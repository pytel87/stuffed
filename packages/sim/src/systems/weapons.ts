import { config, secondsToTicks, type WeaponStats } from '../config.ts';
import { nextRange } from '../rng.ts';
import { Btn } from '../types.ts';
import type { GameState, Input, Player, Rarity, Vec2, WeaponInstance, WeaponKind } from '../types.ts';
import { raycastWalls, type World } from '../world.ts';
import { applyDamage, teammates } from './damage.ts';
import { buildingAt, groundHeight } from './movement.ts';

const SWAP_TICKS = secondsToTicks(config.combat.weaponSwapTime);
const REVEAL_TICKS = secondsToTicks(config.combat.revealOnShot);
const DEG = Math.PI / 180;

export function makeWeapon(kind: WeaponKind, rarity: Rarity): WeaponInstance {
  return { kind, rarity, ammo: config.weapons[kind].magazine, nextFireTick: 0, reloadEndTick: null };
}

/**
 * Barrel tip of a weapon held by a plush at `pos` aiming along unit `aim`: forward by the
 * barrel length and to the shooter's right by muzzleSide. Renderers use this too.
 */
export function muzzlePosition(pos: Vec2, aim: Vec2, kind: WeaponKind): Vec2 {
  const forward = config.weapons[kind].barrelLength;
  const side = config.combat.muzzleSide;
  // The shooter's right, for x right / y down world axes.
  const rightX = -aim.y;
  const rightY = aim.x;
  return { x: pos.x + aim.x * forward + rightX * side, y: pos.y + aim.y * forward + rightY * side };
}

export function weaponDamage(w: WeaponInstance): number {
  return config.weapons[w.kind].damage * (1 + config.rarity[w.rarity].damageBonus);
}

export function reloadTicks(w: WeaponInstance): number {
  return secondsToTicks(config.weapons[w.kind].reloadTime * (1 - config.rarity[w.rarity].reloadReduction));
}

export function stats(kind: WeaponKind): WeaponStats {
  return config.weapons[kind];
}

/** How far a charge weapon is drawn (0..1), or 0 when not charging. */
export function chargeAmount(player: Pick<Player, 'chargeStartTick'>, kind: WeaponKind, tick: number): number {
  const s = stats(kind);
  if (player.chargeStartTick === null || s.mode !== 'charge') return 0;
  return Math.min(1, (tick - player.chargeStartTick) / Math.max(1, secondsToTicks(s.chargeTime ?? 1)));
}

export function updateWeapons(world: World, state: GameState, player: Player, input: Input): void {
  handleSwap(state, player, input);

  const weapon = player.weapons[player.activeSlot];
  if (!weapon) {
    player.chargeStartTick = null;
    return;
  }
  const s = stats(weapon.kind);
  const reloads = !s.consumable && s.mode !== 'melee';

  if (weapon.reloadEndTick !== null && state.tick >= weapon.reloadEndTick) {
    weapon.ammo = s.magazine;
    weapon.reloadEndTick = null;
  }
  if (reloads && input.buttons & Btn.Reload && weapon.reloadEndTick === null && weapon.ammo < s.magazine) {
    weapon.reloadEndTick = state.tick + reloadTicks(weapon);
    player.chargeStartTick = null;
  }

  const held = (input.buttons & Btn.Fire) !== 0;
  // Trying to fire an empty weapon reloads it (a reload cancelled by switching away left it empty).
  if (reloads && held && weapon.ammo === 0 && weapon.reloadEndTick === null) {
    weapon.reloadEndTick = state.tick + reloadTicks(weapon);
    player.chargeStartTick = null;
  }
  const ready = weapon.reloadEndTick === null && weapon.ammo > 0 && state.tick >= weapon.nextFireTick;

  if (s.mode === 'charge') {
    // Hold to draw the band back; it fires when you let go.
    if (held) {
      if (ready) player.chargeStartTick ??= state.tick;
      return;
    }
    if (player.chargeStartTick === null) return;
    const charge = chargeAmount(player, weapon.kind, state.tick);
    player.chargeStartTick = null;
    if (!ready) return;
    fire(world, state, player, weapon, charge, rewindFor(state, input));
  } else {
    if (!held || !ready) return;
    if (s.mode === 'melee') swing(world, state, player, weapon);
    else fire(world, state, player, weapon, 1, rewindFor(state, input));
  }

  if (s.mode !== 'melee') weapon.ammo--;
  weapon.nextFireTick = state.tick + Math.max(1, secondsToTicks(s.fireInterval));
  if (weapon.ammo === 0) {
    if (s.consumable) {
      // The last one is thrown: the slot empties; hold the other weapon if there is one.
      player.weapons[player.activeSlot] = null;
      const other: 0 | 1 = player.activeSlot === 0 ? 1 : 0;
      if (player.weapons[other]) player.activeSlot = other;
    } else {
      weapon.reloadEndTick = state.tick + reloadTicks(weapon);
    }
  }
  player.revealedUntilTick = state.tick + REVEAL_TICKS;
  player.action = null; // shooting cancels opening chests and using items
}

