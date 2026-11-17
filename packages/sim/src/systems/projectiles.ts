import { config, DT, secondsToTicks, type WeaponStats } from '../config.ts';
import { segmentBoxT } from '../collision/geometry.ts';
import type { Ball, Box, GameState, PlacedWall, Player, Projectile, Vec2 } from '../types.ts';
import { poseAt, raycastWalls, wallsNear, type World } from '../world.ts';
import { pushBall } from './balls.ts';
import { TRAIN, trainCircles } from './train.ts';
import { applyDamage, teammates } from './damage.ts';
import { removeWall } from './items.ts';
import { groundHeight } from './movement.ts';

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
    const s: WeaponStats = config.weapons[proj.weapon];
    if (state.tick >= proj.expireTick) {
      // Out of range: a marble or a bomb bursts where it is; anything else just vanishes.
      if (s.blastRadius) burst(world, state, proj, proj.pos, proj.z);
      continue;
    }
    const dx = proj.vel.x * DT;
    const dy = proj.vel.y * DT;
    const r = proj.radius;
    // Height along this tick's path: z at t is proj.z + dz * t. Lobbed throws fall under gravity.
    let zNext: number;
    if (proj.lobbed) {
      zNext = proj.z + proj.vz * DT - 0.5 * config.combat.throwGravity * DT * DT;
      proj.vz -= config.combat.throwGravity * DT;
    } else {
      zNext = proj.vz > 0 ? Math.min(proj.z + proj.vz * DT, proj.zEnd) : Math.max(proj.z + proj.vz * DT, proj.zEnd);
    }
    zNext = clampToRoofs(world, proj.pos.x, proj.pos.y, proj.z, zNext, r);
    const dz = zNext - proj.z;
    const lowest = Math.min(proj.z, zNext) - r;

    let hit: Player | null = null;
    let hitT = Infinity;
    const owner = state.players.find((p) => p.id === proj.ownerId);
    for (const p of state.players) {
      if (!p.alive || p.id === proj.ownerId || p.drop || teammates(owner, p)) continue;
      // Online, where the target was when the shooter saw it (lag compensation).
      const at = proj.rewind ? (poseAt(world, p.id, state.tick - proj.rewind) ?? { x: p.pos.x, y: p.pos.y, z: p.z }) : { x: p.pos.x, y: p.pos.y, z: p.z };
      const t = sweepCircle(proj.pos.x, proj.pos.y, dx, dy, at.x, at.y, p.radius + r);
      if (t === null) continue;
      const zt = proj.z + dz * t;
      // Passes under or over (just touching the feet, e.g. under a roof someone stands on, misses).
      if (zt + r <= at.z + 1e-9 || zt - r >= at.z + config.player.height - 1e-9) continue;
      if (t < hitT) {
        hit = p;
        hitT = t;
      }
    }

    let wallT = Infinity;
    /** What it hit first: a wall box or a chest (for bouncing off it). */
    let wallHit: { box: Box } | { chest: Vec2 } | null = null;
    const candidates = wallsNear(
      world,
      Math.min(proj.pos.x, proj.pos.x + dx) - r,
      Math.min(proj.pos.y, proj.pos.y + dy) - r,
      Math.max(proj.pos.x, proj.pos.x + dx) + r,
      Math.max(proj.pos.y, proj.pos.y + dy) + r,
    );
    for (const wall of candidates) {
      if (lowest >= wall.height) continue;
      const t = segmentBoxT(proj.pos.x, proj.pos.y, dx, dy, wall, r);
      if (t !== null && t < wallT && proj.z + dz * t - r < wall.height) {
        wallT = t;
        wallHit = { box: wall };
      }
    }
    /** A beach ball hit first (it gets knocked along the shot). */
    let ballHit: Ball | null = null;
    for (const ball of state.balls) {
      if (lowest >= ball.radius * 2) continue;
      const t = sweepCircle(proj.pos.x, proj.pos.y, dx, dy, ball.pos.x, ball.pos.y, ball.radius + r);
      if (t !== null && t < wallT && proj.z + dz * t - r < ball.radius * 2) {
        wallT = t;
        wallHit = { chest: ball.pos };
        ballHit = ball;
      }
    }
    // The toy train's cars stop shots too.
    if (world.map.track && lowest < TRAIN.height) {
      for (const c of trainCircles(world.map.track, state.tick)) {
        const t = sweepCircle(proj.pos.x, proj.pos.y, dx, dy, c.x, c.y, c.r + r);
        if (t !== null && t < wallT && proj.z + dz * t - r < TRAIN.height) {
          wallT = t;
          wallHit = { chest: { x: c.x, y: c.y } };
          ballHit = null;
        }
      }
    }
    if (lowest < config.chest.height) {
      for (const chest of state.chests) {
        const t = sweepCircle(proj.pos.x, proj.pos.y, dx, dy, chest.pos.x, chest.pos.y, config.chest.radius + r);
        if (t !== null && t < wallT && proj.z + dz * t - r < config.chest.height) {
          wallT = t;
          wallHit = { chest: chest.pos };
          ballHit = null;
        }
      }
    }
    if (wallT !== Infinity && wallT <= hitT) {
      const at = { x: proj.pos.x + dx * wallT, y: proj.pos.y + dy * wallT };
      const zAt = proj.z + dz * wallT;
      if (ballHit) {
        const len = Math.hypot(proj.vel.x, proj.vel.y) || 1;
        pushBall(ballHit, proj.vel.x / len, proj.vel.y / len, config.beachBall.shotPush);
      }
      // A Cardboard Wall takes the hit and breaks once it's had enough.
      if (wallHit && 'box' in wallHit && 'health' in wallHit.box) {
        const placed = wallHit.box as PlacedWall;
        placed.health -= proj.damage;
        if (placed.health <= 0) {
          removeWall(state, placed.id);
          state.events.push({ type: 'wallBroken', wallId: placed.id, pos: { x: placed.x + placed.w / 2, y: placed.y + placed.h / 2 } });
        }
      }
      if (proj.bounces && proj.bounces > 0 && wallHit) {
        // Marbles bounce off walls (and chests) a couple of times before they burst.
        bounceOff(proj, at, wallHit);
        proj.z = zAt;
        proj.bounces--;
        state.events.push({ type: 'bounce', pos: at });
        survivors.push(proj);
      } else if (s.blastRadius) {
        burst(world, state, proj, at, zAt);
      } else {
        state.events.push({ type: 'impact', pos: at, weapon: proj.weapon });
      }
      continue;
    }

    if (hit) {
      const at = { x: proj.pos.x + dx * hitT, y: proj.pos.y + dy * hitT };
      if (s.blastRadius) {
        burst(world, state, proj, at, proj.z + dz * hitT);
        continue;
      }
      const len = Math.hypot(proj.vel.x, proj.vel.y) || 1;
      hit.knockback.x += (proj.vel.x / len) * proj.knockback;
      hit.knockback.y += (proj.vel.y / len) * proj.knockback;
      if (s.effect === 'bubble' && s.effectTime) {
        hit.bubbledUntil = state.tick + secondsToTicks(s.effectTime);
        hit.chargeStartTick = null;
        hit.action = null;
        state.events.push({ type: 'bubble', playerId: hit.id, trapped: true });
      }
      // Where it came from: a few units back along its path.
      const back = 3 / (len || 1);
      applyDamage(state, hit, proj.damage, proj.ownerId, { from: { x: at.x - proj.vel.x * back, y: at.y - proj.vel.y * back } });
      continue;
    }

    proj.pos.x += dx;
    proj.pos.y += dy;
    proj.z = zNext;
    // A lobbed throw bursts where it comes down (on the lawn, a roof, a wall top).
    if (proj.lobbed && proj.vz < 0 && proj.z - r <= groundHeight(world, state, proj.pos, proj.z)) {
      burst(world, state, proj, proj.pos, groundHeight(world, state, proj.pos, proj.z));
      continue;
    }
    const { width, height } = world.map;
    const out = config.player.roamOutside + 4;
    if (proj.pos.x < -out || proj.pos.y < -out || proj.pos.x > width + out || proj.pos.y > height + out) continue;
    survivors.push(proj);
  }
  state.projectiles = survivors;
}

