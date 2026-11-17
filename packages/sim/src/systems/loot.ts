// Chests, ground loot and pickups.
import { config, secondsToTicks } from '../config.ts';
import { circleBoxPush } from '../collision/geometry.ts';
import { ANIMAL_RARITY, ANIMALS, PART_SLOTS, pickAnimal } from '../parts.ts';
import { nextFloat, pick, pickIndexWeighted, pickWeighted } from '../rng.ts';
import { Btn } from '../types.ts';
import type { Chest, GameState, GroundLoot, Input, ItemStack, LootContent, Part, Player, Rarity, Vec2 } from '../types.ts';
import { wallsNear, type World } from '../world.ts';
import { groundHeight } from './movement.ts';
import { makeWeapon } from './weapons.ts';

const OPEN_TICKS = secondsToTicks(config.chest.openTime);

/**
 * What pressing E would do for this plush right now: pick up the nearest weapon or put on the
 * nearest part (Q stashes a part instead), else open the nearest chest.
 */
export type Interaction =
  | { kind: 'weapon'; loot: GroundLoot }
  | { kind: 'part'; loot: GroundLoot; part: Part }
  | { kind: 'chest'; chest: Chest }
  /** Team mode: a knocked-out teammate to re-stitch. */
  | { kind: 'revive'; target: Player }
  | null;

/** Loot (or a chest base) at height `z` is within vertical reach of this plush. */
function inReach(player: Player, z: number): boolean {
  return Math.abs(player.z - z) <= config.loot.reachHeight;
}

/** Just dropped by this plush: it can't take it back yet (so walking over it doesn't). */
function lockedFor(state: GameState, player: Player, loot: GroundLoot): boolean {
  return loot.droppedBy === player.id && state.tick < (loot.pickupFromTick ?? 0);
}

/**
 * Drops a weapon (slot 0-1), a whole item stack (2-4) or the stashed part (5) in front of the
 * plush. Holding nothing after dropping your weapon switches to the other one.
 */
export function dropFromSlot(world: World, state: GameState, player: Player, slot: number): void {
  let content: LootContent | null = null;
  if (slot === 0 || slot === 1) {
    const w = player.weapons[slot];
    if (w) {
      content = { type: 'weapon', weapon: { ...w, reloadEndTick: null } };
      player.weapons[slot] = null;
      player.chargeStartTick = null;
      const other: 0 | 1 = slot === 0 ? 1 : 0;
      if (player.activeSlot === slot && player.weapons[other]) player.activeSlot = other;
    }
  } else if (slot >= 2 && slot <= 4) {
    const stack = player.items[slot - 2];
    if (stack) {
      content = { type: 'item', item: { ...stack } };
      player.items[slot - 2] = null;
      if (player.action?.kind === 'useItem' && player.action.slot === slot - 2) player.action = null;
    }
  } else if (slot === 5 && player.stash) {
    content = { type: 'part', part: player.stash };
    player.stash = null;
  }
  if (!content) return;
  const ahead = config.loot.dropAhead;
  const at = { x: player.pos.x + player.aim.x * ahead, y: player.pos.y + player.aim.y * ahead };
  const loot = spawnLoot(world, state, at, content, player.z);
  loot.droppedBy = player.id;
  loot.pickupFromTick = state.tick + secondsToTicks(config.loot.dropLockSeconds);
  state.events.push({ type: 'dropped', playerId: player.id, lootId: loot.id });
}

