import { config, secondsToTicks } from '../config.ts';
import { nextRange } from '../rng.ts';
import { Btn } from '../types.ts';
import type { GameState, Input, Player, Rarity, Vec2, WeaponInstance, WeaponKind } from '../types.ts';

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

export function updateWeapons(state: GameState, player: Player, input: Input): void {
  handleSwap(state, player, input);

  const weapon = player.weapons[player.activeSlot];
  if (!weapon) return;
  const stats = config.weapons[weapon.kind];

  if (weapon.reloadEndTick !== null && state.tick >= weapon.reloadEndTick) {
    weapon.ammo = stats.magazine;
    weapon.reloadEndTick = null;
  }
  if (input.buttons & Btn.Reload && weapon.reloadEndTick === null && weapon.ammo < stats.magazine) {
    weapon.reloadEndTick = state.tick + reloadTicks(weapon);
  }

  const canFire = weapon.reloadEndTick === null && weapon.ammo > 0 && state.tick >= weapon.nextFireTick;
  if (!(input.buttons & Btn.Fire) || !canFire) return;

  fire(state, player, weapon);
  weapon.ammo--;
  weapon.nextFireTick = state.tick + Math.max(1, secondsToTicks(stats.fireInterval));
  if (weapon.ammo === 0) weapon.reloadEndTick = state.tick + reloadTicks(weapon);
  player.revealedUntilTick = state.tick + REVEAL_TICKS;
  player.action = null; // shooting cancels opening chests and using items
}

function handleSwap(state: GameState, player: Player, input: Input): void {
  let slot: 0 | 1 = player.activeSlot;
  if (input.weaponSlot !== -1) slot = input.weaponSlot;
  else if (input.cycleWeapon) slot = player.activeSlot === 0 ? 1 : 0;
  if (slot === player.activeSlot || !player.weapons[slot]) return;

  const old = player.weapons[player.activeSlot];
  if (old) old.reloadEndTick = null; // holstering cancels a reload
  player.activeSlot = slot;
  const next = player.weapons[slot]!;
  next.nextFireTick = Math.max(next.nextFireTick, state.tick + SWAP_TICKS);
  player.action = null;
}

function fire(state: GameState, player: Player, weapon: WeaponInstance): void {
  const stats = config.weapons[weapon.kind];
  const base = Math.atan2(player.aim.y, player.aim.x);
  const cone = stats.spreadDegrees * DEG;
  const muzzle = muzzlePosition(player.pos, player.aim, weapon.kind);
  const damage = weaponDamage(weapon);
  const lifeTicks = Math.max(1, secondsToTicks(stats.range / stats.projectileSpeed));

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
      vel: { x: dx * stats.projectileSpeed, y: dy * stats.projectileSpeed },
      radius: stats.projectileRadius,
      damage,
      knockback: stats.knockback,
      expireTick: state.tick + lifeTicks,
    });
  }
  state.events.push({ type: 'shot', playerId: player.id, weapon: weapon.kind });
}
