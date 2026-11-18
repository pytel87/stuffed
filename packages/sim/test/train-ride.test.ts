import { describe, expect, it } from 'vitest';
import { BEDROOM, createGame, createWorld, predictPlayer, step, TRAIN, trainCars } from '../src/index.ts';
import type { EntityId, GameState, Input, Player } from '../src/index.ts';
import { input, roster } from './helpers.ts';

describe('riding the toy train online', () => {
  it("the client's replay of its inputs, each at the tick the server applies it, matches the server", () => {
    const map = BEDROOM;
    const world = createWorld(map);
    const state = createGame({ seed: 1, map, roster: roster(2) });
    const [you, other] = state.players as [Player, Player];
    other.pos = { x: 4, y: 4 };
    // Standing on the first wagon's deck.
    const wagon = trainCars(map.track!, state.tick)[1]!;
    you.pos = { ...wagon.pos };
    you.z = TRAIN.deckHeight;
    you.vel = { x: 0, y: 0 };
    const confirmed: GameState = structuredClone(state);
    const inputs: Input[] = Array.from({ length: 10 }, (_, i) => input({ seq: i + 1, moveX: 0.3 }));
    for (const i of inputs) step(world, state, new Map<EntityId, Input>([[you.id, i]]));
    expect(you.z).toBeCloseTo(TRAIN.deckHeight, 3); // still riding

    const replay = (perTick: boolean) => {
      const me = structuredClone(confirmed.players[0]!);
      inputs.forEach((i, k) => predictPlayer(world, perTick ? { ...confirmed, tick: confirmed.tick + k + 1 } : confirmed, me, i));
      return me;
    };
    const right = replay(true);
    expect(right.pos.x).toBeCloseTo(you.pos.x, 5);
    expect(right.pos.y).toBeCloseTo(you.pos.y, 5);
    expect(right.z).toBeCloseTo(you.z, 5);
    // All at the confirmed tick (as before): the train never moves under the plush.
    const wrong = replay(false);
    expect(Math.hypot(wrong.pos.x - you.pos.x, wrong.pos.y - you.pos.y)).toBeGreaterThan(0.2);
  });
});
