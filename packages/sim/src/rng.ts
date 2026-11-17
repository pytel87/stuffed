// sfc32 PRNG. Its whole state is 4 uint32s stored in GameState.rng, so a cloned or
// serialized state continues the exact same random sequence. Never use Math.random in the sim.
import type { RngState } from './types.ts';

export function seedRng(seed: number): RngState {
  const s: RngState = [0x9e3779b9, 0x243f6a88, 0xb7e15162, seed >>> 0];
  for (let i = 0; i < 15; i++) nextU32(s);
  return s;
}

/** Advances the state in place and returns a uint32. */
export function nextU32(s: RngState): number {
  let [a, b, c, d] = s;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  s[0] = a;
  s[1] = b;
  s[2] = c;
  s[3] = d;
  return t >>> 0;
}

/** Float in [0, 1). */
export function nextFloat(s: RngState): number {
  return nextU32(s) / 4294967296;
}

/** Float in [min, max). */
export function nextRange(s: RngState, min: number, max: number): number {
  return min + (max - min) * nextFloat(s);
}

/** Integer in [0, n). */
export function nextInt(s: RngState, n: number): number {
  return Math.floor(nextFloat(s) * n);
}

export function pick<T>(s: RngState, items: readonly T[]): T {
  const item = items[nextInt(s, items.length)];
  if (item === undefined) throw new Error('pick() from an empty list');
  return item;
}

/** Picks a key with probability proportional to its weight. Keys are visited in insertion order. */
export function pickWeighted<K extends string>(s: RngState, weights: Readonly<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = nextFloat(s) * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1]![0];
}

/** Index in [0, weights.length) with probability proportional to its weight. */
export function pickIndexWeighted(s: RngState, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let roll = nextFloat(s) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/** Fisher-Yates shuffle in place. */
export function shuffle<T>(s: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(s, i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}
