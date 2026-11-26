import type { Building } from '../types.ts';

/** Something standing on a roof (only there: nothing of it inside the building under it). */
export interface RoofBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The roof it stands on. */
  z: number;
  /** How far it sticks up out of the roof. */
  height: number;
  look: 'plaster' | 'stones';
}

const SIZE = 1.4;

/**
 * A house's or a log cabin's chimney, up on its roof a quarter of the way in from its east side
 * (out of the corner, on the roof). Plushies up there bump into it, and nobody stands on it.
 */
export function chimneyOf(b: Building): RoofBlock | null {
  if (b.kind !== 'house' && b.kind !== 'cabin') return null;
  return {
    x: b.x + b.w * 0.75 - SIZE / 2,
    y: b.y + b.h * 0.3 - SIZE / 2,
    w: SIZE,
    h: SIZE,
    z: b.height,
    height: b.kind === 'cabin' ? 1.4 : 1.2,
    look: b.kind === 'cabin' ? 'stones' : 'plaster',
  };
}
