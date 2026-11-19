// Things that move about the map on their own:
// - the robot vacuum (Bedroom): roams its patch of floor, turning at walls and now and then; it
//   bumps plushies aside, and sucks up loot it rolls over, spitting it out again a bit later;
// - the lawnmower (Backyard) and the snowplow (Snowy Park): a switch (E) sends it along its line
//   and back next time; the mower bonks everyone in its way, the plow shoves them along.
import { config, DT, secondsToTicks } from '../config.ts';
import { nextFloat } from '../rng.ts';
import type { GameState, LootContent, MapData, Player, Vec2, WandererState } from '../types.ts';
import { wallsNear, type World } from '../world.ts';
import { applyDamage } from './damage.ts';
import { spawnLoot } from './loot.ts';

const W = config.wanderers;

export function initialWanderers(map: MapData): WandererState[] {
  return (map.wanderers ?? []).map((d) => ({
    pos: { x: d.x, y: d.y },
    dir: d.to ? Math.atan2(d.to.y - d.y, d.to.x - d.x) : 0,
    mode: 'idle',
    until: 0,
    readyTick: secondsToTicks(W.firstReady),
    back: false,
    carried: [],
    dropTick: 0,
    hit: [],
  }));
}

/** How big each one is (plushies bump into it). */
export function wandererRadius(kind: string): number {
  return kind === 'vacuum' ? W.vacuum.radius : W.vehicle.radius;
}

/** The mower's or plow's switch this plush stands at, ready (for E), or -1. */
export function switchAt(world: World, state: GameState, player: Player): number {
  if (player.z > 0.5) return -1;
  const defs = world.map.wanderers ?? [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i]!;
    const s = state.wanderers[i];
    if (!d.switch || !s || s.mode !== 'idle' || state.tick < s.readyTick) continue;
    if (Math.hypot(player.pos.x - d.switch.x, player.pos.y - d.switch.y) <= W.switchRange) return i;
  }
  return -1;
}

/** Flips the switch: off it goes along its line (back the other way next time). */
export function startVehicle(world: World, state: GameState, index: number, by: Player): void {
  const s = state.wanderers[index]!;
  s.mode = 'moving';
  s.hit = [];
  s.byId = by.id;
  state.events.push({ type: 'wandererStarted', index, kind: world.map.wanderers![index]!.kind, pos: { ...s.pos } });
}

