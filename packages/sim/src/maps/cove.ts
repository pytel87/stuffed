// Pirate Cove: a fourth map, 130 x 130, a lagoon of islands. Everywhere off the islands is
// shallow sea to wade through (slowly); a current slaloms round the map between the isles, a
// quick but exposed way round.
//   Treasure Island (C)   the big island; high loot among crates and casks, the parrot piñata
//   Four big isles        on the diagonals, each with its own landmark (and buried treasure):
//     Volcano Isle (NW)   a stepped volcano to climb, lava on it, a chest on its summit
//     Coconut Isle (NE)   two huts
//     Waterfall Isle (SE) a cliff to climb, a waterfall into a pond, a secret cave behind it
//     the Shipwreck (SW)  an old wreck to hide in, a cannon on its deck (the cannonball strike)
//   Four small isles      a lighthouse (N), Skull Rock with a cave (E), a hut (S), and Rocky
//                         Isle (W) with a lookout rock to climb
//   The current           weaves in and out between the big and small isles, all the way round
//   The pirate ship       sails round Treasure Island, against the current
//   Catapults             one on each small isle; a zip line from Rocky Isle to the Shipwreck
//   Four sharks           cruise the sea: they chase and bite anyone wading near
//   Rocks, sunken treasure out in the lagoon between them
// Coordinates: x to the right, y down the screen.
import { ringPath } from '../systems/currents.ts';
import { catapult } from '../systems/rides.ts';
import type { Building, ChestSpawn, Circle, Current, Island, Lava, MapData, MapZone, RideDef, TrainTrack, Vec2, Wall, WallKind } from '../types.ts';

const SIZE = 130;
const C = SIZE / 2;

const w =
  (kind: WallKind, height: number) =>
  (x: number, y: number, width: number, depth: number, h = height): Wall => ({ x, y, w: width, h: depth, height: h, kind });
const crate = w('crate', 1.2);
const cask = (x: number, y: number): Wall => ({ x: x - 0.7, y: y - 0.7, w: 1.4, h: 1.4, height: 1.3, kind: 'cask' });
const rock = w('rock', 1);
/** A palm standing on its own: just its trunk (no bush to hide in). */
const palm = (x: number, y: number): Wall => ({ x: x - 0.35, y: y - 0.35, w: 0.7, h: 0.7, height: 5, kind: 'palm' });
/** Somewhere to hide: a tropical bush (some with a palm growing out of it; the client picks). */
const bush = (x: number, y: number, radius = 2.4): Circle => ({ center: { x, y }, radius });
const chest = (x: number, y: number, loot: ChestSpawn['loot'] = 'medium'): ChestSpawn => ({ x, y, loot });
const isle = (x: number, y: number, radius: number, look?: Island['look']): Island => ({ center: { x, y }, radius, ...(look ? { look } : {}) });
const around = (angle: number, r: number): Vec2 => ({ x: C + Math.cos(angle) * r, y: C + Math.sin(angle) * r });
const deg = (d: number) => (d * Math.PI) / 180;

// The big isles on the diagonals, the small ones on the axes (nearer in): the current swings out
// round the small ones and in past the big ones.
const BIG = 55 / Math.SQRT2;
const TREASURE = isle(C, C, 19);
const ISLES = {
  nw: isle(C - BIG, C - BIG, 15),
  ne: isle(C + BIG, C - BIG, 15),
  se: isle(C + BIG, C + BIG, 15),
  sw: isle(C - BIG, C + BIG, 15),
  n: isle(C, C - 38, 11),
  e: isle(C + 38, C, 11),
  s: isle(C, C + 38, 11),
  w: isle(C - 38, C, 11, 'rock'),
};
const islands: Island[] = [TREASURE, ...Object.values(ISLES)];

// The current: a loop round the map, swinging out round the small isles (r 54 on the axes) and in
// past the big ones (r 34 on the diagonals), clockwise on screen.
const currents: Current[] = [{ path: ringPath(C, C, 44, 128, true, { lobes: 4, amount: 10 }), width: 6, speed: 7, loop: true }];

