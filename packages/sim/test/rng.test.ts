import { describe, expect, it } from 'vitest';
import { rng } from '../src/index.ts';

describe('rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = rng.seedRng(42);
    const b = rng.seedRng(42);
    const seqA = Array.from({ length: 50 }, () => rng.nextU32(a));
    const seqB = Array.from({ length: 50 }, () => rng.nextU32(b));
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    const a = rng.seedRng(1);
    const b = rng.seedRng(2);
    expect(rng.nextU32(a)).not.toEqual(rng.nextU32(b));
  });

  it('continues identically from a cloned state', () => {
    const a = rng.seedRng(7);
    rng.nextU32(a);
    const b = structuredClone(a);
    expect(rng.nextFloat(a)).toEqual(rng.nextFloat(b));
  });

  it('keeps floats in [0, 1)', () => {
    const s = rng.seedRng(3);
    for (let i = 0; i < 10_000; i++) {
      const f = rng.nextFloat(s);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});
