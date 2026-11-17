// Every gameplay number lives here so balancing never means hunting through systems.
// Distances are in world units: a plush is 1 unit wide (radius 0.5). Times are in seconds
// unless a name says otherwise; systems convert to ticks with secondsToTicks().
import type { ItemKind, Rarity, WeaponKind, WeaponSpec } from './types.ts';

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

export interface ItemStats {
  readonly name: string;
  /** Seconds to use; you move at items.useMoveMultiplier speed meanwhile. */
  readonly useTime: number;
  readonly stuffing: number;
  readonly buttons: number;
  /** Heals stop at this much stuffing (a Cotton Puff only patches you up to 75). */
  readonly stuffingCap: number;
  readonly maxStack: number;
  /** How many a chest drops in one stack. */
  readonly chestCount: number;
  /** Ground glow color tier; items' effects do not scale with rarity. */
  readonly rarity: Rarity;
}

const items = {
  cotton_puff: { name: 'Cotton Puff', useTime: 1, stuffing: 15, buttons: 0, stuffingCap: 75, maxStack: 5, chestCount: 2, rarity: 0 },
  sewing_kit: { name: 'Sewing Kit', useTime: 4, stuffing: 50, buttons: 0, stuffingCap: 100, maxStack: 3, chestCount: 1, rarity: 2 },
  button_pack: { name: 'Button Pack', useTime: 2, stuffing: 0, buttons: 25, stuffingCap: 100, maxStack: 3, chestCount: 1, rarity: 1 },
} as const satisfies Record<ItemKind, ItemStats>;

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
    /** Top of the plush above its feet; bullets and other plushies use it. */
    height: 1.6,
    /** Take-off speed (units/s). Apex = jumpSpeed² / (2 gravity) ≈ 1.5: clears chests, books and room walls. */
    jumpSpeed: 9.5,
    gravity: 30,
    /** Ledges up to this high are climbed without jumping, and a jump only needs to reach a top minus this. */
    stepHeight: 0.2,
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
    /** Shots leave this high above the shooter's feet and aim this high above the surface under the cursor. */
    shotHeight: 0.6,
    /** Steepest a shot can climb or dip: height change per unit traveled. */
    maxShotSlope: 0.6,
    /** Closer than this, shots fly level (no meaningful point to aim at). */
    minAimDistanceForSlope: 1.5,
  },

  vision: {
    /** Farthest distance a plush can see another (beyond the screen edge). */
    range: 30,
    /** A plush hidden in a bush is still seen from this close. */
    bushRevealDistance: 1.5,
    /** Jumping above this height takes you out of a bush. */
    bushHeight: 1.2,
  },

  chest: {
    /** Chests are solid; plushies bump into them, can stand on them, and they stop low shots. */
    radius: 0.6,
    height: 0.75,
    /** Seconds E must be held. */
    openTime: 1,
    /** Max distance from a plush's center to a chest's center to open it. */
    interactRange: 1.6,
    /** Relative odds of each weapon kind in a Toy Box. */
    weaponWeights: { cork_popper: 4, foam_dart_smg: 3.5, super_soaker: 2.5 } satisfies Record<WeaponKind, number>,
    /** Relative odds of each rarity (Hand-me-down .. One-of-a-Kind). */
    rarityWeights: [50, 28, 15, 6, 1],
    itemWeights: { cotton_puff: 4.5, sewing_kit: 2, button_pack: 3.5 } satisfies Record<ItemKind, number>,
  },

  loot: {
    /** Items are picked up by walking within this distance. */
    itemPickupRadius: 1,
    /** Weapons and parts are picked up with E (or stashed with Q) within this distance. */
    weaponPickupRange: 1.6,
    /** Loot lands this far from the chest or the knocked-out plush. */
    dropDistance: 1.4,
    radius: 0.4,
  },

  /**
   * The Rinse: after a grace period the water rises without pause, shrinking the safe circle
   * smoothly from the whole map to a random final point. Outside the circle you take damage
   * every second (stuffing only, buttons don't help) and move at player.soggySpeedMultiplier.
   */
  zone: {
    /** Seconds before the water starts rising (time to land and loot). */
    delay: 60,
    /** Seconds from the first drop of water until the circle closes completely. */
    duration: 540,
    /** Stuffing lost per second while soggy, rising linearly while the circle shrinks. */
    damagePerSecond: { start: 1, end: 10 },
    /** The final point keeps at least this share of the map size away from the edges. */
    finalCenterMargin: 0.25,
  },

  /** Movement speed multiplier while using an item. */
  itemUseMoveMultiplier: 0.5,

  weapons,
  items,
  rarity,
} as const;

export const DT = 1 / config.tickRate;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * config.tickRate);
}