// The pirate ship sails round Treasure Island the other way, between it (out to 19) and the small
// isles (from 27): jump aboard from the water and ride its deck (see systems/train.ts, SHIP).
const SHIP_ROUTE: TrainTrack = { center: { x: C, y: C }, rx: 23.5, ry: 23.5, speed: -4, cars: 1, style: 'ship' };

// ---------- Treasure Island ----------
const walls: Wall[] = [
  crate(C - 6, C - 7, 2, 2), crate(C + 4.5, C - 6.5, 2, 2), crate(C - 7.5, C + 4.5, 2, 2), crate(C + 5, C + 5, 2, 2),
  crate(C - 1, C - 12.5, 2, 1.4, 0.9), crate(C - 1, C + 11, 2, 1.4, 0.9),
  cask(C - 11, C), cask(C + 11, C), cask(C + 2, C - 8), cask(C - 3, C + 8),
  palm(C + 14.5, C + 3), palm(C - 14.5, C - 3), palm(C + 2, C + 16),
];
const bushes: Circle[] = [bush(C - 11, C - 10), bush(C + 11, C + 10), bush(C + 10, C - 11), bush(C - 10, C + 11)];
const chestSpawns: ChestSpawn[] = [
  chest(C, C, 'high'), chest(C - 7, C - 1, 'medium'), chest(C + 7, C + 1, 'medium'), chest(C, C - 15.5, 'low'),
  // By the parrot piñata, and out on the beaches.
  chest(C - 5, C + 14.5, 'high'), chest(C - 14, C + 6, 'medium'), chest(C + 14, C - 8, 'low'),
];
// A rowboat pulled up on its east beach.
const rowboat = w('rowboat', 0.8);
walls.push(rowboat(C + 15.5, C - 5, 1.4, 3.2));
// The parrot piñata hangs off the spar of a broken mast stuck in the sand.
const MAST = { x: C + 6.4, y: C + 11.9, w: 1.2, h: 1.2 };
walls.push(w('mast', 4.4)(MAST.x, MAST.y, MAST.w, MAST.h));

/** A little plank hut: walls round its box with a doorway in the middle of its south side (2
 *  wide), a thatched roof on top. */
function hut(x: number, y: number, width: number, depth: number, height: number): Building {
  const plank = w('plank', height);
  const side = (width - 2) / 2;
  walls.push(
    plank(x, y, width, 0.5), plank(x, y, 0.5, depth), plank(x + width - 0.5, y, 0.5, depth),
    plank(x, y + depth - 0.5, side, 0.5), plank(x + width - side, y + depth - 0.5, side, 0.5),
  );
  return { x, y, w: width, h: depth, height, kind: 'hut' };
}
const digs: Vec2[] = [];

// ---------- Volcano Isle (NW): a stepped volcano to climb, a chest on its smoking summit ----------
const NW = ISLES.nw.center;
// Three tiers, each a square and a cross of blocks round the middle (a chunky, roundish step).
const volcano = w('volcano', 1.1);
for (const [r, h] of [[6.2, 1.1], [4.2, 2.2], [2.3, 3.3]] as const) {
  const s = r * 0.71;
  const arm = r * 0.42;
  walls.push(volcano(NW.x - s, NW.y - s, s * 2, s * 2, h), volcano(NW.x - r, NW.y - arm, r * 2, arm * 2, h), volcano(NW.x - arm, NW.y - r, arm * 2, r * 2, h));
}
walls.push(palm(NW.x + 8, NW.y + 1), palm(NW.x - 2, NW.y + 9.5), palm(NW.x - 9.5, NW.y - 3));
// (The summit is a building only so its chest stands up there.)
// Lava: a pool on the summit round a little island (the chest's), and streams across each ledge
// down the south, east and west arms (the client draws them down the faces too).
// (The island is big enough to stand on beside the chest.)
const lava: Lava[] = [{ kind: 'pool', center: NW, radius: 1.8, island: 1.35, z: 3.3 }];
for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0]] as const) {
  for (const [r0, r1, z] of [[2.3, 4.2, 2.2], [4.2, 6.2, 1.1]] as const) {
    lava.push({ kind: 'stream', from: { x: NW.x + dx * r0, y: NW.y + dy * r0 }, to: { x: NW.x + dx * r1, y: NW.y + dy * r1 }, width: 0.8, z });
  }
}
const SUMMIT: Building = { x: NW.x - 1.63, y: NW.y - 1.63, w: 3.26, h: 3.26, height: 3.3, kind: 'volcano' };
bushes.push(bush(NW.x - 9, NW.y + 5, 2.2), bush(NW.x + 9, NW.y - 5, 2.2));
chestSpawns.push({ ...chest(NW.x, NW.y, 'high'), roof: true }, chest(NW.x + 1, NW.y + 8, 'medium'), chest(NW.x - 8, NW.y + 8.5, 'low'), chest(NW.x - 3, NW.y - 9, 'low'));
digs.push({ x: NW.x + 7.5, y: NW.y + 7.5 });

