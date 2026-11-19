import { config, DT } from '../config.ts';
import { circleBoxPush } from '../collision/geometry.ts';
import { clamp, clampLength1, normalizeOrNull } from '../math.ts';
import { Btn } from '../types.ts';
import type { Ball, GameState, Input, Player, Vec2 } from '../types.ts';
import { wallsNear, type World } from '../world.ts';
import { pushBall } from './balls.ts';
import { carriedBy, TRAIN, trainCircles, trainFloor } from './train.ts';
import { iceOpen } from './toys.ts';
import { landed, onTrampoline, rampInTheWay, rampSurface, rideAt, seesawInTheWay, seesawSurface, startRide, updateRide } from './rides.ts';
import { pinsInTheWay } from './minigames.ts';
import { wandererCircles } from './wanderers.ts';

// Fraction of the gap to target velocity closed per tick (frame-rate independent smoothing).
const ACCEL_BLEND = 1 - Math.exp(-config.player.acceleration * DT);
/** On ice: speeding up, slowing down and turning all take much longer (you slide). */
const ICE_BLEND = 1 - Math.exp(-config.player.acceleration * config.player.iceGrip * DT);
const KNOCKBACK_KEEP = Math.exp(-config.player.knockbackDecay * DT);
/** Longest move per collision substep; well under the player radius so walls can't be skipped. */
const MAX_SUBSTEP = 0.35;
const OBSTACLE_PASSES = 3;
const STEP = config.player.stepHeight;
const EPS = 1e-6;

export function applyAim(player: Player, input: Input): void {
  const aim = normalizeOrNull(input.aimX, input.aimY);
  if (aim) player.aim = aim;
  player.aimDistance = Math.hypot(input.aimX, input.aimY);
}

/**
 * Horizontal movement with sliding collision, then jumping and gravity. Obstacles are boxes
 * and circles with a top height: one is solid to a plush only while the plush's feet are
 * below its top (minus the step height); above that the plush passes over or stands on it.
 */
export function movePlayer(world: World, state: GameState, player: Player, input: Input): void {
  if (player.drop) {
    tossMove(world, state, player, input);
    return;
  }
  // On a slide, a sled run, a zip line or in a tube: carried along, no walking.
  if (updateRide(world, state, player)) return;
  // Riding a train wagon: carried along with it (and turned with the track) first.
  if (world.map.track && player.z > 0.05) {
    const carried = carriedBy(world.map.track, state.tick - 1, state.tick, player.pos, player.z);
    if (carried) player.pos = carried;
  }
  // Trapped in a bubble: no walking or jumping (knockback still pushes the bubble around).
  const trapped = state.tick < player.bubbledUntil;
  const move = trapped ? { x: 0, y: 0 } : clampLength1(input.moveX, input.moveY);
  const speed =
    config.player.moveSpeed *
    (player.action?.kind === 'useItem' ? config.itemUseMoveMultiplier : 1) *
    (player.chargeStartTick !== null ? config.combat.chargeMoveMultiplier : 1) *
    (state.tick < player.juiceUntil ? config.itemEffects.juice.speedMultiplier : 1) *
    (state.tick < player.glitteredUntil ? config.combat.glitterMoveMultiplier : 1) *
    (state.tick < player.soakedUntil ? config.strike.soakMoveMultiplier : 1) *
    (player.soggy ? config.player.soggySpeedMultiplier : 1) *
    (wading(world, player, state) ? config.player.wadeSpeedMultiplier : 1);
  const blend = onIce(world, player, state) ? ICE_BLEND : ACCEL_BLEND;
  player.vel.x += (move.x * speed - player.vel.x) * blend;
  player.vel.y += (move.y * speed - player.vel.y) * blend;

  const dx = (player.vel.x + player.knockback.x) * DT;
  const dy = (player.vel.y + player.knockback.y) * DT;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_SUBSTEP));
  for (let i = 0; i < steps; i++) {
    player.pos.x += dx / steps;
    player.pos.y += dy / steps;
    resolveObstacles(world, state, player);
  }
  player.knockback.x *= KNOCKBACK_KEEP;
  player.knockback.y *= KNOCKBACK_KEEP;
  clampToMap(world, player);

  // Jump on a fresh press while standing on something, unless a roof is overhead.
  const ground = groundHeight(world, state, player.pos, player.z);
  const grounded = player.z <= ground + EPS && player.vz <= 0;
  const pressed = !trapped && (input.buttons & Btn.Jump) !== 0 && (player.heldButtons & Btn.Jump) === 0;
  if (grounded && pressed && !underRoof(world, player.pos, player.z)) player.vz = config.player.jumpSpeed;

  if (!grounded || player.vz > 0) {
    // Exact for constant gravity, so the apex matches jumpSpeed² / (2 gravity).
    const g = config.player.gravity;
    player.z += player.vz * DT - 0.5 * g * DT * DT;
    player.vz -= g * DT;
  }
  let floor = groundHeight(world, state, player.pos, player.z);
  // Walking down a slope: stay on it rather than falling off each bit of it.
  if (grounded && player.vz <= 0) {
    const ramp = Math.max(rampSurface(world, player.pos) ?? -1, seesawSurface(world, state, player.pos) ?? -1);
    if (ramp >= 0 && ramp < player.z && player.z - ramp < 0.4) {
      player.z = ramp;
      floor = Math.max(floor, ramp);
    }
  }
  const falling = player.vz < -config.rides.landSpeed;
  if (player.z <= floor + EPS) {
    // Landed, or stepped up onto something low enough.
    player.z = floor;
    if (player.vz < 0) player.vz = 0;
    // A trampoline bounces whoever is on it; a seesaw tips when someone lands on an end.
    if (falling || onTrampoline(world, player)) landed(world, state, player);
  }
  // Stepped onto the top of a slide or a sled run: off you go.
  const slide = rideAt(world, state, player, false);
  if (slide !== -1) startRide(world, state, player, slide);
}

