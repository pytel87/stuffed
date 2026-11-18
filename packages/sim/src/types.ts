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
export type WeaponKind =
  | 'cork_popper' | 'foam_dart_smg' | 'super_soaker'
  | 'rubber_band_rifle' | 'marble_launcher' | 'pillow_hammer' | 'glitter_bomb' | 'bubble_wand';
export type ItemKind = 'cotton_puff' | 'sewing_kit' | 'button_pack' | 'big_stuffing_bag' | 'juice_box' | 'button_pile' | 'cardboard_wall';

/** Held-button bitfield carried in Input.buttons. */
export const Btn = {
  Fire: 1,
  Interact: 2,
  Reload: 4,
  Jump: 8,
  /** Q: put the part in reach into the stash, or swap the stash with the part worn in its slot. */
  Stash: 16,
} as const;

/** One player's intent for one tick. Clients and bots produce these; only the sim interprets them. */
export interface Input {
  /** Increasing per sender; used for prediction/reconciliation in step 2. */
  seq: number;
  /** -1..1; the sim clamps and normalizes. */
  moveX: number;
  moveY: number;
  /**
   * Aim vector toward the point being aimed at. Its direction sets where shots go; its length
   * is the distance to that point, used to angle shots up or down to what's there.
   */
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
  /** Request to drop something: weapon slot 0..1, item slot 2..4, bag slot 5..7; -1 or absent for none. */
  dropSlot?: number;
  /** Request to put on the part in bag slot 0..2 (tapping it); -1 or absent for none. */
  wearBagSlot?: number;
  /**
   * Online: the tick of the other plushies the player was looking at when they made this input
   * (they're drawn a little in the past). Shots are checked against where targets were then.
   */
  viewTick?: number;
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
  | { kind: 'openChest'; chestId: EntityId; startTick: Tick; endTick: Tick }
  | { kind: 'useItem'; slot: number; item: ItemKind; startTick: Tick; endTick: Tick }
  /** Team mode: re-stitching a knocked-out teammate. */
  | { kind: 'revive'; targetId: EntityId; startTick: Tick; endTick: Tick };

export type PartSlot = 'head' | 'body' | 'legs' | 'tail' | 'accessory';
/** Every animal has one part for each slot. */
export type Animal =
  | 'bear' | 'frog' | 'shark' | 'chicken' | 'dino' | 'owl' | 'axolotl' | 'penguin'
  | 'bunny' | 'unicorn' | 'cat' | 'fox' | 'panda' | 'pig' | 'lion' | 'elephant'
  | 'turtle' | 'hedgehog' | 'koala' | 'octopus';

/** A skin part: purely cosmetic, never changes stats or hitboxes. */
export interface Part {
  slot: PartSlot;
  animal: Animal;
  rarity: Rarity;
}

/** A part in someone's collection (and how they can start a match wearing it). */
export interface OwnedPart {
  animal: Animal;
  rarity: Rarity;
}

export interface WornPart {
  animal: Animal;
  rarity: Rarity;
  /** Picked up this match, so it drops when the plush is Unstitched. A plush's own look doesn't. */
  found: boolean;
}

export type PartLoadout = Record<PartSlot, WornPart>;

export interface Player {
  id: EntityId;
  name: string;
  isBot: boolean;
  /** Team mode: plushies on the same team (not 0) can't hurt each other and always see each other. */
  team: number;
  pos: Vec2;
  vel: Vec2;
  /** Height of the plush's feet above the ground (0 on the lawn, more on top of things). */
  z: number;
  /** Vertical speed, units per second (positive = up). */
  vz: number;
  knockback: Vec2;
  radius: number;
  /** Unit aim direction. */
  aim: Vec2;
  /** Distance to the aimed-at point (from the last input). */
  aimDistance: number;
  stuffing: number;
  buttons: number;
  alive: boolean;
  eliminatedTick: Tick | null;
  /** Final rank: 1 for the winner, N for the first one out of N. */
  placement: number | null;
  /** Who knocked this plush out (null = the Rinse or nobody yet). */
  eliminatedBy: EntityId | null;
  /** Plushies this one knocked out. */
  knockouts: number;
  /** Damage this plush dealt to others (stuffing and buttons). */
  damageDealt: number;
  weapons: [WeaponInstance | null, WeaponInstance | null];
  activeSlot: 0 | 1;
  items: [ItemStack | null, ItemStack | null, ItemStack | null];
  action: PlayerAction | null;
  inBush: boolean;
  /** Outside the safe circle: slower and losing stuffing every second. */
  soggy: boolean;
  /** Index into MapData.buildings of the roofed building this plush stands in, or -1. */
  building: number;
  /** Visible to others until this tick even inside a bush (set by shooting). */
  revealedUntilTick: Tick;
  /** Holding fire with a charge weapon (Rubber Band Rifle) since this tick; null when not. */
  chargeStartTick: Tick | null;
  /** Trapped in a bubble until this tick: can't move, shoot, pick up or use items. */
  bubbledUntil: Tick;
  /** Covered in glitter until this tick: sparkles, and can't hide in bushes or under roofs. */
  glitteredUntil: Tick;
  /** A Juice Box keeps healing and speeding this plush up until this tick. */
  juiceUntil: Tick;
  /**
   * The Toss: 'riding' the blimp over the yard (hidden, waiting to drop), 'gliding' down under an
   * umbrella (steerable, can't shoot or be hurt), or null once on the ground.
   */
  drop: 'riding' | 'gliding' | null;
  parts: PartLoadout;
  /**
   * The bag: up to config.parts.bagSize spare parts, not shown on the plush. Kept at the end of a
   * match; dropped for others if knocked out (worn parts are always kept).
   */
  stash: Part[];
  lastInputSeq: number;
  /** Buttons held last tick, to detect presses (E to pick up). */
  heldButtons: number;
}

export interface Projectile {
  id: EntityId;
  ownerId: EntityId;
  weapon: WeaponKind;
  rarity: Rarity;
  pos: Vec2;
  vel: Vec2;
  /** Flight height. Only hits what it overlaps vertically. */
  z: number;
  /** Climb or dip speed (units/s) until the shot reaches zEnd; then it flies level. */
  vz: number;
  zEnd: number;
  radius: number;
  damage: number;
  knockback: number;
  expireTick: Tick;
  /** Lag compensation: hits are checked against where plushies were this many ticks ago. */
  rewind?: number;
  /** Wall bounces left (Marble Launcher); bursts on the next wall when 0. */
  bounces?: number;
  /** Lobbed (Glitter Bomb): falls under gravity and bursts where it lands. */
  lobbed?: boolean;
}

/** How good a chest's loot is: rarer at 'high'; 'food' favors healing items. */
export type LootLevel = 'low' | 'medium' | 'high' | 'food';

export interface Chest {
  id: EntityId;
  pos: Vec2;
  opened: boolean;
  loot: LootLevel;
}

export type LootContent =
  | { type: 'weapon'; weapon: WeaponInstance }
  | { type: 'item'; item: ItemStack }
  | { type: 'part'; part: Part };

export interface GroundLoot {
  id: EntityId;
  pos: Vec2;
  /** Height of the surface it lies on (the lawn, a roof, a crate top). */
  z: number;
  /** Dropped by this plush, who can't pick it up again before `pickupFromTick`. */
  droppedBy?: EntityId;
  pickupFromTick?: Tick;
  rarity: Rarity;
  content: LootContent;
}

export interface Circle {
  center: Vec2;
  radius: number;
}

export interface Zone {
  /** 'waiting' before the water rises, 'shrinking' while it does, 'closed' at radius 0. */
  stage: 'waiting' | 'shrinking' | 'closed';
  /** The circle shrinks linearly from `start` (at startTick) to `end` (at endTick). */
  startTick: Tick;
  endTick: Tick;
  start: Circle;
  /** Radius 0 at the final point. */
  end: Circle;
  current: Circle;
  /** Multiplies the delay and duration (1 = as configured; tests and playtests use less). */
  timeScale: number;
}

export type GameEvent =
  /** `pos`: where the shooter stood (so you can tell where shots come from, even unseen). */
  | { type: 'shot'; playerId: EntityId; weapon: WeaponKind; pos: Vec2 }
  /** `from`: where the damage came from (back along the shot, a burst's middle, the swinger), for a direction hint. */
  | { type: 'hit'; targetId: EntityId; sourceId: EntityId | null; damage: number; armorDamage: number; from?: Vec2 }
  | { type: 'chestOpened'; chestId: EntityId; playerId: EntityId }
  | { type: 'itemUsed'; playerId: EntityId; item: ItemKind }
  | { type: 'pickup'; playerId: EntityId; lootId: EntityId; what: WeaponKind | ItemKind | 'part' }
  /**
   * A knocked-out plush's found parts: `kept` (the ones it wore) go to the player's collection;
   * `dropped` (the bag, or everything for a bot) fall to the ground for others.
   */
  | { type: 'partsDropped'; playerId: EntityId; kept: Part[]; dropped: Part[] }
  /** Put on a part (from the ground or the bag), or put one in the bag. */
  | { type: 'wear'; playerId: EntityId; part: Part; stashed: boolean }
  | { type: 'eliminated'; playerId: EntityId; byId: EntityId | null; placement: number }
  /** Team mode: a knocked-out plush re-stitched by a teammate. */
  | { type: 'revived'; playerId: EntityId; byId: EntityId }
  /** The Rinse started rising, or closed completely. */
  | { type: 'zone'; stage: Zone['stage'] }
  /** A projectile stopped against a wall. */
  | { type: 'impact'; pos: Vec2; weapon: WeaponKind }
  /** A marble or glitter bomb burst here, affecting everything within `radius`. */
  | { type: 'burst'; pos: Vec2; z: number; weapon: WeaponKind; radius: number }
  /** A marble bounced off a wall. */
  | { type: 'bounce'; pos: Vec2 }
  /** The toy train shoved a plush out of its way. */
  | { type: 'trainBump'; playerId: EntityId; pos: Vec2 }
  /** A beach ball rolled into goal `goal` (index in map.goals). */
  | { type: 'goal'; goal: number; ballId: number; pos: Vec2 }
  /** A plush ran into a beach ball and got bounced back (`pos`: the ball's center). */
  | { type: 'ballBounce'; playerId: EntityId; ballId: number; pos: Vec2 }
  /** A Pillow Hammer swing landed on someone (the swing itself is a 'shot'). */
  | { type: 'bonk'; playerId: EntityId; targetId: EntityId }
  /** Dropped something on purpose. */
  | { type: 'dropped'; playerId: EntityId; lootId: EntityId }
  /** A Bouncy Ball dash. */
  /** A Cardboard Wall went up, or was shot down. */
  | { type: 'wallPlaced'; wallId: EntityId; playerId: EntityId }
  | { type: 'wallBroken'; wallId: EntityId; pos: Vec2 }
  /** A plush got trapped in a bubble (or popped out of one). */
  | { type: 'bubble'; playerId: EntityId; trapped: boolean };

export type RngState = [number, number, number, number];

export interface GameState {
  tick: Tick;
  rng: RngState;
  nextId: EntityId;
  status: 'playing' | 'ended';
  winnerId: EntityId | null;
  /** Team mode: the team left standing at the end (winnerId is then null). */
  winnerTeam: number | null;
  /** Arrays stay sorted by id so iteration order is deterministic. */
  players: Player[];
  projectiles: Projectile[];
  chests: Chest[];
  loot: GroundLoot[];
  /** Cardboard Walls standing right now, oldest first. */
  placedWalls: PlacedWall[];
  /** Beach balls rolling around (the map's 'ball' walls become these at the start). */
  balls: Ball[];
  /** Goals scored in each of the map's beach ball goals. */
  goals: number[];
  /** The Toss: the blimp flies from `from` to `to` between these ticks; null without one. */
  toss: Toss | null;
  zone: Zone;
  /** Events produced during the last step only (for effects and audio). */
  events: GameEvent[];
  mapId: string;
}

/** A beach ball goal (a mini-game by the pool): its mouth, and which way it opens. */
export interface Goal {
  mouth: Box;
  /** The side the ball comes in from. */
  opens: 'north' | 'south';
}

/** A beach ball: rolls when a plush runs into it or a shot hits it. `id` is its index. */
export interface Ball {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  /** Where it goes back to after a goal. */
  home: Vec2;
  /** A rubber duck: it floats, and stays in its pool. */
  kind?: 'duck';
}

/** Axis-aligned box, min corner + size. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How a wall looks. The sim only cares about its box and height. */
export type WallKind =
  | 'block' | 'cardboard' | 'book' | 'brick' | 'plank' | 'crate' | 'barrel' | 'trunk'
  | 'bench' | 'table-leg' | 'sandcastle' | 'bucket' | 'planter' | 'ball' | 'basket' | 'goal' | 'train'
  /** A kiddie pool's inflatable rim, as small blocks round it (drawn with the pool). */
  | 'rim'
  /** A rubber duck floating in a pool: it becomes a pushable ball (see Ball). */
  | 'duck';

export interface Toss {
  from: Vec2;
  to: Vec2;
  startTick: Tick;
  endTick: Tick;
}

/** A Cardboard Wall someone put up: a wall that breaks when shot enough and folds away in time. */
export interface PlacedWall extends Wall {
  id: EntityId;
  ownerId: EntityId;
  health: number;
  expireTick: Tick;
}

/** A solid box standing on the ground. Plushies can jump onto and over walls low enough. */
export interface Wall extends Box {
  height: number;
  /** Look only; without it the renderer picks one from the height. */
  kind?: WallKind;
}

/**
 * A roofed area. Its roof is a floor at `height` that plushies can walk on; a plush under it
 * (inside the area, below the roof) is hidden from everyone outside and can't jump.
 */
export interface Building extends Box {
  height: number;
  /** Roof look only. */
  kind?: 'cardboard' | 'house' | 'shed' | 'treehouse' | 'table' | 'bed' | 'desk';
}

/** A patch of ground drawn differently (no effect on play). */
export interface Ground {
  kind: 'sand' | 'dirt' | 'blanket' | 'stones' | 'floor' | 'rug';
  box?: Box;
  circle?: Circle;
}

/** Where a chest stands and how good its loot is (medium when omitted). */
export interface ChestSpawn extends Vec2 {
  loot?: LootLevel;
}

/** A named area, for the name banner when you walk in. */
export interface MapZone {
  name: string;
  center: Vec2;
  /** Roughly how far from the center it reaches. */
  radius: number;
}

/** Static map data. Not part of GameState: it never changes during a match. */
export interface MapData {
  id: string;
  /** How it looks: a lawn with leafy bushes, or a bedroom floor with laundry piles. */
  theme?: 'backyard' | 'bedroom';
  width: number;
  height: number;
  walls: Wall[];
  bushes: Circle[];
  /** Roofed areas. Walls do not block sight; bushes and roofs hide plushies. */
  buildings: Building[];
  spawns: Vec2[];
  chestSpawns: ChestSpawn[];
  /** Shallow water: plushies wading in it move slower. */
  pools?: Circle[];
  /** Beach ball goals: a ball whose center rolls into `mouth` scores (the frame is in walls). */
  goals?: Goal[];
  grounds?: Ground[];
  zones?: MapZone[];
  /** Things lying on the floor just for looks (no effect on play). */
  decor?: Decor[];
  /** A toy train running round an oval track (see systems/train.ts). */
  track?: TrainTrack;
}

/** An oval train track and the train on it. */
export interface TrainTrack {
  center: Vec2;
  rx: number;
  ry: number;
  /** Units per second. */
  speed: number;
  cars: number;
}

/** A bit of floor clutter, drawn only: crayons, drawings, socks, a train track... */
export interface Decor {
  kind: 'track' | 'crayon' | 'paper' | 'sock' | 'puzzle' | 'marbles' | 'car';
  x: number;
  y: number;
  /** Turn (radians). */
  turn?: number;
  /** The track: its half-width and half-depth. */
  rx?: number;
  ry?: number;
}

export interface RosterEntry {
  name: string;
  isBot: boolean;
  /** Team mode: a team number (0 or omitted: on your own). */
  team?: number;
  /** The plush's own look (Hand-me-down when only an animal is given); omitted slots get a random animal. Own parts never drop. */
  parts?: Partial<Record<PartSlot, Animal | OwnedPart>>;
  /** Up to 2 weapons to start with; defaults to config.player.startingLoadout. */
  loadout?: WeaponSpec[];
}

export interface WeaponSpec {
  kind: WeaponKind;
  rarity: Rarity;
}
