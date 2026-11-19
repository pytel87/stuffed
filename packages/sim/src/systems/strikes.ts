// The air strike: a big toy button on the map (one per map). Pressing it calls a shower of water
// balloons, toy blocks or snowballs onto the busiest spot away from you. Each lands in a circle
// marked on the ground a moment before; a roof keeps you safe. The button then needs a while.
import { config, secondsToTicks } from '../config.ts';
import { nextFloat } from '../rng.ts';
import type { GameState, Player, Strike, Vec2 } from '../types.ts';
import type { World } from '../world.ts';
import { applyDamage } from './damage.ts';
import { buildingAt } from './movement.ts';

const S = config.strike;

/** The button is in reach (beside it, or standing at its height) and ready. */
export function strikeReady(state: GameState, player: Player): boolean {
  const b = state.strikeButton;
  if (!b || state.tick < b.readyTick) return false;
  if (Math.abs(player.z - b.z) > config.loot.reachHeight) return false;
  return Math.hypot(player.pos.x - b.pos.x, player.pos.y - b.pos.y) <= S.interactRange;
}

/**
 * Where the strike goes: onto the plush with the most others around it (not you or your team,
 * nor anyone still on the Toss); out in the open first, as a roof would keep them safe anyway.
 */
function target(world: World, state: GameState, by: Player): Vec2 {
  let best: Player | null = null;
  let bestScore = -1;
  for (const p of state.players) {
    if (!p.alive || p.drop || p.id === by.id || (by.team !== 0 && p.team === by.team)) continue;
    let score = buildingAt(world, p.pos, p.z) === -1 ? 100 : 0;
    for (const q of state.players) {
      if (q.alive && !q.drop && q.id !== by.id && Math.hypot(q.pos.x - p.pos.x, q.pos.y - p.pos.y) < S.crowdRadius) score++;
    }
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  if (best) return { ...best.pos };
  // Nobody else around: a little ahead of you.
  return { x: by.pos.x + by.aim.x * 10, y: by.pos.y + by.aim.y * 10 };
}

/** Presses the button: the drops are marked now and land one after another. */
export function callStrike(world: World, state: GameState, by: Player): void {
  const b = state.strikeButton;
  if (!b) return;
  b.readyTick = state.tick + secondsToTicks(S.cooldown);
  const center = target(world, state, by);
  const first = state.tick + secondsToTicks(S.warning);
  for (let i = 0; i < S.count; i++) {
    const a = nextFloat(state.rng) * Math.PI * 2;
    const r = i === 0 ? 0 : S.spread * Math.sqrt(nextFloat(state.rng));
    const pos = {
      x: Math.max(1, Math.min(world.map.width - 1, center.x + Math.cos(a) * r)),
      y: Math.max(1, Math.min(world.map.height - 1, center.y + Math.sin(a) * r)),
    };
    state.strikes.push({ id: state.nextId++, kind: b.kind, pos, calledTick: state.tick, landTick: first + secondsToTicks(S.gap * i), byId: by.id });
  }
  state.events.push({ type: 'strikeCalled', playerId: by.id, kind: b.kind, pos: center });
}

/** Lands the drops whose time has come: everyone in the circle (and not under a roof) is hit. */
export function updateStrikes(world: World, state: GameState): void {
  if (state.strikes.length === 0) return;
  const landed: Strike[] = [];
  for (const s of state.strikes) if (state.tick >= s.landTick) landed.push(s);
  if (landed.length === 0) return;
  state.strikes = state.strikes.filter((s) => state.tick < s.landTick);
  for (const s of landed) {
    state.events.push({ type: 'strikeLand', kind: s.kind, pos: s.pos });
    const k = S.kinds[s.kind];
    for (const p of state.players) {
      if (!p.alive || p.drop === 'riding' || buildingAt(world, p.pos, p.z) !== -1) continue;
      const dx = p.pos.x - s.pos.x;
      const dy = p.pos.y - s.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > S.radius + p.radius) continue;
      applyDamage(state, p, k.damage, s.byId, { from: s.pos, cause: 'strike' });
      const ux = d > 1e-6 ? dx / d : 1;
      const uy = d > 1e-6 ? dy / d : 0;
      p.knockback.x += ux * k.knockback;
      p.knockback.y += uy * k.knockback;
      if (k.soak > 0) {
        // Soaked: slower, and dripping too much to hide in a bush.
        p.soakedUntil = Math.max(p.soakedUntil, state.tick + secondsToTicks(k.soak));
        p.revealedUntilTick = Math.max(p.revealedUntilTick, state.tick + secondsToTicks(k.soak));
      }
    }
  }
}
