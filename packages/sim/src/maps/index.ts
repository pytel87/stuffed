import type { MapData } from '../types.ts';
import { BACKYARD } from './backyard.ts';
import { BEDROOM } from './bedroom.ts';
import { TEST_MAP } from './test-map.ts';

/** Every map by id. TEST_MAP stays for tests. */
export const MAPS: Record<string, MapData> = { [BACKYARD.id]: BACKYARD, [BEDROOM.id]: BEDROOM, [TEST_MAP.id]: TEST_MAP };

/** The maps matches can be played on, in the order the map button cycles through them. */
export const PLAYABLE_MAPS: readonly MapData[] = [BACKYARD, BEDROOM];

/** The map with this id (the Backyard if unknown). */
export function getMap(id: string): MapData {
  return MAPS[id] ?? BACKYARD;
}
