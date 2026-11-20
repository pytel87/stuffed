// A short message popping up under the players count: in red when something big is set off on the
// map (an air strike called, the lawnmower or the snowplow sent off), so everyone knows what's
// coming; in the calm cream of the area names for anything else (a tip, who won).
import type { GameEvent } from '@stuffed/sim';
import { escapeHtml } from './escape.ts';
import { tr } from '../i18n.ts';

const SHOW_SECONDS = 3.5;

export class Toast {
  private readonly el: HTMLElement;
  private left = 0;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML('beforeend', `<div class="toast" hidden></div>`);
    this.el = root.querySelector<HTMLElement>('.toast')!;
  }

  reset(): void {
    this.left = 0;
    this.el.hidden = true;
  }

  /** Shows a message for any event that calls for one. */
  events(events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'strikeCalled') this.show(tr(e.kind === 'balloons' ? 'Water balloons!' : e.kind === 'blocks' ? 'Falling blocks!' : 'Snowball barrage!'), true);
      else if (e.type === 'wandererStarted') this.show(tr(e.kind === 'plow' ? 'Snowplow!' : 'Lawnmower!'), true);
    }
  }

  update(dt: number): void {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) this.el.hidden = true;
  }

  /** A message of our own (a tip, who won), shown for `seconds`: calm, not an alarm. */
  announce(text: string, seconds: number): void {
    this.show(text, false, seconds);
  }

  /** `warning`: red, for danger on its way (an air strike, the mower); otherwise the cream pill. */
  private show(text: string, warning: boolean, seconds = SHOW_SECONDS): void {
    this.el.classList.toggle('warning', warning);
    // (Its fade-out runs over the same time.)
    this.el.style.setProperty('--for', `${seconds}s`);
    this.el.innerHTML = escapeHtml(text);
    this.el.hidden = false;
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
    this.left = seconds;
  }
}
