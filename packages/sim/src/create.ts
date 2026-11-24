import { config, secondsToTicks } from './config.ts';
import { ANIMALS, PART_SLOTS, pickAnimal } from './parts.ts';
import { nextFloat, pick, seedRng, shuffle } from './rng.ts';
import { makeWeapon } from './systems/weapons.ts';
import { initialZone } from './systems/zone.ts';
import type { GameState, MapData, PartLoadout, Player, RosterEntry, RngState, Toss, Vec2, WeaponInstance, WeaponSpec } from './types.ts';
import { initialGames } from './systems/minigames.ts';
import { initialWanderers } from './systems/wanderers.ts';
import { meetingSlot, meetingSpot, ringSlot } from './systems/meeting.ts';

export interface CreateGameOptions {
  seed: number;
  map: MapData;
  roster: RosterEntry[];
  /** Scales every zone duration; 1 = as configured. */
  zoneTimeScale?: number;
  /** Start everyone on the Toss blimp instead of at spawn points. */
  toss?: boolean;
  /** A warm-up: no hurting, no chests or piñata, no Rinse, never over (see GameState.peaceful). */
  peaceful?: boolean;
}

export function createGame({ seed, map, roster, zoneTimeScale = 1, toss: withToss = false, peaceful = false }: CreateGameOptions): GameState {
  if (roster.length > map.spawns.length) {
    throw new Error(`Map ${map.id} has ${map.spawns.length} spawns for ${roster.length} players`);
  }
  const rng = seedRng(seed);
  const spawns = shuffle(rng, map.spawns.slice());
  let nextId = 1;

  // A warm-up: everyone together round the map's meeting spot instead of its spawn points.
  const meet = peaceful ? meetingSpot(map) : null;
  const players = roster.map((entry, i): Player => makePlayer(nextId++, entry, meet ? ringSlot(meet, i) : spawns[i]!, map, rng));

  const chests = peaceful ? [] : map.chestSpawns.map((pos) => ({ id: nextId++, pos: { x: pos.x, y: pos.y }, z: pos.roof ? roofUnder(map, pos) : 0, opened: false, loot: pos.loot ?? 'medium' }));

  const toss = withToss ? planToss(map, rng) : null;
  if (toss) {
    for (const p of players) {
      p.pos = { ...toss.from };
      p.z = config.toss.height;
      p.drop = 'riding';
    }
  }

  return {
    tick: 0,
    rng,
    nextId,
    status: 'playing',
    winnerId: null,
    winnerTeam: null,
    victoryUntil: null,
    players,
    projectiles: [],
    chests,
    loot: [],
    placedWalls: [],
    balls: map.walls
      .filter((w) => w.kind === 'ball' || w.kind === 'duck')
      .map((w, id) => ({
        id,
        pos: { x: w.x + w.w / 2, y: w.y + w.h / 2 },
        vel: { x: 0, y: 0 },
        radius: Math.min(w.w, w.h) / 2,
        home: { x: w.x + w.w / 2, y: w.y + w.h / 2 },
        ...(w.kind === 'duck' ? { kind: 'duck' as const } : {}),
      })),
    goals: (map.goals ?? []).map(() => 0),
    toss,
    strikeButton: map.strikeButton
      ? { pos: { x: map.strikeButton.x, y: map.strikeButton.y }, z: map.strikeButton.z, kind: map.strikeButton.kind, readyTick: secondsToTicks(config.strike.firstReady) }
      : null,
    strikes: [],
    seesaws: (map.seesaws ?? []).map(() => ({ down: 'a' as const, tick: -1 })),
    catapults: (map.rides ?? []).flatMap((r, ride) => (r.kind === 'catapult' ? [{ ride, firedTick: -1 }] : [])),
    games: initialGames(map),
    wanderers: initialWanderers(map),
    toy: map.toy
      ? {
          kind: map.toy.kind,
          pos: { x: map.toy.x, y: map.toy.y },
          z: map.toy.z,
          at: { ...(map.toy.at ?? { x: map.toy.x, y: map.toy.y }) },
          readyTick: secondsToTicks(config.toys.firstReady),
          startTick: -1,
          endTick: -1,
          byId: null,
        }
      : null,
    pinata: map.pinata && !peaceful
      ? { pos: { x: map.pinata.x, y: map.pinata.y }, z: map.pinata.z, kind: map.pinata.kind, hp: config.pinata.hp, broken: false, hitTick: -1 }
      : null,
    zone: initialZone(map, rng, zoneTimeScale),
    events: [],
    mapId: map.id,
    ...(peaceful ? { peaceful: true } : {}),
  };
}

/**
 * Someone joins a warm-up under way: a new plush beside the others at the map's meeting spot (the
 * nearest place there nobody's standing), or null if the map has no room. Returns it.
 */
export function addPlayer(state: GameState, map: MapData, entry: RosterEntry): Player | null {
  if (state.players.length >= map.spawns.length) return null;
  const at = meetingSlot(map, state.players.map((p) => p.pos));
  const player = makePlayer(state.nextId++, entry, at, map, state.rng);
  state.players.push(player);
  return player;
}

