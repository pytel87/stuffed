// The Backyard: the first real map, 128 x 128, seen at toy scale. A house in the middle and six
// zones around it (clockwise from the top left):
//   Treehouse (NW)        a platform on a trunk; climb the crates; high loot
//   Tool Shed (NE)        tight plank rooms with doorways; high loot
//   Kiddie Pool (E)       shallow water slows you; a chest in the middle
//   Picnic Plateau (SE)   a giant table to climb via the benches; food crates
//   Sandbox Desert (SW)   open sand, low sandcastles, half-buried chests
//   Veggie Jungle (W)     planter rows and leafy bushes; low loot
// Coordinates: x to the right, y down the screen (north = small y).
import type { Building, ChestSpawn, Circle, Ground, MapData, MapZone, Vec2, Wall, WallKind } from '../types.ts';

const SIZE = 128;
const C = SIZE / 2;

const w =
  (kind: WallKind, height: number) =>
  (x: number, y: number, width: number, depth: number, h = height): Wall => ({ x, y, w: width, h: depth, height: h, kind });

const brick = w('brick', 2.6);
const plank = w('plank', 2.2);
const crate = w('crate', 0.9);
const block = w('block', 2);
const book = w('book', 1.2);
const trunk = w('trunk', 6);
const bench = w('bench', 1);
const leg = w('table-leg', 2);
const sandcastle = w('sandcastle', 1.4);
const planter = w('planter', 0.7);
const border = w('plank', 0.6);
const ball = w('ball', 1.6);
const bush = (x: number, y: number, radius = 2.2): Circle => ({ center: { x, y }, radius });
const chest = (x: number, y: number, loot: ChestSpawn['loot'] = 'medium'): ChestSpawn => ({ x, y, loot });

// ---------- the house (center) ----------
// 24 x 20 brick house with a door on every side and a wall splitting it into two rooms.
// A rain barrel on the west side gets you onto the roof.
const HOUSE = { x: 52, y: 54, w: 24, h: 20 };
const house: Wall[] = [
  // north wall, door at x 62.5..65.5
  brick(52, 54, 10.5, 1), brick(65.5, 54, 10.5, 1),
  // south wall, door at x 62.5..65.5
  brick(52, 73, 10.5, 1), brick(65.5, 73, 10.5, 1),
  // west wall, door at y 62.5..65.5
  brick(52, 55, 1, 7.5), brick(52, 65.5, 1, 7.5),
  // east wall, door at y 62.5..65.5
  brick(75, 55, 1, 7.5), brick(75, 65.5, 1, 7.5),
  // inner wall at x 63.5..64.5 with a doorway at y 58..61 (north) and 67..70 (south)
  brick(63.5, 55, 1, 3), brick(63.5, 61, 1, 6), brick(63.5, 70, 1, 3),
];
const houseProps: Wall[] = [
  w('barrel', 1.3)(49.4, 57, 2.2, 2.2),
  book(55, 57, 4, 1.4), // a shelf of books inside the west room
  book(70, 69.5, 3.5, 1.4),
];

// ---------- Treehouse (NW) ----------
// A plank platform at 2.7 on a tall trunk. Crates make steps up on the south and west sides;
// under the platform you're hidden (it's a roof).
const treehouse: Wall[] = [
  trunk(26.5, 25.5, 3, 3),
  // south-east stair
  crate(34.5, 32.5, 2, 2, 0.9), crate(32.5, 32.5, 2, 2, 1.8),
  // west stair
  crate(18, 26, 2, 2, 0.9), crate(20, 26, 2, 2, 1.8),
];

// ---------- Tool Shed (NE) ----------
// 18 x 14 shed: a big west room and two small east rooms; doors on the west side and two on the
// south side (into the big room and the south-east room). A crate by the east wall reaches the roof.
const shed: Wall[] = [
  // north wall
  plank(88, 18, 18, 0.8),
  // south wall, doors at x 91..94 and 99.5..102.5
  plank(88, 31.2, 3, 0.8), plank(94, 31.2, 5.5, 0.8), plank(102.5, 31.2, 3.5, 0.8),
  // west wall, door at y 23.5..26.5
  plank(88, 18.8, 0.8, 4.7), plank(88, 26.5, 0.8, 4.7),
  // east wall
  plank(105.2, 18.8, 0.8, 12.4),
  // inner: a wall at x 97 from the north wall down to y 25, gap 25..28, then to the south wall
  plank(97, 18.8, 0.8, 6.2), plank(97, 28, 0.8, 3.2),
  // and across the east side at y 25, doorway x 100..103
  plank(97.8, 25, 2.2, 0.8), plank(103, 25, 2.2, 0.8),
];
const shedProps: Wall[] = [
  w('bench', 1)(89.2, 19.2, 5, 1.6), // workbench
  crate(106.4, 22, 2, 2, 1.1), // up to the roof (2.2)
  crate(84, 32.5, 2, 2, 0.9),
];