/**
 * Pillow Hammer: everyone in front within reach (and the swing's arc), on about the same level
 * and not behind a tall wall, gets bonked and knocked away.
 */
function swing(world: World, state: GameState, player: Player, weapon: WeaponInstance): void {
  const s = stats(weapon.kind);
  const reach = s.reach ?? 1.8;
  const halfArc = ((s.arcDegrees ?? 90) * DEG) / 2;
  for (const p of state.players) {
    if (!p.alive || p.id === player.id || p.drop || teammates(player, p)) continue;
    const dx = p.pos.x - player.pos.x;
    const dy = p.pos.y - player.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > reach + p.radius || Math.abs(p.z - player.z) > 1.2) continue;
    const off = Math.acos(Math.max(-1, Math.min(1, (dx * player.aim.x + dy * player.aim.y) / (d || 1))));
    if (off > halfArc && d > player.radius + p.radius + 0.2) continue;
    if (raycastWalls(world, player.pos, p.pos, 0, player.z + config.combat.shotHeight) !== null) continue;
    const ux = d > 1e-6 ? dx / d : player.aim.x;
    const uy = d > 1e-6 ? dy / d : player.aim.y;
    p.knockback.x += ux * s.knockback;
    p.knockback.y += uy * s.knockback;
    applyDamage(state, p, weaponDamage(weapon), player.id, { from: { x: player.pos.x, y: player.pos.y } });
    state.events.push({ type: 'bonk', playerId: player.id, targetId: p.id });
  }
  state.events.push({ type: 'shot', playerId: player.id, weapon: weapon.kind, pos: { x: player.pos.x, y: player.pos.y } });
}

function handleSwap(state: GameState, player: Player, input: Input): void {
  let slot: 0 | 1 = player.activeSlot;
  if (input.weaponSlot !== -1) slot = input.weaponSlot;
  else if (input.cycleWeapon) slot = player.activeSlot === 0 ? 1 : 0;
  if (slot === player.activeSlot || !player.weapons[slot]) return;

  const old = player.weapons[player.activeSlot];
  if (old) old.reloadEndTick = null; // holstering cancels a reload
  player.chargeStartTick = null;
  player.activeSlot = slot;
  const next = player.weapons[slot]!;
  next.nextFireTick = Math.max(next.nextFireTick, state.tick + SWAP_TICKS);
  player.action = null;
  // Switching to an empty weapon starts its reload.
  const s = config.weapons[next.kind];
  if (next.ammo === 0 && !s.consumable && s.mode !== 'melee') next.reloadEndTick = state.tick + reloadTicks(next);
}

/**
 * Shots angle toward chest height above whatever is under the aimed-at point (the lawn, a
 * wall top, a roof), so plushies on different levels can hit each other. Level when aiming
 * very close or at the same level. Indoors, the roof over you doesn't count: a shot at a spot
 * under the same roof aims at what stands on the floor there.
 */
function shotSlope(world: World, state: GameState, player: Player, z: number, speed: number): { vz: number; zEnd: number } {
  const d = player.aimDistance;
  if (d < config.combat.minAimDistanceForSlope) return { vz: 0, zEnd: z };
  const target = { x: player.pos.x + player.aim.x * d, y: player.pos.y + player.aim.y * d };
  const inside = buildingAt(world, player.pos, player.z);
  const roof = inside >= 0 ? world.map.buildings[inside]! : null;
  const sameRoof = roof && target.x > roof.x && target.x < roof.x + roof.w && target.y > roof.y && target.y < roof.y + roof.h;
  // groundHeight reaches a step above `z`: keep the reach just under the roof.
  const reachFrom = sameRoof ? roof.height - config.player.stepHeight - 0.01 : Infinity;
  const zEnd = groundHeight(world, state, target, reachFrom) + config.combat.shotHeight;
  const maxClimb = config.combat.maxShotSlope * speed;
  const vz = Math.max(-maxClimb, Math.min(maxClimb, ((zEnd - z) * speed) / d));
  return { vz, zEnd };
}

