import { config, DT } from '../config.ts';
import { circleBoxPush } from '../collision/geometry.ts';
import { clamp, clampLength1, normalizeOrNull } from '../math.ts';
import type { GameState, Input, Player } from '../types.ts';
import type { World } from '../world.ts';

// Fraction of the gap to target velocity closed per tick (frame-rate independent smoothing).
const ACCEL_BLEND = 1 - Math.exp(-config.player.acceleration * DT);
const KNOCKBACK_KEEP = Math.exp(-config.player.knockbackDecay * DT);
/** Longest move per collision substep; well under the player radius so walls can't be skipped. */
const MAX_SUBSTEP = 0.35;
const WALL_PASSES = 3;

export function applyAim(player: Player, input: Input): void {
  const aim = normalizeOrNull(input.aimX, input.aimY);
  if (aim) player.aim = aim;
}

export function movePlayer(world: World, state: GameState, player: Player, input: Input): void {
  const move = clampLength1(input.moveX, input.moveY);
  const speed =
    config.player.moveSpeed *
    (player.action?.kind === 'useItem' ? config.itemUseMoveMultiplier : 1) *
    (player.soggy ? config.player.soggySpeedMultiplier : 1);
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
}

/**
 * Pushes the player out of any wall or chest it overlaps and removes velocity into them, so
 * the plush slides along instead of sticking.
 */
export function resolveObstacles(world: World, state: GameState, player: Player): void {
  const r = player.radius;
  for (let pass = 0; pass < WALL_PASSES; pass++) {
    const { x, y } = player.pos;
    let moved = false;
    for (const i of world.walls.query(x - r, y - r, x + r, y + r)) {
      const push = circleBoxPush(player.pos.x, player.pos.y, r, world.map.walls[i]!);
      if (push) moved = pushOut(player, push.nx, push.ny, push.depth) || moved;
    }
    for (const chest of state.chests) {
      const dx = player.pos.x - chest.pos.x;
      const dy = player.pos.y - chest.pos.y;
      const min = r + config.chest.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      moved = (d < 1e-9 ? pushOut(player, 0, 1, min) : pushOut(player, dx / d, dy / d, min - d)) || moved;
    }
    if (!moved) return;
  }
}

function pushOut(player: Player, nx: number, ny: number, depth: number): boolean {
  player.pos.x += nx * depth;
  player.pos.y += ny * depth;
  removeInto(player.vel, nx, ny);
  removeInto(player.knockback, nx, ny);
  return true;
}

/**
 * Plushies are solid to each other: overlapping pairs are pushed apart equally.
 * Pairs are visited in id order so the result is deterministic.
 */
export function separatePlayers(world: World, state: GameState): void {
  const alive = state.players.filter((p) => p.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i]!;
      const b = alive[j]!;
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

/** Index of the roofed building containing the point, or -1. */
export function buildingAt(world: World, x: number, y: number): number {
  const buildings = world.map.buildings;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]!;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
  }
  return -1;
}

/** True if the point is inside any bush. */
export function insideBush(world: World, x: number, y: number): boolean {
  for (const b of world.map.bushes) {
    const dx = x - b.center.x;
    const dy = y - b.center.y;
    if (dx * dx + dy * dy <= b.radius * b.radius) return true;
  }
  return false;
}

function clampToMap(world: World, player: Player): void {
  const r = player.radius;
  player.pos.x = clamp(player.pos.x, r, world.map.width - r);
  player.pos.y = clamp(player.pos.y, r, world.map.height - r);
}

function removeInto(v: { x: number; y: number }, nx: number, ny: number): void {
  const dot = v.x * nx + v.y * ny;
  if (dot < 0) {
    v.x -= nx * dot;
    v.y -= ny * dot;
  }
}
