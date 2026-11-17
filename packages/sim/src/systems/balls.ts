// Beach balls: they roll when a plush runs into one (see movement.ts) or a shot hits one,
// bounce off walls, chests, plushies and each other, and slow down on the grass.
import { config, DT } from '../config.ts';
import { circleBoxPush } from '../collision/geometry.ts';
import type { Ball, GameState, Vec2 } from '../types.ts';
import { wallsNear, type World } from '../world.ts';

const B = config.beachBall;
const KEEP = Math.exp(-B.friction * DT);
/** Floating in the pool slows it down faster. */
const KEEP_IN_WATER = Math.exp(-B.friction * 3 * DT);
/** Longest move between collision checks, so a fast ball can't skip through a thin wall. */
const MAX_STEP = 0.3;
/** Slower than this (units/s) it stops. */
const REST = 0.1;

export function updateBalls(world: World, state: GameState): void {
  for (const ball of state.balls) {
    const speed = Math.hypot(ball.vel.x, ball.vel.y);
    if (speed === 0) continue;
    const steps = Math.max(1, Math.ceil((speed * DT) / MAX_STEP));
    for (let i = 0; i < steps; i++) {
      ball.pos.x += (ball.vel.x * DT) / steps;
      ball.pos.y += (ball.vel.y * DT) / steps;
      collide(world, state, ball);
    }
    const inWater = world.map.pools?.some((c) => Math.hypot(ball.pos.x - c.center.x, ball.pos.y - c.center.y) < c.radius) ?? false;
    const keep = inWater ? KEEP_IN_WATER : KEEP;
    ball.vel.x *= keep;
    ball.vel.y *= keep;
    if (Math.hypot(ball.vel.x, ball.vel.y) < REST) ball.vel = { x: 0, y: 0 };
    scoreGoal(world, state, ball);
  }
  separateBalls(state);
}

/** A ball inside a goal's mouth scores there and goes back to where it started. */
function scoreGoal(world: World, state: GameState, ball: Ball): void {
  const goals = world.map.goals ?? [];
  for (let i = 0; i < goals.length; i++) {
    const m = goals[i]!.mouth;
    if (ball.pos.x < m.x || ball.pos.x > m.x + m.w || ball.pos.y < m.y || ball.pos.y > m.y + m.h) continue;
    state.goals[i] = (state.goals[i] ?? 0) + 1;
    state.events.push({ type: 'goal', goal: i, ballId: ball.id, pos: { x: ball.pos.x, y: ball.pos.y } });
    ball.pos = { ...ball.home };
    ball.vel = { x: 0, y: 0 };
    return;
  }
}

/** Speeds a ball up along `dir` (a kick or a shot), capped. */
export function pushBall(ball: Ball, dirX: number, dirY: number, speed: number): void {
  ball.vel.x += dirX * speed;
  ball.vel.y += dirY * speed;
  const s = Math.hypot(ball.vel.x, ball.vel.y);
  if (s > B.maxSpeed) {
    ball.vel.x *= B.maxSpeed / s;
    ball.vel.y *= B.maxSpeed / s;
  }
}

function collide(world: World, state: GameState, ball: Ball): void {
  const r = ball.radius;
  for (const wall of wallsNear(world, ball.pos.x - r, ball.pos.y - r, ball.pos.x + r, ball.pos.y + r)) {
    if (wall.height < B.minWallHeight) continue;
    const push = circleBoxPush(ball.pos.x, ball.pos.y, r, wall);
    if (push) reflect(ball, push.nx, push.ny, push.depth, B.restitution);
  }
  for (const chest of state.chests) bounceOffCircle(ball, chest.pos, config.chest.radius, B.restitution);
  // Rolling into a plush: the ball bounces off and gives them a little shove.
  for (const p of state.players) {
    if (!p.alive || p.drop || p.z >= r * 2) continue;
    const n = bounceOffCircle(ball, p.pos, p.radius, 0.5);
    if (n) {
      p.knockback.x -= n.x * Math.min(6, Math.hypot(ball.vel.x, ball.vel.y));
      p.knockback.y -= n.y * Math.min(6, Math.hypot(ball.vel.x, ball.vel.y));
    }
  }
  // The edge of the play area (past the Rinse's foam) bounces it back.
  const out = config.player.roamOutside;
  const { width, height } = world.map;
  if (ball.pos.x < -out + r) reflect(ball, 1, 0, -out + r - ball.pos.x, B.restitution);
  if (ball.pos.x > width + out - r) reflect(ball, -1, 0, ball.pos.x - (width + out - r), B.restitution);
  if (ball.pos.y < -out + r) reflect(ball, 0, 1, -out + r - ball.pos.y, B.restitution);
  if (ball.pos.y > height + out - r) reflect(ball, 0, -1, ball.pos.y - (height + out - r), B.restitution);
}

/** Moves the ball out along the normal and bounces the velocity heading into it. */
function reflect(ball: Ball, nx: number, ny: number, depth: number, keep: number): void {
  ball.pos.x += nx * depth;
  ball.pos.y += ny * depth;
  const into = ball.vel.x * nx + ball.vel.y * ny;
  if (into < 0) {
    ball.vel.x -= (1 + keep) * into * nx;
    ball.vel.y -= (1 + keep) * into * ny;
  }
}

/** Bounces off a solid circle; returns the normal (from the circle to the ball) on contact. */
function bounceOffCircle(ball: Ball, center: Vec2, radius: number, keep: number): Vec2 | null {
  const dx = ball.pos.x - center.x;
  const dy = ball.pos.y - center.y;
  const min = ball.radius + radius;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return null;
  const d = Math.sqrt(d2);
  const n = d < 1e-9 ? { x: 0, y: 1 } : { x: dx / d, y: dy / d };
  reflect(ball, n.x, n.y, min - d, keep);
  return n;
}

/** Balls knock into each other: pushed apart, trading speed along the line between them. */
function separateBalls(state: GameState): void {
  const balls = state.balls;
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]!;
      const b = balls[j]!;
      const dx = a.pos.x - b.pos.x;
      const dy = a.pos.y - b.pos.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const nx = d < 1e-9 ? 1 : dx / d;
      const ny = d < 1e-9 ? 0 : dy / d;
      const half = (min - d) / 2;
      a.pos.x += nx * half;
      a.pos.y += ny * half;
      b.pos.x -= nx * half;
      b.pos.y -= ny * half;
      const closing = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny;
      if (closing < 0) {
        const j2 = (-(1 + B.restitution) * closing) / 2;
        a.vel.x += j2 * nx;
        a.vel.y += j2 * ny;
        b.vel.x -= j2 * nx;
        b.vel.y -= j2 * ny;
      }
    }
  }
}
