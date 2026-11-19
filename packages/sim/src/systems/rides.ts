// Things that move you around the map:
// - rides: a slide or a sled run (step onto the top and you go), a zip line or a hamster tube
//   (press E at its start): you're carried along, then let go with a push (a hop off a ski jump);
//   off a zip line you can also let go early (Jump), carried on along it as you drop;
//   inside a tube nobody sees you;
// - trampolines: landing on one bounces you high (onto roofs);
// - seesaws: landing on one end launches whoever stands on the other;
// - catapults (press E at the cup): flung high, where your umbrella opens and you glide down.
//   One flings again only after a while.
import { config, secondsToTicks } from '../config.ts';
import type { Box, GameState, Player, Ride, RideDef, Vec2, Wall } from '../types.ts';
import type { World } from '../world.ts';

const R = config.rides;

/** The ride whose start this plush stands at (for E: zip lines and tubes), or -1. */
export function rideAt(world: World, state: GameState, player: Player, needsPress: boolean): number {
  if (player.ride || player.drop || player.umbrella || state.tick < player.rideAgainTick) return -1;
  const rides = world.map.rides ?? [];
  for (let i = 0; i < rides.length; i++) {
    const r = rides[i]!;
    const pressed = r.kind === 'zip' || r.kind === 'tube' || r.kind === 'catapult';
    if (pressed !== needsPress) continue;
    if (r.kind === 'catapult' && !catapultReady(state, i)) continue;
    if (r.kind === 'catapult') {
      // From the ground (or on top of it) anywhere round it.
      if (player.z > CATAPULT_SIZE / 2) continue;
      if (Math.max(Math.abs(player.pos.x - r.from.x), Math.abs(player.pos.y - r.from.y)) <= CATAPULT_SIZE / 2 + R.catapultReach) return i;
      continue;
    }
    if (Math.abs(player.z - r.from.z) > (pressed ? config.loot.reachHeight : 0.3)) continue;
    if (pressed) {
      if (Math.hypot(player.pos.x - r.from.x, player.pos.y - r.from.y) <= R.pressRange) return i;
      continue;
    }
    // A slide or sled run: stepping onto its top heading down it (walking up it, you just arrive).
    const { t, side } = along(r, player.pos);
    if (t < 0 || t > R.stepRange / (Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y) || 1) || side > rampWidth(r) / 2) continue;
    const dx = r.to.x - r.from.x;
    const dy = r.to.y - r.from.y;
    const len = Math.hypot(dx, dy) || 1;
    if ((player.vel.x * dx + player.vel.y * dy) / len > 1) return i;
  }
  return -1;
}

/** A catapult (by its ride index) that can fling someone now. */
export function catapultReady(state: GameState, ride: number): boolean {
  const c = state.catapults.find((x) => x.ride === ride);
  return !!c && (c.firedTick < 0 || state.tick >= c.firedTick + secondsToTicks(R.catapultCooldown));
}

export function startRide(world: World, state: GameState, player: Player, index: number): void {
  const r = world.map.rides![index]!;
  player.ride = { index, startTick: state.tick, endTick: state.tick + secondsToTicks(r.seconds) };
  const catapult = state.catapults.find((x) => x.ride === index);
  if (catapult) catapult.firedTick = state.tick;
  player.vel = { x: 0, y: 0 };
  player.knockback = { x: 0, y: 0 };
  player.vz = 0;
  player.action = null;
  state.events.push({ type: 'rideStarted', playerId: player.id, kind: r.kind, pos: { x: r.from.x, y: r.from.y } });
}

