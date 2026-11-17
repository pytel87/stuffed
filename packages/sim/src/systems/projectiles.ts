import { config, DT } from '../config.ts';
import { segmentBoxT } from '../collision/geometry.ts';
import type { GameState, Player, Projectile } from '../types.ts';
import type { World } from '../world.ts';
import { applyDamage } from './damage.ts';

/**
 * Moves projectiles with a swept test so fast ones can't skip through a plush or a wall
 * between ticks. Shots fly level at their height: they only hit plushies, walls and chests
 * they overlap vertically, so a jump can dodge them and a shot from up high clears low cover.
 * The earliest hit along the path wins; on equal t cover beats a plush and a lower player id
 * beats a higher one (deterministic).
 */
export function updateProjectiles(world: World, state: GameState): void {
  const survivors: Projectile[] = [];
  for (const proj of state.projectiles) {
    if (state.tick >= proj.expireTick) continue;
    const dx = proj.vel.x * DT;
    const dy = proj.vel.y * DT;
    // Height along this tick's path: z at t is proj.z + dz * t.
    const zNext = proj.vz > 0 ? Math.min(proj.z + proj.vz * DT, proj.zEnd) : Math.max(proj.z + proj.vz * DT, proj.zEnd);
    const dz = zNext - proj.z;
    const r = proj.radius;
    const lowest = Math.min(proj.z, zNext) - r;

    let hit: Player | null = null;
    let hitT = Infinity;
    for (const p of state.players) {
      if (!p.alive || p.id === proj.ownerId) continue;
      const t = sweepCircle(proj.pos.x, proj.pos.y, dx, dy, p.pos.x, p.pos.y, p.radius + r);
      if (t === null) continue;
      const zt = proj.z + dz * t;
      if (zt + r < p.z || zt - r > p.z + config.player.height) continue; // passes over or under
      if (t < hitT) {
        hit = p;
        hitT = t;
      }
    }

    let wallT = Infinity;
    const candidates = world.walls.query(
      Math.min(proj.pos.x, proj.pos.x + dx) - r,
      Math.min(proj.pos.y, proj.pos.y + dy) - r,
      Math.max(proj.pos.x, proj.pos.x + dx) + r,
      Math.max(proj.pos.y, proj.pos.y + dy) + r,
    );
    for (const i of candidates) {
      const wall = world.map.walls[i]!;
      if (lowest >= wall.height) continue;
      const t = segmentBoxT(proj.pos.x, proj.pos.y, dx, dy, wall, r);
      if (t !== null && t < wallT && proj.z + dz * t - r < wall.height) wallT = t;
    }
    if (lowest < config.chest.height) {
      for (const chest of state.chests) {
        const t = sweepCircle(proj.pos.x, proj.pos.y, dx, dy, chest.pos.x, chest.pos.y, config.chest.radius + r);
        if (t !== null && t < wallT && proj.z + dz * t - r < config.chest.height) wallT = t;
      }
    }
    if (wallT !== Infinity && wallT <= hitT) {
      state.events.push({ type: 'impact', pos: { x: proj.pos.x + dx * wallT, y: proj.pos.y + dy * wallT }, weapon: proj.weapon });
      continue;
    }

    if (hit) {
      const len = Math.hypot(proj.vel.x, proj.vel.y) || 1;
      hit.knockback.x += (proj.vel.x / len) * proj.knockback;
      hit.knockback.y += (proj.vel.y / len) * proj.knockback;
      applyDamage(state, hit, proj.damage, proj.ownerId);
      continue;
    }

    proj.pos.x += dx;
    proj.pos.y += dy;
    proj.z = zNext;
    const { width, height } = world.map;
    if (proj.pos.x < 0 || proj.pos.y < 0 || proj.pos.x > width || proj.pos.y > height) continue;
    survivors.push(proj);
  }
  state.projectiles = survivors;
}

/**
 * First time t in [0, 1] at which the point (x, y) moving by (dx, dy) comes within r of
 * (cx, cy), or null if it never does. Starting inside counts as t = 0.
 */
export function sweepCircle(x: number, y: number, dx: number, dy: number, cx: number, cy: number, r: number): number | null {
  const fx = x - cx;
  const fy = y - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = fx * dx + fy * dy;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 && t <= 1 ? t : null;
}
