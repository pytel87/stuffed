import { config, isOutside, zoneSecondsLeft } from '@stuffed/sim';
import type { GameEvent, GameState, Player, Vec2 } from '@stuffed/sim';

const ANNOUNCE_SECONDS = 2.8;

function clock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Top-center Rinse timer, a soggy warning with an arrow to safety, and phase announcements. */
export class ZoneHud {
  private readonly phase: HTMLElement;
  private readonly status: HTMLElement;
  private readonly soggy: HTMLElement;
  private readonly soggyText: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly banner: HTMLElement;
  private bannerTime = 0;
  private last = '';

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="zone">
         <div class="zone-timer"><span class="phase"></span><span class="status"></span></div>
         <div class="soggy" hidden><span class="arrow">➜</span><span class="text"></span></div>
       </div>
       <div class="banner" hidden></div>`,
    );
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    this.phase = q('.zone .phase');
    this.status = q('.zone .status');
    this.soggy = q('.zone .soggy');
    this.soggyText = q('.zone .soggy .text');
    this.arrow = q('.zone .soggy .arrow');
    this.banner = q('.banner');
  }

  events(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type !== 'zone') continue;
      if (e.stage === 'shrink') this.announce(e.phase === config.zone.phases.length - 1 ? 'The final Rinse! Get to the center' : 'The Rinse is coming! Get inside the circle');
      else if (e.stage === 'final') this.announce('The Rinse has closed');
    }
  }

  update(state: GameState, me: Player | undefined, mePos: Vec2, dt: number): void {
    const z = state.zone;
    const left = clock(zoneSecondsLeft(z, state.tick));
    const total = config.zone.phases.length;
    const text =
      z.stage === 'wait' ? `The Rinse moves in ${left}` : z.stage === 'shrink' ? `The Rinse is moving · ${left}` : 'The Rinse has closed';
    const phase = `Phase ${Math.min(z.phase + 1, total)}/${total}`;
    const key = `${phase}|${text}|${z.stage}`;
    if (key !== this.last) {
      this.last = key;
      this.phase.textContent = phase;
      this.status.textContent = text;
      this.status.dataset.stage = z.stage;
    }

    const soggy = !!me?.alive && isOutside(z, mePos);
    this.soggy.hidden = !soggy;
    if (soggy) {
      const dps = config.zone.phases[Math.min(z.phase, total - 1)]!.damagePerSecond;
      this.soggyText.textContent = `Soggy! −${dps} stuffing/s · get to the circle`;
      const angle = Math.atan2(z.current.center.y - mePos.y, z.current.center.x - mePos.x);
      this.arrow.style.transform = `rotate(${angle}rad)`;
    }

    if (this.bannerTime > 0) {
      this.bannerTime -= dt;
      if (this.bannerTime <= 0) this.banner.hidden = true;
    }
  }

  private announce(text: string): void {
    this.banner.textContent = text;
    this.banner.hidden = false;
    this.banner.classList.remove('pop');
    void this.banner.offsetWidth; // restart the pop animation
    this.banner.classList.add('pop');
    this.bannerTime = ANNOUNCE_SECONDS;
  }
}