// ---------- Kiddie Pool (E) ----------
const POOL: Circle = { center: { x: 106, y: 64 }, radius: 9.5 };
const poolProps: Wall[] = [ball(94.2, 54.5, 1.6, 1.6), ball(115.5, 73.5, 1.6, 1.6), ball(117, 52, 1.6, 1.6)];

// ---------- Picnic Plateau (SE) ----------
// A 16 x 8 table (its top is a roof at 2) with benches along both long sides and legs at the
// corners. Under the table you're hidden.
const TABLE = { x: 90, y: 95, w: 16, h: 8 };
const picnic: Wall[] = [
  bench(90, 92.4, 16, 1.6), bench(90, 104.0, 16, 1.6),
  leg(90.4, 95.4, 0.8, 0.8), leg(104.8, 95.4, 0.8, 0.8), leg(90.4, 101.8, 0.8, 0.8), leg(104.8, 101.8, 0.8, 0.8),
  w('basket', 1.2)(85, 89, 2.4, 2),
];

// ---------- Sandbox Desert (SW) ----------
// A sandbox with a low plank border (gaps to walk in), sandcastles and a bucket. Open: long
// sightlines across it.
const SAND = { x: 14, y: 84, w: 32, h: 30 };
const sandbox: Wall[] = [
  // border: north (gap 27..33), south (gap 27..33), west (gap 96..102), east (gap 96..102)
  border(14, 84, 13, 0.6), border(33, 84, 13, 0.6),
  border(14, 113.4, 13, 0.6), border(33, 113.4, 13, 0.6),
  border(14, 84.6, 0.6, 11.4), border(14, 102, 0.6, 11.4),
  border(45.4, 84.6, 0.6, 11.4), border(45.4, 102, 0.6, 11.4),
  sandcastle(21, 91, 4, 4), sandcastle(35, 103, 3.5, 3.5, 1.2),
  w('bucket', 1.6)(38.5, 89, 2, 2),
];

// ---------- Veggie Jungle (W) ----------
// Rows of raised planters you hop over, with leafy bushes between them.
const planters: Wall[] = [planter(8, 47, 16, 1.4), planter(8, 55, 16, 1.4), planter(8, 63, 16, 1.4), planter(8, 71, 16, 1.4), planter(8, 79, 16, 1.4)];
const jungleBushes: Circle[] = [
  bush(10.5, 51.2, 2), bush(17, 51.2, 2), bush(22.5, 51.4, 1.8),
  bush(12, 59.2, 2), bush(20, 59.2, 2),
  bush(9.5, 67.3, 2), bush(16, 67.4, 2.1), bush(22.6, 67.2, 1.8),
  bush(13, 75.2, 2), bush(21, 75.3, 2),
];

// ---------- the open lawn between zones ----------
const lawn: Wall[] = [
  block(63, 40, 2, 2), block(40, 63, 2, 2), block(86, 63, 2, 2), block(63, 86, 2, 2),
  block(44, 44, 2, 2), block(82, 44, 2, 2), block(44, 82, 2, 2), block(82, 82, 2, 2),
  book(56, 34, 7, 1.6), book(70, 92, 7, 1.6), book(34, 70, 1.6, 7), book(92, 37, 1.6, 7),
];
const lawnBushes: Circle[] = [
  bush(50, 40), bush(78, 40), bush(40, 50), bush(88, 78), bush(50, 88), bush(78, 88),
  bush(64, 20, 2.6), bush(64, 108, 2.6), bush(20, 64, 2), bush(116, 40, 2.4), bush(116, 92, 2.4),
  bush(38, 14, 2.4), bush(14, 38, 2.4), // around the treehouse
  bush(30, 36, 2), bush(36, 22, 2),
];

const walls: Wall[] = [
  ...house, ...houseProps, ...treehouse, ...shed, ...shedProps, ...poolProps, ...picnic, ...sandbox, ...planters, ...lawn,
];

const buildings: Building[] = [
  { ...HOUSE, height: 2.6, kind: 'house' },
  { x: 22, y: 22, w: 12, h: 10, height: 2.7, kind: 'treehouse' },
  { x: 88, y: 18, w: 18, h: 14, height: 2.2, kind: 'shed' },
  { ...TABLE, height: 2, kind: 'table' },
];

