import { config, DT } from './config.ts';
import { NEUTRAL_INPUT, sanitizeInput } from './input.ts';
import { checkWinner } from './systems/damage.ts';
import { expireWalls, updateItemUse } from './systems/items.ts';
import { autoPickupItems, dropEverything, hasDrops, updateInteraction } from './systems/loot.ts';
import { applyAim, buildingAt, insideBush, movePlayer, separatePlayers } from './systems/movement.ts';
import { updateProjectiles } from './systems/projectiles.ts';
import { updateWeapons } from './systems/weapons.ts';
import { updateZone } from './systems/zone.ts';
import type { EntityId, GameState, Input, Player } from './types.ts';
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
  // Walls put up this match count as walls for everything below.
  expireWalls(state);
  world.placed = state.placedWalls;

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
    if (player.drop) {
      // Still on the Toss: no shooting, looting or items until you land.
      player.heldButtons = input.buttons;
      continue;
    }
    if (state.tick < player.juiceUntil) {
      player.stuffing = Math.min(config.player.maxStuffing, player.stuffing + config.itemEffects.juice.regenPerSecond * DT);
    }
    if (state.tick < player.bubbledUntil) {
      // In a bubble: nothing but floating there.
      player.chargeStartTick = null;
      player.action = null;
      player.heldButtons = input.buttons;
      continue;
    }
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
    if (!player.alive && hasDrops(player)) dropEverything(world, state, player);
  }
  checkWinner(state);
  return state;
}

/**
 * Moves one plush by one input exactly as step() would, without touching anything else (no
 * shots, pickups, damage or other plushies). Clients use it to predict their own plush between
 * server updates: apply each input as it is sent, and on every update re-apply the inputs the
 * server hasn't confirmed yet on top of the confirmed state.
 */
export function predictPlayer(world: World, state: GameState, player: Player, raw: Input): void {
  world.placed = state.placedWalls;
  const input = sanitizeInput(raw);
  player.lastInputSeq = input.seq;
  applyAim(player, input);
  movePlayer(world, state, player, input);
  player.inBush = insideBush(world, player.pos, player.z);
  player.building = buildingAt(world, player.pos, player.z);
  player.heldButtons = input.buttons;
}
