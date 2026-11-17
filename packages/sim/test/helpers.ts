import { createGame, createWorld, NEUTRAL_INPUT, step, TEST_MAP } from '../src/index.ts';
import type { EntityId, GameState, Input, MapData, RosterEntry } from '../src/index.ts';

/** The test map's size and spawns with no walls or bushes, so tests control the terrain. */
export const OPEN_MAP: MapData = { ...TEST_MAP, id: 'open', walls: [], bushes: [], buildings: [] };

export function roster(count: number): RosterEntry[] {
  return Array.from({ length: count }, (_, i) => ({ name: i === 0 ? 'you' : `bot ${i}`, isBot: i > 0 }));
}

export function newGame(seed = 1, players = 4, map: MapData = OPEN_MAP) {
  const world = createWorld(map);
  const state = createGame({ seed, map, roster: roster(players) });
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
