import { isOutside, zoneDamagePerSecond } from '@stuffed/sim';
import type { GameState, Player, Vec2 } from '@stuffed/sim';
import { icon } from './icons.ts';

/** How many plushies are left, and a badge pointing back to safety while you're out in the Rinse
 *  (it pulses faster the more it hurts). No countdown or call-outs: the grey edge shows it coming. */
export class ZoneHud {
  /** How many plushies are still in the match. */
  private readonly left: HTMLElement;
  private lastLeft = -1;
  private readonly soggy: HTMLElement;
  private readonly arrow: HTMLElement;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="zone">
         <div class="zone-row"><span class="alive-count">${icon('person')}<b class="left"></b></span></div>
         <div class="soggy" hidden>${icon('drained')}<span class="arrow">${icon('arrow')}</span></div>
       </div>`,
    );
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    this.left = q('.alive-count .left');
    this.soggy = q('.soggy');
    this.arrow = q('.soggy .arrow');
  }

  /** `left`: plushies still in the match. */
  update(state: GameState, me: Player | undefined, mePos: Vec2, left: number): void {
    const z = state.zone;
    if (left !== this.lastLeft) {
      this.lastLeft = left;
      this.left.textContent = String(left);
    }

    const soggy = !!me?.alive && isOutside(z, mePos);
    this.soggy.hidden = !soggy;
    if (soggy) {
      const dps = zoneDamagePerSecond(z, state.tick);
      // From a slow throb (a little damage) to a fast one (a lot).
      this.soggy.style.animationDuration = `${Math.max(0.35, 1.1 - dps * 0.06).toFixed(2)}s`;
      const angle = Math.atan2(z.current.center.y - mePos.y, z.current.center.x - mePos.x);
      this.arrow.style.transform = `rotate(${angle}rad)`;
    }
  }
}