// ---------- Coconut Isle (NE): two huts ----------
// The big one has a chest inside and a crate by its south-east corner to climb onto its roof.
const NE = ISLES.ne.center;
const HUT = hut(NE.x - 5.5, NE.y - 5, 7, 6, 2.6);
const HUT2 = hut(NE.x + 3, NE.y + 2, 5, 4.5, 2.4);
walls.push(crate(HUT.x + HUT.w + 0.3, HUT.y + 4.2, 1.6, 1.6, 1.2), cask(NE.x + 6, NE.y - 7), palm(NE.x + 9.5, NE.y + 3), palm(NE.x - 9, NE.y + 5.5));
walls.push(rowboat(NE.x + 10, NE.y - 6, 1.4, 3.2));
bushes.push(bush(NE.x - 5, NE.y - 8), bush(NE.x + 7, NE.y - 2));
chestSpawns.push(chest(HUT.x + 3.5, HUT.y + 2.5, 'high'), chest(HUT2.x + 2.5, HUT2.y + 2, 'medium'), chest(NE.x + 1, NE.y + 7.5, 'medium'), chest(NE.x - 7, NE.y + 3, 'low'), chest(NE.x + 3, NE.y - 9, 'low'));
digs.push({ x: NE.x + 6.5, y: NE.y + 8 });

// ---------- Waterfall Isle (SE): a cliff (climbed from a rock and a ledge) with a waterfall down its
// south face into a pond at its foot (wading there). The cliff is hollow: behind the falling water
// a low archway leads into a secret cave, a high chest inside. ----------
const SE = ISLES.se.center;
const cliff = w('cliff', 3.3);
const CAVE: Building = { x: SE.x - 2, y: SE.y - 9, w: 10, h: 4, height: 3.3, kind: 'cave' };
const caveRock = w('cave', 3.3);
walls.push(
  // The rock round the cave: solid to its west and east, a back wall, and the front either side of
  // the archway (2 wide, under the waterfall).
  caveRock(CAVE.x, CAVE.y, 3.5, 4), caveRock(CAVE.x + 8.5, CAVE.y, 1.5, 4), caveRock(CAVE.x + 3.5, CAVE.y, 5, 0.6),
  caveRock(CAVE.x + 3.5, CAVE.y + 3.4, 1.5, 0.6), caveRock(CAVE.x + 7, CAVE.y + 3.4, 1.5, 0.6),
  cliff(SE.x - 5, SE.y - 8, 3.1, 3, 2.2), rock(SE.x - 7.6, SE.y - 6.4, 2.4, 2.2, 1.1),
  crate(SE.x - 1, SE.y + 3, 2, 2), cask(SE.x + 9, SE.y - 6),
  palm(SE.x + 10, SE.y - 1), palm(SE.x - 9, SE.y + 5.5), palm(SE.x + 1, SE.y + 10),
);
const POND: Circle = { center: { x: SE.x + 4, y: SE.y - 2.6 }, radius: 2.4 };
const WATERFALL = { x: SE.x + 4, y: SE.y - 5, height: 3.3 };
bushes.push(bush(SE.x - 4, SE.y + 1), bush(SE.x + 9, SE.y + 6, 2.2));
chestSpawns.push(chest(SE.x + 3, SE.y + 6, 'medium'), chest(SE.x - 8, SE.y - 1, 'low'), chest(SE.x + 4, SE.y - 7.2, 'high'), chest(SE.x - 5, SE.y + 8, 'low'));
digs.push({ x: SE.x + 6.5, y: SE.y + 9 });

