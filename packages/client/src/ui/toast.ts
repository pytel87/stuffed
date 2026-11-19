// A short message popping up under the players count when something big is set off on the map
// (an air strike called, the lawnmower or the snowplow sent off), so everyone knows what's coming.
import type { GameEvent } from '@stuffed/sim';
import { escapeHtml } from './escape.ts';
import { tr } from '../i18n.ts';

const SHOW_SECONDS = 2.4;

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
      if (e.type === 'strikeCalled') this.show(tr(e.kind === 'balloons' ? 'Water balloons!' : e.kind === 'blocks' ? 'Falling blocks!' : 'Snowball barrage!'));
      else if (e.type === 'wandererStarted') this.show(tr(e.kind === 'plow' ? 'Snowplow!' : 'Lawnmower!'));
    }
  }

  update(dt: number): void {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) this.el.hidden = true;
  }

  /** A message of our own, shown for `seconds`. */
  announce(text: string, seconds: number): void {
    this.show(text);
    this.left = seconds;
  }

  private show(text: string): void {
    this.el.innerHTML = escapeHtml(text);
    this.el.hidden = false;
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
    this.left = SHOW_SECONDS;
  }
}
