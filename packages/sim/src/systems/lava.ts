// Lava: whoever stands in it (feet down on it, not jumping over it) is burnt and hops up off it
// with a yelp; landing back in it burns again, so it's crossed in a hurry, hop by hop.
import { config } from '../config.ts';
import type { GameState, Lava, Vec2 } from '../types.ts';
import type { World } from '../world.ts';
import { applyDamage } from './damage.ts';

/** Whether `p` is in a patch of lava (at its height). */
export function inLava(lava: Lava, p: Vec2, z: number): boolean {
  if (Math.abs(z - lava.z) > 0.05) return false;
  if (lava.kind === 'pool') {
    const d = Math.hypot(p.x - lava.center.x, p.y - lava.center.y);
    return d < lava.radius && d > lava.island;
  }
  const dx = lava.to.x - lava.from.x;
  const dy = lava.to.y - lava.from.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - lava.from.x) * dx + (p.y - lava.from.y) * dy) / len2));
  return Math.hypot(p.x - (lava.from.x + dx * t), p.y - (lava.from.y + dy * t)) < lava.width / 2;
}

export function updateLava(world: World, state: GameState): void {
  const patches = world.map.lava;
  if (!patches) return;
  for (const p of state.players) {
    if (!p.alive || p.drop || p.ride || p.vz > 0) continue;
    if (!patches.some((l) => inLava(l, p.pos, p.z))) continue;
    p.vz = config.lava.hop;
    state.events.push({ type: 'burn', playerId: p.id, pos: { ...p.pos } });
    applyDamage(state, p, config.lava.damage, null, { cause: 'lava' });
  }
}
