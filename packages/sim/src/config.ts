// Every gameplay number lives here so balancing never means hunting through systems.
// Distances are in world units: a plush is 1 unit wide (radius 0.5). Times are in seconds
// unless a name says otherwise; systems convert to ticks with secondsToTicks().
import type { ItemKind, LootLevel, Rarity, WeaponKind, WeaponSpec } from './types.ts';

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
  /**
   * How firing works: 'auto' fires while held; 'charge' fires on release, stronger the longer it
   * was held; 'melee' swings at whoever is in reach; 'throw' lobs to where you aim.
   */
  readonly mode?: 'auto' | 'charge' | 'melee' | 'throw';
  /** Charge: seconds to full strength. A quick tap fires at minCharge strength. */
  readonly chargeTime?: number;
  readonly minCharge?: number;
  /** Bursts (on a hit, its last bounce, landing or running out of range) hurting everyone within this radius. */
  readonly blastRadius?: number;
  /** Wall bounces before bursting. */
  readonly bounces?: number;
  /** Melee: how far and how wide the swing reaches. */
  readonly reach?: number;
  readonly arcDegrees?: number;
  /** What a hit or burst does besides damage, and for how long (seconds). */
  readonly effect?: 'bubble' | 'glitter';
  readonly effectTime?: number;
  /** Used up when empty instead of reloading (throwables). */
  readonly consumable?: boolean;
}

const weapons: Record<WeaponKind, WeaponStats> = {
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
  rubber_band_rifle: {
    name: 'Rubber Band Rifle',
    // At full charge; a tap does minCharge of it, flying slower.
    damage: 52,
    fireInterval: 0.5,
    magazine: 3,
    reloadTime: 2.4,
    projectileSpeed: 46,
    projectileRadius: 0.12,
    range: 34,
    spreadDegrees: 0,
    pellets: 1,
    knockback: 2,
    barrelLength: 1.02,
    mode: 'charge',
    chargeTime: 1.1,
    minCharge: 0.3,
  },
  marble_launcher: {
    name: 'Marble Launcher',
    // In the middle of the burst; less toward its edge.
    damage: 30,
    fireInterval: 0.9,
    magazine: 4,
    reloadTime: 2.6,
    projectileSpeed: 15,
    projectileRadius: 0.2,
    range: 17,
    spreadDegrees: 3,
    pellets: 1,
    knockback: 7,
    barrelLength: 0.92,
    blastRadius: 2.4,
    bounces: 2,
  },
  pillow_hammer: {
    name: 'Pillow Hammer',
    damage: 26,
    fireInterval: 0.7,
    magazine: 1,
    reloadTime: 0,
    projectileSpeed: 0,
    projectileRadius: 0,
    range: 0,
    spreadDegrees: 0,
    pellets: 0,
    knockback: 15,
    barrelLength: 0.8,
    mode: 'melee',
    reach: 1.9,
    arcDegrees: 120,
  },
  glitter_bomb: {
    name: 'Glitter Bomb',
    damage: 6,
    fireInterval: 0.8,
    magazine: 2,
    reloadTime: 0,
    projectileSpeed: 13,
    projectileRadius: 0.22,
    range: 14,
    spreadDegrees: 0,
    pellets: 1,
    knockback: 0,
    barrelLength: 0.5,
    mode: 'throw',
    blastRadius: 3.5,
    effect: 'glitter',
    effectTime: 3,
    consumable: true,
  },
  bubble_wand: {
    name: 'Bubble Wand',
    damage: 12,
    fireInterval: 0.7,
    magazine: 3,
    reloadTime: 2,
    projectileSpeed: 9,
    projectileRadius: 0.35,
    range: 11,
    spreadDegrees: 2,
    pellets: 1,
    knockback: 0,
    barrelLength: 0.95,
    effect: 'bubble',
    effectTime: 1.5,
  },
};

export interface ItemStats {
  readonly name: string;
  /** Seconds to use; you move at items.useMoveMultiplier speed meanwhile. */
  readonly useTime: number;
  readonly stuffing: number;
  readonly buttons: number;
  /** Heals stop at this much stuffing. */
  readonly stuffingCap: number;
  readonly maxStack: number;
  /** How many a chest drops in one stack. */
  readonly chestCount: number;
  /** Ground glow color tier; items' effects do not scale with rarity. */
  readonly rarity: Rarity;
  /** Special effects: a Juice Box buff, a Cardboard Wall. */
  readonly effect?: 'juice' | 'wall';
}