/** Where a ride has the plush at `tick` (also used for drawing between ticks). */
export function ridePose(world: World, ride: Ride, tick: number): { pos: Vec2; z: number } {
  const r = world.map.rides![ride.index]!;
  const t = Math.min(1, Math.max(0, (tick - ride.startTick) / Math.max(1, ride.endTick - ride.startTick)));
  // Slides and sled runs speed up as they go; a zip line sags in the middle; a tube arcs up; a
  // catapult's throw rises fast and slows toward its top.
  const k = r.kind === 'slide' || r.kind === 'sled' ? t * t : t;
  const lift = r.kind === 'zip' ? -0.8 * 4 * t * (1 - t) : r.kind === 'tube' ? 2.5 * 4 * t * (1 - t) : 0;
  const rise = r.kind === 'catapult' ? 1 - (1 - t) * (1 - t) : k;
  return {
    pos: { x: r.from.x + (r.to.x - r.from.x) * k, y: r.from.y + (r.to.y - r.from.y) * k },
    z: r.from.z + (r.to.z - r.from.z) * rise + lift,
  };
}

/** Jump on a zip line: let go there, carried on along it with a little hop. False on other rides. */
export function letGoOfZip(world: World, state: GameState, player: Player): boolean {
  const ride = player.ride;
  const r = ride ? world.map.rides![ride.index]! : null;
  if (!ride || r?.kind !== 'zip') return false;
  const { pos, z } = ridePose(world, ride, state.tick);
  player.ride = null;
  player.rideAgainTick = state.tick + secondsToTicks(R.again);
  player.pos = pos;
  player.z = z;
  const dx = r.to.x - r.from.x;
  const dy = r.to.y - r.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = (len / r.seconds) * R.zipLetGoCarry;
  player.knockback.x += (dx / len) * speed;
  player.knockback.y += (dy / len) * speed;
  player.vz = R.zipLetGoHop;
  state.events.push({ type: 'rideEnded', playerId: player.id, kind: r.kind, pos: { ...pos } });
  return true;
}

/** Carries a riding plush along; at the end it's let go with a push. True while riding. */
export function updateRide(world: World, state: GameState, player: Player): boolean {
  const ride = player.ride;
  if (!ride) return false;
  const r = world.map.rides![ride.index]!;
  const { pos, z } = ridePose(world, ride, state.tick);
  player.pos = pos;
  player.z = z;
  player.vel = { x: 0, y: 0 };
  if (state.tick < ride.endTick) return true;
  player.ride = null;
  player.rideAgainTick = state.tick + secondsToTicks(R.again);
  const dx = r.to.x - r.from.x;
  const dy = r.to.y - r.from.y;
  const len = Math.hypot(dx, dy) || 1;
  if (r.kind === 'catapult') {
    // At the top of the throw: the umbrella opens, still heading on the way you were flung.
    player.umbrella = true;
    player.vel = { x: (dx / len) * R.catapultCarry, y: (dy / len) * R.catapultCarry };
    player.vz = 0;
    state.events.push({ type: 'rideEnded', playerId: player.id, kind: r.kind, pos: { ...pos } });
    return true;
  }
  player.knockback.x += (dx / len) * r.boost;
  player.knockback.y += (dy / len) * r.boost;
  player.vz = r.hop ?? 0;
  state.events.push({ type: 'rideEnded', playerId: player.id, kind: r.kind, pos: { ...pos } });
  return true;
}

/** Feet on a trampoline: bounced high. */
export function onTrampoline(world: World, player: Pick<Player, 'pos' | 'z'>): boolean {
  if (player.z > 0.05) return false;
  return (world.map.trampolines ?? []).some((c) => Math.hypot(player.pos.x - c.center.x, player.pos.y - c.center.y) < c.radius);
}

