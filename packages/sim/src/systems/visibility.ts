import { config } from '../config.ts';
import type { GameState, Player } from '../types.ts';
import type { World } from '../world.ts';

/**
 * Whether `viewer` can see `target`. Walls do not block sight (the camera looks over them);
 * hiding happens in bushes and under roofs:
 * - beyond vision range: hidden;
 * - covered in glitter: seen (within range) wherever they are, bush or roof;
 * - inside a building the viewer is not in: hidden (the roof covers them);
 * - in a bush: hidden, unless they shot recently or the viewer is right next to them.
 * The client uses this to decide which plushies to draw; the server will use it to decide
 * what to send each player.
 */
export function canSee(world: World, state: GameState, viewer: Player, target: Player): boolean {
  if (viewer.id === target.id) return true;
  if (!target.alive || target.drop === 'riding') return false;
  // Crawling through a hamster tube: out of sight.
  if (target.ride && world.map.rides?.[target.ride.index]?.kind === 'tube') return false;
  // Teammates always see each other (through bushes and roofs).
  if (viewer.team !== 0 && viewer.team === target.team) return true;
  const d = Math.hypot(target.pos.x - viewer.pos.x, target.pos.y - viewer.pos.y);
  if (d > config.vision.range) return false;
  // Glittered: sparkling too much to hide anywhere.
  if (state.tick < target.glitteredUntil) return true;
  const covered = coveredBy(world, target);
  if (covered !== -1 && covered !== coveredBy(world, viewer)) return false;
  const hiddenInBush = target.inBush && state.tick >= target.revealedUntilTick;
  return !(hiddenInBush && d > config.vision.bushRevealDistance);
}

/**
 * The building whose roof covers this plush, or -1. Feet within half a unit of the roof's height
 * don't count: that's someone jumping up onto it (or stepping off), only under it for a moment,
 * who would otherwise blink out of sight (and the roof flicker) on the way.
 */
export function coveredBy(world: World, p: Pick<Player, 'building' | 'z'>): number {
  if (p.building === -1) return -1;
  const b = world.map.buildings[p.building];
  return b && p.z < b.height - ROOF_EDGE ? p.building : -1;
}

const ROOF_EDGE = 0.5;
