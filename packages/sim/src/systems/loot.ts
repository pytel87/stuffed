// Chests, ground loot and pickups.
import { config, secondsToTicks } from '../config.ts';
import { circleBoxPush } from '../collision/geometry.ts';
import { pickIndexWeighted, pickWeighted } from '../rng.ts';
import { Btn } from '../types.ts';
import type { Chest, GameState, GroundLoot, Input, ItemStack, LootContent, Player, Rarity, Vec2 } from '../types.ts';
import type { World } from '../world.ts';
import { makeWeapon } from './weapons.ts';

const OPEN_TICKS = secondsToTicks(config.chest.openTime);

/** What pressing E would do for this plush right now: pick up the nearest weapon, else open the nearest chest. */
export type Interaction = { kind: 'weapon'; loot: GroundLoot } | { kind: 'chest'; chest: Chest } | null;

export function findInteraction(state: GameState, player: Player): Interaction {
  let best: GroundLoot | null = null;
  let bestD: number = config.loot.weaponPickupRange;
  for (const loot of state.loot) {
    if (loot.content.type !== 'weapon') continue;
    const d = dist(player.pos, loot.pos);
    if (d <= bestD) {
      best = loot;
      bestD = d;
    }
  }
  if (best) return { kind: 'weapon', loot: best };

  let chest: Chest | null = null;
  let chestD: number = config.chest.interactRange;
  for (const c of state.chests) {
    if (c.opened) continue;
    const d = dist(player.pos, c.pos);
    if (d <= chestD) {
      chest = c;
      chestD = d;
    }
  }
  return chest ? { kind: 'chest', chest } : null;
}

/** E: a press picks up a weapon or starts opening a chest; holding it finishes the chest. */
export function updateInteraction(world: World, state: GameState, player: Player, input: Input): void {
  const held = (input.buttons & Btn.Interact) !== 0;
  const pressed = held && (player.heldButtons & Btn.Interact) === 0;

  const action = player.action;
  if (action?.kind === 'openChest') {
    const chest = state.chests.find((c) => c.id === action.chestId);
    if (!held || !chest || chest.opened || dist(player.pos, chest.pos) > config.chest.interactRange) {
      player.action = null;
    } else if (state.tick >= action.endTick) {
      player.action = null;
      openChest(world, state, chest, player);
    }
    return;
  }

  if (!pressed) return;
  const target = findInteraction(state, player);
  if (target?.kind === 'weapon') pickUpWeapon(world, state, player, target.loot);
  else if (target?.kind === 'chest') {
    player.action = { kind: 'openChest', chestId: target.chest.id, startTick: state.tick, endTick: state.tick + OPEN_TICKS };
  }
}

/** A Toy Box drops one weapon and one item stack, tossed toward whoever opened it. */
export function openChest(world: World, state: GameState, chest: Chest, opener: Player | null): void {
  chest.opened = true;
  const kind = pickWeighted(state.rng, config.chest.weaponWeights);
  const rarity = pickIndexWeighted(state.rng, config.chest.rarityWeights) as Rarity;
  const item = pickWeighted(state.rng, config.chest.itemWeights);

  // Drops land to either side of the opener (60 degrees off their direction), not under them.
  const toward = opener ? unit(opener.pos.x - chest.pos.x, opener.pos.y - chest.pos.y) : { x: 0, y: 1 };
  const d = config.loot.dropDistance;
  const base = Math.atan2(toward.y, toward.x);
  const spots = [base + Math.PI / 3, base - Math.PI / 3].map((a) => ({
    x: chest.pos.x + Math.cos(a) * d,
    y: chest.pos.y + Math.sin(a) * d,
  }));
  spawnLoot(world, state, spots[0]!, { type: 'weapon', weapon: makeWeapon(kind, rarity) });
  spawnLoot(world, state, spots[1]!, { type: 'item', item: { kind: item, count: config.items[item].chestCount } });
  state.events.push({ type: 'chestOpened', chestId: chest.id, playerId: opener?.id ?? 0 });
}

