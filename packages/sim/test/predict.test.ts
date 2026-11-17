import { describe, expect, it } from 'vitest';
import { Btn, predictPlayer, rng, step, TEST_MAP } from '../src/index.ts';
import type { EntityId, GameState, Input } from '../src/index.ts';
import { input, newGame } from './helpers.ts';

/** A pseudo-random walk with jumps, one input per tick. */
function walk(seed: number, ticks: number): Input[] {
  const r = rng.seedRng(seed);
  const out: Input[] = [];
  let move = { x: 0, y: 0 };
  for (let t = 0; t < ticks; t++) {
    if (t % 12 === 0) move = { x: rng.nextRange(r, -1, 1), y: rng.nextRange(r, -1, 1) };
    out.push(input({ seq: t, moveX: move.x, moveY: move.y, aimX: move.x, aimY: move.y, buttons: rng.nextFloat(r) < 0.08 ? Btn.Jump : 0 }));
  }
  return out;
}

describe('client prediction', () => {
  it('replaying unconfirmed inputs from a confirmed state lands exactly where the server does', () => {
    // A lone plush on the walled test map: walls, chests, roofs, jumps all in play.
    const { world, state } = newGame(4, 1, TEST_MAP);
    const me = state.players[0]!;
    const inputs = walk(9, 240);

    let confirmed: GameState | null = null;
    inputs.forEach((inp, t) => {
      step(world, state, new Map<EntityId, Input>([[me.id, inp]]));
      if (t === 100) confirmed = structuredClone(state); // the update the client last received
    });

    // Client side: start from the confirmed plush and re-apply every input after it.
    const predicted = structuredClone(confirmed!.players[0]!);
    for (const inp of inputs.slice(predicted.lastInputSeq + 1)) predictPlayer(world, confirmed!, predicted, inp);

    expect(predicted.pos).toEqual(me.pos);
    expect(predicted.z).toEqual(me.z);
    expect(predicted.vel).toEqual(me.vel);
    expect(predicted.lastInputSeq).toBe(me.lastInputSeq);
  });
});
