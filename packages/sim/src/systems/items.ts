// Using items (keys 3-5): healing and armor, a Juice Box buff, a Bouncy Ball dash and a
// Cardboard Wall.
import { config, secondsToTicks } from '../config.ts';
import type { GameState, Input, ItemKind, PlacedWall, Player } from '../types.ts';

/**
 * Whether using this item now would do anything (no healing at the cap, no armor at 100). A
 * Cardboard Wall goes up only from the lawn (not from a roof or a crate top).
 */
export function canUseItem(player: Player, kind: ItemKind): boolean {
  const item = config.items[kind];
  if (item.effect === 'wall') return player.z < 0.3;
  if (item.effect) return true;
  const heals = item.stuffing > 0 && player.stuffing < item.stuffingCap;
  const armors = item.patches > 0 && player.patches < config.player.maxPatches;
  return heals || armors;
}

export function updateItemUse(state: GameState, player: Player, input: Input): void {
  const action = player.action;
  if (action?.kind === 'useItem') {
    if (state.tick < action.endTick) return;
    player.action = null;
    const stack = player.items[action.slot];
    if (!stack || stack.kind !== action.item) return;
    applyItem(state, player, action.item, null);
    stack.count--;
    if (stack.count <= 0) player.items[action.slot] = null;
    state.events.push({ type: 'itemUsed', playerId: player.id, item: action.item });
    return;
  }

  if (input.useItemSlot === -1) return;
  const stack = player.items[input.useItemSlot];
  if (!stack || !canUseItem(player, stack.kind)) return;
  if (config.items[stack.kind].useTime <= 0) {
    // Instant (Bouncy Ball): used right away, without stopping to use it.
    applyItem(state, player, stack.kind, input);
    stack.count--;
    if (stack.count <= 0) player.items[input.useItemSlot] = null;
    state.events.push({ type: 'itemUsed', playerId: player.id, item: stack.kind });
    return;
  }
  // Starting an item cancels opening a chest.
  player.action = {
    kind: 'useItem',
    slot: input.useItemSlot,
    item: stack.kind,
    startTick: state.tick,
    endTick: state.tick + secondsToTicks(config.items[stack.kind].useTime),
  };
}

function applyItem(state: GameState, player: Player, kind: ItemKind, input: Input | null): void {
  const item = config.items[kind];
  if (item.stuffing > 0 && player.stuffing < item.stuffingCap) {
    player.stuffing = Math.min(item.stuffingCap, player.stuffing + item.stuffing);
  }
  if (item.patches > 0) player.patches = Math.min(config.player.maxPatches, player.patches + item.patches);
  if (item.effect === 'juice') player.juiceUntil = state.tick + secondsToTicks(config.itemEffects.juice.seconds);
  if (item.effect === 'wall') placeWall(state, player);
}

/**
 * Cardboard Wall: stands up in front of you, across your aim (walls are boxes, so it faces the
 * nearest of the four directions). It stays until it's shot (or bonked, or blown) down.
 */
function placeWall(state: GameState, player: Player): void {
  const w = config.itemEffects.wall;
  const cx = player.pos.x + player.aim.x * w.distance;
  const cy = player.pos.y + player.aim.y * w.distance;
  const across = Math.abs(player.aim.x) >= Math.abs(player.aim.y);
  const sizeX = across ? w.thickness : w.length;
  const sizeY = across ? w.length : w.thickness;
  const wall: PlacedWall = {
    id: state.nextId++,
    ownerId: player.id,
    x: cx - sizeX / 2,
    y: cy - sizeY / 2,
    w: sizeX,
    h: sizeY,
    height: w.height,
    kind: 'cardboard',
    health: w.health,
  };
  state.placedWalls.push(wall);
  state.events.push({ type: 'wallPlaced', wallId: wall.id, playerId: player.id });
}

/** Removes a placed wall in place (the world points at the same list). */
export function removeWall(state: GameState, id: number): void {
  const i = state.placedWalls.findIndex((w) => w.id === id);
  if (i !== -1) state.placedWalls.splice(i, 1);
}

