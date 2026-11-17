import type { MapData } from '../types.ts';
import { BACKYARD } from './backyard.ts';
import { TEST_MAP } from './test-map.ts';

/** Every map by id. Matches are played on BACKYARD; TEST_MAP stays for tests. */
export const MAPS: Record<string, MapData> = { [BACKYARD.id]: BACKYARD, [TEST_MAP.id]: TEST_MAP };

/** The map with this id (the Backyard if unknown). */
export function getMap(id: string): MapData {
  return MAPS[id] ?? BACKYARD;
}
