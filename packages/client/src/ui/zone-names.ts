// The zone you just walked into ("Picnic Plateau"), shown briefly under the Rinse timer.
import type { MapData, Player, Vec2 } from '@stuffed/sim';
import { escapeHtml } from './escape.ts';
import { tr } from '../i18n.ts';

const SHOW_SECONDS = 2.4;

export class ZoneNames {
  private readonly el: HTMLElement;
  private current: string | null = null;
  private left = 0;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML('beforeend', `<div class="zone-name" hidden></div>`);
    this.el = root.querySelector<HTMLElement>('.zone-name')!;
  }

  reset(): void {
    this.current = null;
    this.left = 0;
    this.el.hidden = true;
  }

  update(map: MapData, me: Player | undefined, pos: Vec2, dt: number): void {
    if (this.left > 0) {
      this.left -= dt;
      if (this.left <= 0) this.el.hidden = true;
    }
    if (!me?.alive || me.drop) return;
    let inside: string | null = null;
    let best = Infinity;
    for (const zone of map.zones ?? []) {
      const d = Math.hypot(pos.x - zone.center.x, pos.y - zone.center.y);
      if (d < zone.radius && d < best) {
        inside = zone.name;
        best = d;
      }
    }
    // Only entering a zone is announced (walking out onto the lawn is quiet).
    if (inside && inside !== this.current) {
      this.el.innerHTML = escapeHtml(tr(inside));
      this.el.hidden = false;
      this.el.classList.remove('pop');
      void this.el.offsetWidth;
      this.el.classList.add('pop');
      this.left = SHOW_SECONDS;
    }
    this.current = inside;
  }
}