export function findInteraction(state: GameState, player: Player): Interaction {
  // A teammate to re-stitch comes first (their dropped things lie all around them).
  if (player.team !== 0) {
    let mate: Player | null = null;
    let mateD: number = config.team.reviveRange;
    for (const p of state.players) {
      if (p.team !== player.team || p.id === player.id || !revivable(state, p) || Math.abs(p.z - player.z) > 1) continue;
      const d = dist(player.pos, p.pos);
      if (d <= mateD) {
        mate = p;
        mateD = d;
      }
    }
    if (mate) return { kind: 'revive', target: mate };
  }
  let best: GroundLoot | null = null;
  let bestD: number = config.loot.weaponPickupRange;
  for (const loot of state.loot) {
    if (loot.content.type === 'item' || !inReach(player, loot.z) || lockedFor(state, player, loot)) continue;
    const d = dist(player.pos, loot.pos);
    if (d <= bestD) {
      best = loot;
      bestD = d;
    }
  }
  if (best?.content.type === 'part') return { kind: 'part', loot: best, part: best.content.part };
  if (best) return { kind: 'weapon', loot: best };

  let chest: Chest | null = null;
  let chestD: number = config.chest.interactRange;
  // A chest opens from the ground beside it or standing on it, not from a roof above.
  if (player.z > config.chest.height + config.loot.reachHeight) return null;
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

/**
 * E: a press picks up a weapon, puts on a part or starts opening a chest; holding it finishes
 * the chest. Q: a press stashes the part in reach, or with none in reach swaps the stash with
 * the part worn in its slot.
 */
export function updateInteraction(world: World, state: GameState, player: Player, input: Input): void {
  const held = (input.buttons & Btn.Interact) !== 0;
  const pressed = held && (player.heldButtons & Btn.Interact) === 0;
  const stashPressed = (input.buttons & Btn.Stash) !== 0 && (player.heldButtons & Btn.Stash) === 0;

  const action = player.action;
  if (action?.kind === 'revive') {
    const mate = state.players.find((p) => p.id === action.targetId);
    if (!held || !mate || !revivable(state, mate) || dist(player.pos, mate.pos) > config.team.reviveRange) {
      player.action = null;
    } else if (state.tick >= action.endTick) {
      player.action = null;
      revive(state, mate, player);
    }
    return;
  }
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

  if (stashPressed) {
    const target = findInteraction(state, player);
    if (target?.kind === 'part') stashPart(world, state, player, target.loot, target.part);
    else swapStash(state, player);
    return;
  }

  if (!pressed) return;
  const target = findInteraction(state, player);
  if (target?.kind === 'weapon') pickUpWeapon(world, state, player, target.loot);
  else if (target?.kind === 'part') wearPart(world, state, player, target.loot, target.part);
  else if (target?.kind === 'chest') {
    player.action = { kind: 'openChest', chestId: target.chest.id, startTick: state.tick, endTick: state.tick + OPEN_TICKS };
  } else if (target?.kind === 'revive') {
    player.action = { kind: 'revive', targetId: target.target.id, startTick: state.tick, endTick: state.tick + secondsToTicks(config.team.reviveTime) };
  }
}

/** Team mode: a knocked-out plush a teammate can still re-stitch (match on, within the window). */
export function revivable(state: GameState, p: Player): boolean {
  return (
    state.status === 'playing' &&
    !p.alive &&
    p.team !== 0 &&
    p.eliminatedTick !== null &&
    state.tick - p.eliminatedTick <= secondsToTicks(config.team.reviveWindow)
  );
}

/** Re-stitched by a teammate: back in, where they fell, with some stuffing and their starting weapons. */
export function revive(state: GameState, p: Player, by: Player): void {
  p.alive = true;
  p.stuffing = config.team.reviveStuffing;
  p.buttons = 0;
  const [a, b] = config.player.startingLoadout;
  p.weapons = [a ? makeWeapon(a.kind, a.rarity) : null, b ? makeWeapon(b.kind, b.rarity) : null];
  p.activeSlot = 0;
  p.items = [null, null, null];
  p.vel = { x: 0, y: 0 };
  p.knockback = { x: 0, y: 0 };
  p.vz = 0;
  p.action = null;
  p.chargeStartTick = null;
  p.eliminatedTick = null;
  p.eliminatedBy = null;
  p.placement = null;
  state.events.push({ type: 'revived', playerId: p.id, byId: by.id });
}

/** A Toy Box drops a weapon, an item stack and a skin part around whoever opened it. */
export function openChest(world: World, state: GameState, chest: Chest, opener: Player | null): void {
  chest.opened = true;
  const kind = pickWeighted(state.rng, config.chest.weaponWeights);
  const rolled = pickIndexWeighted(state.rng, config.chest.rarityWeights[chest.loot]) as Rarity;
  // The starting weapon from a chest is always better than the one you have.
  const rarity = kind === 'cork_popper' ? (Math.max(1, rolled) as Rarity) : rolled;
  const item = pickWeighted(state.rng, chest.loot === 'food' ? config.chest.foodItemWeights : config.chest.itemWeights);
  const part: Part = {
    slot: pick(state.rng, PART_SLOTS),
    animal: pickAnimal(state.rng),
    rarity: 0, // parts have no rarity
  };

  // Drops land to either side of the opener (60 degrees off their direction), not under them.
  const toward = opener ? unit(opener.pos.x - chest.pos.x, opener.pos.y - chest.pos.y) : { x: 0, y: 1 };
  const d = config.loot.dropDistance;
  const base = Math.atan2(toward.y, toward.x);
  // The part lands on the far side of the chest.
  const spots = [base + Math.PI / 3, base - Math.PI / 3, base + Math.PI].map((a) => ({
    x: chest.pos.x + Math.cos(a) * d,
    y: chest.pos.y + Math.sin(a) * d,
  }));
  spawnLoot(world, state, spots[0]!, { type: 'weapon', weapon: makeWeapon(kind, rarity) });
  spawnLoot(world, state, spots[1]!, { type: 'item', item: { kind: item, count: config.items[item].chestCount } });
  spawnLoot(world, state, spots[2]!, { type: 'part', part });
  state.events.push({ type: 'chestOpened', chestId: chest.id, playerId: opener?.id ?? 0 });
}

/**
 * Puts loot down at `at`, on whatever surface is there at or below `fromZ` (a plush knocked out
 * on a roof drops its things on the roof; past the edge they fall to the lawn).
 */
export function spawnLoot(world: World, state: GameState, at: Vec2, content: LootContent, fromZ = 0): GroundLoot {
  const pos = { x: at.x, y: at.y };
  pushOutOfWalls(world, pos, config.loot.radius, groundHeight(world, state, pos, fromZ));
  const z = groundHeight(world, state, pos, fromZ);
  const rarity =
    content.type === 'weapon' ? content.weapon.rarity : content.type === 'part' ? ANIMAL_RARITY[content.part.animal] : config.items[content.item.kind].rarity;
  const loot: GroundLoot = { id: state.nextId++, pos, z, rarity, content };
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
    spawnLoot(world, state, loot.pos, { type: 'weapon', weapon: old }, loot.z);
  }
  state.events.push({ type: 'pickup', playerId: player.id, lootId: loot.id, what: weapon.kind });
}

