import { config } from './config.ts';
import { PART_CATALOG, PART_SLOTS } from './parts.ts';
import { pick, seedRng, shuffle } from './rng.ts';
import { makeWeapon } from './systems/weapons.ts';
import { initialZone } from './systems/zone.ts';
import type { GameState, MapData, PartLoadout, Player, RosterEntry, RngState, WeaponInstance, WeaponSpec } from './types.ts';

export interface CreateGameOptions {
  seed: number;
  map: MapData;
  roster: RosterEntry[];
  /** Scales every zone duration; 1 = as configured. */
  zoneTimeScale?: number;
}

export function createGame({ seed, map, roster, zoneTimeScale = 1 }: CreateGameOptions): GameState {
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
      pos: { x: spawn.x, y: spawn.y },
      vel: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      radius: config.player.radius,
      aim: { x: toCenter.x / len, y: toCenter.y / len },
      stuffing: config.player.maxStuffing,
      buttons: 0,
      alive: true,
      eliminatedTick: null,
      placement: null,
      weapons: startingWeapons(entry.loadout ?? config.player.startingLoadout),
      activeSlot: 0,
      items: [null, null, null],
      action: null,
      inBush: false,
      soggy: false,
      building: -1,
      revealedUntilTick: 0,
      parts: rollParts(rng, entry.parts),
      lastInputSeq: -1,
      heldButtons: 0,
    };
  });

  const chests = map.chestSpawns.map((pos) => ({ id: nextId++, pos: { x: pos.x, y: pos.y }, opened: false }));

  return {
    tick: 0,
    rng,
    nextId,
    status: 'playing',
    winnerId: null,
    players,
    projectiles: [],
    chests,
    loot: [],
    zone: initialZone(map, rng, zoneTimeScale),
    events: [],
    mapId: map.id,
  };
}

function startingWeapons(loadout: readonly WeaponSpec[]): [WeaponInstance | null, WeaponInstance | null] {
  const [a, b] = loadout;
  return [a ? makeWeapon(a.kind, a.rarity) : null, b ? makeWeapon(b.kind, b.rarity) : null];
}

function rollParts(rng: RngState, fixed: Partial<PartLoadout> = {}): PartLoadout {
  const parts = {} as PartLoadout;
  for (const slot of PART_SLOTS) parts[slot] = fixed[slot] ?? pick(rng, PART_CATALOG[slot]);
  return parts;
}


