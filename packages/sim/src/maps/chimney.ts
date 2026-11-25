import type { Building, Wall } from '../types.ts';

const SIZE = 1.4;
/** In from the house's outer walls a little, so their faces don't fight below the roof. */
const INSET = 0.1;

/**
 * A chimney sticking `above` out of a roof over the building's north-east corner: a wall from the
 * floor up through the roof, so plushies up there bump into it (or hop onto it). Below the roof
 * it's in the corner where the two outer walls meet, taking hardly any room from inside.
 */
export function chimney(b: Building, above: number, kind: 'chimney' | 'stone-chimney' = 'chimney'): Wall {
  return { x: b.x + b.w - SIZE - INSET, y: b.y + INSET, w: SIZE, h: SIZE, height: b.height + above, kind };
}
