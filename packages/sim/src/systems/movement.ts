import { config, DT } from '../config.ts';
import { clamp, clampLength1, normalizeOrNull } from '../math.ts';
import type { Input, Player } from '../types.ts';
import type { World } from '../world.ts';

// Fraction of the gap to target velocity closed per tick (frame-rate independent smoothing).
const ACCEL_BLEND = 1 - Math.exp(-config.player.acceleration * DT);
const KNOCKBACK_KEEP = Math.exp(-config.player.knockbackDecay * DT);

export function applyAim(player: Player, input: Input): void {
  const aim = normalizeOrNull(input.aimX, input.aimY);
  if (aim) player.aim = aim;
}

export function movePlayer(world: World, player: Player, input: Input): void {
  const move = clampLength1(input.moveX, input.moveY);
  const speed = config.player.moveSpeed;
  const targetX = move.x * speed;
  const targetY = move.y * speed;

  player.vel.x += (targetX - player.vel.x) * ACCEL_BLEND;
  player.vel.y += (targetY - player.vel.y) * ACCEL_BLEND;

  player.pos.x += (player.vel.x + player.knockback.x) * DT;
  player.pos.y += (player.vel.y + player.knockback.y) * DT;
  player.knockback.x *= KNOCKBACK_KEEP;
  player.knockback.y *= KNOCKBACK_KEEP;

  const { width, height } = world.map;
  const r = player.radius;
  player.pos.x = clamp(player.pos.x, r, width - r);
  player.pos.y = clamp(player.pos.y, r, height - r);
}