/** A plush just landed: on a trampoline it bounces; on a seesaw's end it launches the other end. */
export function landed(world: World, state: GameState, player: Player): void {
  if (onTrampoline(world, player)) {
    player.vz = R.trampolineSpeed;
    state.events.push({ type: 'bounced', playerId: player.id, pos: { ...player.pos } });
    return;
  }
  // Landing on a seesaw's raised end tips it down, and whoever is on the other end flies.
  const seesaws = world.map.seesaws ?? [];
  for (let i = 0; i < seesaws.length; i++) {
    const s = seesaws[i]!;
    const state_ = state.seesaws[i];
    if (!state_) continue;
    const upEnd = state_.down === 'a' ? 'b' : 'a';
    const up = s[upEnd];
    const other = s[state_.down];
    if (Math.hypot(player.pos.x - up.x, player.pos.y - up.y) > R.seesawEnd) continue;
    state.seesaws[i] = { down: upEnd, tick: state.tick };
    const dx = other.x - up.x;
    const dy = other.y - up.y;
    const len = Math.hypot(dx, dy) || 1;
    for (const p of state.players) {
      if (!p.alive || p.drop || p.id === player.id || p.z > 0.5) continue;
      if (Math.hypot(p.pos.x - other.x, p.pos.y - other.y) > R.seesawEnd) continue;
      p.vz = R.seesawSpeed;
      p.knockback.x += (dx / len) * R.seesawPush;
      p.knockback.y += (dy / len) * R.seesawPush;
      state.events.push({ type: 'bounced', playerId: p.id, pos: { ...p.pos } });
    }
    return;
  }
}


/** How wide a slide or a sled run is (its hidden steps and the drawn ramp). */
export function rampWidth(r: RideDef): number {
  return r.kind === 'sled' ? 2.2 : 1.1;
}

/** Where `pos` is along a slide or a sled run: 0 at its top, 1 at its bottom, and how far off its middle line. */
function along(r: RideDef, pos: Vec2): { t: number; side: number } {
  const dx = r.to.x - r.from.x;
  const dy = r.to.y - r.from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    t: ((pos.x - r.from.x) * dx + (pos.y - r.from.y) * dy) / (len * len),
    side: Math.abs((pos.x - r.from.x) * dy - (pos.y - r.from.y) * dx) / len,
  };
}

/** A slide's or sled run's footprint (they run straight along x or y). */
export function rampBox(r: RideDef): Box {
  const w = rampWidth(r) / 2;
  return {
    x: Math.min(r.from.x, r.to.x) - (Math.abs(r.to.y - r.from.y) > 0.01 ? w : 0),
    y: Math.min(r.from.y, r.to.y) - (Math.abs(r.to.x - r.from.x) > 0.01 ? w : 0),
    w: Math.abs(r.to.x - r.from.x) + (Math.abs(r.to.y - r.from.y) > 0.01 ? 2 * w : 0),
    h: Math.abs(r.to.y - r.from.y) + (Math.abs(r.to.x - r.from.x) > 0.01 ? 2 * w : 0),
  };
}

/**
 * Where along a shot's step (0..1) it first runs into a slide or a sled run, or null. Only the
 * board itself stops it (from its underside up to its rails' tops), not the open space under its
 * raised end. `z` and `dz`: the shot's height and its change over the step; `r`: its size.
 */
export function rampHit(world: World, from: Vec2, dx: number, dy: number, z: number, dz: number, r: number): number | null {
  let best: number | null = null;
  for (const ride of world.map.rides ?? []) {
    if (ride.kind !== 'slide' && ride.kind !== 'sled') continue;
    // Walk the step finely: the slope's height changes along it.
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const p = { x: from.x + dx * t, y: from.y + dy * t };
      const b = rampBox(ride);
      if (p.x < b.x - r || p.x > b.x + b.w + r || p.y < b.y - r || p.y > b.y + b.h + r) continue;
      const k = Math.max(0, Math.min(1, along(ride, p).t));
      const top = ride.from.z + (ride.to.z - ride.from.z) * k;
      const shot = z + dz * t;
      if (shot - r < top + (ride.kind === 'slide' ? RAIL_TOP : 0) && shot + r > top - BOARD) {
        if (best === null || t < best) best = t;
        break;
      }
    }
  }
  return best;
}

/** A slide's board is this thick under its surface; its side rails reach this far above it. */
const BOARD = 0.12;
const RAIL_TOP = 0.27;

