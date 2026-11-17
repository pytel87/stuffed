// The Bedroom: a second map, 112 x 112, a kid's room at toy scale. Six areas around a block
// castle in the middle (clockwise from the top left):
//   The Bed (NW)       hide underneath, or climb on via the toy box; high loot underneath
//   The Desk (NE)      climb up by the chair; high loot underneath
//   Toy Corner (SE)    a big open toy box to hide in, crates and drums
//   The Rug (S)        an open rug with laundry piles and beach balls
//   Bookshelf (SW)     long shelves and book piles; low loot
//   Block Castle (C)   alphabet-block walls with doorways and a keep in the middle
// Coordinates: x to the right, y down the screen.
import type { Building, ChestSpawn, Circle, Decor, Ground, MapData, MapZone, TrainTrack, Vec2, Wall, WallKind } from '../types.ts';

const SIZE = 112;
const C = SIZE / 2;

const w =
  (kind: WallKind, height: number) =>
  (x: number, y: number, width: number, depth: number, h = height): Wall => ({ x, y, w: width, h: depth, height: h, kind });

const block = w('block', 2);
const plank = w('plank', 2.4);
const crate = w('crate', 1.1);
const book = w('book', 1.2);
const leg = w('table-leg', 2.2);
const bench = w('bench', 1.2);
const barrel = w('barrel', 1.6);
const bucket = w('bucket', 0.9);
const cardboard = w('cardboard', 1.8);
const ball = w('ball', 1.6);
const pile = (x: number, y: number, radius = 2.2): Circle => ({ center: { x, y }, radius });
const chest = (x: number, y: number, loot: ChestSpawn['loot'] = 'medium'): ChestSpawn => ({ x, y, loot });

// ---------- The Bed (NW) ----------
const BED: Building = { x: 10, y: 10, w: 22, h: 14, height: 2.2, kind: 'bed' };
const bed: Wall[] = [
  w('plank', 3.4)(10, 8.6, 22, 1.4), // headboard
  leg(10.3, 10.3, 0.9, 0.9), leg(30.8, 10.3, 0.9, 0.9), leg(10.3, 22.8, 0.9, 0.9), leg(30.8, 22.8, 0.9, 0.9),
  crate(33, 17, 2.2, 2.2), // a toy box to climb onto the bed
];

// ---------- The Desk (NE) ----------
const DESK: Building = { x: 78, y: 10, w: 20, h: 9, height: 2.6, kind: 'desk' };
const desk: Wall[] = [
  w('table-leg', 2.6)(78.3, 10.3, 0.9, 0.9), w('table-leg', 2.6)(96.8, 10.3, 0.9, 0.9),
  w('table-leg', 2.6)(78.3, 17.8, 0.9, 0.9), w('table-leg', 2.6)(96.8, 17.8, 0.9, 0.9),
  bench(84, 20.5, 3, 3), // the chair: up onto the desk
  book(100.5, 24, 1.6, 5), book(74, 26, 4, 1.6, 0.8),
  barrel(100, 38, 2, 2, 2.4), // a lamp stand
];

// ---------- Block Castle (center) ----------
// A square of alphabet blocks with a doorway in the middle of each side, and a keep (its roof
// at 2.4) in the middle, reached from a crate.
const castle: Wall[] = [];
for (const x of [46, 48, 50, 60, 62, 64]) castle.push(block(x, 46, 2, 2), block(x, 64, 2, 2));
for (const y of [48, 50, 60, 62]) castle.push(block(46, y, 2, 2), block(64, y, 2, 2));
const KEEP: Building = { x: 53, y: 53, w: 6, h: 6, height: 2.4, kind: 'cardboard' };
castle.push(
  block(53, 53, 1, 1, 2.4), block(58, 53, 1, 1, 2.4), block(53, 58, 1, 1, 2.4), block(58, 58, 1, 1, 2.4),
  crate(50.8, 55.3, 1.4, 1.4),
);

// ---------- Toy Corner (SE) ----------
// A big open toy box (cardboard sides, open to the west, a roof at 2.2) and toys around it.
const TOYBOX: Building = { x: 88, y: 88, w: 12, h: 10, height: 2.2, kind: 'cardboard' };
const toys: Wall[] = [
  cardboard(88, 88, 12, 0.6, 2.2), cardboard(88, 97.4, 12, 0.6, 2.2), cardboard(99.4, 88, 0.6, 10, 2.2),
  crate(80, 82, 2, 2), crate(83, 100, 2, 2, 1.4), bucket(96, 80, 1.6, 1.6), bucket(78, 92, 1.6, 1.6), barrel(102, 80, 1.6, 1.6),
];

// ---------- Bookshelf (SW) ----------
const shelf: Wall[] = [
  plank(8, 76, 1, 24), plank(18, 80, 1, 18), plank(28, 92, 10, 1),
  book(11, 82, 2, 1.6), book(12, 94, 1.6, 2, 1.6), book(21.5, 86, 2, 1.6), book(22, 100, 3, 1.6, 0.8), book(32, 84, 1.6, 3),
];