/** Puts the part on; the one worn in that slot drops where the new one lay, if it was found this match. */
function wearPart(world: World, state: GameState, player: Player, loot: GroundLoot, part: Part): void {
  removeLoot(state, loot.id);
  const old = player.parts[part.slot];
  player.parts[part.slot] = { animal: part.animal, rarity: part.rarity, found: true };
  if (old.found) spawnLoot(world, state, loot.pos, { type: 'part', part: { slot: part.slot, animal: old.animal, rarity: old.rarity } }, loot.z);
  state.events.push({ type: 'pickup', playerId: player.id, lootId: loot.id, what: 'part' });
  state.events.push({ type: 'wear', playerId: player.id, part, stashed: false });
}

/** Puts the part in the stash; a part already there drops where the new one lay. */
function stashPart(world: World, state: GameState, player: Player, loot: GroundLoot, part: Part): void {
  removeLoot(state, loot.id);
  if (player.stash) spawnLoot(world, state, loot.pos, { type: 'part', part: player.stash }, loot.z);
  player.stash = { ...part };
  state.events.push({ type: 'pickup', playerId: player.id, lootId: loot.id, what: 'part' });
  state.events.push({ type: 'wear', playerId: player.id, part, stashed: true });
}

/**
 * Puts the stashed part on. The part it replaces goes into the stash if it was found this
 * match; the plush's own part simply comes off.
 */
