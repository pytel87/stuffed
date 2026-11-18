// The Snowy Park: a third map, 120 x 120, a park in winter at toy scale. Seven areas round a
// frozen pond in the middle (clockwise from the top left):
//   Pine Forest (NW)      dense pines to hide in, fallen logs; low and medium loot
//   Snowball Alley (N)    rows of low snow walls (jump them) for snowball fights
//   Snow Fort (NE)        a square fort of snow with towers and doorways; high loot inside
//   Log Cabin (SE)        a cabin with a door on the west; climb the woodpile onto the roof
//   Gift Market (S)       stacks of gift boxes; a tall gift tower to climb
//   Snowman Garden (SW)   snowmen, lamp posts and benches
//   Frozen Pond (C)       slippery ice (you slide) with ice blocks for cover; high loot in the middle
// Coordinates: x to the right, y down the screen.
import type { Building, ChestSpawn, Circle, Decor, MapData, MapZone, Vec2, Wall, WallKind } from '../types.ts';

const SIZE = 120;
const C = SIZE / 2;

const w =
  (kind: WallKind, height: number) =>
  (x: number, y: number, width: number, depth: number, h = height): Wall => ({ x, y, w: width, h: depth, height: h, kind });

const snowman = (x: number, y: number): Wall => ({ x: x - 0.9, y: y - 0.9, w: 1.8, h: 1.8, height: 2.4, kind: 'snowman' });
const gift = w('gift', 1.2);
const snowwall = w('snowwall', 1.1);
const iceblock = w('iceblock', 1.3);
const log = w('log', 0.8);
const crate = w('crate', 1.2);
const bench = w('bench', 1);
const lamppost = (x: number, y: number): Wall => ({ x: x - 0.25, y: y - 0.25, w: 0.5, h: 0.5, height: 3.2, kind: 'lamppost' });
const pine = (x: number, y: number, radius = 2.3): Circle => ({ center: { x, y }, radius });
const chest = (x: number, y: number, loot: ChestSpawn['loot'] = 'medium'): ChestSpawn => ({ x, y, loot });

// ---------- Frozen Pond (center) ----------
const POND: Circle = { center: { x: C, y: C }, radius: 14 };
const pond: Wall[] = [
  iceblock(50, 53, 2, 2), iceblock(68, 51, 2, 2), iceblock(52, 67, 2, 2), iceblock(67.5, 66, 2, 2),
  iceblock(59, 48, 2, 1.4, 1), iceblock(59, 70.5, 2, 1.4, 1),
];

// ---------- Pine Forest (NW) ----------
const forest: Wall[] = [log(10, 26, 6, 1.2), log(26, 12, 1.2, 6), log(30, 32, 5, 1.2), log(16, 38, 1.2, 4)];

// ---------- Snowball Alley (N) ----------
const alley: Wall[] = [];
for (const [x, y] of [[44, 10], [56, 10], [68, 10], [50, 18], [62, 18], [44, 26], [56, 26], [68, 26]] as const) alley.push(snowwall(x, y, 6, 1.2));

// ---------- Snow Fort (NE) ----------
// An 18 x 18 square of snow walls (1.6 tall: climb them from the towers' steps) with a doorway
// in the middle of each side, and a tower in each corner.
const FX = 86;
const FY = 10;
const fort: Wall[] = [];
for (const [x, y, ww, hh] of [
  [FX + 2, FY, 6, 1.2], [FX + 10, FY, 6, 1.2], [FX + 2, FY + 16.8, 6, 1.2], [FX + 10, FY + 16.8, 6, 1.2],
  [FX, FY + 2, 1.2, 6], [FX, FY + 10, 1.2, 6], [FX + 16.8, FY + 2, 1.2, 6], [FX + 16.8, FY + 10, 1.2, 6],
] as const) fort.push(snowwall(x, y, ww, hh, 1.6));
for (const [x, y] of [[FX - 0.5, FY - 0.5], [FX + 16, FY - 0.5], [FX - 0.5, FY + 16], [FX + 16, FY + 16]] as const) fort.push(snowwall(x, y, 2.5, 2.5, 2.6));
fort.push(snowwall(FX + 7, FY + 7, 4, 4, 1.2)); // a snow pile in the yard

