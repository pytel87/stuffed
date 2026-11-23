// Messages between browser and game server (JSON over WebSocket). Shared so both sides agree.
import { DEFAULT_PARTS } from '../parts.ts';
import { circleAt } from '../systems/zone.ts';
import type { BotLevel } from '../bots/brain.ts';
import type { ButtonAward } from '../economy.ts';
import type { Ball, Chest, EntityId, GameEvent, GameState, GroundLoot, Input, OwnedPart, Part, PartSlot, PinataState, PlacedWall, Player, Projectile, Strike, StrikeButtonState, Toss, ToyState, WeaponInstance, Zone } from '../types.ts';

export const PROTOCOL_VERSION = 21;
/** Plushies per match, humans and bots together. */
export const MAX_PLAYERS = 16;
/** The server sends a snapshot every this many ticks (1 = 30 per second: others drawn fresher). */
export const SNAPSHOT_EVERY = 1;

/** Room codes: 4 consonants (no accidental words; no I, L, O, U, Y). About 130k codes. */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKMNPQRSTVWXZ';
export const ROOM_CODE_LENGTH = 4;

export function generateRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  return code;
}

/** Uppercases and trims; null if it can't be a valid code. */
export function parseRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

export type ClientMessage =
  /** First message on every connection. `token` identifies the seat across reconnects. */
  /** `profile` is the device's profile token, if it has one (for its look and keeping parts). */
  | { t: 'hello'; v: number; name: string; token: string; profile?: string }
  /** One per client tick (30 per second) while playing. */
  | { t: 'input'; i: Input }
  /** Host only: start a match (from the lobby or after one ends). */
  | { t: 'start'; bots: number; teams?: boolean; level?: BotLevel; mapId?: string }
  /** Change your name in the lobby. */
  | { t: 'rename'; name: string }
  /** Your look changed in the Wardrobe: the room re-reads your profile for the next match. */
  | { t: 'look' }
  /** Host, after a match: everyone back to this room's lobby (to change the map, bots...). */
  | { t: 'lobby' }
  /** Host, in the lobby: the map picked (the warm-up moves there). */
  | { t: 'map'; mapId: string }
  | { t: 'ping'; c: number };

export interface LobbySeat {
  seat: number;
  name: string;
  connected: boolean;
  host: boolean;
}

export type RoomPhase = 'lobby' | 'playing' | 'ended';

export type ServerMessage =
  | { t: 'welcome'; code: string; seat: number | null }
  /**
   * `public`: a matchmade room (no host; it starts by itself, at `startsAt` ms since 1970 at the
   * latest). `solo`: one player against bots, started as soon as they're in (no lobby).
   */
  | { t: 'lobby'; phase: RoomPhase; seats: LobbySeat[]; bots: number; teams?: boolean; public?: boolean; startsAt?: number | null; solo?: boolean }
  /** A match started; `you` is your plush, or null when you only watch. */
  /** `warmup`: the lobby's warm-up (play around, nobody gets hurt) until the real match starts. */
  | { t: 'start'; mapId: string; you: EntityId | null; warmup?: boolean }
  /** The match as you can see it (see CompactSnapshot below). */
  | CompactSnapshot
  | { t: 'pong'; c: number; s: number }
  /** After a match: the parts that went into your collection. */
  | { t: 'kept'; parts: Part[] }
  /** The Buttons this match earned you (sent once, when your result is final). */
  | { t: 'buttons'; award: ButtonAward; balance: number }
  | { t: 'error'; code: 'version' | 'full' | 'not_host' | 'bad_message' };

// ---------- profiles (HTTP API, see apps/server) ----------

/** The look a profile starts every match in: one owned part per slot. */
export type Look = Record<PartSlot, OwnedPart>;

/** A part in a collection, and how many times it was kept. */
export interface OwnedEntry extends Part {
  count: number;
}

export interface Profile {
  id: string;
  /** Typed on another device to play the same profile there. */
  recovery: string;
  look: Look;
  parts: OwnedEntry[];
  /** Buttons (Knoflíky) to spend in the shop. */
  buttons: number;
  /** The account it's linked to (a parent's Google sign-in), if any. */
  account?: { email: string } | null;
}

