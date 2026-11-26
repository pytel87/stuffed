// Static, precomputed data for one map. Built once per match and passed to step();
// never part of GameState.
import { segmentBoxT } from './collision/geometry.ts';
import { StaticBoxHash } from './collision/spatial-hash.ts';
import type { EntityId, MapData, PlacedWall, Vec2, Wall } from './types.ts';
import { chimneyOf, type RoofBlock } from './maps/chimney.ts';

export interface World {
  map: MapData;
  /** The map's fixed walls (beach balls aren't: they roll, in GameState.balls). */
  solid: Wall[];
  walls: StaticBoxHash;
  /**
   * Cardboard Walls standing right now: the match state's list, pointed to by step() (and by
   * client prediction) so every wall check sees them along with the map's walls.
   */
  placed: readonly PlacedWall[];
  /** Where each plush was over the last few ticks (newest last), for lag-compensated hits. */
  history: Map<EntityId, Pose[]>;
  /** What stands on the roofs (their chimneys). */
  roofBlocks: RoofBlock[];
}

export interface Pose {
  tick: number;
  x: number;
  y: number;
  z: number;
}

/** Ticks of history kept per plush (a bit more than the longest rewind). */
const HISTORY = 16;

export function createWorld(map: MapData): World {
  const solid = map.walls.filter((w) => w.kind !== 'ball' && w.kind !== 'duck');
  const roofBlocks = map.buildings.map(chimneyOf).filter((b): b is RoofBlock => b !== null);
  return { map, solid, walls: new StaticBoxHash(solid), placed: [], history: new Map(), roofBlocks };
}

/** Remembers where every living plush is this tick. */
export function recordPoses(world: World, players: readonly { id: EntityId; alive: boolean; pos: Vec2; z: number }[], tick: number): void {
  for (const p of players) {
    if (!p.alive) {
      world.history.delete(p.id);
      continue;
    }
    let poses = world.history.get(p.id);
    if (!poses) world.history.set(p.id, (poses = []));
    poses.push({ tick, x: p.pos.x, y: p.pos.y, z: p.z });
    if (poses.length > HISTORY) poses.shift();
  }
}

/** Where a plush was at `tick` (its oldest known pose if earlier), or null if unknown. */
export function poseAt(world: World, id: EntityId, tick: number): Pose | null {
  const poses = world.history.get(id);
  if (!poses || poses.length === 0) return null;
  for (let i = poses.length - 1; i >= 0; i--) if (poses[i]!.tick <= tick) return poses[i]!;
  return poses[0]!;
}

/** Map walls and placed walls overlapping the box (min/max corners). */
export function wallsNear(world: World, minX: number, minY: number, maxX: number, maxY: number): Wall[] {
  const found: Wall[] = [];
  for (const i of world.walls.query(minX, minY, maxX, maxY)) found.push(world.solid[i]!);
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
