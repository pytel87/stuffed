// Hard-coded test map for the prototype; a Tiled JSON loader will replace this file.
// Layout (80 x 80): a roofed cardboard room in the middle with a door on each side, an L of
// books in each corner, scattered toy blocks, and bushes between them.
import type { Box, Circle, MapData, Vec2 } from '../types.ts';

const SIZE = 80;
const C = SIZE / 2;

function ringSpawns(count: number, radius: number): Vec2[] {
  const spawns: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawns.push({ x: C + Math.cos(a) * radius, y: C + Math.sin(a) * radius });
  }
  return spawns;
}

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const bush = (x: number, y: number, radius = 2.4): Circle => ({ center: { x, y }, radius });

/** 14 x 14 room, walls 1 thick, 3-wide doors centered on each side. */
const room: Box[] = [
  box(33, 33, 5.5, 1), box(41.5, 33, 5.5, 1),
  box(33, 46, 5.5, 1), box(41.5, 46, 5.5, 1),
  box(33, 34, 1, 4.5), box(33, 41.5, 1, 4.5),
  box(46, 34, 1, 4.5), box(46, 41.5, 1, 4.5),
];

/** An L of books in each corner, 1.5 thick. */
const corners: Box[] = [
  box(13, 13, 8, 1.5), box(13, 14.5, 1.5, 6.5),
  box(59, 13, 8, 1.5), box(65.5, 14.5, 1.5, 6.5),
  box(13, 65.5, 8, 1.5), box(13, 59, 1.5, 6.5),
  box(59, 65.5, 8, 1.5), box(65.5, 59, 1.5, 6.5),
];

/** 2 x 2 toy blocks. */
const blocks: Box[] = [
  [24, 24], [54, 24], [24, 54], [54, 54], [39, 20], [39, 58],
  [20, 39], [58, 39], [8, 30], [70, 48], [30, 70], [48, 8],
].map(([x, y]) => box(x!, y!, 2, 2));

export const TEST_MAP: MapData = {
  id: 'test-yard',
  width: SIZE,
  height: SIZE,
  walls: [...room, ...corners, ...blocks],
  bushes: [bush(30, 30), bush(50, 30), bush(30, 50), bush(50, 50), bush(18, 48), bush(62, 32), bush(48, 62), bush(32, 18)],
  /** The room's roof covers its walls and floor. */
  buildings: [box(33, 33, 14, 14)],
  spawns: [...ringSpawns(12, 28), ...ringSpawns(6, 12)],
  chestSpawns: [
    [36.5, 36.5], [43.5, 43.5], // inside the room
    [17, 17], [63, 17], [17, 63], [63, 63], // in the book corners
    [27.5, 25], [52.5, 25], [27.5, 55], [52.5, 55], // beside blocks
    [40, 24], [40, 56], [24, 40], [56, 40],
    [10, 10], [70, 10], [10, 70], [70, 70],
    [8, 50], [72, 30], [30, 8], [50, 72],
    [20, 30], [60, 50], [50, 20], [30, 60],
    [40, 4], [4, 40], [76, 40], [40, 76],
  ].map(([x, y]) => ({ x: x!, y: y! })),
};