/** One of an account's profiles, as offered when signing in on a device: enough to tell them apart. */
export interface ProfileSummary {
  id: string;
  look: Look;
  /** Distinct parts and complete sets collected, and Buttons. */
  parts: number;
  sets: number;
  buttons: number;
}

/** Rounds floats so snapshots stay small (millimeter precision is plenty). */
export function compactJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
}

// ---------- compact snapshots ----------
//
// Each update carries what moves (visible living plushies, projectiles, events) plus, only when
// they changed since this player's previous update, the slow parts: chests, loot, the zone's
// plan, everyone's name and look, and knocked-out plushies. The client keeps the slow parts and
// rebuilds a full GameState; the zone's current circle is computed from the tick.

/** Who a plush is: sent once and when it changes. */
export interface RosterEntry {
  id: EntityId;
  name: string;
  isBot: boolean;
  parts: Player['parts'];
  radius: number;
  team: number;
}

/** Your own living plush, sent in full every update (prediction needs it all). */
export type MovingPlayer = Omit<Player, 'name' | 'isBot' | 'parts' | 'radius' | 'team'>;

/** Someone else's living plush: only what drawing it needs. */
export interface SeenPlayer extends Pick<
  Player,
  | 'id' | 'pos' | 'vel' | 'z' | 'vz' | 'aim' | 'stuffing' | 'patches' | 'activeSlot' | 'action' | 'inBush' | 'soggy' | 'building' | 'revealedUntilTick'
  | 'chargeStartTick' | 'bubbledUntil' | 'glitteredUntil' | 'soakedUntil' | 'juiceUntil' | 'drop' | 'umbrella' | 'ride'
> {
  weapons: [WeaponLook | null, WeaponLook | null];
}
export type WeaponLook = Pick<WeaponInstance, 'kind' | 'rarity' | 'reloadEndTick'>;

/** A projectile as drawn. */
export type SeenProjectile = Pick<Projectile, 'id' | 'ownerId' | 'weapon' | 'rarity' | 'pos' | 'vel' | 'z'>;

export type ZonePlan = Omit<Zone, 'current'>;

export interface CompactSnapshot {
  t: 'snap';
  tick: number;
  status: GameState['status'];
  winnerId: EntityId | null;
  winnerTeam?: number | null;
  victoryUntil?: number | null;
  mapId: string;
  nextId: number;
  me?: MovingPlayer;
  others: SeenPlayer[];
  projectiles: SeenProjectile[];
  ev: GameEvent[];
  chests?: Chest[];
  strikeButton?: StrikeButtonState | null;
  strikes?: Strike[];
  pinata?: PinataState | null;
  toy?: ToyState | null;
  seesaws?: GameState['seesaws'];
  catapults?: GameState['catapults'];
  games?: GameState['games'];
  wanderers?: GameState['wanderers'];
  /** Loot that appeared or changed (moved) since the last update, and ids that are gone. */
  lootUp?: GroundLoot[];
  lootGone?: EntityId[];
  walls?: PlacedWall[];
  toss?: Toss | null;
  zone?: ZonePlan;
  roster?: RosterEntry[];
  fallen?: Player[];
  /** Beach balls, when any moved since the last update. */
  balls?: Ball[];
  /** Goal scores, when they changed. */
  goals?: number[];
}

/** Per-connection memory of the slow parts last sent (as JSON), so unchanged ones are skipped. */
export type SnapshotMemory = Partial<Record<'chests' | 'strikeButton' | 'strikes' | 'pinata' | 'toy' | 'seesaws' | 'catapults' | 'games' | 'wanderers' | 'walls' | 'toss' | 'zone' | 'roster' | 'fallen' | 'balls' | 'goals', string>> & {
  /** Each loot item as last sent (only what changed goes out). */
  lootById?: Map<EntityId, string>;
};

/**
 * Builds one player's update. `visible` are the living plushies this player may see (their own
 * included); `you` is their plush (others lose private details such as items and input counters).
 */
