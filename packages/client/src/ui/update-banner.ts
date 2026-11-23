// A newer game deployed while this page was open: a pill at the top of the menus offers to reload.
// Checked (version.json, written by each build) when a menu, the lobby or the results show, and when
// the tab comes back into view; never in the middle of a match. Online, the server turns away an
// outdated page, which shows it too.
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';

/** Checking more often than this is pointless. */
const MIN_GAP_MS = 60_000;

export class UpdateBanner {
  private readonly el: HTMLElement;
  private lastCheck = 0;
  private outdated = false;
  private playing = false;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="update-banner" hidden role="status">
         ${icon('sparkle')}<span></span>
         <button type="button" class="update-reload">${tr('Reload')}</button>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.update-banner')!;
    this.el.querySelector('.update-reload')!.addEventListener('click', () => location.reload());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.check();
    });
  }

  /** In a match it stays out of the way (and isn't checked for). */
  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.render();
  }

  /** Asks the server which game is deployed now (at most once a minute). */
  async check(): Promise<void> {
    if (import.meta.env.DEV || this.outdated || this.playing) return;
    const now = Date.now();
    if (now - this.lastCheck < MIN_GAP_MS) return;
    this.lastCheck = now;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' });
      if (!res.ok) return;
      const { build } = (await res.json()) as { build?: string };
      if (build && build !== __BUILD_ID__) this.markOutdated(false);
    } catch {
      // offline: try again next time
    }
  }

  /** `required`: online play needs it (the server turned this page away), not just a nicety. */
  markOutdated(required: boolean): void {
    this.outdated = true;
    this.el.querySelector('span')!.textContent = tr(required ? 'A new version is out: reload to play online' : 'A new version of the game is ready');
    this.el.classList.toggle('required', required);
    this.render();
  }

  private render(): void {
    this.el.hidden = !this.outdated || (this.playing && !this.el.classList.contains('required'));
  }
}