const chestSpawns: ChestSpawn[] = [
  // house: one per room, plus one by each door outside
  chest(57, 69, 'high'), chest(70.5, 58.5, 'high'), chest(64, 50.5), chest(64, 77.5),
  // treehouse: under the platform
  chest(24.5, 30, 'high'), chest(31.5, 24, 'high'),
  // shed: one per room
  chest(92, 27.5, 'high'), chest(101.5, 21.5, 'high'), chest(101.5, 28.5, 'high'),
  // kiddie pool: around it, and one in the middle of the water
  chest(106, 64), chest(106, 51.5), chest(96.5, 71), chest(116, 61),
  // picnic: food crates under and around the table
  chest(94.5, 99, 'food'), chest(101.5, 99, 'food'), chest(86.5, 99.5, 'food'), chest(110, 95, 'food'), chest(98, 108.5, 'food'),
  // sandbox: half-buried in the sand
  chest(19.5, 100), chest(30, 89.5), chest(41, 108.5), chest(27.5, 109), chest(30, 98.5),
  // veggie jungle: between the planters
  chest(16, 59.2, 'low'), chest(13, 67.3, 'low'), chest(17, 75.3, 'low'),
  // the lawn
  chest(64, 30), chest(30, 64, 'low'), chest(98, 64 - 18), chest(64, 98), chest(46, 30), chest(82, 30, 'low'),
  chest(46, 98, 'low'), chest(82, 98), chest(116, 116, 'low'), chest(12, 12, 'low'), chest(116, 12, 'low'), chest(12, 116, 'low'),
];

const grounds: Ground[] = [
  { kind: 'sand', box: SAND },
  { kind: 'dirt', box: { x: 6, y: 45, w: 20, h: 37 } },
  { kind: 'blanket', box: { x: 83, y: 87, w: 30, h: 24 } },
  { kind: 'floor', box: HOUSE },
  { kind: 'floor', box: { x: 88, y: 18, w: 18, h: 14 } },
  { kind: 'stones', box: { x: 62.5, y: 74, w: 3, h: 10 } },
  { kind: 'stones', box: { x: 62.5, y: 44, w: 3, h: 10 } },
  { kind: 'stones', box: { x: 42, y: 62.5, w: 10, h: 3 } },
  { kind: 'stones', box: { x: 76, y: 62.5, w: 10, h: 3 } },
];

const zones: MapZone[] = [
  { name: 'Treehouse', center: { x: 28, y: 27 }, radius: 12 },
  { name: 'Tool Shed', center: { x: 97, y: 25 }, radius: 13 },
  { name: 'Kiddie Pool', center: POOL.center, radius: 13 },
  { name: 'Picnic Plateau', center: { x: 98, y: 99 }, radius: 16 },
  { name: 'Sandbox Desert', center: { x: 30, y: 99 }, radius: 18 },
  { name: 'Veggie Jungle', center: { x: 16, y: 63 }, radius: 16 },
  { name: 'The House', center: { x: 64, y: 64 }, radius: 14 },
];

/** True if a plush could stand here: inside the map, clear of walls (with a margin) and out of the pool. */
function clearSpot(p: Vec2, margin: number): boolean {
  if (p.x < 3 || p.y < 3 || p.x > SIZE - 3 || p.y > SIZE - 3) return false;
  if (Math.hypot(p.x - POOL.center.x, p.y - POOL.center.y) < POOL.radius + margin) return false;
  return walls.every((b) => p.x < b.x - margin || p.x > b.x + b.w + margin || p.y < b.y - margin || p.y > b.y + b.h + margin);
}

/** `count` spawns on a ring; any that land on something slide along the ring until clear. */
function ringSpawns(count: number, radius: number, offsetDegrees: number): Vec2[] {
  const spawns: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const base = (i / count) * Math.PI * 2 + (offsetDegrees * Math.PI) / 180;
    for (let k = 0; k < 40; k++) {
      // Try 0, +1°, -1°, +2°, ... and a slightly smaller ring as a last resort.
      const a = base + (((k % 2 ? 1 : -1) * Math.ceil(k / 2)) * Math.PI) / 180;
      const r = k < 30 ? radius : radius - 3;
      const p = { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
      if (clearSpot(p, 1.2) && spawns.every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 6)) {
        spawns.push(p);
        break;
      }
    }
  }
  return spawns;
}

export const BACKYARD: MapData = {
  id: 'backyard',
  width: SIZE,
  height: SIZE,
  walls,
  bushes: [...jungleBushes, ...lawnBushes],
  buildings,
  spawns: [...ringSpawns(16, 54, 11), ...ringSpawns(8, 36, 33)],
  chestSpawns,
  pools: [POOL],
  grounds,
  zones,
};