export function encodeSnapshot(state: GameState, visible: Player[], you: EntityId | null, events: GameEvent[], memory: SnapshotMemory): string {
  let me: MovingPlayer | undefined;
  const others: SeenPlayer[] = [];
  for (const p of visible) {
    if (!p.alive) continue;
    if (p.id === you) {
      const { name: _n, isBot: _b, parts: _p, radius: _r, team: _t, ...moving } = p;
      me = moving;
      continue;
    }
    const look = (w: WeaponInstance | null): WeaponLook | null => (w ? { kind: w.kind, rarity: w.rarity, reloadEndTick: w.reloadEndTick } : null);
    others.push({
      id: p.id, pos: p.pos, vel: p.vel, z: p.z, vz: p.vz, aim: p.aim, stuffing: p.stuffing, patches: p.patches,
      activeSlot: p.activeSlot, action: p.action, inBush: p.inBush, soggy: p.soggy, building: p.building,
      revealedUntilTick: p.revealedUntilTick, chargeStartTick: p.chargeStartTick, bubbledUntil: p.bubbledUntil, glitteredUntil: p.glitteredUntil, soakedUntil: p.soakedUntil, ride: p.ride, juiceUntil: p.juiceUntil, drop: p.drop, umbrella: p.umbrella,
      weapons: [look(p.weapons[0]), look(p.weapons[1])],
    });
  }
  const msg: CompactSnapshot = {
    t: 'snap',
    tick: state.tick,
    status: state.status,
    winnerId: state.winnerId,
    winnerTeam: state.winnerTeam,
    victoryUntil: state.victoryUntil,
    mapId: state.mapId,
    nextId: state.nextId,
    ...(me ? { me } : {}),
    others,
    projectiles: state.projectiles.map((q) => ({ id: q.id, ownerId: q.ownerId, weapon: q.weapon, rarity: q.rarity, pos: q.pos, vel: q.vel, z: q.z })),
    ev: events,
  };
  const { current: _c, ...zonePlan } = state.zone;
  const slow = {
    chests: state.chests,
    strikeButton: state.strikeButton,
    strikes: state.strikes,
    pinata: state.pinata,
    toy: state.toy,
    seesaws: state.seesaws,
    catapults: state.catapults,
    games: state.games,
    wanderers: state.wanderers,
    walls: state.placedWalls,
    toss: state.toss,
    zone: zonePlan,
    roster: state.players.map((p): RosterEntry => ({ id: p.id, name: p.name, isBot: p.isBot, parts: p.parts, radius: p.radius, team: p.team })),
    fallen: state.players.filter((p) => !p.alive),
    balls: state.balls,
    goals: state.goals,
  };
  for (const key of Object.keys(slow) as (keyof typeof slow)[]) {
    const json = compactJson(slow[key]);
    if (memory[key] === json) continue;
    memory[key] = json;
    (msg as unknown as Record<string, unknown>)[key] = slow[key];
  }
  // Loot: only what's new or changed, and what's gone.
  const known = (memory.lootById ??= new Map());
  const up: GroundLoot[] = [];
  const here = new Set<EntityId>();
  for (const l of state.loot) {
    here.add(l.id);
    const json = compactJson(l);
    if (known.get(l.id) === json) continue;
    known.set(l.id, json);
    up.push(l);
  }
  const gone: EntityId[] = [];
  for (const lootId of known.keys()) {
    if (here.has(lootId)) continue;
    known.delete(lootId);
    gone.push(lootId);
  }
  if (up.length > 0) msg.lootUp = up;
  if (gone.length > 0) msg.lootGone = gone;
  return compactJson(msg);
}

/** Client side: the slow parts received so far. */
export interface SnapshotParts {
  chests: Chest[];
  strikeButton: StrikeButtonState | null;
  strikes: Strike[];
  pinata: PinataState | null;
  toy: ToyState | null;
  seesaws: GameState['seesaws'];
  catapults: GameState['catapults'];
  games: GameState['games'] | null;
  wanderers: GameState['wanderers'];
  loot: GroundLoot[];
  walls: PlacedWall[];
  toss: Toss | null;
  zone: ZonePlan | null;
  roster: Map<EntityId, RosterEntry>;
  fallen: Player[];
  balls: Ball[];
  goals: number[];
}

export function emptySnapshotParts(): SnapshotParts {
  return { chests: [], strikeButton: null, strikes: [], pinata: null, toy: null, seesaws: [], catapults: [], games: null, wanderers: [], loot: [], walls: [], toss: null, zone: null, roster: new Map(), fallen: [], balls: [], goals: [] };
}

/**
 * Rebuilds a full GameState from an update and the slow parts kept from earlier ones (updated
 * in place). Null until the zone plan has arrived (the first update always carries it).
 */
