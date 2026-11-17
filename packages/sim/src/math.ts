import type { Vec2 } from './types.ts';

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });

export const length = (v: Vec2): number => Math.hypot(v.x, v.y);

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Replaces NaN and infinities (e.g. from untrusted network input) with 0. */
export function finiteOr0(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/** Scales v down to length 1 if it is longer; shorter vectors are kept (analog sticks). */
export function clampLength1(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/** Unit vector, or null for a zero-length input. */
export function normalizeOrNull(x: number, y: number): Vec2 | null {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? { x: x / len, y: y / len } : null;
}