const items: Record<ItemKind, ItemStats> = {
  cotton_puff: { name: 'Cotton Puff', useTime: 1, stuffing: 15, buttons: 0, stuffingCap: 100, maxStack: 5, chestCount: 2, rarity: 0 },
  sewing_kit: { name: 'Sewing Kit', useTime: 4, stuffing: 50, buttons: 0, stuffingCap: 100, maxStack: 3, chestCount: 1, rarity: 2 },
  button_pack: { name: 'Button Pack', useTime: 2, stuffing: 0, buttons: 25, stuffingCap: 100, maxStack: 3, chestCount: 1, rarity: 1 },
  big_stuffing_bag: { name: 'Big Stuffing Bag', useTime: 8, stuffing: 100, buttons: 0, stuffingCap: 100, maxStack: 1, chestCount: 1, rarity: 3 },
  juice_box: { name: 'Juice Box', useTime: 2, stuffing: 0, buttons: 0, stuffingCap: 100, maxStack: 2, chestCount: 1, rarity: 2, effect: 'juice' },
  // The big armor: like the Sewing Kit is to the Cotton Puff.
  button_jar: { name: 'Button Jar', useTime: 4, stuffing: 0, buttons: 50, stuffingCap: 100, maxStack: 2, chestCount: 1, rarity: 2 },
  cardboard_wall: { name: 'Cardboard Wall', useTime: 1, stuffing: 0, buttons: 0, stuffingCap: 100, maxStack: 2, chestCount: 1, rarity: 1, effect: 'wall' },
};

