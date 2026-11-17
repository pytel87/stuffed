// Using healing and armor items (keys 3-5).
import { config, secondsToTicks } from '../config.ts';
import type { GameState, Input, ItemKind, Player } from '../types.ts';

/** Whether using this item now would do anything (no healing at the cap, no armor at 100). */
export function canUseItem(player: Player, kind: ItemKind): boolean {
  const item = config.items[kind];
  const heals = item.stuffing > 0 && player.stuffing < item.stuffingCap;
  const armors = item.buttons > 0 && player.buttons < config.player.maxButtons;
  return heals || armors;
}

export function updateItemUse(state: GameState, player: Player, input: Input): void {
  const action = player.action;
  if (action?.kind === 'useItem') {
    if (state.tick < action.endTick) return;
    player.action = null;
    const stack = player.items[action.slot];
    if (!stack || stack.kind !== action.item) return;
    applyItem(player, action.item);
    stack.count--;
    if (stack.count <= 0) player.items[action.slot] = null;
    state.events.push({ type: 'itemUsed', playerId: player.id, item: action.item });
    return;
  }

  if (input.useItemSlot === -1) return;
  const stack = player.items[input.useItemSlot];
  if (!stack || !canUseItem(player, stack.kind)) return;
  // Starting an item cancels opening a chest.
  player.action = {
    kind: 'useItem',
    slot: input.useItemSlot,
    item: stack.kind,
    startTick: state.tick,
    endTick: state.tick + secondsToTicks(config.items[stack.kind].useTime),
  };
}

function applyItem(player: Player, kind: ItemKind): void {
  const item = config.items[kind];
  if (item.stuffing > 0 && player.stuffing < item.stuffingCap) {
    player.stuffing = Math.min(item.stuffingCap, player.stuffing + item.stuffing);
  }
  if (item.buttons > 0) player.buttons = Math.min(config.player.maxButtons, player.buttons + item.buttons);
}