/** How far back to test this input's shots (online lag compensation; 0 offline). */
function rewindFor(state: GameState, input: Input): number {
  if (input.viewTick === undefined) return 0;
  return Math.max(0, Math.min(config.combat.maxRewindTicks, state.tick - input.viewTick));
}

function fire(world: World, state: GameState, player: Player, weapon: WeaponInstance, charge: number, rewind = 0): void {
  const stats = config.weapons[weapon.kind] as WeaponStats;
  const base = Math.atan2(player.aim.y, player.aim.x);
  const cone = stats.spreadDegrees * DEG;
  // A barrel poking through a wall fires from where it meets the wall, so the shot stops there.
  const tip = muzzlePosition(player.pos, player.aim, weapon.kind);
  const z = player.z + config.combat.shotHeight;
  const blocked = raycastWalls(world, player.pos, tip, stats.projectileRadius, z - stats.projectileRadius);
  const muzzle =
    blocked === null
      ? tip
      : { x: player.pos.x + (tip.x - player.pos.x) * blocked, y: player.pos.y + (tip.y - player.pos.y) * blocked };
  // A charge weapon fired early is weaker and slower.
  const strength = stats.mode === 'charge' ? (stats.minCharge ?? 0.3) + (1 - (stats.minCharge ?? 0.3)) * charge : 1;
  const speed = stats.projectileSpeed * (stats.mode === 'charge' ? 0.6 + 0.4 * charge : 1);
  const damage = weaponDamage(weapon) * strength;

  if (stats.mode === 'throw') {
    lob(world, state, player, weapon, muzzle, speed, damage);
    state.events.push({ type: 'shot', playerId: player.id, weapon: weapon.kind, pos: { x: player.pos.x, y: player.pos.y } });
    return;
  }

  // Bouncing marbles fly level: aiming at a wall to bank a shot shouldn't send it up the wall.
  const { vz, zEnd } = stats.bounces ? { vz: 0, zEnd: z } : shotSlope(world, state, player, z, speed);
  const lifeTicks = Math.max(1, secondsToTicks(stats.range / speed));

  for (let i = 0; i < stats.pellets; i++) {
    // Pellets spread evenly across the cone with a little jitter; single shots get random spread.
    const even = stats.pellets > 1 ? (i / (stats.pellets - 1) - 0.5) * cone : 0;
    const jitter = nextRange(state.rng, -0.5, 0.5) * (stats.pellets > 1 ? cone / stats.pellets : cone);
    const angle = base + even + jitter;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    state.projectiles.push({
      id: state.nextId++,
      ownerId: player.id,
      weapon: weapon.kind,
      rarity: weapon.rarity,
      pos: { x: muzzle.x, y: muzzle.y },
      vel: { x: dx * speed, y: dy * speed },
      z,
      vz,
      zEnd,
      radius: stats.projectileRadius,
      damage,
      knockback: stats.knockback,
      expireTick: state.tick + lifeTicks,
      ...(rewind > 0 ? { rewind } : {}),
      ...(stats.bounces ? { bounces: stats.bounces } : {}),
    });
  }
  state.events.push({ type: 'shot', playerId: player.id, weapon: weapon.kind, pos: { x: player.pos.x, y: player.pos.y } });
}

/**
 * Throws in an arc that lands where you aim (up to the weapon's range), over low cover: launched
 * from above your head with the upward speed that brings it down on the surface there.
 */
function lob(world: World, state: GameState, player: Player, weapon: WeaponInstance, from: Vec2, speed: number, damage: number): void {
  const stats = config.weapons[weapon.kind];
  const distance = Math.max(1.5, Math.min(player.aimDistance || stats.range / 2, stats.range));
  const target = { x: player.pos.x + player.aim.x * distance, y: player.pos.y + player.aim.y * distance };
  const flight = Math.hypot(target.x - from.x, target.y - from.y) / speed;
  const z0 = player.z + config.combat.throwHeight;
  const zLand = groundHeight(world, state, target, Infinity);
  const g = config.combat.throwGravity;
  const vz = (zLand - z0 + 0.5 * g * flight * flight) / Math.max(flight, 1e-3);
  state.projectiles.push({
    id: state.nextId++,
    ownerId: player.id,
    weapon: weapon.kind,
    rarity: weapon.rarity,
    pos: { x: from.x, y: from.y },
    vel: { x: player.aim.x * speed, y: player.aim.y * speed },
    z: z0,
    vz,
    zEnd: zLand,
    radius: stats.projectileRadius,
    damage,
    knockback: stats.knockback,
    // Lands by itself; this is only a backstop.
    expireTick: state.tick + secondsToTicks(flight * 2 + 1),
    lobbed: true,
  });
}
