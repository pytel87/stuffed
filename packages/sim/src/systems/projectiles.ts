import { DT } from '../config.ts';
import { segmentBoxT } from '../collision/geometry.ts';
import type { GameState, Player, Projectile } from '../types.ts';
import type { World } from '../world.ts';
import { applyDamage } from './damage.ts';

/**
 * Moves projectiles with a swept test so fast ones can't skip through a plush or a wall
 * between ticks. The earliest hit along the path wins; on equal t a wall beats a plush and a
 * lower player id beats a higher one (deterministic).
 */
export function updateProjectiles(world: World, state: GameState): void {
  const survivors: Projectile[] = [];
  for (const proj of state.projectiles) {
    if (state.tick >= proj.expireTick) continue;
    const dx = proj.vel.x * DT;
    const dy = proj.vel.y * DT;

    let hit: Player | null = null;
    let hitT = Infinity;
    for (const p of state.players) {
      if (!p.alive || p.id === proj.ownerId) continue;
      const t = sweepCircle(proj.pos.x, proj.pos.y, dx, dy, p.pos.x, p.pos.y, p.radius + proj.radius);
      if (t !== null && t < hitT) {
        hit = p;
        hitT = t;
      }
    }

    let wallT = Infinity;
    const r = proj.radius;
    const candidates = world.walls.query(
      Math.min(proj.pos.x, proj.pos.x + dx) - r,
      Math.min(proj.pos.y, proj.pos.y + dy) - r,
      Math.max(proj.pos.x, proj.pos.x + dx) + r,
      Math.max(proj.pos.y, proj.pos.y + dy) + r,
    );
    for (const i of candidates) {
      const t = segmentBoxT(proj.pos.x, proj.pos.y, dx, dy, world.map.walls[i]!, r);
      if (t !== null && t < wallT) wallT = t;
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
