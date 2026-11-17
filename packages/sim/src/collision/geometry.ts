// Circle and segment tests against axis-aligned boxes. Pure math, no allocation in hot paths
// except the small result objects.
import type { Box } from '../types.ts';

export interface Push {
  /** Unit normal pointing out of the box. */
  nx: number;
  ny: number;
  /** How far to move along the normal to stop overlapping. */
  depth: number;
}

/** How to push a circle out of a box, or null if they don't overlap. */
export function circleBoxPush(px: number, py: number, r: number, b: Box): Push | null {
  const cx = px < b.x ? b.x : px > b.x + b.w ? b.x + b.w : px;
  const cy = py < b.y ? b.y : py > b.y + b.h ? b.y + b.h : py;
  const dx = px - cx;
  const dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Center is inside the box: leave by the nearest face.
  const left = px - b.x;
  const right = b.x + b.w - px;
  const top = py - b.y;
  const bottom = b.y + b.h - py;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { nx: -1, ny: 0, depth: left + r };
  if (min === right) return { nx: 1, ny: 0, depth: right + r };
  if (min === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

/**
 * First t in [0, 1] where the segment (x, y) + t * (dx, dy) touches the box grown by `pad`
 * on every side (a circle of radius pad sweeping along the segment, with square corners).
 * Starting inside counts as t = 0. Null if it never touches.
 */
export function segmentBoxT(x: number, y: number, dx: number, dy: number, b: Box, pad = 0): number | null {
  let tmin = 0;
  let tmax = 1;
  const minX = b.x - pad;
  const maxX = b.x + b.w + pad;
  const minY = b.y - pad;
  const maxY = b.y + b.h + pad;

  if (Math.abs(dx) < 1e-12) {
    if (x < minX || x > maxX) return null;
  } else {
    let t1 = (minX - x) / dx;
    let t2 = (maxX - x) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (Math.abs(dy) < 1e-12) {
    if (y < minY || y > maxY) return null;
  } else {
    let t1 = (minY - y) / dy;
    let t2 = (maxY - y) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin;
}