// ---------- the Shipwreck (SW) ----------
// An old ship run aground: its hull is a building to hide in (a high chest inside), the way in a
// hole in its south side and its broken-off bow at the east end. A crate by the bow climbs onto
// its deck, where the cannon's button is (it calls the cannonballs).
const SW = ISLES.sw.center;
const WRECK: Building = { x: SW.x - 6.5, y: SW.y - 3.4, w: 13, h: 6.5, height: 2.4, kind: 'wreck' };
const hull = w('hull', 2.4);
walls.push(
  hull(WRECK.x, WRECK.y, WRECK.w, 0.5),
  hull(WRECK.x, WRECK.y + WRECK.h - 0.5, 5, 0.5), hull(WRECK.x + 8, WRECK.y + WRECK.h - 0.5, 5, 0.5),
  hull(WRECK.x, WRECK.y, 0.5, WRECK.h),
  crate(WRECK.x + WRECK.w + 0.6, WRECK.y + 1, 1.8, 1.8, 1.2),
  palm(SW.x + 7, SW.y - 7.5), palm(SW.x - 11, SW.y + 3),
);
bushes.push(bush(SW.x - 5, SW.y - 8), bush(SW.x + 8.5, SW.y + 7.5, 2.2));
chestSpawns.push(
  chest(WRECK.x + 4, WRECK.y + WRECK.h / 2, 'high'), chest(SW.x - 7, SW.y + 7, 'low'), chest(SW.x + 4, SW.y + 6.5, 'medium'),
  // Up on its deck, by the cannon's button.
  { ...chest(SW.x + 3.5, SW.y - 1.5, 'high'), roof: true },
);

// ---------- Lighthouse Isle (N): a striped lighthouse, nowhere to land on top; go up inside it
// from its door for a lookout (see the rides below) ----------
const N = ISLES.n.center;
// (Its pointed roof is no floor: nobody stands on top of it.)
walls.push({ ...w('lighthouse', 7)(N.x - 1.4, N.y - 1.4, 2.8, 2.8), noTop: true }, cask(N.x + 3, N.y - 2), palm(N.x + 4.5, N.y + 4), palm(N.x - 5.5, N.y + 2.5));
bushes.push(bush(N.x - 5, N.y - 3, 2));
// (Off to the side of the lighthouse's door: right in front of it, its prompt hid the door's.)
chestSpawns.push(chest(N.x - 3, N.y + 5, 'medium'), chest(N.x + 2, N.y + 7.5, 'low'));

// ---------- Skull Rock (E): a skull-shaped rock with a cave inside, its open jaw the way in (south) ----------
const E = ISLES.e.center;
/** The middle of its dome, and the dome's half-width and half-depth where it meets the sand. */
const SKULL_MID = { x: E.x, y: E.y + 1.25 };
const SKULL_A = 4.85;
const SKULL_C = 4.1;
// The cave (where you're hidden): a box inside the dome, its corners in reach of nobody outside.
const SKULL: Building = { x: SKULL_MID.x - 3.8, y: SKULL_MID.y - 3.2, w: 7.6, h: 6.4, height: 4.2, kind: 'skull' };
walls.push(...skullShell(), cask(E.x + 5.6, E.y + 6.4), palm(E.x + 5.5, E.y - 6.5), palm(E.x - 6.5, E.y + 6.5));

/**
 * The dome's shell as strips side by side, stepping round its oval (a box with corners stood out
 * past the dome, an invisible wall), and open on the south for the jaw (3.6 wide).
 */
