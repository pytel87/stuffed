// Currents: streams in a sea map's shallow water that carry anyone wading in them along their
// path, a quick way round the map (you can still steer, but only a little against them).
import type { Current, Vec2 } from '../types.ts';

/** The water's flow at `p` (units per second), or null outside every current. Strongest down the
 *  middle of a stream, easing off toward its banks. */
export function currentAt(currents: readonly Current[] | undefined, p: Vec2): Vec2 | null {
  if (!currents) return null;
  let best: { flow: Vec2; d: number } | null = null;
  for (const c of currents) {
    const n = c.path.length;
    const segments = c.loop ? n : n - 1;
    for (let i = 0; i < segments; i++) {
      const a = c.path[i]!;
      const b = c.path[(i + 1) % n]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      const d = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
      if (d > c.width / 2 || (best && d >= best.d)) continue;
      const len = Math.sqrt(len2);
      const strength = c.speed * (1 - 0.5 * (d / (c.width / 2)) ** 2);
      best = { flow: { x: (dx / len) * strength, y: (dy / len) * strength }, d };
    }
  }
  return best?.flow ?? null;
}

/** Points round a circle (a loop current), clockwise on screen if `clockwise`. With `wave`, it
 *  swings in and out `lobes` times on the way round, by `amount` (out at angle 0): a slalom. */
export function ringPath(cx: number, cy: number, radius: number, points: number, clockwise = true, wave?: { lobes: number; amount: number }): Vec2[] {
  return Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2 * (clockwise ? 1 : -1);
    const r = radius + (wave ? wave.amount * Math.cos(wave.lobes * a) : 0);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}