// ---------- Log Cabin (SE) ----------
// A cabin with a door in its west wall; its snowy roof (2.8) is reached from the woodpile.
const CABIN: Building = { x: 88, y: 86, w: 14, h: 11, height: 2.8, kind: 'cabin' };
const LOG_WALL = w('log', 2.8);
const cabin: Wall[] = [
  LOG_WALL(88, 86, 14, 0.7), LOG_WALL(88, 96.3, 14, 0.7), LOG_WALL(101.3, 86, 0.7, 11),
  LOG_WALL(88, 86, 0.7, 3.5), LOG_WALL(88, 93.5, 0.7, 3.5),
  crate(103, 90, 2, 3, 1.4), // the woodpile: up onto the roof
  log(84, 100, 5, 1.2), log(104, 100, 1.2, 4),
];

// ---------- Gift Market (S) ----------
const market: Wall[] = [
  gift(44, 100, 2, 2), gift(47, 101, 1.6, 1.6, 0.9), gift(52, 106, 2.4, 2.4, 1.6), gift(64, 104, 2, 2),
  gift(67, 100, 1.4, 1.4, 0.8), gift(72, 106, 2.4, 2, 1.4), gift(58, 96, 1.6, 1.6, 0.9),
  // The gift tower: three steps up to a lookout.
  gift(58.5, 108, 3, 3, 1), gift(61.5, 108.3, 2.4, 2.4, 2), gift(64, 108.6, 1.8, 1.8, 3),
];

// ---------- Snowman Garden (SW) ----------
const garden: Wall[] = [
  snowman(14, 86), snowman(24, 96), snowman(32, 84), snowman(16, 104),
  lamppost(20, 80), lamppost(30, 104), lamppost(8, 96),
  bench(22, 88, 4, 1.2), bench(34, 96, 1.2, 4),
];

// ---------- Scattered cover between the areas ----------
const scattered: Wall[] = [
  snowman(40, 40), snowman(82, 42), snowman(38, 80), snowman(84, 78),
  iceblock(8, 56, 2, 2), iceblock(110, 58, 2, 2), iceblock(104, 46, 2, 2, 1), iceblock(14, 66, 2, 2, 1),
  gift(78, 60, 2, 2), gift(40, 62, 2, 2, 0.9), snowwall(20, 50, 5, 1.2), snowwall(92, 63, 5, 1.2),
  log(70, 38, 5, 1.2), log(46, 82, 5, 1.2), lamppost(60, 34), lamppost(60, 86), lamppost(34, 60), lamppost(86, 60),
];

// ---------- Igloos ----------
// A ring of snow blocks with a doorway, under a dome (a roof you can't climb: it hides who's
// inside). Each has a high-loot chest in the middle.
const IGLOO_R = 3.6;
function igloo(cx: number, cy: number, door: number): { walls: Wall[]; building: Building } {
  const walls: Wall[] = [];
  const n = Math.ceil((2 * Math.PI * IGLOO_R) / 0.9);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const off = Math.atan2(Math.sin(a - door), Math.cos(a - door));
    if (Math.abs(off) < 0.62) continue; // the doorway (wide enough to walk in easily)
    walls.push({ x: cx + Math.cos(a) * IGLOO_R - 0.5, y: cy + Math.sin(a) * IGLOO_R - 0.5, w: 1, h: 1, height: 2, kind: 'igloo' });
  }
  const half = IGLOO_R - 0.5;
  return { walls, building: { x: cx - half, y: cy - half, w: half * 2, h: half * 2, height: 2, kind: 'igloo' } };
}
const IGLOOS = [igloo(106, 38, Math.PI), igloo(10, 50, 0), igloo(100, 72, Math.PI)];

const walls: Wall[] = [...IGLOOS.flatMap((i) => i.walls), ...pond, ...forest, ...alley, ...fort, ...cabin, ...market, ...garden, ...scattered];
const buildings: Building[] = [CABIN, ...IGLOOS.map((i) => i.building)];

const bushes: Circle[] = [
  // Pine Forest: dense
  pine(8, 8), pine(14, 14, 2.6), pine(8, 18), pine(20, 8), pine(20, 20, 2.6), pine(32, 22), pine(24, 30), pine(10, 34),
  pine(34, 8), pine(16, 44, 2), pine(36, 40, 2),
  // round the pond and the fields
  pine(44, 44, 2), pine(76, 76, 2), pine(78, 44, 2), pine(42, 76, 2),
  pine(112, 26), pine(110, 80), pine(78, 112), pine(30, 112), pine(6, 74), pine(104, 112, 2), pine(112, 6, 2),
  // Snowman Garden
  pine(8, 110), pine(36, 104, 2),
];

