// Mini-games with a prize (a good weapon and an item):
// - buried treasure: sparkling spots in the sand or snow; hold E to dig one up (once each);
// - the shooting gallery: ducks pop up one at a time behind a counter; shoot five in a row (a
//   duck that drops unhit breaks the run), then the booth rests for a while;
// - bowling: roll the beach ball into the pins; knock them all down and they're reset later;
// - king of the hill: stand on top alone (or with your team only) long enough;
// - beach-ball goals: a goal pays out too (each goal now and then).
import { config, secondsToTicks } from '../config.ts';
import { nextFloat, pickIndexWeighted, pickWeighted } from '../rng.ts';
import type { Box, EntityId, GameState, MapData, MiniGames, Player, Rarity, Vec2, Wall } from '../types.ts';
import type { World } from '../world.ts';
import { spawnLoot } from './loot.ts';
import { makeWeapon } from './weapons.ts';

const G = config.games;
const PRIZE_RING = 2;

export function initialGames(map: MapData): MiniGames {
  return {
    digs: (map.digs ?? []).map(() => false),
    gallery: map.gallery ? { up: -1, upUntil: 0, nextUpTick: secondsToTicks(G.gallery.gap), hits: 0, readyTick: 0, last: -1 } : null,
    pins: map.pins ? { down: map.pins.map(() => false), resetTick: -1 } : null,
    hills: (map.hills ?? []).map(() => ({ holder: -1, progress: 0, readyTick: 0 })),
    goalPrizeAt: (map.goals ?? []).map(() => 0),
  };
}

/** A prize: good weapons (rare or better) and items, in a little ring around `at`, on height `z`. */
export function spawnPrize(world: World, state: GameState, at: Vec2, z: number, weapons = 1, items = 1): void {
  // A warm-up: the games still work and cheer, but nothing comes of them (nothing's kept there).
  if (state.peaceful) {
    state.events.push({ type: 'prize', pos: { ...at } });
    return;
  }
  const n = weapons + items;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + nextFloat(state.rng) * 0.5;
    // Far enough out that whoever won it doesn't pick the item up without seeing it land.
    const spot = { x: at.x + Math.cos(a) * PRIZE_RING, y: at.y + Math.sin(a) * PRIZE_RING };
    if (i < weapons) {
      const kind = pickWeighted(state.rng, config.chest.weaponWeights);
      const rarity = Math.max(2, pickIndexWeighted(state.rng, config.chest.rarityWeights.high)) as Rarity;
      spawnLoot(world, state, spot, { type: 'weapon', weapon: makeWeapon(kind, rarity) }, z);
    } else {
      const item = pickWeighted(state.rng, config.chest.itemWeights);
      spawnLoot(world, state, spot, { type: 'item', item: { kind: item, count: config.items[item].chestCount } }, z);
    }
  }
  state.events.push({ type: 'prize', pos: { ...at } });
}

// ---------- buried treasure ----------

/** The undug spot this plush stands at (for E), or -1. */
export function digAt(world: World, state: GameState, player: Player): number {
  if (player.z > 0.3) return -1;
  const digs = world.map.digs ?? [];
  for (let i = 0; i < digs.length; i++) {
    if (state.games.digs[i]) continue;
    if (Math.hypot(player.pos.x - digs[i]!.x, player.pos.y - digs[i]!.y) <= G.digRange) return i;
  }
  return -1;
}

export function finishDig(world: World, state: GameState, index: number, by: Player): void {
  state.games.digs[index] = true;
  state.events.push({ type: 'dug', index, playerId: by.id });
  spawnPrize(world, state, world.map.digs![index]!, 0);
}

// ---------- the shooting gallery ----------

/** Where each duck stands (a row along x, centered on the gallery's spot). */
export function galleryTargets(map: MapData): Vec2[] {
  const g = map.gallery;
  if (!g) return [];
  const n = G.gallery.targets;
  return Array.from({ length: n }, (_, i) => ({ x: g.x + (i - (n - 1) / 2) * G.gallery.spacing, y: g.y }));
}

/**
 * The booth's walls: it opens south (toward the camera, so the low counter is in front and the
 * ducks show above it): a counter in front and a back board behind the ducks. Its sides are open
 * (walk in round the counter's ends).
 */
export function galleryWalls(g: { x: number; y: number }): Wall[] {
  const half = ((G.gallery.targets - 1) / 2) * G.gallery.spacing + 1;
  return [
    { kind: 'ramp', x: g.x - half, y: g.y + 1, w: half * 2, h: 0.6, height: 0.4 },
    { kind: 'ramp', x: g.x - half - 0.3, y: g.y - 1.1, w: half * 2 + 0.6, h: 0.5, height: 2.4 },
  ];
}

/** The duck standing up right now, as a circle to hit (null when none is up). */
export function galleryDuck(world: World, state: GameState): { index: number; pos: Vec2 } | null {
  const g = state.games.gallery;
  if (!g || g.up < 0) return null;
  return { index: g.up, pos: galleryTargets(world.map)[g.up]! };
}

