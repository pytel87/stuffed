import { NEUTRAL_INPUT, sanitizeInput } from './input.ts';
import { checkWinner } from './systems/damage.ts';
import { applyAim, buildingAt, insideBush, movePlayer, separatePlayers } from './systems/movement.ts';
import { updateProjectiles } from './systems/projectiles.ts';
import { updateWeapons } from './systems/weapons.ts';
import type { EntityId, GameState, Input } from './types.ts';
import type { World } from './world.ts';

/**
 * Advances the game by one tick. Mutates `state` in place and returns it.
 * Players without an input this tick get NEUTRAL_INPUT (standing still).
 * System order is fixed; changing it changes the simulation.
 */
export function step(world: World, state: GameState, inputs: ReadonlyMap<EntityId, Input>): GameState {
  if (state.status === 'ended') return state;
  state.tick++;
  state.events = [];

  const clean = new Map<EntityId, Input>();
  for (const player of state.players) {
    if (!player.alive) continue;
    const raw = inputs.get(player.id);
    const input = raw ? sanitizeInput(raw) : NEUTRAL_INPUT;
    if (raw) player.lastInputSeq = input.seq;
    clean.set(player.id, input);
    applyAim(player, input);
    movePlayer(world, player, input);
  }
  separatePlayers(world, state);

  for (const player of state.players) {
    if (!player.alive) continue;
    player.inBush = insideBush(world, player.pos.x, player.pos.y);
    player.building = buildingAt(world, player.pos.x, player.pos.y);
    updateWeapons(world, state, player, clean.get(player.id)!);
  }

  updateProjectiles(world, state);
  checkWinner(state);
  return state;
}
