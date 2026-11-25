import { BUTTONS, isOutside, zoneDamagePerSecond } from '@stuffed/sim';
import type { GameState, Player, Vec2 } from '@stuffed/sim';
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';

/** How many plushies are left, and a badge pointing back to safety while you're out in the Rinse
 *  (it pulses faster the more it hurts), over your plush (see placeSoggy). No countdown or
 *  call-outs: the grey edge shows it coming. */
export class ZoneHud {
  /** How many plushies are still in the match. */
  private readonly left: HTMLElement;
  private lastLeft = -1;
  private readonly soggy: HTMLElement;
  private readonly arrow: HTMLElement;
  /** Buttons earned so far this match: found, and for knockouts (shown once there are some). */
  private readonly pocket: HTMLElement;
  private lastPocket = -1;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="zone">
         <div class="zone-row"><span class="alive-count">${icon('person')}<b class="left"></b></span><span class="alive-count pocket-count" title="${tr('Buttons')}">${icon('button')}<b></b></span></div>
       </div>
       <div class="soggy" hidden>${icon('drained')}<span class="arrow">${icon('arrow')}</span></div>`,
    );
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    this.left = q('.alive-count .left');
    this.soggy = q('.soggy');
    this.arrow = q('.soggy .arrow');
    this.pocket = q('.pocket-count');
  }

  /** `left`: plushies still in the match. */
  update(state: GameState, me: Player | undefined, mePos: Vec2, left: number): void {
    const z = state.zone;
    if (left !== this.lastLeft) {
      this.lastLeft = left;
      this.left.textContent = String(left);
    }

    // What the match has earned you so far: what you found, and your knockouts (as the end will count them).
    const pocket = (me?.pocket ?? 0) + Math.min(BUTTONS.maxKnockouts, me?.knockouts ?? 0) * BUTTONS.knockout;
    if (pocket !== this.lastPocket) {
      const more = pocket > this.lastPocket && this.lastPocket >= 0;
      this.lastPocket = pocket;
      // (Always there, from 0: you see where they'll count.)
      this.pocket.hidden = false;
      this.pocket.querySelector('b')!.textContent = String(pocket);
      // Restart the pop.
      this.pocket.classList.remove('more');
      if (more) void this.pocket.offsetWidth, this.pocket.classList.add('more');
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

  /** While it shows: over your plush, at (x, y) on the screen (its bottom middle there). */
  placeSoggy(x: number, y: number): void {
    if (this.soggy.hidden) return;
    this.soggy.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}
