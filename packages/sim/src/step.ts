import { NEUTRAL_INPUT, sanitizeInput } from './input.ts';
import { checkWinner } from './systems/damage.ts';
import { updateItemUse } from './systems/items.ts';
import { autoPickupItems, dropEverything, updateInteraction } from './systems/loot.ts';
import { applyAim, buildingAt, insideBush, movePlayer, separatePlayers } from './systems/movement.ts';
import { updateProjectiles } from './systems/projectiles.ts';
import { updateWeapons } from './systems/weapons.ts';
import { updateZone } from './systems/zone.ts';
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
    movePlayer(world, state, player, input);
  }
  separatePlayers(world, state);

  for (const player of state.players) {
    if (!player.alive) continue;
    const input = clean.get(player.id)!;
    player.inBush = insideBush(world, player.pos, player.z);
    player.building = buildingAt(world, player.pos, player.z);
    updateWeapons(world, state, player, input);
    updateInteraction(world, state, player, input);
    updateItemUse(state, player, input);
    autoPickupItems(state, player);
    player.heldButtons = input.buttons;
  }

  updateProjectiles(world, state);
  updateZone(state);
  // Knocked-out plushies burst and drop whatever they still hold.
  for (const player of state.players) {
    if (!player.alive && (player.weapons.some(Boolean) || player.items.some(Boolean))) dropEverything(world, state, player);
  }
  checkWinner(state);
  return state;
}
