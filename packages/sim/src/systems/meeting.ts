// Where a warm-up gathers everyone: an open, dry spot near the middle of the map (not in a wall, a
// building, water, ice or lava), with room round it. Players stand in rings round it, newcomers too, so
// friends see each other arrive.
import { inLava } from './lava.ts';
import { wading } from './movement.ts';
import type { MapData, Vec2 } from '../types.ts';
import { createWorld, type World } from '../world.ts';

/** How far apart players stand round the meeting spot. */
const SPACING = 2.1;
const cache = new Map<string, Vec2>();

function free(world: World, p: Vec2): boolean {
  const map = world.map;
  if (p.x < 2 || p.y < 2 || p.x > map.width - 2 || p.y > map.height - 2) return false;
  if (map.walls.some((w) => p.x > w.x - 1 && p.x < w.x + w.w + 1 && p.y > w.y - 1 && p.y < w.y + w.h + 1)) return false;
  if (map.buildings.some((b) => p.x > b.x - 0.5 && p.x < b.x + b.w + 0.5 && p.y > b.y - 0.5 && p.y < b.y + b.h + 0.5)) return false;
  if (wading(world, { pos: p, z: 0 })) return false;
  // (Not on a frozen pond either: slippery, and it breaks up later.)
  if ((map.ice ?? []).some((c) => Math.hypot(p.x - c.center.x, p.y - c.center.y) < c.radius + 1)) return false;
  if ((map.lava ?? []).some((l) => inLava(l, p, 0))) return false;
  return true;
}

/** The `i`th place round `center` (the middle, then rings outward, a little turned each ring). */
export function ringSlot(center: Vec2, i: number): Vec2 {
  if (i === 0) return { ...center };
  let ring = 1;
  let first = 1;
  while (i >= first + ring * 6) (first += ring * 6), ring++;
  const n = ring * 6;
  const a = ((i - first) / n) * Math.PI * 2 + ring * 0.4;
  return { x: center.x + Math.cos(a) * ring * SPACING, y: center.y + Math.sin(a) * ring * SPACING };
}

/** The map's meeting spot: the open place nearest its middle with room for a crowd round it. */
export function meetingSpot(map: MapData): Vec2 {
  const known = cache.get(map.id);
  if (known) return known;
  const world = createWorld(map);
  const mid = { x: map.width / 2, y: map.height / 2 };
  let spot: Vec2 = mid;
  search: for (let r = 0; r < Math.max(map.width, map.height) / 2; r += 1.5) {
    const steps = Math.max(1, Math.round((r * Math.PI * 2) / 1.5));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const c = { x: mid.x + Math.cos(a) * r, y: mid.y + Math.sin(a) * r };
      // Room for the first two rings (19 players) all on open ground.
      if (Array.from({ length: 19 }, (_, i) => ringSlot(c, i)).every((p) => free(world, p))) {
        spot = c;
        break search;
      }
    }
  }
  cache.set(map.id, spot);
  return spot;
}

/** A free place for a newcomer round the meeting spot: the first ring slot nobody's standing on. */
export function meetingSlot(map: MapData, taken: readonly Vec2[]): Vec2 {
  const center = meetingSpot(map);
  for (let i = 0; ; i++) {
    const p = ringSlot(center, i);
    if (taken.every((t) => Math.hypot(t.x - p.x, t.y - p.y) > SPACING * 0.8)) return p;
  }
}
