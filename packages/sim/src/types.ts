// Core simulation types. Everything in GameState is plain, JSON-serializable data so it can be
// cloned for interpolation, hashed for determinism tests and (in step 2) synced by Colyseus.
// World coordinates: x to the right, y "down" the map (renderers map y to their depth axis).

export type EntityId = number;
/** Simulation tick index; the sim runs at config.tickRate (30 Hz). */
export type Tick = number;

export interface Vec2 {
  x: number;
  y: number;
}

/** 0 Hand-me-down, 1 Store-bought, 2 Collector, 3 Limited Edition, 4 One-of-a-Kind. */
export type Rarity = 0 | 1 | 2 | 3 | 4;
export type WeaponKind = 'cork_popper' | 'foam_dart_smg' | 'super_soaker';
export type ItemKind = 'cotton_puff' | 'sewing_kit' | 'button_pack';

/** Held-button bitfield carried in Input.buttons. */
export const Btn = {
  Fire: 1,
  Interact: 2,
  Reload: 4,
} as const;

/** One player's intent for one tick. Clients and bots produce these; only the sim interprets them. */
export interface Input {
  /** Increasing per sender; used for prediction/reconciliation in step 2. */
  seq: number;
  /** -1..1; the sim clamps and normalizes. */
  moveX: number;
  moveY: number;
  /** Aim direction; the sim normalizes it and keeps the previous aim if it is zero. */
  aimX: number;
  aimY: number;
  /** Btn bitfield of held buttons. */
  buttons: number;
  /** Request to switch to weapon slot 0 or 1; -1 for none. */
  weaponSlot: -1 | 0 | 1;
  /** Request to switch to the other weapon slot (mouse wheel). */
  cycleWeapon: boolean;
  /** Request to start using the item in slot 0..2; -1 for none. */
  useItemSlot: -1 | 0 | 1 | 2;
}

export interface WeaponInstance {
  kind: WeaponKind;
  rarity: Rarity;
  /** Rounds left in the magazine; reserve ammo is infinite. */
  ammo: number;
  nextFireTick: Tick;
  reloadEndTick: Tick | null;
}

export interface ItemStack {
  kind: ItemKind;
  count: number;
}

export type PlayerAction =
  | { kind: 'openChest'; chestId: EntityId; endTick: Tick }
  | { kind: 'useItem'; slot: number; endTick: Tick };

export type PartSlot = 'head' | 'body' | 'legs' | 'tail' | 'accessory';
/** Cosmetic part ids per slot. Never affects stats or hitboxes. */
export type PartLoadout = Record<PartSlot, string>;

export interface Player {
  id: EntityId;
  name: string;
  isBot: boolean;
  pos: Vec2;
  vel: Vec2;
  knockback: Vec2;
  radius: number;
  /** Unit aim direction. */
  aim: Vec2;
  stuffing: number;
  buttons: number;
  alive: boolean;
  eliminatedTick: Tick | null;
  placement: number | null;
  weapons: [WeaponInstance | null, WeaponInstance | null];
  activeSlot: 0 | 1;
  items: [ItemStack | null, ItemStack | null, ItemStack | null];
  action: PlayerAction | null;
  inBush: boolean;
  /** Visible to others until this tick even inside a bush (set by shooting). */
  revealedUntilTick: Tick;
  parts: PartLoadout;
  lastInputSeq: number;
}

export interface Projectile {
  id: EntityId;
  ownerId: EntityId;
  weapon: WeaponKind;
  rarity: Rarity;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  damage: number;
  knockback: number;
  expireTick: Tick;
}

export interface Chest {
  id: EntityId;
  pos: Vec2;
  opened: boolean;
}

export type LootContent =
  | { type: 'weapon'; weapon: WeaponInstance }
  | { type: 'item'; item: ItemStack };

export interface GroundLoot {
  id: EntityId;
  pos: Vec2;
  rarity: Rarity;
  content: LootContent;
}

export interface Circle {
  center: Vec2;
  radius: number;
}

export interface Zone {
  /** Index into config.zone.phases; -1 before the first phase starts. */
  phase: number;
  stage: 'wait' | 'shrink' | 'final';
  stageEndTick: Tick;
  current: Circle;
  /** Circle at the start of the current shrink; `current` lerps from `from` to `next`. */
  from: Circle;
  /** Next safe circle, shown to players ahead of time. */
  next: Circle;
}

export type GameEvent =
  | { type: 'shot'; playerId: EntityId; weapon: WeaponKind }
  | { type: 'hit'; targetId: EntityId; sourceId: EntityId | null; damage: number; armorDamage: number }
  | { type: 'chestOpened'; chestId: EntityId; playerId: EntityId }
  | { type: 'itemUsed'; playerId: EntityId; item: ItemKind }
  | { type: 'eliminated'; playerId: EntityId; byId: EntityId | null; placement: number };

export type RngState = [number, number, number, number];

export interface GameState {
  tick: Tick;
  rng: RngState;
  nextId: EntityId;
  status: 'playing' | 'ended';
  winnerId: EntityId | null;
  /** Arrays stay sorted by id so iteration order is deterministic. */
  players: Player[];
  projectiles: Projectile[];
  chests: Chest[];
  loot: GroundLoot[];
  zone: Zone;
  /** Events produced during the last step only (for effects and audio). */
  events: GameEvent[];
  mapId: string;
}

/** Axis-aligned box, min corner + size. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Static map data. Not part of GameState: it never changes during a match. */
export interface MapData {
  id: string;
  width: number;
  height: number;
  walls: Box[];
  bushes: Circle[];
  spawns: Vec2[];
  chestSpawns: Vec2[];
}

export interface RosterEntry {
  name: string;
  isBot: boolean;
  /** Omitted parts are picked at random from the placeholder catalog. */
  parts?: Partial<PartLoadout>;
  /** Up to 2 weapons to start with; defaults to config.player.startingLoadout. */
  loadout?: WeaponSpec[];
}

export interface WeaponSpec {
  kind: WeaponKind;
  rarity: Rarity;
}