/** Someone leaves a warm-up: their plush goes (and anything they had in flight stays harmless). */
export function removePlayer(state: GameState, id: number): void {
  state.players = state.players.filter((p) => p.id !== id);
}

/** A new plush for `entry`, standing at `spawn` facing the map's middle. */
function makePlayer(id: number, entry: RosterEntry, spawn: Vec2, map: MapData, rng: RngState): Player {
  const toCenter = { x: map.width / 2 - spawn.x, y: map.height / 2 - spawn.y };
  const len = Math.hypot(toCenter.x, toCenter.y) || 1;
  return {
    id,
    name: entry.name,
    isBot: entry.isBot,
    team: entry.team ?? 0,
    pos: { x: spawn.x, y: spawn.y },
    vel: { x: 0, y: 0 },
    z: 0,
    vz: 0,
    knockback: { x: 0, y: 0 },
    radius: config.player.radius,
    aim: { x: toCenter.x / len, y: toCenter.y / len },
    aimDistance: 0,
    stuffing: config.player.maxStuffing,
    patches: 0,
    pocket: 0,
    danceUntil: 0,
    alive: true,
    eliminatedTick: null,
    placement: null,
    eliminatedBy: null,
    knockouts: 0,
    damageDealt: 0,
    weapons: startingWeapons(entry.loadout ?? config.player.startingLoadout),
    activeSlot: 0,
    items: [null, null, null],
    action: null,
    inBush: false,
    soggy: false,
    building: -1,
    revealedUntilTick: 0,
    chargeStartTick: null,
    bubbledUntil: 0,
    glitteredUntil: 0,
    soakedUntil: 0,
    ride: null,
    rideAgainTick: 0,
    juiceUntil: 0,
    drop: null,
    umbrella: false,
    parts: rollParts(rng, entry.parts, map.id),
    stash: [],
    holoAnimals: (entry.holoAnimals ?? []).filter((a) => ANIMALS.includes(a)),
    missingParts: (entry.missingParts ?? []).filter((m) => ANIMALS.includes(m.animal) && PART_SLOTS.includes(m.slot)),
    lastInputSeq: -1,
    heldButtons: 0,
  };
}

/**
 * Puts a new look on a plush already in the game (a room's warm-up: someone changed clothes in the
 * Wardrobe): its parts, and the sets that make its holo parts and the parts it's still missing.
 */
export function redress(state: GameState, player: Player, entry: RosterEntry): void {
  player.parts = rollParts(state.rng, entry.parts, state.mapId);
  player.holoAnimals = (entry.holoAnimals ?? []).filter((a) => ANIMALS.includes(a));
  player.missingParts = (entry.missingParts ?? []).filter((m) => ANIMALS.includes(m.animal) && PART_SLOTS.includes(m.slot));
}

function startingWeapons(loadout: readonly WeaponSpec[]): [WeaponInstance | null, WeaponInstance | null] {
  const [a, b] = loadout;
  return [a ? makeWeapon(a.kind, a.rarity) : null, b ? makeWeapon(b.kind, b.rarity) : null];
}

/** A plush's own look: Hand-me-down parts that never drop. */
function rollParts(rng: RngState, fixed: RosterEntry['parts'] = {}, mapId?: string): PartLoadout {
  const parts = {} as PartLoadout;
  for (const slot of PART_SLOTS) {
    const own = fixed[slot];
    const owned = typeof own === 'string' ? { animal: own, rarity: 0 as const } : own;
    // A real animal only (the look may come from outside, e.g. a saved profile).
    const animal = owned && ANIMALS.includes(owned.animal) ? owned.animal : pickAnimal(rng, mapId);
    const rarity = owned && animal === owned.animal && owned.rarity >= 0 && owned.rarity <= 4 ? owned.rarity : 0;
    const holo = !!owned && typeof owned === 'object' && animal === owned.animal && owned.holo === true;
    parts[slot] = { animal, rarity, found: false, ...(holo ? { holo: true } : {}) };
  }
  return parts;
}

/** The blimp's flight: a random direction, on a line passing near the middle of the map. */
function planToss(map: MapData, rng: RngState): Toss {
  const t = config.toss;
  const angle = nextFloat(rng) * Math.PI * 2;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const off = (nextFloat(rng) * 2 - 1) * t.centerOffset;
  const mid = { x: map.width / 2 - dir.y * off, y: map.height / 2 + dir.x * off };
  return {
    from: { x: mid.x - dir.x * t.reach, y: mid.y - dir.y * t.reach },
    to: { x: mid.x + dir.x * t.reach, y: mid.y + dir.y * t.reach },
    startTick: 0,
    endTick: Math.round(((2 * t.reach) / t.speed) * config.tickRate),
  };
}

/** The roof height of the building over `pos` (where a roof chest stands). */
function roofUnder(map: MapData, pos: Vec2): number {
  const b = map.buildings.find((b) => pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h);
  if (!b) throw new Error(`roof chest at ${pos.x}, ${pos.y} is not on a building`);
  return b.height;
}