/** A shot hit the duck that's up. */
export function hitDuck(world: World, state: GameState, byId: EntityId): void {
  const g = state.games.gallery;
  if (!g || g.up < 0) return;
  const t = galleryTargets(world.map);
  state.events.push({ type: 'duckHit', pos: { ...t[g.up]! }, hits: g.hits + 1 });
  g.up = -1;
  g.hits++;
  g.nextUpTick = state.tick + secondsToTicks(G.gallery.gap);
  if (g.hits < G.gallery.need) return;
  // Five in a row: a prize in front of the counter, and the booth rests.
  g.hits = 0;
  g.readyTick = state.tick + secondsToTicks(G.gallery.cooldown);
  g.nextUpTick = g.readyTick;
  const at = world.map.gallery!;
  spawnPrize(world, state, { x: at.x, y: at.y + 3.2 }, 0);
  state.events.push({ type: 'galleryWon', playerId: byId });
}

function updateGallery(state: GameState): void {
  const g = state.games.gallery;
  if (!g || state.tick < g.readyTick) return;
  if (g.up >= 0 && state.tick >= g.upUntil) {
    // It dropped unhit: the run starts over.
    g.up = -1;
    g.hits = 0;
    g.nextUpTick = state.tick + secondsToTicks(G.gallery.gap);
  }
  if (g.up < 0 && state.tick >= g.nextUpTick) {
    let next = Math.floor(nextFloat(state.rng) * G.gallery.targets);
    if (next === g.last) next = (next + 1) % G.gallery.targets;
    g.up = next;
    g.last = next;
    g.upUntil = state.tick + secondsToTicks(G.gallery.upTime);
  }
}

// ---------- bowling ----------

function updatePins(world: World, state: GameState): void {
  const p = state.games.pins;
  const spots = world.map.pins;
  if (!p || !spots) return;
  if (p.resetTick >= 0) {
    if (state.tick >= p.resetTick) {
      p.down = p.down.map(() => false);
      p.resetTick = -1;
    }
    return;
  }
  for (const ball of state.balls) {
    if (Math.hypot(ball.vel.x, ball.vel.y) < G.pins.minSpeed) continue;
    spots.forEach((s, i) => {
      if (p.down[i] || Math.hypot(ball.pos.x - s.x, ball.pos.y - s.y) > ball.radius + G.pins.radius) return;
      p.down[i] = true;
      state.events.push({ type: 'pinDown', index: i, pos: { ...s } });
    });
  }
  if (p.down.every(Boolean)) {
    p.resetTick = state.tick + secondsToTicks(G.pins.reset);
    const c = spots.reduce((a, s) => ({ x: a.x + s.x / spots.length, y: a.y + s.y / spots.length }), { x: 0, y: 0 });
    spawnPrize(world, state, c, 0);
  }
}

/** Standing pins are in a plush's way (it takes the ball to knock them down). */
export function pinsInTheWay(world: World, state: GameState): Vec2[] {
  const p = state.games.pins;
  if (!p || !world.map.pins) return [];
  return world.map.pins.filter((_, i) => !p.down[i]);
}

// ---------- king of the hill ----------

function updateHills(world: World, state: GameState): void {
  (world.map.hills ?? []).forEach((hill, i) => {
    const h = state.games.hills[i]!;
    if (state.tick < h.readyTick) return;
    const on = state.players.filter(
      (p) => p.alive && !p.drop && !p.ride && Math.abs(p.z - hill.z) < 0.35 && Math.hypot(p.pos.x - hill.x, p.pos.y - hill.y) < hill.radius,
    );
    const sides = new Set(on.map((p) => (p.team !== 0 ? `t${p.team}` : `p${p.id}`)));
    if (sides.size === 0) {
      h.progress = Math.max(0, h.progress - 2);
      if (h.progress === 0) h.holder = -1;
      return;
    }
    // Two sides on it: nobody gets anywhere until it's settled.
    if (sides.size > 1) return;
    const holder = state.players.find((p) => p.id === h.holder);
    const same = holder && on.some((p) => (p.team !== 0 ? p.team === holder.team : p.id === holder.id));
    if (!same) {
      h.holder = on[0]!.id;
      h.progress = 0;
      state.events.push({ type: 'hillTaken', index: i, playerId: h.holder });
    }
    h.progress++;
    if (h.progress < secondsToTicks(G.hill.hold)) return;
    h.progress = 0;
    h.holder = -1;
    h.readyTick = state.tick + secondsToTicks(G.hill.cooldown);
    spawnPrize(world, state, { x: hill.x, y: hill.y }, hill.z);
  });
}

// ---------- goals ----------

/** A goal was scored: a prize in front of it (each goal pays out once in a while). */
export function goalScored(world: World, state: GameState, index: number): void {
  const goal = world.map.goals?.[index];
  if (!goal || state.tick < (state.games.goalPrizeAt[index] ?? 0)) return;
  state.games.goalPrizeAt[index] = state.tick + secondsToTicks(G.goalCooldown);
  const m = goal.mouth;
  const out = goal.opens === 'north' ? -2.5 : 2.5;
  spawnPrize(world, state, { x: m.x + m.w / 2, y: (goal.opens === 'north' ? m.y : m.y + m.h) + out }, 0, 1, 0);
}

export function updateMiniGames(world: World, state: GameState): void {
  updateGallery(state);
  updatePins(world, state);
  updateHills(world, state);
}

/** For tests and drawing: the booth's footprint. */
export function galleryBox(map: MapData): Box | null {
  const g = map.gallery;
  if (!g) return null;
  const half = ((G.gallery.targets - 1) / 2) * G.gallery.spacing + 1;
  return { x: g.x - half, y: g.y - 1.1, w: half * 2, h: 2.7 };
}
