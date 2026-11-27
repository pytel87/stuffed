import { config, DT } from './config.ts';
import { NEUTRAL_INPUT, sanitizeInput } from './input.ts';
import { updateBalls } from './systems/balls.ts';
import { plowLoot } from './systems/train.ts';
import { checkWinner } from './systems/damage.ts';
import { updateItemUse } from './systems/items.ts';
import { autoPickupItems, dropEverything, dropFromSlot, hasDrops, updateInteraction } from './systems/loot.ts';
import { applyAim, buildingAt, insideBush, movePlayer, separatePlayers } from './systems/movement.ts';
import { updateProjectiles } from './systems/projectiles.ts';
import { updateStrikes } from './systems/strikes.ts';
import { updateToys } from './systems/toys.ts';
import { updateMiniGames } from './systems/minigames.ts';
import { updateWeapons } from './systems/weapons.ts';
import { updateZone } from './systems/zone.ts';
import type { EntityId, GameState, Input, Player } from './types.ts';
import { recordPoses, type World } from './world.ts';
import { updateWanderers } from './systems/wanderers.ts';
import { updateLava } from './systems/lava.ts';
import { inLookout } from './systems/rides.ts';

/**
 * Advances the game by one tick. Mutates `state` in place and returns it.
 * Players without an input this tick get NEUTRAL_INPUT (standing still).
 * System order is fixed; changing it changes the simulation.
 */
export function step(world: World, state: GameState, inputs: ReadonlyMap<EntityId, Input>): GameState {
  if (state.status === 'ended') {
    // Over: nothing happens any more (and the last tick's events aren't repeated).
    state.events = [];
    return state;
  }
  state.tick++;
  state.events = [];
  // Walls put up this match count as walls for everything below.
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
  recordPoses(world, state.players, state.tick);

  for (const player of state.players) {
    const input = clean.get(player.id);
    // (A plush re-stitched by a teammate this tick has no input yet: it acts from the next.)
    if (!player.alive || !input) continue;
    player.inBush = insideBush(world, player.pos, player.z);
    player.building = buildingAt(world, player.pos, player.z);
    if (player.drop || player.umbrella || inLookout(world, player)) {
      // Still on the Toss, holding an umbrella, or up in a lookout (unseen, out of reach: no sniping
      // from there either): no shooting, looting or items until you're back down.
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
    if (input.dropSlot !== undefined && input.dropSlot >= 0) dropFromSlot(world, state, player, input.dropSlot);
    updateItemUse(state, player, input);
    autoPickupItems(state, player);
    player.heldButtons = input.buttons;
  }

  // Being re-stitched: their clock stands still (started in time, it finishes, however long is
  // left; the timer ran out under a teammate halfway through before). Let go, it runs on.
  for (const p of state.players) {
    if (p.alive || p.eliminatedTick === null) continue;
    if (state.players.some((q) => q.alive && q.action?.kind === 'revive' && q.action.targetId === p.id)) p.eliminatedTick++;
  }

  updateBalls(world, state);
  if (world.map.track) plowLoot(world.map.track, state);
  updateProjectiles(world, state);
  updateStrikes(world, state);
  updateToys(world, state);
  updateMiniGames(world, state);
  updateWanderers(world, state);
  updateLava(world, state);
  if (!state.peaceful) updateZone(state);
  // Knocked-out plushies burst and drop whatever they still hold.
  for (const player of state.players) {
    if (!player.alive && hasDrops(player)) dropEverything(world, state, player);
  }
  if (!state.peaceful) checkWinner(state);
  // The victory lap is over: the match ends.
  if (state.victoryUntil !== null && state.tick >= state.victoryUntil) state.status = 'ended';
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
