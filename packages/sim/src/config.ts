// Every gameplay number lives here so balancing never means hunting through systems.
// Distances are in world units: a plush is 1 unit wide (radius 0.5). Times are in seconds
// unless a name says otherwise; systems convert to ticks with secondsToTicks().
import type { WeaponKind, WeaponSpec } from './types.ts';

export interface WeaponStats {
  readonly name: string;
  /** Damage per projectile at Hand-me-down rarity. */
  readonly damage: number;
  /** Seconds between shots while fire is held. */
  readonly fireInterval: number;
  readonly magazine: number;
  /** Seconds at Hand-me-down rarity; higher rarities reload faster. */
  readonly reloadTime: number;
  /** Units per second. Keep these slow enough to dodge. */
  readonly projectileSpeed: number;
  readonly projectileRadius: number;
  /** Units a projectile flies before it vanishes. */
  readonly range: number;
  /** Full cone angle. With several pellets they spread evenly across it. */
  readonly spreadDegrees: number;
  readonly pellets: number;
  /** Knockback speed (units/s) added to the target per projectile hit. */
  readonly knockback: number;
  /** Distance from the shooter's center to the barrel tip, along the aim. Matches the model. */
  readonly barrelLength: number;
}

const weapons = {
  cork_popper: {
    name: 'Cork Popper',
    damage: 18,
    fireInterval: 0.32,
    magazine: 8,
    reloadTime: 1.3,
    projectileSpeed: 26,
    projectileRadius: 0.18,
    range: 18,
    spreadDegrees: 2,
    pellets: 1,
    knockback: 0,
    barrelLength: 0.87,
  },
  foam_dart_smg: {
    name: 'Foam Dart SMG',
    damage: 8,
    fireInterval: 0.1,
    magazine: 25,
    reloadTime: 1.8,
    projectileSpeed: 30,
    projectileRadius: 0.13,
    range: 14,
    spreadDegrees: 7,
    pellets: 1,
    knockback: 0,
    barrelLength: 0.96,
  },
  super_soaker: {
    name: 'Super Soaker',
    damage: 9,
    fireInterval: 0.85,
    magazine: 4,
    reloadTime: 2.2,
    projectileSpeed: 22,
    projectileRadius: 0.16,
    range: 8,
    spreadDegrees: 30,
    pellets: 7,
    knockback: 3,
    barrelLength: 1.04,
  },
} as const satisfies Record<WeaponKind, WeaponStats>;

export interface RarityStats {
  readonly name: string;
  readonly color: string;
  /** Added to weapon damage: 0.08 = +8%. */
  readonly damageBonus: number;
  /** Removed from reload time: 0.1 = 10% faster. */
  readonly reloadReduction: number;
}

/** Indexed by Rarity (0..4). */
const rarity = [
  { name: 'Hand-me-down', color: '#9aa0a6', damageBonus: 0, reloadReduction: 0 },
  { name: 'Store-bought', color: '#4caf50', damageBonus: 0.08, reloadReduction: 0.05 },
  { name: 'Collector', color: '#3d8bfd', damageBonus: 0.16, reloadReduction: 0.1 },
  { name: 'Limited Edition', color: '#a259e6', damageBonus: 0.24, reloadReduction: 0.15 },
  { name: 'One-of-a-Kind', color: '#f5b82e', damageBonus: 0.32, reloadReduction: 0.2 },
] as const satisfies readonly RarityStats[];

export const config = {
  tickRate: 30,

  player: {
    radius: 0.5,
    maxStuffing: 100,
    maxButtons: 100,
    /** Top speed in units per second. */
    moveSpeed: 6,
    /** How quickly velocity reaches the target speed (1/s); higher feels snappier. */
    acceleration: 16,
    /** Speed multiplier while outside the safe zone ("soggy"). */
    soggySpeedMultiplier: 0.8,
    /** Knockback decay rate (1/s). */
    knockbackDecay: 8,
    /** What every plush starts with until chests exist (prototype step 4). */
    startingLoadout: [{ kind: 'cork_popper', rarity: 0 }] as readonly WeaponSpec[],
  },

  combat: {
    /** Seconds after switching weapons before the new one can fire. */
    weaponSwapTime: 0.25,
    /** Seconds a shot reveals the shooter, even inside a bush. */
    revealOnShot: 1.5,
    /** The weapon is held this far to the shooter's right of center; shots leave from there. */
    muzzleSide: 0.24,
  },

  vision: {
    /** Farthest distance a plush can see another (beyond the screen edge). */
    range: 30,
    /** A plush hidden in a bush is still seen from this close. */
    bushRevealDistance: 1.5,
  },

  weapons,
  rarity,
} as const;

export const DT = 1 / config.tickRate;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * config.tickRate);
}