export function spawnLoot(world: World, state: GameState, at: Vec2, content: LootContent): GroundLoot {
  const pos = { x: at.x, y: at.y };
  pushOutOfWalls(world, pos, config.loot.radius);
  const rarity = content.type === 'weapon' ? content.weapon.rarity : config.items[content.item.kind].rarity;
  const loot: GroundLoot = { id: state.nextId++, pos, rarity, content };
  state.loot.push(loot);
  return loot;
}

/**
 * Swaps the weapon on the ground into an empty slot, or into the active slot (dropping the
 * one you held where the new one was).
 */
function pickUpWeapon(world: World, state: GameState, player: Player, loot: GroundLoot): void {
  if (loot.content.type !== 'weapon') return;
  const weapon = loot.content.weapon;
  removeLoot(state, loot.id);

  const empty = player.weapons.findIndex((w) => w === null);
  const slot: 0 | 1 = empty === -1 ? player.activeSlot : (empty as 0 | 1);
  const old = player.weapons[slot];
  player.weapons[slot] = weapon;
  player.activeSlot = slot;
  weapon.reloadEndTick = null;
  weapon.nextFireTick = Math.max(weapon.nextFireTick, state.tick + secondsToTicks(config.combat.weaponSwapTime));
  player.action = null;
  if (old) {
    old.reloadEndTick = null;
    spawnLoot(world, state, loot.pos, { type: 'weapon', weapon: old });
  }
  state.events.push({ type: 'pickup', playerId: player.id, lootId: loot.id, what: weapon.kind });
}

/** Items are picked up by walking over them, as long as there is room in the 3 item slots. */
export function autoPickupItems(state: GameState, player: Player): void {
  for (const loot of [...state.loot]) {
    if (loot.content.type !== 'item') continue;
    if (dist(player.pos, loot.pos) > config.loot.itemPickupRadius) continue;
    const stack = loot.content.item;
    const left = addToSlots(player.items, stack);
    if (left === stack.count) continue;
    state.events.push({ type: 'pickup', playerId: player.id, lootId: loot.id, what: stack.kind });
    if (left === 0) removeLoot(state, loot.id);
    else stack.count = left;
  }
}

/** Fills matching stacks first, then empty slots. Returns how many did not fit. */
export function addToSlots(slots: Player['items'], stack: ItemStack): number {
  const max = config.items[stack.kind].maxStack;
  let left = stack.count;
  for (const s of slots) {
    if (left === 0) break;
    if (s && s.kind === stack.kind && s.count < max) {
      const take = Math.min(max - s.count, left);
      s.count += take;
      left -= take;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i]) continue;
    const take = Math.min(max, left);
    slots[i] = { kind: stack.kind, count: take };
    left -= take;
  }
  return left;
}

/** Unstitched plushies burst and drop everything they carried, in a ring around them. */
export function dropEverything(world: World, state: GameState, player: Player): void {
  const drops: LootContent[] = [];
  for (const w of player.weapons) if (w) drops.push({ type: 'weapon', weapon: { ...w, reloadEndTick: null } });
  for (const s of player.items) if (s) drops.push({ type: 'item', item: { ...s } });
  player.weapons = [null, null];
  player.items = [null, null, null];
  drops.forEach((content, i) => {
    const a = (i / drops.length) * Math.PI * 2;
    const r = config.loot.dropDistance * 0.8;
    spawnLoot(world, state, { x: player.pos.x + Math.cos(a) * r, y: player.pos.y + Math.sin(a) * r }, content);
  });
}

function removeLoot(state: GameState, id: number): void {
  state.loot = state.loot.filter((l) => l.id !== id);
}

function pushOutOfWalls(world: World, pos: Vec2, r: number): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const i of world.walls.query(pos.x - r, pos.y - r, pos.x + r, pos.y + r)) {
      const push = circleBoxPush(pos.x, pos.y, r, world.map.walls[i]!);
      if (!push) continue;
      pos.x += push.nx * push.depth;
      pos.y += push.ny * push.depth;
      moved = true;
    }
    if (!moved) break;
  }
  pos.x = Math.min(Math.max(pos.x, r), world.map.width - r);
  pos.y = Math.min(Math.max(pos.y, r), world.map.height - r);
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unit(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? { x: x / len, y: y / len } : { x: 0, y: 1 };
}