/** Reflects the velocity off the face of the box (or chest) it hit, and moves it to the contact point. */
function bounceOff(proj: Projectile, at: Vec2, hit: { box: Box } | { chest: Vec2 }): void {
  let nx = 0;
  let ny = 0;
  if ('box' in hit) {
    const b = hit.box;
    if (at.x <= b.x) nx = -1;
    else if (at.x >= b.x + b.w) nx = 1;
    if (at.y <= b.y) ny = -1;
    else if (at.y >= b.y + b.h) ny = 1;
    if (nx === 0 && ny === 0) {
      // Started inside it: head back the way it came.
      proj.vel.x = -proj.vel.x;
      proj.vel.y = -proj.vel.y;
    }
    if (nx !== 0) proj.vel.x = Math.abs(proj.vel.x) * nx;
    if (ny !== 0) proj.vel.y = Math.abs(proj.vel.y) * ny;
  } else {
    const len = Math.hypot(at.x - hit.chest.x, at.y - hit.chest.y) || 1;
    nx = (at.x - hit.chest.x) / len;
    ny = (at.y - hit.chest.y) / len;
    const dot = proj.vel.x * nx + proj.vel.y * ny;
    proj.vel.x -= 2 * dot * nx;
    proj.vel.y -= 2 * dot * ny;
  }
  proj.pos.x = at.x + nx * 0.01;
  proj.pos.y = at.y + ny * 0.01;
}

