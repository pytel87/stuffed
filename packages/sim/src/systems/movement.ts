import { config, DT } from '../config.ts';
import { circleBoxPush } from '../collision/geometry.ts';
import { clamp, clampLength1, normalizeOrNull } from '../math.ts';
import { Btn } from '../types.ts';
import type { GameState, Input, Player, Vec2, Wall } from '../types.ts';
import { wallsNear, type World } from '../world.ts';

// Fraction of the gap to target velocity closed per tick (frame-rate independent smoothing).
const ACCEL_BLEND = 1 - Math.exp(-config.player.acceleration * DT);
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
  // Trapped in a bubble: no walking or jumping (knockback still pushes the bubble around).
  const trapped = state.tick < player.bubbledUntil;
  const move = trapped ? { x: 0, y: 0 } : clampLength1(input.moveX, input.moveY);
  const speed =
    config.player.moveSpeed *
    (player.action?.kind === 'useItem' ? config.itemUseMoveMultiplier : 1) *
    (player.chargeStartTick !== null ? config.combat.chargeMoveMultiplier : 1) *
    (state.tick < player.juiceUntil ? config.itemEffects.juice.speedMultiplier : 1) *
    (player.soggy ? config.player.soggySpeedMultiplier : 1) *
    (wading(world, player) ? config.player.wadeSpeedMultiplier : 1);
  player.vel.x += (move.x * speed - player.vel.x) * ACCEL_BLEND;
  player.vel.y += (move.y * speed - player.vel.y) * ACCEL_BLEND;

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
  const floor = groundHeight(world, state, player.pos, player.z);
  if (player.z <= floor + EPS) {
    // Landed, or stepped up onto something low enough.
    player.z = floor;
    if (player.vz < 0) player.vz = 0;
  }
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
  const h = config.chest.height;
  if (h <= reach && h > best) {
    for (const c of state.chests) {
      if (Math.hypot(pos.x - c.pos.x, pos.y - c.pos.y) <= config.chest.radius) best = h;
    }
  }
  for (const b of world.map.buildings) {
    if (b.height <= reach && b.height > best && inBox(pos, b)) best = b.height;
  }
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
      if (wall.kind === 'ball') {
        moved = bounceOffBall(state, player, wall) || moved;
        continue;
      }
      const push = circleBoxPush(player.pos.x, player.pos.y, r, wall);
      if (push) moved = pushOut(player, push.nx, push.ny, push.depth) || moved;
    }
    if (config.chest.height > feet) {
      for (const chest of state.chests) {
        const dx = player.pos.x - chest.pos.x;
        const dy = player.pos.y - chest.pos.y;
        const min = r + config.chest.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        moved = (d < 1e-9 ? pushOut(player, 0, 1, min) : pushOut(player, dx / d, dy / d, min - d)) || moved;
      }
    }
    if (!moved) return;
  }
}

/** A beach ball is round; running into it bounces the plush back (with a boing). */
function bounceOffBall(state: GameState, player: Player, ball: Wall): boolean {
  const cx = ball.x + ball.w / 2;
  const cy = ball.y + ball.h / 2;
  const min = player.radius + Math.min(ball.w, ball.h) / 2;
  const dx = player.pos.x - cx;
  const dy = player.pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  const nx = d < 1e-9 ? 0 : dx / d;
  const ny = d < 1e-9 ? 1 : dy / d;
  // How fast the plush was heading into the ball.
  const impact = -((player.vel.x + player.knockback.x) * nx + (player.vel.y + player.knockback.y) * ny);
  pushOut(player, nx, ny, min - d);
  if (impact >= config.beachBall.minImpact) {
    player.knockback.x = nx * config.beachBall.bounce;
    player.knockback.y = ny * config.beachBall.bounce;
    state.events.push({ type: 'ballBounce', playerId: player.id, pos: { x: cx, y: cy } });
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

/** Standing in a pool's shallow water (not jumping over it). */
export function wading(world: World, player: Pick<Player, 'pos' | 'z'>): boolean {
  if (player.z > 0.05) return false;
  for (const pool of world.map.pools ?? []) {
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
