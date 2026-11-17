import { config } from '../config.ts';
import type { GameState, Player } from '../types.ts';
import type { World } from '../world.ts';

/**
 * Whether `viewer` can see `target`. Walls do not block sight (the camera looks over them);
 * hiding happens in bushes and under roofs:
 * - beyond vision range (much shorter while blinded by glitter): hidden;
 * - inside a building the viewer is not in: hidden (the roof covers them);
 * - in a bush: hidden, unless they shot recently or the viewer is right next to them.
 * The client uses this to decide which plushies to draw; the server will use it to decide
 * what to send each player.
 */
export function canSee(_world: World, state: GameState, viewer: Player, target: Player): boolean {
  if (viewer.id === target.id) return true;
  if (!target.alive || target.drop === 'riding') return false;
  const d = Math.hypot(target.pos.x - viewer.pos.x, target.pos.y - viewer.pos.y);
  // Glitter in the eyes: only what's very close.
  const range = state.tick < viewer.blindedUntil ? config.combat.blindVision : config.vision.range;
  if (d > range) return false;
  if (target.building !== -1 && target.building !== viewer.building) return false;
  const hiddenInBush = target.inBush && state.tick >= target.revealedUntilTick;
  return !(hiddenInBush && d > config.vision.bushRevealDistance);
}