/** One slide's or sled run's surface height at `pos`, or null off it. */
export function slopeAt(r: RideDef, pos: Vec2): number | null {
  if (r.kind !== 'slide' && r.kind !== 'sled') return null;
  const { t, side } = along(r, pos);
  if (t < 0 || t > 1 || side > rampWidth(r) / 2) return null;
  return r.from.z + (r.to.z - r.from.z) * t;
}

/** A slide's or a sled run's smooth sloped surface: its height at `pos`, or null off it. */
export function rampSurface(world: World, pos: Vec2): number | null {
  let best: number | null = null;
  for (const r of world.map.rides ?? []) {
    const h = slopeAt(r, pos);
    if (h !== null && (best === null || h > best)) best = h;
  }
  return best;
}

/**
 * A slide or sled run in the way of a plush whose feet are at `feet`: the part of it within the
 * plush's reach that's higher than its feet, as a box to be pushed out of (null if none). Walking
 * up it is fine (each step up is tiny); walking into its side isn't.
 */
export function rampInTheWay(world: World, pos: Vec2, radius: number, feet: number): Box | null {
  for (const r of world.map.rides ?? []) {
    if (r.kind !== 'slide' && r.kind !== 'sled') continue;
    const box = rampBox(r);
    if (pos.x + radius < box.x || pos.x - radius > box.x + box.w || pos.y + radius < box.y || pos.y - radius > box.y + box.h) continue;
    // How high it is beside the plush (level with its middle along the slope). A slide's board up
    // above the plush's head can be walked under (the sled run is a solid mound of snow).
    const { t } = along(r, pos);
    const top = r.from.z + (r.to.z - r.from.z) * Math.max(0, Math.min(1, t));
    const head = feet - config.player.stepHeight + config.player.height;
    if (top > feet && (r.kind === 'sled' || top - BOARD < head)) return box;
  }
  return null;
}

/** A seesaw plank's middle sits this high; it's this wide and reaches this far past each end. */
export const SEESAW = { pivot: 0.6, width: 0.6, overhang: 0.5, thickness: 0.12 };

/** A seesaw's plank as a slope (from its low end to its high end), for standing on. */
function seesawSlope(s: { a: Vec2; b: Vec2 }, down: 'a' | 'b'): { from: Vec2; to: Vec2; low: number; high: number } {
  const lowEnd = down === 'a' ? s.a : s.b;
  const highEnd = down === 'a' ? s.b : s.a;
  const dx = highEnd.x - lowEnd.x;
  const dy = highEnd.y - lowEnd.y;
  const len = Math.hypot(dx, dy) || 1;
  const o = SEESAW.overhang / len;
  return {
    from: { x: lowEnd.x - dx * o, y: lowEnd.y - dy * o },
    to: { x: highEnd.x + dx * o, y: highEnd.y + dy * o },
    // The top of the plank: its low end rests on the ground, the high end mirrors it.
    low: SEESAW.thickness,
    high: 2 * SEESAW.pivot,
  };
}

/** The top of a seesaw's tilted plank at `pos`, or null off every plank. */
export function seesawSurface(world: World, state: GameState, pos: Vec2): number | null {
  let best: number | null = null;
  (world.map.seesaws ?? []).forEach((s, i) => {
    const sl = seesawSlope(s, state.seesaws[i]?.down ?? 'a');
    const dx = sl.to.x - sl.from.x;
    const dy = sl.to.y - sl.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = ((pos.x - sl.from.x) * dx + (pos.y - sl.from.y) * dy) / (len * len);
    const side = Math.abs((pos.x - sl.from.x) * dy - (pos.y - sl.from.y) * dx) / len;
    if (t < 0 || t > 1 || side > SEESAW.width / 2) return;
    const h = sl.low + (sl.high - sl.low) * t;
    if (best === null || h > best) best = h;
  });
  return best;
}

