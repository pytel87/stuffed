// Static, precomputed data for one map. Built once per match and passed to step();
// never part of GameState.
import { segmentBoxT } from './collision/geometry.ts';
import { StaticBoxHash } from './collision/spatial-hash.ts';
import type { MapData, PlacedWall, Vec2, Wall } from './types.ts';

export interface World {
  map: MapData;
  walls: StaticBoxHash;
  /**
   * Cardboard Walls standing right now: the match state's list, pointed to by step() (and by
   * client prediction) so every wall check sees them along with the map's walls.
   */
  placed: readonly PlacedWall[];
}

export function createWorld(map: MapData): World {
  return { map, walls: new StaticBoxHash(map.walls), placed: [] };
}

/** Map walls and placed walls overlapping the box (min/max corners). */
export function wallsNear(world: World, minX: number, minY: number, maxX: number, maxY: number): Wall[] {
  const found: Wall[] = [];
  for (const i of world.walls.query(minX, minY, maxX, maxY)) found.push(world.map.walls[i]!);
  for (const w of world.placed) {
    if (w.x <= maxX && w.x + w.w >= minX && w.y <= maxY && w.y + w.h >= minY) found.push(w);
  }
  return found;
}

/**
 * First t in [0, 1] along from→to where a circle of radius `pad` touches a wall, or null if
 * the path is clear. pad 0 = a thin ray. With `atHeight`, walls lower than that are ignored
 * (a shot flying above them).
 */
export function raycastWalls(world: World, from: Vec2, to: Vec2, pad = 0, atHeight = -Infinity): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const candidates = wallsNear(
    world,
    Math.min(from.x, to.x) - pad,
    Math.min(from.y, to.y) - pad,
    Math.max(from.x, to.x) + pad,
    Math.max(from.y, to.y) + pad,
  );
  let best: number | null = null;
  for (const wall of candidates) {
    if (wall.height <= atHeight) continue;
    const t = segmentBoxT(from.x, from.y, dx, dy, wall, pad);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}