/** Tuning for the items with special effects. */
const itemEffects = {
  /** Juice Box: stuffing per second while it lasts, for this long, and a speed boost meanwhile. */
  juice: { regenPerSecond: 5, seconds: 10, speedMultiplier: 1.15 },
  /** Cardboard Wall: size, how far in front it stands, how long, how many hits' worth of damage. */
  wall: { length: 3, thickness: 0.5, height: 1.4, distance: 1.6, seconds: 20, health: 60, perPlayer: 3 },
} as const;

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
    /**
     * How far past the map's edges a plush can wander. There's no fence: the Rinse's foam is the
     * edge you see (past it you're soggy); this hard stop is far out, deep in the water.
     */
    roamOutside: 40,
    /** Wading in a pool (Kiddie Pool). */
    wadeSpeedMultiplier: 0.6,
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
    /** Lobbed throws: launch height above the feet and how fast they fall (units/s²). */
    throwHeight: 1.4,
    throwGravity: 22,
    /** Movement speed while charging a Rubber Band Rifle. */
    chargeMoveMultiplier: 0.65,
    /** A burst at the edge of its radius does this share of its damage (full in the middle). */
    blastEdgeDamage: 0.4,
    /** Seen this far while blinded by glitter. */
    blindVision: 3,
    /**
     * Lag compensation: online, shots are tested against where plushies were when the shooter
     * saw them, at most this many ticks back (a third of a second), so laggy shots can't reach
     * far into the past.
     */
    maxRewindTicks: 10,
  },

  vision: {
    /** Farthest distance a plush can see another (beyond the screen edge). */
    range: 30,
    /** A plush hidden in a bush is still seen from this close. */
    bushRevealDistance: 1.5,
    /** Jumping above this height takes you out of a bush. */
    bushHeight: 1.2,
  },

  /**
   * The Toss: everyone starts on a toy blimp crossing the yard and drops off when they like,
   * gliding down under an umbrella.
   */
  toss: {
    /** Blimp height and speed (units/s). */
    height: 14,
    speed: 8,
    /** Half the length of its flight line, centered near the middle of the map. */
    reach: 72,
    /** The line passes this close to the map's center, at most. */
    centerOffset: 16,
    /** Gliding: steering speed and how fast you sink (units/s). */
    glideSpeed: 9,
    fallSpeed: 3,
  },

  parts: {
    /** How many spare parts the bag holds (dropped if you're knocked out; worn ones are kept). */
    bagSize: 3,
    /** Relative odds of a chest's part being each animal, by the animal's rarity (1-4). */
    animalWeights: [0, 6, 4, 3, 2],
  },

  chest: {
    /** Chests are solid; plushies bump into them, can stand on them, and they stop low shots. */
    radius: 0.6,
    height: 0.75,
    /** Seconds E must be held. */
    openTime: 1,
    /** Max distance from a plush's center to a chest's center to open it. */
    interactRange: 1.6,
    /**
     * Relative odds of each weapon kind in a Toy Box. Everyone starts with a Cork Popper, so a
     * chest rarely gives one (about 1 in 15), and never a plain Hand-me-down one.
     */
    weaponWeights: {
      cork_popper: 1,
      foam_dart_smg: 3,
      super_soaker: 2.5,
      rubber_band_rifle: 1.5,
      marble_launcher: 1.5,
      pillow_hammer: 2,
      glitter_bomb: 1.5,
      bubble_wand: 1.5,
    } satisfies Record<WeaponKind, number>,
    /** Relative odds of each rarity (Hand-me-down .. One-of-a-Kind), by the chest's loot level. */
    rarityWeights: {
      low: [64, 25, 9, 2, 0],
      medium: [50, 28, 15, 6, 1],
      high: [30, 32, 24, 11, 3],
      food: [50, 28, 15, 6, 1],
    } satisfies Record<LootLevel, readonly number[]>,
    itemWeights: {
      cotton_puff: 4,
      sewing_kit: 2,
      button_pack: 3,
      big_stuffing_bag: 0.6,
      juice_box: 1.5,
      button_jar: 1.2,
      cardboard_wall: 1.6,
    } satisfies Record<ItemKind, number>,
    /** Food crates (picnic) favor healing. */
    foodItemWeights: {
      cotton_puff: 5,
      sewing_kit: 4,
      button_pack: 1,
      big_stuffing_bag: 2,
      juice_box: 3,
      button_jar: 0.5,
      cardboard_wall: 0.5,
    } satisfies Record<ItemKind, number>,
  },

  /** Team mode. */
  team: {
    /** Seconds a knocked-out plush can still be re-stitched by a teammate. */
    reviveWindow: 30,
    /** Seconds of holding E beside them to re-stitch them. */
    reviveTime: 3,
    /** How close the teammate must stand. */
    reviveRange: 1.8,
    /** Stuffing they come back with (and their starting weapons). */
    reviveStuffing: 50,
  },

  /**
   * Beach balls: run into one and it rolls off (and you bounce back a little); shots knock it
   * too. They roll off walls, chests and each other and slow down on the grass.
   */
  beachBall: {
    /** Speed (units/s) a plush is bounced away at. */
    bounce: 5,
    /** Slower bumps (units/s toward the ball) just nudge it along, without a bounce. */
    minImpact: 2,
    /** A kick: the ball leaves at this much of the plush's speed into it, plus `kickBase`. */
    kickFactor: 1.6,
    kickBase: 3,
    /** A shot hitting it adds this speed along the shot. */
    shotPush: 3,
    maxSpeed: 16,
    /** How quickly rolling slows (1/s). */
    friction: 0.8,
    /** Speed kept bouncing off a wall, chest or another ball. */
    restitution: 0.75,
    /** Walls lower than this it rolls over (low borders, the lawn's edges). */
    minWallHeight: 0.25,
  },

  loot: {
    /** Items are picked up by walking within this distance. */
    itemPickupRadius: 1,
    /** Weapons and parts are picked up with E (or stashed with Q) within this distance. */
    weaponPickupRange: 1.6,
    /**
     * How far above or below a plush's feet loot (and a chest's base) can be and still be picked
     * up (or opened): from a roof you can't reach what lies on the lawn below.
     */
    reachHeight: 0.8,
    /** Something dropped on purpose lands this far in front, and its dropper can't take it back for this long. */
    dropAhead: 1.2,
    dropLockSeconds: 2,
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
  itemEffects,
  rarity,
} as const;

export const DT = 1 / config.tickRate;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * config.tickRate);
}
