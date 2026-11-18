// The map's big toy, pressed with E (one per map):
// - jack-in-the-box (Bedroom): cranked, it plays a tune while it shakes, then the clown pops out
//   and launches everyone around it;
// - sprinkler (Backyard): the tap on the house turns on a sprinkler out on the lawn that sprays a
//   turning arc of water, pushing plushies away and soaking them;
// - ice drill (Snowy Park): cracks spread over the frozen pond, then it breaks: everyone on it is
//   dunked, and it stays open water (slow to wade) until it freezes over again.
import { config, DT, secondsToTicks } from '../config.ts';
import type { GameState, Player, ToyState } from '../types.ts';
import type { World } from '../world.ts';
import { applyDamage } from './damage.ts';
import { buildingAt } from './movement.ts';

const T = config.toys;

/** In reach (beside it, at its height) and ready to be pressed. */
export function toyReady(state: GameState, player: Player): boolean {
  const t = state.toy;
  if (!t || state.tick < t.readyTick) return false;
  if (Math.abs(player.z - t.z) > config.loot.reachHeight) return false;
  return Math.hypot(player.pos.x - t.pos.x, player.pos.y - t.pos.y) <= T.interactRange;
}

/** The pond is broken open (no ice to slide on: water to wade through). */
export function iceOpen(state: GameState): boolean {
  const t = state.toy;
  return !!t && t.kind === 'icedrill' && state.tick >= t.startTick && state.tick < t.endTick;
}

export function pressToy(state: GameState, by: Player): void {
  const t = state.toy;
  if (!t) return;
  const now = state.tick;
  if (t.kind === 'jack') {
    t.startTick = now + secondsToTicks(T.jack.windup);
    t.endTick = t.startTick + secondsToTicks(T.jack.show);
    t.readyTick = now + secondsToTicks(T.jack.cooldown);
  } else if (t.kind === 'sprinkler') {
    t.startTick = now;
    t.endTick = now + secondsToTicks(T.sprinkler.duration);
    t.readyTick = now + secondsToTicks(T.sprinkler.cooldown);
  } else {
    t.startTick = now + secondsToTicks(T.icedrill.windup);
    t.endTick = t.startTick + secondsToTicks(T.icedrill.open);
    t.readyTick = t.endTick + secondsToTicks(T.icedrill.cooldownAfter);
  }
  t.byId = by.id;
  state.events.push({ type: 'toyStarted', kind: t.kind, playerId: by.id, pos: { ...t.at } });
}

/** Whether a plush can be reached by the toy (out in the open, at about its level). */
function exposed(world: World, t: ToyState, p: Player): boolean {
  return p.alive && !p.drop && buildingAt(world, p.pos, p.z) === -1 && p.z < t.z + 1.8;
}

export function updateToys(world: World, state: GameState): void {
  const t = state.toy;
  if (!t || t.startTick < 0) return;
  const now = state.tick;
  if (t.kind === 'jack' && now === t.startTick) {
    // The clown pops out: everyone close is launched away (and bumped).
    state.events.push({ type: 'toyPop', kind: 'jack', pos: { ...t.at } });
    for (const p of state.players) {
      if (!exposed(world, t, p)) continue;
      const dx = p.pos.x - t.at.x;
      const dy = p.pos.y - t.at.y;
      const d = Math.hypot(dx, dy);
      if (d > T.jack.radius + p.radius) continue;
      const share = 1 - Math.min(1, d / T.jack.radius) * 0.5;
      p.knockback.x += (d > 1e-6 ? dx / d : 1) * T.jack.knockback * share;
      p.knockback.y += (d > 1e-6 ? dy / d : 0) * T.jack.knockback * share;
      p.vz = Math.max(p.vz, T.jack.hop);
      applyDamage(state, p, T.jack.damage, t.byId, { from: { ...t.at } });
    }
  } else if (t.kind === 'sprinkler' && now >= t.startTick && now < t.endTick) {
    // A turning arc of water: whoever it sweeps over is pushed away and soaked.
    const S = T.sprinkler;
    const angle = (now - t.startTick) * DT * S.turnPerSecond;
    const half = ((S.arcDegrees / 2) * Math.PI) / 180;
    for (const p of state.players) {
      if (!exposed(world, t, p)) continue;
      const dx = p.pos.x - t.at.x;
      const dy = p.pos.y - t.at.y;
      const d = Math.hypot(dx, dy);
      if (d > S.radius || d < 0.3) continue;
      let off = Math.atan2(dy, dx) - angle;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      if (Math.abs(off) > half) continue;
      p.knockback.x += (dx / d) * S.push;
      p.knockback.y += (dy / d) * S.push;
      p.soakedUntil = Math.max(p.soakedUntil, now + secondsToTicks(S.soak));
      p.revealedUntilTick = Math.max(p.revealedUntilTick, now + secondsToTicks(S.soak));
    }
  } else if (t.kind === 'icedrill' && now === t.startTick) {
    // The ice breaks: everyone standing on it is dunked.
    state.events.push({ type: 'toyPop', kind: 'icedrill', pos: { ...t.at } });
    for (const p of state.players) {
      if (!p.alive || p.drop || p.z > 0.05) continue;
      const onPond = (world.map.ice ?? []).some((c) => Math.hypot(p.pos.x - c.center.x, p.pos.y - c.center.y) < c.radius);
      if (!onPond) continue;
      applyDamage(state, p, T.icedrill.damage, t.byId, { from: { ...p.pos } });
      p.soakedUntil = Math.max(p.soakedUntil, now + secondsToTicks(T.icedrill.soak));
    }
  }
}