/** A seesaw walked into from the side, higher there than the plush's feet: a box to push out of. */
export function seesawInTheWay(world: World, state: GameState, pos: Vec2, radius: number, feet: number): Box | null {
  const seesaws = world.map.seesaws ?? [];
  for (let i = 0; i < seesaws.length; i++) {
    const sl = seesawSlope(seesaws[i]!, state.seesaws[i]?.down ?? 'a');
    const alongX = Math.abs(sl.to.x - sl.from.x) > Math.abs(sl.to.y - sl.from.y);
    const w = SEESAW.width / 2;
    const box: Box = alongX
      ? { x: Math.min(sl.from.x, sl.to.x), y: sl.from.y - w, w: Math.abs(sl.to.x - sl.from.x), h: 2 * w }
      : { x: sl.from.x - w, y: Math.min(sl.from.y, sl.to.y), w: 2 * w, h: Math.abs(sl.to.y - sl.from.y) };
    if (pos.x + radius < box.x || pos.x - radius > box.x + box.w || pos.y + radius < box.y || pos.y - radius > box.y + box.h) continue;
    const dx = sl.to.x - sl.from.x;
    const dy = sl.to.y - sl.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, Math.min(1, ((pos.x - sl.from.x) * dx + (pos.y - sl.from.y) * dy) / (len * len)));
    if (sl.low + (sl.high - sl.low) * t > feet) return box;
  }
  return null;
}

/**
 * A hamster tube's low parts as solid walls (straight along x or y): near its ends it lies on the
 * floor; where it arches higher than a plush you walk under it. `arch`: how high its middle rises.
 */
export function tubeWalls(r: RideDef, arch = 2.5, radius = 0.55, base = 0.5): Wall[] {
  const dx = r.to.x - r.from.x;
  const dy = r.to.y - r.from.y;
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.round(len));
  const alongX = Math.abs(dx) > Math.abs(dy);
  const out: Wall[] = [];
  // Leave its mouths open (stand there to get in).
  const skip = 1.2 / len;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    if (t1 < skip || t0 > 1 - skip) continue;
    const t = (t0 + t1) / 2;
    const middle = base + arch * 4 * t * (1 - t);
    if (middle - radius > config.player.height) continue;
    const x0 = r.from.x + dx * t0;
    const x1 = r.from.x + dx * t1;
    const y0 = r.from.y + dy * t0;
    const y1 = r.from.y + dy * t1;
    out.push({
      kind: 'ramp',
      x: alongX ? Math.min(x0, x1) : x0 - radius,
      y: alongX ? y0 - radius : Math.min(y0, y1),
      w: alongX ? Math.abs(x1 - x0) : radius * 2,
      h: alongX ? radius * 2 : Math.abs(y1 - y0),
      height: middle + radius,
    });
  }
  return out;
}

/** A catapult (a spring launcher) is this big across (a solid low box), and the top of its
 *  platform, squashed down ready to throw, this high: a plush is loaded in its middle. */
export const CATAPULT_SIZE = 2;
export const CATAPULT_CUP = 0.95;

/**
 * A catapult standing at `at`, throwing toward `toward`: its ride (from its platform up to where
 * the umbrella opens, `reach` along and `height` up) and its body as a solid wall (drawn with the ride).
 */
export function catapult(at: Vec2, toward: Vec2, reach = 12, height = 14): { ride: RideDef; wall: Wall } {
  const dx = toward.x - at.x;
  const dy = toward.y - at.y;
  const len = Math.hypot(dx, dy) || 1;
  const half = CATAPULT_SIZE / 2;
  return {
    ride: {
      kind: 'catapult',
      from: { x: at.x, y: at.y, z: CATAPULT_CUP },
      to: { x: at.x + (dx / len) * reach, y: at.y + (dy / len) * reach, z: height },
      seconds: 1.2,
      boost: 0,
    },
    wall: { kind: 'ramp', x: at.x - half, y: at.y - half, w: CATAPULT_SIZE, h: CATAPULT_SIZE, height: CATAPULT_CUP },
  };
}