function swapStash(state: GameState, player: Player): void {
  const part = player.stash;
  if (!part) return;
  const old = player.parts[part.slot];
  player.parts[part.slot] = { animal: part.animal, rarity: part.rarity, found: true };
  player.stash = old.found ? { slot: part.slot, animal: old.animal, rarity: old.rarity } : null;
  state.events.push({ type: 'wear', playerId: player.id, part, stashed: false });
}

/** Items are picked up by walking over them, as long as there is room in the 3 item slots. */
export function autoPickupItems(state: GameState, player: Player): void {
  for (const loot of [...state.loot]) {
    if (loot.content.type !== 'item' || !inReach(player, loot.z) || lockedFor(state, player, loot)) continue;
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

/** True while a knocked-out plush still has something to drop. */
export function hasDrops(player: Player): boolean {
  return player.weapons.some(Boolean) || player.items.some(Boolean) || player.stash !== null || PART_SLOTS.some((s) => player.parts[s].found);
}

/**
 * Unstitched plushies burst and drop their weapons and items in a ring around them. Players keep
 * every part they found this match (and their stash): those go home with them, not to the
 * ground. Bots have no collection, so their parts drop for others to take. Their own starting
 * look stays theirs.
 */
export function dropEverything(world: World, state: GameState, player: Player): void {
  const drops: LootContent[] = [];
  for (const w of player.weapons) if (w) drops.push({ type: 'weapon', weapon: { ...w, reloadEndTick: null } });
  for (const s of player.items) if (s) drops.push({ type: 'item', item: { ...s } });
  const carried: Part[] = [];
  for (const slot of PART_SLOTS) {
    const worn = player.parts[slot];
    if (!worn.found) continue;
    carried.push({ slot, animal: worn.animal, rarity: worn.rarity });
    worn.found = false;
  }
  if (player.stash) carried.push(player.stash);
  const kept: Part[] = [];
  const dropped: Part[] = [];
  (player.isBot ? dropped : kept).push(...carried);
  for (const part of dropped) drops.push({ type: 'part', part });
  if (carried.length > 0) state.events.push({ type: 'partsDropped', playerId: player.id, kept, dropped });
  player.weapons = [null, null];
  player.items = [null, null, null];
  player.stash = null;
  drops.forEach((content, i) => {
    const a = (i / drops.length) * Math.PI * 2;
    const r = config.loot.dropDistance * 0.8;
    spawnLoot(world, state, { x: player.pos.x + Math.cos(a) * r, y: player.pos.y + Math.sin(a) * r }, content, player.z);
  });
}

function removeLoot(state: GameState, id: number): void {
  state.loot = state.loot.filter((l) => l.id !== id);
}

/** Moves loot out of walls that stand above the surface it lies on (`z`); lower ones it rests on. */
function pushOutOfWalls(world: World, pos: Vec2, r: number, z: number): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const wall of wallsNear(world, pos.x - r, pos.y - r, pos.x + r, pos.y + r)) {
      if (wall.height <= z + config.player.stepHeight) continue;
      const push = circleBoxPush(pos.x, pos.y, r, wall);
      if (!push) continue;
      pos.x += push.nx * push.depth;
      pos.y += push.ny * push.depth;
      moved = true;
    }
    if (!moved) break;
  }
  const out = config.player.roamOutside;
  pos.x = Math.min(Math.max(pos.x, -out + r), world.map.width + out - r);
  pos.y = Math.min(Math.max(pos.y, -out + r), world.map.height + out - r);
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unit(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? { x: x / len, y: y / len } : { x: 0, y: 1 };
}