function blocked(world: World, pos: Vec2, r: number): boolean {
  for (const w of wallsNear(world, pos.x - r, pos.y - r, pos.x + r, pos.y + r)) {
    if (w.height < 0.3) continue;
    const cx = Math.max(w.x, Math.min(pos.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(pos.y, w.y + w.h));
    if (Math.hypot(pos.x - cx, pos.y - cy) < r) return true;
  }
  return false;
}

/** Plushies (not in the air, not on the Toss) touching a circle at `pos` of radius `r`. */
function touching(state: GameState, pos: Vec2, r: number): Player[] {
  return state.players.filter((p) => p.alive && !p.drop && !p.ride && p.z < 0.6 && Math.hypot(p.pos.x - pos.x, p.pos.y - pos.y) < r + p.radius);
}

function shove(p: Player, from: Vec2, strength: number): void {
  const dx = p.pos.x - from.x;
  const dy = p.pos.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  p.knockback.x += (dx / d) * strength;
  p.knockback.y += (dy / d) * strength;
}

export function updateWanderers(world: World, state: GameState): void {
  const defs = world.map.wanderers ?? [];
  defs.forEach((d, i) => {
    const s = state.wanderers[i];
    if (!s) return;
    if (d.kind === 'vacuum') updateVacuum(world, state, i, s, d.area!);
    else updateVehicle(world, state, i, s, d.kind, { x: d.x, y: d.y }, d.to!);
  });
}

function updateVacuum(world: World, state: GameState, index: number, s: WandererState, area: { x: number; y: number; w: number; h: number }): void {
  const V = W.vacuum;
  // Now and then (and at a wall or its patch's edge) it turns somewhere new.
  if (state.tick >= s.until) {
    s.dir += (nextFloat(state.rng) - 0.5) * Math.PI;
    s.until = state.tick + secondsToTicks(V.turnEvery * (0.6 + nextFloat(state.rng) * 0.8));
  }
  const next = { x: s.pos.x + Math.cos(s.dir) * V.speed * DT, y: s.pos.y + Math.sin(s.dir) * V.speed * DT };
  const outside = next.x < area.x || next.x > area.x + area.w || next.y < area.y || next.y > area.y + area.h;
  if (outside || blocked(world, next, V.radius)) {
    s.dir += Math.PI * (0.6 + nextFloat(state.rng) * 0.8);
  } else {
    s.pos = next;
  }
  for (const p of touching(state, s.pos, V.radius)) {
    shove(p, s.pos, V.bump);
    state.events.push({ type: 'wandererBump', index, playerId: p.id, pos: { ...s.pos } });
  }
  // Loot it rolls over goes into its bin; it spits it all out again a while later.
  for (const l of [...state.loot]) {
    if (s.carried.length >= V.binSize || l.z > 0.3 || Math.hypot(l.pos.x - s.pos.x, l.pos.y - s.pos.y) > V.radius) continue;
    if (s.carried.length === 0) s.dropTick = state.tick + secondsToTicks(V.holdFor);
    s.carried.push(l.content);
    state.loot = state.loot.filter((x) => x.id !== l.id);
    state.events.push({ type: 'sucked', index, pos: { ...s.pos } });
  }
  if (s.carried.length > 0 && state.tick >= s.dropTick) {
    const back = { x: s.pos.x - Math.cos(s.dir) * 1.4, y: s.pos.y - Math.sin(s.dir) * 1.4 };
    s.carried.forEach((c: LootContent, k) => spawnLoot(world, state, { x: back.x + (k - 1) * 0.9, y: back.y }, c));
    s.carried = [];
    state.events.push({ type: 'spat', index, pos: back });
  }
}

function updateVehicle(world: World, state: GameState, index: number, s: WandererState, kind: string, a: Vec2, b: Vec2): void {
  if (s.mode !== 'moving') return;
  const V = W.vehicle;
  const speed = kind === 'plow' ? V.plowSpeed : V.mowerSpeed;
  const target = s.back ? a : b;
  const dx = target.x - s.pos.x;
  const dy = target.y - s.pos.y;
  const d = Math.hypot(dx, dy);
  s.dir = Math.atan2(dy, dx);
  const step = speed * DT;
  if (d <= step) {
    s.pos = { ...target };
    s.mode = 'idle';
    s.back = !s.back;
    s.dir += Math.PI;
    s.readyTick = state.tick + secondsToTicks(V.cooldown);
    state.events.push({ type: 'wandererStopped', index, pos: { ...s.pos } });
    return;
  }
  s.pos = { x: s.pos.x + (dx / d) * step, y: s.pos.y + (dy / d) * step };
  const ux = dx / d;
  const uy = dy / d;
  for (const p of touching(state, s.pos, V.radius)) {
    if (kind === 'plow') {
      // Shoved along ahead of the blade.
      p.knockback.x += ux * V.plowPush;
      p.knockback.y += uy * V.plowPush;
      continue;
    }
    // The mower: bonked aside, once per run.
    if (s.hit.includes(p.id)) continue;
    s.hit.push(p.id);
    const side = (p.pos.x - s.pos.x) * -uy + (p.pos.y - s.pos.y) * ux >= 0 ? 1 : -1;
    p.knockback.x += -uy * side * V.mowerKnock;
    p.knockback.y += ux * side * V.mowerKnock;
    applyDamage(state, p, V.mowerDamage, s.byId ?? null, { from: { ...s.pos }, cause: 'mower' });
    state.events.push({ type: 'wandererBump', index, playerId: p.id, pos: { ...s.pos } });
  }
}

/** Each one as a solid circle a plush bumps into (at the plush's level). */
export function wandererCircles(world: World, state: GameState): { x: number; y: number; r: number }[] {
  return (world.map.wanderers ?? []).map((d, i) => {
    const s = state.wanderers[i]!;
    return { x: s.pos.x, y: s.pos.y, r: wandererRadius(d.kind) };
  });
}