/**
 * Height of the highest surface under `pos` that a plush with its feet at `z` can stand on:
 * the lawn (0), or a wall, chest or roof whose top is at most a step above the feet.
 */
export function groundHeight(world: World, state: GameState, pos: Vec2, z: number): number {
  let best = 0;
  const reach = z + STEP;
  for (const w of wallsNear(world, pos.x, pos.y, pos.x, pos.y)) {
    if (w.height <= reach && w.height > best && inBox(pos, w)) best = w.height;
  }
  for (const c of state.chests) {
    const top = c.z + config.chest.height;
    if (top <= reach && top > best && Math.hypot(pos.x - c.pos.x, pos.y - c.pos.y) <= config.chest.radius) best = top;
  }
  for (const b of world.map.buildings) {
    if (b.height <= reach && b.height > best && inBox(pos, b)) best = b.height;
  }
  // A slide's or sled run's smooth slope, or a seesaw's tilted plank.
  for (const slope of [rampSurface(world, pos), seesawSurface(world, state, pos)]) {
    if (slope !== null && slope <= reach && slope > best) best = slope;
  }
  // A train wagon's deck.
  if (world.map.track) best = Math.max(best, trainFloor(world.map.track, state.tick, pos, reach));
  return best;
}

/** Index of the roofed building the plush is under (inside the area, below the roof), or -1. */
export function buildingAt(world: World, pos: Vec2, z: number): number {
  const buildings = world.map.buildings;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]!;
    if (z < b.height && inBox(pos, b)) return i;
  }
  return -1;
}

function underRoof(world: World, pos: Vec2, z: number): boolean {
  return buildingAt(world, pos, z) !== -1;
}

/**
 * Pushes the player out of any wall or chest it overlaps and is not above, and removes
 * velocity into them, so the plush slides along instead of sticking.
 */