// ---------- The Train ----------
// A big oval track round the castle, through every area; a four-car train runs round it all
// match (see systems/train.ts). Anything that would sit on the rails is moved off below.
const TRACK: TrainTrack = { center: { x: C, y: C }, rx: 34, ry: 31, speed: 4.5, cars: 4 };
/** How close to the rails things may stand. */
const TRACK_CLEAR = 2.4;

// ---------- The Dollhouse (E) ----------
// A little house with a door on the west side; its roof is a lookout (climb from the drum).
const DOLLHOUSE: Building = { x: 93.5, y: 50, w: 11, h: 9, height: 2.6, kind: 'house' };
const dollhouse: Wall[] = [
  w('brick', 2.6)(93.5, 50, 11, 0.6), w('brick', 2.6)(93.5, 58.4, 11, 0.6), w('brick', 2.6)(103.9, 50, 0.6, 9),
  w('brick', 2.6)(93.5, 50, 0.6, 2.8), w('brick', 2.6)(93.5, 56.2, 0.6, 2.8),
  bucket(105, 60, 1.6, 1.6, 1.3), // a toy drum to climb onto the roof from
];

// ---------- Toys all over the floor (cover between the areas) ----------
const scattered: Wall[] = [
  crate(34, 6.5, 2.4, 2.4, 1.6), // the nightstand
  block(38, 44, 2, 2), block(40, 44, 2, 2, 1.2), block(72, 40, 2, 2), block(74.5, 41, 2, 2, 1.2),
  block(36, 66, 2, 2), block(74, 70, 2, 2, 1.4), block(26, 34, 2, 2, 1.4), block(84, 70, 2, 2),
  book(8, 40, 3, 2, 1.4), book(102, 70, 2, 3), book(66, 92, 3, 2, 0.8), book(24, 66, 2, 3),
  bucket(20, 50, 1.6, 1.6), bucket(64, 38, 1.6, 1.6), bucket(30, 104, 1.6, 1.6),
  cardboard(70, 100, 5, 0.6), cardboard(74.4, 100, 0.6, 5), crate(80, 104, 2, 2),
];

// ---------- The Rug (S) ----------
const RUG = { x: 38, y: 74, w: 26, h: 22 };
const rugToys: Wall[] = [ball(44, 80, 1.6, 1.6), ball(56, 88, 1.6, 1.6)];

/** Distance from a box to the track's oval (sampled). */
function boxToTrack(b: { x: number; y: number; w: number; h: number }): number {
  let best = Infinity;
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    const px = TRACK.center.x + Math.cos(a) * TRACK.rx;
    const py = TRACK.center.y + Math.sin(a) * TRACK.ry;
    const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
    const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}
const clearOfTrack = (b: { x: number; y: number; w: number; h: number }) => boxToTrack(b) >= TRACK_CLEAR;
/** Nudges a point straight out from (or in toward) the oval until it's clear of the rails. */
function offTrack<P extends Vec2>(p: P, margin: number): P {
  const k = Math.hypot((p.x - TRACK.center.x) / TRACK.rx, (p.y - TRACK.center.y) / TRACK.ry) || 1;
  const box = (q: Vec2) => ({ x: q.x - margin, y: q.y - margin, w: margin * 2, h: margin * 2 });
  if (clearOfTrack(box(p))) return p;
  for (let step = 0.5; step < 12; step += 0.5) {
    const s = k >= 1 ? 1 + step / Math.min(TRACK.rx, TRACK.ry) : 1 - step / Math.min(TRACK.rx, TRACK.ry);
    const q = { ...p, x: TRACK.center.x + (p.x - TRACK.center.x) * (s / 1), y: TRACK.center.y + (p.y - TRACK.center.y) * (s / 1) };
    if (clearOfTrack(box(q))) return q;
  }
  return p;
}

// Small toys that would sit on the rails are left out; the big furniture is placed clear.
const walls: Wall[] = [...bed, ...desk, ...castle, ...toys, ...shelf, ...dollhouse, ...[...rugToys, ...scattered].filter(clearOfTrack)];
const buildings: Building[] = [BED, DESK, KEEP, TOYBOX, DOLLHOUSE];

const bushes: Circle[] = ([
  // laundry piles: hide in them
  pile(42, 88, 2.2), pile(60, 80, 2.2), pile(30, 58, 2.2), pile(82, 58, 2.4), pile(70, 34, 2.2), pile(40, 36, 2),
  pile(88, 44, 2.2), pile(68, 102, 2.4), pile(22, 42, 2.2), pile(104, 62, 2.2), pile(14, 64, 2), pile(50, 104, 2),
] as Circle[]).map((c) => ({ ...c, center: offTrack(c.center, c.radius) }));

