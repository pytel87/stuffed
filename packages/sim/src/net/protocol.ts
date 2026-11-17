// Messages between browser and game server (JSON over WebSocket). Shared so both sides agree.
import { DEFAULT_PARTS } from '../parts.ts';
import { circleAt } from '../systems/zone.ts';
import type { Ball, Chest, EntityId, GameEvent, GameState, GroundLoot, Input, OwnedPart, Part, PartSlot, PlacedWall, Player, Projectile, Toss, WeaponInstance, Zone } from '../types.ts';

export const PROTOCOL_VERSION = 4;
/** Plushies per match, humans and bots together. */
export const MAX_PLAYERS = 10;
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
  | { t: 'start'; bots: number }
  /** Change your name in the lobby. */
  | { t: 'rename'; name: string }
  /** Your look changed in the Wardrobe: the room re-reads your profile for the next match. */
  | { t: 'look' }
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
  | { t: 'lobby'; phase: RoomPhase; seats: LobbySeat[]; bots: number }
  /** A match started; `you` is your plush, or null when you only watch. */
  | { t: 'start'; mapId: string; you: EntityId | null }
  /** The match as you can see it (see CompactSnapshot below). */
  | CompactSnapshot
  | { t: 'pong'; c: number; s: number }
  /** After a match: the parts that went into your collection. */
  | { t: 'kept'; parts: Part[] }
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
}

/** Your own living plush, sent in full every update (prediction needs it all). */
export type MovingPlayer = Omit<Player, 'name' | 'isBot' | 'parts' | 'radius'>;

/** Someone else's living plush: only what drawing it needs. */
export interface SeenPlayer extends Pick<
  Player,
  | 'id' | 'pos' | 'vel' | 'z' | 'vz' | 'aim' | 'stuffing' | 'buttons' | 'activeSlot' | 'action' | 'inBush' | 'soggy' | 'building' | 'revealedUntilTick'
  | 'chargeStartTick' | 'bubbledUntil' | 'blindedUntil' | 'juiceUntil' | 'drop'
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
  mapId: string;
  nextId: number;
  me?: MovingPlayer;
  others: SeenPlayer[];
  projectiles: SeenProjectile[];
  ev: GameEvent[];
  chests?: Chest[];
  loot?: GroundLoot[];
  walls?: PlacedWall[];
  toss?: Toss | null;
  zone?: ZonePlan;
  roster?: RosterEntry[];
  fallen?: Player[];
  /** Beach balls, when any moved since the last update. */
  balls?: Ball[];
}

/** Per-connection memory of the slow parts last sent (as JSON), so unchanged ones are skipped. */
export type SnapshotMemory = Partial<Record<'chests' | 'loot' | 'walls' | 'toss' | 'zone' | 'roster' | 'fallen' | 'balls', string>>;

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
      const { name: _n, isBot: _b, parts: _p, radius: _r, ...moving } = p;
      me = moving;
      continue;
    }
    const look = (w: WeaponInstance | null): WeaponLook | null => (w ? { kind: w.kind, rarity: w.rarity, reloadEndTick: w.reloadEndTick } : null);
    others.push({
      id: p.id, pos: p.pos, vel: p.vel, z: p.z, vz: p.vz, aim: p.aim, stuffing: p.stuffing, buttons: p.buttons,
      activeSlot: p.activeSlot, action: p.action, inBush: p.inBush, soggy: p.soggy, building: p.building,
      revealedUntilTick: p.revealedUntilTick, chargeStartTick: p.chargeStartTick, bubbledUntil: p.bubbledUntil, blindedUntil: p.blindedUntil, juiceUntil: p.juiceUntil, drop: p.drop,
      weapons: [look(p.weapons[0]), look(p.weapons[1])],
    });
  }
  const msg: CompactSnapshot = {
    t: 'snap',
    tick: state.tick,
    status: state.status,
    winnerId: state.winnerId,
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
    loot: state.loot,
    walls: state.placedWalls,
    toss: state.toss,
    zone: zonePlan,
    roster: state.players.map((p): RosterEntry => ({ id: p.id, name: p.name, isBot: p.isBot, parts: p.parts, radius: p.radius })),
    fallen: state.players.filter((p) => !p.alive),
    balls: state.balls,
  };
  for (const key of Object.keys(slow) as (keyof typeof slow)[]) {
    const json = compactJson(slow[key]);
    if (memory[key] === json) continue;
    memory[key] = json;
    (msg as unknown as Record<string, unknown>)[key] = slow[key];
  }
  return compactJson(msg);
}

/** Client side: the slow parts received so far. */
export interface SnapshotParts {
  chests: Chest[];
  loot: GroundLoot[];
  walls: PlacedWall[];
  toss: Toss | null;
  zone: ZonePlan | null;
  roster: Map<EntityId, RosterEntry>;
  fallen: Player[];
  balls: Ball[];
}

export function emptySnapshotParts(): SnapshotParts {
  return { chests: [], loot: [], walls: [], toss: null, zone: null, roster: new Map(), fallen: [], balls: [] };
}

/**
 * Rebuilds a full GameState from an update and the slow parts kept from earlier ones (updated
 * in place). Null until the zone plan has arrived (the first update always carries it).
 */
export function decodeSnapshot(msg: CompactSnapshot, parts: SnapshotParts): { state: GameState; events: GameEvent[] } | null {
  if (msg.chests) parts.chests = msg.chests;
  if (msg.loot) parts.loot = msg.loot;
  if (msg.walls) parts.walls = msg.walls;
  if (msg.toss !== undefined) parts.toss = msg.toss;
  if (msg.zone) parts.zone = msg.zone;
  if (msg.roster) parts.roster = new Map(msg.roster.map((r) => [r.id, r]));
  if (msg.fallen) parts.fallen = msg.fallen;
  if (msg.balls) parts.balls = msg.balls;
  if (!parts.zone) return null;

  const fallenIds = new Set(parts.fallen.map((p) => p.id));
  const identity = (id: EntityId) => {
    const r = parts.roster.get(id);
    return { name: r?.name ?? '', isBot: r?.isBot ?? true, parts: r?.parts ?? DEFAULT_PARTS, radius: r?.radius ?? 0.5 };
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
    damageDealt: 0,
    weapons: [weaponFrom(p.weapons[0]), weaponFrom(p.weapons[1])],
    items: [null, null, null],
    stash: null,
    lastInputSeq: 0,
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
    players: players.filter((p) => !(p.alive && fallenIds.has(p.id))),
    projectiles: msg.projectiles.map((q) => ({ ...q, vz: 0, zEnd: q.z, radius: 0.15, damage: 0, knockback: 0, expireTick: msg.tick + 60 })),
    chests: parts.chests,
    loot: parts.loot,
    placedWalls: parts.walls,
    // Copies: client prediction may nudge them; the next update says where they really are.
    balls: parts.balls.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })),
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