export function resolveObstacles(world: World, state: GameState, player: Player): void {
  const r = player.radius;
  const feet = player.z + STEP;
  for (let pass = 0; pass < OBSTACLE_PASSES; pass++) {
    const { x, y } = player.pos;
    let moved = false;
    for (const wall of wallsNear(world, x - r, y - r, x + r, y + r)) {
      if (wall.height <= feet) continue;
      const push = circleBoxPush(player.pos.x, player.pos.y, r, wall);
      if (push) moved = pushOut(player, push.nx, push.ny, push.depth) || moved;
    }
    // A slide or sled run walked into from the side (or from below its high end).
    const ramp = rampInTheWay(world, player.pos, r, feet) ?? seesawInTheWay(world, state, player.pos, r, feet);
    if (ramp) {
      const push = circleBoxPush(player.pos.x, player.pos.y, r, ramp);
      if (push) moved = pushOut(player, push.nx, push.ny, push.depth) || moved;
    }
    {
      for (const chest of state.chests) {
        // Only one at the plush's own level: not one it's on, nor one on the roof above it.
        if (chest.z + config.chest.height <= feet || chest.z > feet) continue;
        const dx = player.pos.x - chest.pos.x;
        const dy = player.pos.y - chest.pos.y;
        const min = r + config.chest.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        moved = (d < 1e-9 ? pushOut(player, 0, 1, min) : pushOut(player, dx / d, dy / d, min - d)) || moved;
      }
    }
    for (const ball of state.balls) {
      if (player.z < ball.radius * 2) moved = kickBall(state, player, ball) || moved;
    }
    // The wanderers (a vacuum, a mower or plow) are in the way.
    if (player.z < 0.8) {
      for (const c of wandererCircles(world, state)) {
        const dx = player.pos.x - c.x;
        const dy = player.pos.y - c.y;
        const min = r + c.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        moved = (d < 1e-9 ? pushOut(player, 0, 1, min) : pushOut(player, dx / d, dy / d, min - d)) || moved;
      }
    }
    // Standing bowling pins (it takes the ball to knock them down).
    if (player.z < 0.8) {
      for (const pin of pinsInTheWay(world, state)) {
        const dx = player.pos.x - pin.x;
        const dy = player.pos.y - pin.y;
        const min = r + config.games.pins.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        moved = (d < 1e-9 ? pushOut(player, 0, 1, min) : pushOut(player, dx / d, dy / d, min - d)) || moved;
      }
    }
    // The jack-in-the-box.
    const toy = state.toy;
    if (toy?.kind === 'jack' && player.z < toy.z + 1) {
      const dx = player.pos.x - toy.at.x;
      const dy = player.pos.y - toy.at.y;
      const min = r + config.toys.jack.size;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min) {
        const d = Math.sqrt(d2);
        moved = (d < 1e-9 ? pushOut(player, 0, 1, min) : pushOut(player, dx / d, dy / d, min - d)) || moved;
      }
    }
    // The piñata, while it's whole (at the plush's level).
    const pin = state.pinata;
    if (pin && !pin.broken && player.z < pin.z + config.pinata.lift[pin.kind] + config.pinata.halfHeight && player.z + config.player.height > pin.z) {
      const dx = player.pos.x - pin.pos.x;
      const dy = player.pos.y - pin.pos.y;
      const min = r + config.pinata.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min) {
        const d = Math.sqrt(d2);
        moved = (d < 1e-9 ? pushOut(player, 0, 1, min) : pushOut(player, dx / d, dy / d, min - d)) || moved;
      }
    }
    if (world.map.track) {
      for (const c of trainCircles(world.map.track, state.tick)) {
        // Standing on (or above) a car: it's floor, not a wall.
        if (c.top > feet) moved = trainBump(state, player, c) || moved;
      }
    }
    if (!moved) return;
  }
}

/**
 * Running into a beach ball kicks it away (and the plush bounces back a little, with a boing);
 * a gentle bump just nudges it along.
 */
function kickBall(state: GameState, player: Player, ball: Ball): boolean {
  const dx = player.pos.x - ball.pos.x;
  const dy = player.pos.y - ball.pos.y;
  const min = player.radius + ball.radius;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  const nx = d < 1e-9 ? 0 : dx / d;
  const ny = d < 1e-9 ? 1 : dy / d;
  // How fast the plush was heading into the ball.
  const impact = -((player.vel.x + player.knockback.x) * nx + (player.vel.y + player.knockback.y) * ny);
  pushOut(player, nx, ny, min - d);
  const B = config.beachBall;
  if (impact >= B.minImpact) {
    pushBall(ball, -nx, -ny, impact * B.kickFactor + B.kickBase);
    player.knockback.x = nx * B.bounce;
    player.knockback.y = ny * B.bounce;
    state.events.push({ type: 'ballBounce', playerId: player.id, ballId: ball.id, pos: { x: ball.pos.x, y: ball.pos.y } });
  } else if (impact > 0) {
    pushBall(ball, -nx, -ny, impact * 1.1);
  }
  return true;
}

/** A train car in the way: pushed out, and shoved hard if it's heading into you (a toot). */
function trainBump(state: GameState, player: Player, c: { x: number; y: number; r: number; dir: Vec2 }): boolean {
  const dx = player.pos.x - c.x;
  const dy = player.pos.y - c.y;
  const min = player.radius + c.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  const nx = d < 1e-9 ? -c.dir.y : dx / d;
  const ny = d < 1e-9 ? c.dir.x : dy / d;
  pushOut(player, nx, ny, min - d);
  const ahead = nx * c.dir.x + ny * c.dir.y;
  const shoved = Math.hypot(player.knockback.x, player.knockback.y) > TRAIN.shove * 0.6;
  if (ahead > 0.2 && !shoved) {
    // Off to the side and forward, like a cow catcher.
    player.knockback.x = (nx + c.dir.x) * 0.5 * TRAIN.shove * 1.4;
    player.knockback.y = (ny + c.dir.y) * 0.5 * TRAIN.shove * 1.4;
    state.events.push({ type: 'trainBump', playerId: player.id, pos: { x: player.pos.x, y: player.pos.y } });
  }
  return true;
}

function pushOut(player: Player, nx: number, ny: number, depth: number): boolean {
  player.pos.x += nx * depth;
  player.pos.y += ny * depth;
  removeInto(player.vel, nx, ny);
  removeInto(player.knockback, nx, ny);
  return true;
}

