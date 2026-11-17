import { config } from './config.ts';
import { ANIMALS, PART_SLOTS, pickAnimal } from './parts.ts';
import { nextFloat, pick, seedRng, shuffle } from './rng.ts';
import { makeWeapon } from './systems/weapons.ts';
import { initialZone } from './systems/zone.ts';
import type { GameState, MapData, PartLoadout, Player, RosterEntry, RngState, Toss, WeaponInstance, WeaponSpec } from './types.ts';

export interface CreateGameOptions {
  seed: number;
  map: MapData;
  roster: RosterEntry[];
  /** Scales every zone duration; 1 = as configured. */
  zoneTimeScale?: number;
  /** Start everyone on the Toss blimp instead of at spawn points. */
  toss?: boolean;
}

export function createGame({ seed, map, roster, zoneTimeScale = 1, toss: withToss = false }: CreateGameOptions): GameState {
  if (roster.length > map.spawns.length) {
    throw new Error(`Map ${map.id} has ${map.spawns.length} spawns for ${roster.length} players`);
  }
  const rng = seedRng(seed);
  const spawns = shuffle(rng, map.spawns.slice());
  let nextId = 1;

  const players = roster.map((entry, i): Player => {
    const spawn = spawns[i]!;
    const toCenter = { x: map.width / 2 - spawn.x, y: map.height / 2 - spawn.y };
    const len = Math.hypot(toCenter.x, toCenter.y) || 1;
    return {
      id: nextId++,
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
      buttons: 0,
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
      blindedUntil: 0,
      juiceUntil: 0,
      drop: null,
      parts: rollParts(rng, entry.parts),
      stash: null,
      lastInputSeq: -1,
      heldButtons: 0,
    };
  });

  const chests = map.chestSpawns.map((pos) => ({ id: nextId++, pos: { x: pos.x, y: pos.y }, opened: false, loot: pos.loot ?? 'medium' }));

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
    players,
    projectiles: [],
    chests,
    loot: [],
    placedWalls: [],
    balls: map.walls
      .filter((w) => w.kind === 'ball')
      .map((w, id) => ({ id, pos: { x: w.x + w.w / 2, y: w.y + w.h / 2 }, vel: { x: 0, y: 0 }, radius: Math.min(w.w, w.h) / 2 })),
    toss,
    zone: initialZone(map, rng, zoneTimeScale),
    events: [],
    mapId: map.id,
  };
}

function startingWeapons(loadout: readonly WeaponSpec[]): [WeaponInstance | null, WeaponInstance | null] {
  const [a, b] = loadout;
  return [a ? makeWeapon(a.kind, a.rarity) : null, b ? makeWeapon(b.kind, b.rarity) : null];
}

/** A plush's own look: Hand-me-down parts that never drop. */
function rollParts(rng: RngState, fixed: RosterEntry['parts'] = {}): PartLoadout {
  const parts = {} as PartLoadout;
  for (const slot of PART_SLOTS) {
    const own = fixed[slot];
    const owned = typeof own === 'string' ? { animal: own, rarity: 0 as const } : own;
    // A real animal only (the look may come from outside, e.g. a saved profile).
    const animal = owned && ANIMALS.includes(owned.animal) ? owned.animal : pickAnimal(rng);
    const rarity = owned && animal === owned.animal && owned.rarity >= 0 && owned.rarity <= 4 ? owned.rarity : 0;
    parts[slot] = { animal, rarity, found: false };
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