/**
 * A marble or glitter bomb bursts: everyone within the radius (on about the same level and not
 * behind a tall wall) takes damage, more in the middle, and is pushed away; glitter also blinds,
 * the thrower included. The thrower takes no damage from their own burst.
 */
function burst(world: World, state: GameState, proj: Projectile, at: Vec2, z: number): void {
  const s: WeaponStats = config.weapons[proj.weapon];
  const radius = s.blastRadius ?? 0;
  const owner = state.players.find((p) => p.id === proj.ownerId);
  for (const p of state.players) {
    if (!p.alive || p.drop) continue;
    const d = Math.hypot(p.pos.x - at.x, p.pos.y - at.y);
    if (d > radius + p.radius) continue;
    if (p.z > z + radius || p.z + config.player.height < z - radius) continue;
    if (raycastWalls(world, at, p.pos, 0, z + 0.05) !== null) continue;
    const share = Math.min(1, d / radius);
    // Teammates are spared (the thrower still gets glitter in the eyes).
    if (p.id !== proj.ownerId && teammates(owner, p)) continue;
    if (s.effect === 'glitter' && s.effectTime) p.blindedUntil = Math.max(p.blindedUntil, state.tick + secondsToTicks(s.effectTime));
    if (p.id === proj.ownerId) continue;
    const push = proj.knockback * (1 - share);
    if (push > 0 && d > 1e-6) {
      p.knockback.x += ((p.pos.x - at.x) / d) * push;
      p.knockback.y += ((p.pos.y - at.y) / d) * push;
    }
    applyDamage(state, p, proj.damage * (1 - (1 - config.combat.blastEdgeDamage) * share), proj.ownerId, { from: { x: at.x, y: at.y } });
  }
  state.events.push({ type: 'burst', pos: { x: at.x, y: at.y }, z, weapon: proj.weapon, radius });
}

/**
 * Roofs are floors and ceilings for shots: over a roof, a shot above it can't sink through it
 * (it skims the roof and clears the walls before dipping toward its target), and a shot
 * under it can't rise through it.
 */
function clampToRoofs(world: World, x: number, y: number, z: number, zNext: number, r: number): number {
  for (const b of world.map.buildings) {
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    if (z - r >= b.height - 1e-9) zNext = Math.max(zNext, b.height + r);
    else zNext = Math.min(zNext, b.height - r);
  }
  return zNext;
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
