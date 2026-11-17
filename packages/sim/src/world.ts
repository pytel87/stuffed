// Static, precomputed data for one map (wall spatial hash comes in the collision step).
// Built once per match and passed to step(); never part of GameState.
import type { MapData } from './types.ts';

export interface World {
  map: MapData;
}

export function createWorld(map: MapData): World {
  return { map };
}
