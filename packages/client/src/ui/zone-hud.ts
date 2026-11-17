import { isOutside, zoneDamagePerSecond, zoneSecondsLeft } from '@stuffed/sim';
import type { GameEvent, GameState, Player, Vec2 } from '@stuffed/sim';
import { icon } from './icons.ts';

const ANNOUNCE_SECONDS = 2.4;

function clock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The Rinse: a water-drop timer, a soggy badge pointing back to safety, and short call-outs. */
export class ZoneHud {
  private readonly timer: HTMLElement;
  private readonly time: HTMLElement;
  private readonly soggy: HTMLElement;
  private readonly soggyRate: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly banner: HTMLElement;
  private bannerTime = 0;
  private last = '';

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="zone">
         <div class="zone-timer">${icon('water')}<b class="time"></b></div>
         <div class="soggy" hidden>${icon('water')}<span class="arrow">${icon('arrow')}</span><b class="rate"></b></div>
       </div>
       <div class="banner" hidden></div>`,
    );
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    this.timer = q('.zone-timer');
    this.time = q('.zone-timer .time');
    this.soggy = q('.soggy');
    this.soggyRate = q('.soggy .rate');
    this.arrow = q('.soggy .arrow');
    this.banner = q('.banner');
  }

  events(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type !== 'zone') continue;
      if (e.stage === 'shrinking') this.announce('Rinse!');
      else if (e.stage === 'closed') this.announce('Flood!');
    }
  }

  update(state: GameState, me: Player | undefined, mePos: Vec2, dt: number): void {
    const z = state.zone;
    const text = z.stage === 'closed' ? '0:00' : clock(zoneSecondsLeft(z, state.tick));
    const key = `${text}|${z.stage}`;
    if (key !== this.last) {
      this.last = key;
      this.time.textContent = text;
      this.timer.dataset.stage = z.stage;
    }

    const soggy = !!me?.alive && isOutside(z, mePos);
    this.soggy.hidden = !soggy;
    if (soggy) {
      const dps = zoneDamagePerSecond(z, state.tick);
      this.soggyRate.textContent = `−${dps.toFixed(dps < 10 ? 1 : 0)}`;
      const angle = Math.atan2(z.current.center.y - mePos.y, z.current.center.x - mePos.x);
      this.arrow.style.transform = `rotate(${angle}rad)`;
    }

    if (this.bannerTime > 0) {
      this.bannerTime -= dt;
      if (this.bannerTime <= 0) this.banner.hidden = true;
    }
  }

  private announce(text: string): void {
    this.banner.innerHTML = `${icon('water')}<span>${text}</span>`;
    this.banner.hidden = false;
    this.banner.classList.remove('pop');
    void this.banner.offsetWidth; // restart the pop animation
    this.banner.classList.add('pop');
    this.bannerTime = ANNOUNCE_SECONDS;
  }
}