/**
 * Plushies are solid to each other when they overlap in height: overlapping pairs are pushed
 * apart equally. Pairs are visited in id order so the result is deterministic.
 */
export function separatePlayers(world: World, state: GameState): void {
  // Everyone on the blimp shares a spot; they don't push each other.
  const alive = state.players.filter((p) => p.alive && !p.drop);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i]!;
      const b = alive[j]!;
      if (Math.abs(a.z - b.z) >= config.player.height) continue;
      let dx = b.pos.x - a.pos.x;
      let dy = b.pos.y - a.pos.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const half = (min - d) / 2;
      if (d < 1e-9) {
        // Exactly on top of each other: split along x.
        dx = 1;
        dy = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      a.pos.x -= dx * half;
      a.pos.y -= dy * half;
      b.pos.x += dx * half;
      b.pos.y += dy * half;
      resolveObstacles(world, state, a);
      resolveObstacles(world, state, b);
      clampToMap(world, a);
      clampToMap(world, b);
    }
  }
}

/** True if a plush at this point and height is inside a bush. */
export function insideBush(world: World, pos: Vec2, z: number): boolean {
  if (z >= config.vision.bushHeight) return false;
  for (const b of world.map.bushes) {
    const dx = pos.x - b.center.x;
    const dy = pos.y - b.center.y;
    if (dx * dx + dy * dy <= b.radius * b.radius) return true;
  }
  return false;
}

function inBox(p: Vec2, b: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

function clampToMap(world: World, player: Player): void {
  const r = player.radius;
  const out = config.player.roamOutside;
  player.pos.x = clamp(player.pos.x, -out + r, world.map.width + out - r);
  player.pos.y = clamp(player.pos.y, -out + r, world.map.height + out - r);
}

function removeInto(v: { x: number; y: number }, nx: number, ny: number): void {
  const dot = v.x * nx + v.y * ny;
  if (dot < 0) {
    v.x -= nx * dot;
    v.y -= ny * dot;
  }
}

/** Standing on ice (not in the air; and not while the pond is broken open). */
export function onIce(world: World, player: Pick<Player, 'pos' | 'z'>, state?: GameState): boolean {
  if (player.z > 0.05 || (state && iceOpen(state))) return false;
  for (const ice of world.map.ice ?? []) {
    if (Math.hypot(player.pos.x - ice.center.x, player.pos.y - ice.center.y) < ice.radius) return true;
  }
  return false;
}

/** Standing in a pool's shallow water (not jumping over it), or in the pond while it's open. */
export function wading(world: World, player: Pick<Player, 'pos' | 'z'>, state?: GameState): boolean {
  if (player.z > 0.05) return false;
  const water = state && iceOpen(state) ? [...(world.map.pools ?? []), ...(world.map.ice ?? [])] : (world.map.pools ?? []);
  for (const pool of water) {
    if (Math.hypot(player.pos.x - pool.center.x, player.pos.y - pool.center.y) < pool.radius) return true;
  }
  return false;
}

/**
 * The Toss. Riding: carried along the blimp's line; Jump drops you (everyone left is dropped at
 * the end of the line). Gliding: steer under your umbrella while you sink; you land on whatever
 * is below (the lawn, a roof, a wall top) and the match begins for you.
 */
function tossMove(world: World, state: GameState, player: Player, input: Input): void {
  const t = config.toss;
  if (player.drop === 'riding') {
    const toss = state.toss;
    if (toss) {
      const k = clamp((state.tick - toss.startTick) / Math.max(1, toss.endTick - toss.startTick), 0, 1);
      player.pos.x = toss.from.x + (toss.to.x - toss.from.x) * k;
      player.pos.y = toss.from.y + (toss.to.y - toss.from.y) * k;
    }
    player.z = t.height;
    player.vel.x = player.vel.y = player.vz = 0;
    const pressed = (input.buttons & Btn.Jump) !== 0 && (player.heldButtons & Btn.Jump) === 0;
    if (pressed || !toss || state.tick >= toss.endTick) player.drop = 'gliding';
    return;
  }
  const move = clampLength1(input.moveX, input.moveY);
  player.vel.x += (move.x * t.glideSpeed - player.vel.x) * ACCEL_BLEND;
  player.vel.y += (move.y * t.glideSpeed - player.vel.y) * ACCEL_BLEND;
  player.pos.x += player.vel.x * DT;
  player.pos.y += player.vel.y * DT;
  player.z -= t.fallSpeed * DT;
  resolveObstacles(world, state, player);
  clampToMap(world, player);
  const floor = groundHeight(world, state, player.pos, player.z);
  if (player.z <= floor + EPS) {
    player.z = floor;
    player.vz = 0;
    player.drop = null;
  }
}