const chestSpawns: ChestSpawn[] = ([
  // under the bed and the desk, in the castle keep and the toy box
  chest(16, 17, 'high'), chest(26, 17, 'high'), chest(84, 14.5, 'high'), chest(93, 14.5, 'high'), chest(56, 56, 'high'), chest(94, 93, 'high'), chest(99, 54.5, 'high'),
  // castle yard
  chest(49.5, 60.5), chest(61.5, 49.5),
  // bookshelf
  chest(13, 86, 'low'), chest(23, 92, 'low'), chest(13, 100, 'low'),
  // rug and toys
  chest(50, 84), chest(86, 86), chest(104, 100, 'low'),
  // the floor
  chest(56, 30), chest(30, 56, 'low'), chest(82, 56), chest(56, 70), chest(36, 30, 'low'), chest(76, 34), chest(34, 76),
  chest(78, 76, 'low'), chest(8, 56, 'low'), chest(107.5, 45, 'low'), chest(56, 8, 'low'), chest(56, 106, 'low'), chest(104, 106, 'low'), chest(8, 106, 'low'),
] as ChestSpawn[]).map((c) => offTrack(c, 0.9));

// Floor clutter, just for looks.
const decor: Decor[] = [{ kind: 'track', x: TRACK.center.x, y: TRACK.center.y, rx: TRACK.rx, ry: TRACK.ry }];
{
  // Spread with a fixed pattern (the same every match), kept off furniture.
  const kinds: Decor['kind'][] = ['crayon', 'paper', 'sock', 'puzzle', 'marbles', 'car', 'crayon', 'crayon'];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90 && decor.length < 60; i++) {
    const p = { x: 6 + rand() * (SIZE - 12), y: 6 + rand() * (SIZE - 12) };
    const turn = rand() * Math.PI * 2;
    const kind = kinds[i % kinds.length]!;
    const clear = [...walls, ...buildings].every((b) => p.x < b.x - 1.2 || p.x > b.x + b.w + 1.2 || p.y < b.y - 1.2 || p.y > b.y + b.h + 1.2);
    const onTrack = !clearOfTrack({ x: p.x - 0.8, y: p.y - 0.8, w: 1.6, h: 1.6 });
    if (clear && !onTrack) decor.push({ kind, x: p.x, y: p.y, turn });
  }
}

const grounds: Ground[] = [{ kind: 'rug', box: RUG }, { kind: 'rug', box: { x: 49, y: 49, w: 14, h: 14 } }];

const zones: MapZone[] = [
  { name: 'The Bed', center: { x: 21, y: 17 }, radius: 13 },
  { name: 'The Desk', center: { x: 88, y: 16 }, radius: 12 },
  { name: 'Toy Corner', center: { x: 92, y: 90 }, radius: 14 },
  { name: 'The Rug', center: { x: 51, y: 85 }, radius: 13 },
  { name: 'Bookshelf', center: { x: 18, y: 90 }, radius: 14 },
  { name: 'Block Castle', center: { x: C, y: C }, radius: 12 },
  { name: 'Dollhouse', center: { x: 99, y: 54 }, radius: 9 },
];

/** True if a plush could stand here: inside the map and clear of walls and roofs (with a margin). */
function clearSpot(p: Vec2, margin: number): boolean {
  if (p.x < 3 || p.y < 3 || p.x > SIZE - 3 || p.y > SIZE - 3) return false;
  const off = (b: { x: number; y: number; w: number; h: number }) => p.x < b.x - margin || p.x > b.x + b.w + margin || p.y < b.y - margin || p.y > b.y + b.h + margin;
  return walls.every(off) && buildings.every(off) && clearOfTrack({ x: p.x - margin, y: p.y - margin, w: margin * 2, h: margin * 2 });
}

/** `count` spawns on a ring; any that land on something slide along the ring until clear. */
function ringSpawns(count: number, radius: number, offsetDegrees: number): Vec2[] {
  const spawns: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const base = (i / count) * Math.PI * 2 + (offsetDegrees * Math.PI) / 180;
    for (let k = 0; k < 60; k++) {
      const a = base + (((k % 2 ? 1 : -1) * Math.ceil(k / 2)) * Math.PI) / 180;
      const r = k < 40 ? radius : radius - 4;
      const p = { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
      if (clearSpot(p, 1.2) && spawns.every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 6)) {
        spawns.push(p);
        break;
      }
    }
  }
  return spawns;
}

export const BEDROOM: MapData = {
  id: 'bedroom',
  theme: 'bedroom',
  width: SIZE,
  height: SIZE,
  walls,
  bushes,
  buildings,
  spawns: [...ringSpawns(16, 44, 11), ...ringSpawns(8, 26, 33)],
  chestSpawns,
  grounds,
  zones,
  decor,
  track: TRACK,
};
