// Static, precomputed data for one map. Built once per match and passed to step();
// never part of GameState.
import { segmentBoxT } from './collision/geometry.ts';
import { StaticBoxHash } from './collision/spatial-hash.ts';
import type { MapData, Vec2 } from './types.ts';

export interface World {
  map: MapData;
  walls: StaticBoxHash;
}

export function createWorld(map: MapData): World {
  return { map, walls: new StaticBoxHash(map.walls) };
}

/**
 * First t in [0, 1] along from→to where a circle of radius `pad` touches a wall, or null if
 * the path is clear. pad 0 = a thin ray (line of sight).
 */
export function raycastWalls(world: World, from: Vec2, to: Vec2, pad = 0): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const candidates = world.walls.query(
    Math.min(from.x, to.x) - pad,
    Math.min(from.y, to.y) - pad,
    Math.max(from.x, to.x) + pad,
    Math.max(from.y, to.y) + pad,
  );
  let best: number | null = null;
  for (const i of candidates) {
    const t = segmentBoxT(from.x, from.y, dx, dy, world.map.walls[i]!, pad);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}