export function decodeSnapshot(msg: CompactSnapshot, parts: SnapshotParts): { state: GameState; events: GameEvent[] } | null {
  if (msg.chests) parts.chests = msg.chests;
  if (msg.strikeButton !== undefined) parts.strikeButton = msg.strikeButton;
  if (msg.strikes) parts.strikes = msg.strikes;
  if (msg.pinata !== undefined) parts.pinata = msg.pinata;
  if (msg.toy !== undefined) parts.toy = msg.toy;
  if (msg.seesaws) parts.seesaws = msg.seesaws;
  if (msg.catapults) parts.catapults = msg.catapults;
  if (msg.games) parts.games = msg.games;
  if (msg.wanderers) parts.wanderers = msg.wanderers;
  if (msg.lootUp || msg.lootGone) {
    const byId = new Map(parts.loot.map((l) => [l.id, l]));
    for (const lootId of msg.lootGone ?? []) byId.delete(lootId);
    for (const l of msg.lootUp ?? []) byId.set(l.id, l);
    parts.loot = [...byId.values()].sort((a, b) => a.id - b.id);
  }
  if (msg.walls) parts.walls = msg.walls;
  if (msg.toss !== undefined) parts.toss = msg.toss;
  if (msg.zone) parts.zone = msg.zone;
  if (msg.roster) parts.roster = new Map(msg.roster.map((r) => [r.id, r]));
  if (msg.fallen) parts.fallen = msg.fallen;
  if (msg.balls) parts.balls = msg.balls;
  if (msg.goals) parts.goals = msg.goals;
  if (!parts.zone) return null;

  const fallenIds = new Set(parts.fallen.map((p) => p.id));
  const identity = (id: EntityId) => {
    const r = parts.roster.get(id);
    return { name: r?.name ?? '', isBot: r?.isBot ?? true, parts: r?.parts ?? DEFAULT_PARTS, radius: r?.radius ?? 0.5, team: r?.team ?? 0 };
  };
  const living: Player[] = msg.others.map((p) => ({
    ...identity(p.id),
    ...p,
    knockback: { x: 0, y: 0 },
    aimDistance: 0,
    alive: true,
    eliminatedTick: null,
    placement: null,
    eliminatedBy: null,
    knockouts: 0,
    pocket: 0,
    damageDealt: 0,
    weapons: [weaponFrom(p.weapons[0]), weaponFrom(p.weapons[1])],
    items: [null, null, null],
    stash: [],
    holoAnimals: [],
    missingParts: [],
    lastInputSeq: 0,
    rideAgainTick: 0,
    heldButtons: 0,
  }));
  if (msg.me) living.push({ ...identity(msg.me.id), ...msg.me });
  const players = [...living, ...parts.fallen].sort((a, b) => a.id - b.id);
  const zone: Zone = { ...parts.zone, current: circleAt({ ...parts.zone, current: parts.zone.start }, msg.tick) };
  const state: GameState = {
    tick: msg.tick,
    rng: [0, 0, 0, 0],
    nextId: msg.nextId,
    status: msg.status,
    winnerId: msg.winnerId,
    winnerTeam: msg.winnerTeam ?? null,
    victoryUntil: msg.victoryUntil ?? null,
    players: players.filter((p) => !(p.alive && fallenIds.has(p.id))),
    projectiles: msg.projectiles.map((q) => ({ ...q, vz: 0, zEnd: q.z, radius: 0.15, damage: 0, knockback: 0, expireTick: msg.tick + 60 })),
    chests: parts.chests,
    strikeButton: parts.strikeButton,
    strikes: parts.strikes,
    pinata: parts.pinata,
    toy: parts.toy,
    seesaws: parts.seesaws,
    catapults: parts.catapults,
    wanderers: parts.wanderers,
    games: parts.games ?? { digs: [], gallery: null, pins: null, hills: [], goalPrizeAt: [] },
    loot: parts.loot,
    placedWalls: parts.walls,
    // Copies: client prediction may nudge them; the next update says where they really are.
    balls: parts.balls.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })),
    goals: parts.goals,
    toss: parts.toss,
    zone,
    events: [],
    mapId: msg.mapId,
  };
  return { state, events: msg.ev };
}

function weaponFrom(look: WeaponLook | null): WeaponInstance | null {
  return look ? { ...look, ammo: 0, nextFireTick: 0 } : null;
}