const chestSpawns: ChestSpawn[] = [
  // inside the igloos
  chest(106, 38, 'high'), chest(10, 50, 'high'), chest(100, 72, 'high'),
  // the pond's middle, the fort and the cabin
  chest(C, C, 'high'), chest(FX + 4.5, FY + 4.5, 'high'), chest(FX + 13.5, FY + 13.5, 'high'), chest(92, 90.5, 'high'), chest(98, 93, 'high'),
  // up on the cabin's snowy roof (from the woodpile)
  { ...chest(92, 94, 'high'), roof: true },
  // at the foot of the gift tower
  chest(68, 110.5, 'high'),
  // Pine Forest
  chest(14, 22, 'low'), chest(28, 18), chest(6, 28, 'low'), chest(26, 40, 'low'),
  // Snowball Alley
  chest(50, 14), chest(62, 22), chest(74, 14, 'low'),
  // Snowman Garden
  chest(18, 92), chest(28, 100, 'low'), chest(10, 100, 'low'),
  // Gift Market
  chest(50, 96), chest(70, 96, 'low'),
  // around the pond and the fields
  chest(C, 40), chest(40, C, 'low'), chest(82, 55), chest(C, 80, 'low'), chest(100, 40, 'low'), chest(106, 104, 'low'),
  chest(8, 64, 'low'), chest(112, 66, 'low'), chest(30, 70), chest(90, 50),
];

// Snow clutter, just for looks: sleds, snowball piles and lost mittens.
const decor: Decor[] = [];
{
  const kinds: Decor['kind'][] = ['snowballs', 'mitten', 'sled', 'snowballs', 'snowballs', 'mitten'];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120 && decor.length < 40; i++) {
    const p = { x: 6 + rand() * (SIZE - 12), y: 6 + rand() * (SIZE - 12) };
    const turn = rand() * Math.PI * 2;
    const kind = kinds[i % kinds.length]!;
    const clear = [...walls, ...buildings].every((b) => p.x < b.x - 1.2 || p.x > b.x + b.w + 1.2 || p.y < b.y - 1.2 || p.y > b.y + b.h + 1.2);
    const onPond = Math.hypot(p.x - POND.center.x, p.y - POND.center.y) < POND.radius + 1;
    if (clear && !onPond) decor.push({ kind, x: p.x, y: p.y, turn });
  }
}

const zones: MapZone[] = [
  { name: 'Frozen Pond', center: { x: C, y: C }, radius: 14 },
  { name: 'Pine Forest', center: { x: 18, y: 20 }, radius: 16 },
  { name: 'Snowball Alley', center: { x: C, y: 18 }, radius: 12 },
  { name: 'Snow Fort', center: { x: FX + 9, y: FY + 9 }, radius: 12 },
  { name: 'Log Cabin', center: { x: 95, y: 92 }, radius: 11 },
  { name: 'Gift Market', center: { x: C, y: 103 }, radius: 13 },
  { name: 'Snowman Garden', center: { x: 22, y: 94 }, radius: 15 },
  { name: 'Igloo', center: { x: 106, y: 38 }, radius: 5 },
  { name: 'Igloo', center: { x: 10, y: 50 }, radius: 5 },
  { name: 'Igloo', center: { x: 100, y: 72 }, radius: 5 },
];

/** True if a plush could stand here: inside the map, off the ice, and clear of walls and roofs. */
function clearSpot(p: Vec2, margin: number): boolean {
  if (p.x < 3 || p.y < 3 || p.x > SIZE - 3 || p.y > SIZE - 3) return false;
  if (Math.hypot(p.x - POND.center.x, p.y - POND.center.y) < POND.radius + margin) return false;
  const off = (b: { x: number; y: number; w: number; h: number }) => p.x < b.x - margin || p.x > b.x + b.w + margin || p.y < b.y - margin || p.y > b.y + b.h + margin;
  return walls.every(off) && buildings.every(off);
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

export const PARK: MapData = {
  id: 'park',
  theme: 'snow',
  width: SIZE,
  height: SIZE,
  walls,
  bushes,
  buildings,
  spawns: [...ringSpawns(16, 46, 7), ...ringSpawns(8, 26, 29)],
  chestSpawns,
  // The air strike button: in the snow fort's yard, by the snow pile (a snowball barrage).
  strikeButton: { x: FX + 9, y: FY + 13.5, z: 0, kind: 'snowballs' },
  // A toy ice drill out on the frozen pond (beside the chest in the middle).
  toy: { kind: 'icedrill', x: 64, y: 62, z: 0 },
  // A big pink present (gold ribbon, unlike the stacks around it) in the middle of the Gift Market.
  pinata: { x: 60, y: 100, z: 0, kind: 'present' },
  ice: [POND],
  zones,
  decor,
};
