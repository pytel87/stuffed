import { describe, expect, it } from 'vitest';
import { Btn, rng } from '../src/index.ts';
import type { EntityId, Input } from '../src/index.ts';
import { input, newGame, run } from './helpers.ts';

/** A seeded, pseudo-random input script so the test covers varied movement. */
function scriptedInputs(seed: number) {
  const r = rng.seedRng(seed);
  const cache = new Map<string, Input>();
  return (id: EntityId, tick: number): Input => {
    const key = `${id}:${Math.floor(tick / 10)}`; // change direction every 10 ticks
    let inp = cache.get(key);
    if (!inp) {
      inp = input({
        seq: tick,
        moveX: rng.nextRange(r, -1, 1),
        moveY: rng.nextRange(r, -1, 1),
        aimX: rng.nextRange(r, -1, 1),
        aimY: rng.nextRange(r, -1, 1),
        buttons: rng.nextFloat(r) < 0.5 ? Btn.Fire : 0,
        cycleWeapon: rng.nextFloat(r) < 0.1,
      });
      cache.set(key, inp);
    }
    return inp;
  };
}

describe('determinism', () => {
  it('same seed + same inputs = same state', () => {
    const a = newGame(123, 16);
    const b = newGame(123, 16);
    run(a.world, a.state, 900, scriptedInputs(9));
    run(b.world, b.state, 900, scriptedInputs(9));
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  });

  it('a cloned mid-game state continues identically', () => {
    const a = newGame(5, 16);
    run(a.world, a.state, 300, scriptedInputs(1));
    const b = { world: a.world, state: structuredClone(a.state) };
    const inputsA = scriptedInputs(2);
    const inputsB = scriptedInputs(2);
    run(a.world, a.state, 300, inputsA);
    run(b.world, b.state, 300, inputsB);
    expect(b.state).toEqual(a.state);
  });

  it('the scripted match actually exercises combat', () => {
    const a = newGame(123, 16);
    let shots = 0;
    let hits = 0;
    const script = scriptedInputs(9);
    for (let t = 0; t < 900; t++) {
      run(a.world, a.state, 1, script);
      shots += a.state.events.filter((e) => e.type === 'shot').length;
      hits += a.state.events.filter((e) => e.type === 'hit').length;
    }
    expect(shots).toBeGreaterThan(100);
    expect(hits).toBeGreaterThan(0);
  });

  it('different seeds give different games', () => {
    const a = newGame(1, 16);
    const b = newGame(2, 16);
    expect(a.state.players.map((p) => p.pos)).not.toEqual(b.state.players.map((p) => p.pos));
  });
});