function skullShell(): Wall[] {
  const outer = (x: number) => SKULL_C * Math.sqrt(Math.max(0, 1 - (x / SKULL_A) ** 2));
  // (The inside of the shell: an oval in from the dome's by 1.2.)
  const inner = (x: number) => (SKULL_C - 1.2) * Math.sqrt(Math.max(0, 1 - (x / (SKULL_A - 1.2)) ** 2));
  const edges = [0, 0.9, 1.8, 2.4, 3, 3.5, 4, 4.4, 4.75];
  const strips: Wall[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const near = edges[i]!;
    const far = edges[i + 1]!;
    // Each strip only as tall as the dome at its outer edge (never past it), and thick enough on
    // the inside to overlap the next strip's (no gaps between them).
    const top = outer(far);
    const bottom = inner(far);
    for (const side of [-1, 1]) {
      const x = side < 0 ? SKULL_MID.x - far : SKULL_MID.x + near;
      const piece = (y0: number, y1: number): Wall => ({ x, y: SKULL_MID.y + y0, w: far - near, h: y1 - y0, height: 4.2, kind: 'skull' });
      if (bottom <= 0) strips.push(piece(-top, top));
      else {
        strips.push(piece(-top, -bottom));
        if (far > 1.8) strips.push(piece(bottom, top));
      }
    }
  }
  return strips;
}
bushes.push(bush(E.x - 7.2, E.y - 4.5, 1.6));
chestSpawns.push(chest(E.x, E.y + 0.5, 'high'), chest(E.x - 7, E.y + 1.5, 'low'));

// ---------- Palm Isle (S): a hut among the palms ----------
const S = ISLES.s.center;
const HUT3 = hut(S.x - 2.5, S.y - 1, 5, 4.5, 2.4);
walls.push(cask(S.x + 5, S.y - 3), palm(S.x + 4.5, S.y + 4.5), palm(S.x - 5.5, S.y + 2.5), rowboat(S.x + 3, S.y - 8.5, 3.2, 1.4));
bushes.push(bush(S.x - 4, S.y - 4, 2));
chestSpawns.push(chest(S.x, S.y + 1.2, 'high'), chest(S.x - 1, S.y + 7, 'low'));

// Rocky Isle: boulders, and a big lookout rock climbed from a smaller one beside it.
const W = ISLES.w.center;
walls.push(
  rock(W.x - 2.5, W.y - 3, 4, 3.5, 2.2), rock(W.x + 1.8, W.y - 1.2, 1.8, 1.6, 1.1),
  rock(W.x - 7, W.y + 2.5, 2.2, 2, 1.2), rock(W.x + 3.5, W.y + 5, 2, 1.6, 1), rock(W.x - 1, W.y - 8, 1.8, 1.6, 0.9),
);
bushes.push(bush(W.x + 5, W.y - 5, 1.8));
chestSpawns.push(chest(W.x + 1, W.y + 3.5, 'medium'), chest(W.x - 4, W.y - 5, 'high'));

// ---------- catapults: one on each small isle, flinging toward Treasure Island ----------
const CATAPULTS = [
  // (Beside the lighthouse, not behind it, where the camera couldn't see it.)
  catapult({ x: ISLES.n.center.x + 6, y: ISLES.n.center.y - 1 }, { x: C, y: C }),
  catapult({ x: ISLES.e.center.x, y: ISLES.e.center.y - 5 }, { x: C, y: C }),
  catapult({ x: ISLES.s.center.x, y: ISLES.s.center.y - 5 }, { x: C, y: C }),
  catapult({ x: W.x + 5.5, y: W.y + 1 }, { x: C, y: C }),
];
walls.push(...CATAPULTS.map((c) => c.wall));

// ---------- a zip line between the lookout rock on Rocky Isle and the Shipwreck's deck (both ways) ----------
const LOOKOUT = { x: W.x - 0.5, y: W.y - 1.25, z: 2.2 };
const WRECK_DECK = { x: WRECK.x + 6, y: WRECK.y + 1.1, z: WRECK.height };
const rides: RideDef[] = [
  { kind: 'zip', from: LOOKOUT, to: WRECK_DECK, seconds: 3.5, boost: 3 },
  { kind: 'zip', from: WRECK_DECK, to: LOOKOUT, seconds: 3.5, boost: 3 },
  // Up the lighthouse from its door (south): a while in the lamp room, unseen, seeing far.
  { kind: 'lookout', from: { x: N.x, y: N.y + 2, z: 0 }, to: { x: N.x, y: N.y, z: 7.4 }, seconds: 10, boost: 0 },
  ...CATAPULTS.map((c) => c.ride),
];

