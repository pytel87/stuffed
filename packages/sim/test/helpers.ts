import { createGame, createWorld, NEUTRAL_INPUT, step, TEST_MAP } from '../src/index.ts';
import type { EntityId, GameState, Input, RosterEntry } from '../src/index.ts';

export function roster(count: number): RosterEntry[] {
  return Array.from({ length: count }, (_, i) => ({ name: i === 0 ? 'you' : `bot ${i}`, isBot: i > 0 }));
}

export function newGame(seed = 1, players = 4) {
  const world = createWorld(TEST_MAP);
  const state = createGame({ seed, map: TEST_MAP, roster: roster(players) });
  return { world, state };
}

export function input(over: Partial<Input> = {}): Input {
  return { ...NEUTRAL_INPUT, seq: 0, ...over };
}

/** Runs `ticks` steps, giving every player the input returned by `inputFor`. */
export function run(
  world: ReturnType<typeof createWorld>,
  state: GameState,
  ticks: number,
  inputFor: (id: EntityId, tick: number) => Input,
): GameState {
  for (let t = 0; t < ticks; t++) {
    const inputs = new Map<EntityId, Input>();
    for (const p of state.players) inputs.set(p.id, inputFor(p.id, state.tick));
    step(world, state, inputs);
  }
  return state;
}
