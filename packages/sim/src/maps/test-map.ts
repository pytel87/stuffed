// Hard-coded test map for the prototype. Walls, bushes and chests arrive in later steps;
// a Tiled JSON loader will replace this file.
import type { MapData, Vec2 } from '../types.ts';

const SIZE = 80;

function ringSpawns(count: number, radius: number): Vec2[] {
  const spawns: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawns.push({ x: SIZE / 2 + Math.cos(a) * radius, y: SIZE / 2 + Math.sin(a) * radius });
  }
  return spawns;
}

export const TEST_MAP: MapData = {
  id: 'test-yard',
  width: SIZE,
  height: SIZE,
  walls: [],
  bushes: [],
  spawns: [...ringSpawns(12, 28), ...ringSpawns(6, 12)],
  chestSpawns: [],
};