// ---------- sunken treasure: out in the lagoon between the isles (dig it up wading, slow and in
// the open, with the sharks about), clear of the current and the ship's way round ----------
for (const d of [22.5, 112.5, 202.5, 292.5]) digs.push(around(deg(d), 31));

// ---------- rocks out in the lagoon, between the isles: cover (and somewhere dry) in open water ----------
for (const d of [67.5, 157.5, 247.5, 337.5]) {
  const p = around(deg(d), 30);
  walls.push(rock(p.x - 1, p.y - 0.9, 2, 1.8), rock(p.x + 0.8, p.y + 0.6, 1.4, 1.2, 0.7));
}

const zones: MapZone[] = [
  { name: 'Treasure Island', center: { x: C, y: C }, radius: 19 },
  { name: 'Volcano Isle', center: NW, radius: 15 },
  { name: 'Coconut Isle', center: NE, radius: 15 },
  { name: 'Waterfall Isle', center: SE, radius: 15 },
  { name: 'The Shipwreck', center: SW, radius: 15 },
  { name: 'Lighthouse Isle', center: N, radius: 11 },
  { name: 'Skull Rock', center: E, radius: 11 },
  { name: 'Palm Isle', center: S, radius: 11 },
  { name: 'Rocky Isle', center: W, radius: 11 },
  { name: 'The Current', center: around(0, 54), radius: 4 },
];

const buildings: Building[] = [WRECK, HUT, HUT2, HUT3, SKULL, SUMMIT, CAVE];

/** Spawn points: round the edge of every isle, clear of its walls, buildings and the pond. */
function islandSpawns(): Vec2[] {
  const out: Vec2[] = [];
  for (const island of islands) {
    const n = island === TREASURE ? 6 : 2;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 24; k++) {
        const a = ((i + k / 24) / n) * Math.PI * 2;
        const p = { x: island.center.x + Math.cos(a) * island.radius * 0.6, y: island.center.y + Math.sin(a) * island.radius * 0.6 };
        const clear =
          [...walls, ...buildings].every((b) => p.x < b.x - 1 || p.x > b.x + b.w + 1 || p.y < b.y - 1 || p.y > b.y + b.h + 1) &&
          Math.hypot(p.x - POND.center.x, p.y - POND.center.y) > POND.radius + 1;
        if (clear) {
          out.push(p);
          break;
        }
      }
    }
  }
  return out;
}

export const COVE: MapData = {
  id: 'cove',
  theme: 'island',
  width: SIZE,
  height: SIZE,
  walls,
  bushes,
  buildings,
  lava,
  pools: [POND],
  decor: [{ kind: 'waterfall', x: WATERFALL.x, y: WATERFALL.y, rx: WATERFALL.height }],
  rides,
  spawns: islandSpawns(),
  chestSpawns,
  islands,
  currents,
  zones,
  track: SHIP_ROUTE,
  digs,
  // Four sharks cruising the sea, one from each corner.
  wanderers: [
    { kind: 'shark', x: 6, y: 6 },
    { kind: 'shark', x: SIZE - 6, y: SIZE - 6 },
    { kind: 'shark', x: SIZE - 6, y: 6 },
    { kind: 'shark', x: 6, y: SIZE - 6 },
  ],
  strikeButton: { x: WRECK.x + 2, y: WRECK.y + WRECK.h / 2, z: WRECK.height, kind: 'cannonballs' },
  pinata: { x: C + 4.6, y: MAST.y + MAST.h / 2, z: 0, kind: 'parrot', branch: { x: MAST.x + MAST.w / 2, y: MAST.y + MAST.h / 2, z: 3.9 } },
};
