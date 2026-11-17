import { MAX_PLAYERS } from '@stuffed/sim/net';
import type { RoomClient } from '../session/room-client.ts';

/** Room card before a match: the code to share, who's in, bots, and Start for the host. */
export class LobbyScreen {
  private readonly el: HTMLElement;
  private readonly code: HTMLElement;
  private readonly link: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly botsRow: HTMLElement;
  private readonly botCount: HTMLElement;
  private readonly start: HTMLButtonElement;
  private readonly status: HTMLElement;
  private wantedBots = 7;

  constructor(root: HTMLElement, private readonly client: RoomClient) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="end lobby" hidden role="dialog" aria-modal="true" aria-labelledby="lobby-title">
         <div class="end-card">
           <div class="end-placement">Room <span class="lobby-code"></span></div>
           <h1 id="lobby-title">Waiting for plushies</h1>
           <div class="lobby-share">
             <input id="lobby-link" class="lobby-link" readonly aria-label="Invite link">
             <button type="button" class="lobby-copy">Copy link</button>
           </div>
           <ul class="lobby-players"></ul>
           <div class="lobby-bots"><span>Bots</span>
             <button type="button" class="lobby-less" aria-label="Fewer bots">−</button>
             <b class="lobby-bot-count"></b>
             <button type="button" class="lobby-more" aria-label="More bots">+</button>
           </div>
           <p class="end-subtitle lobby-status"></p>
           <div class="end-actions"><button type="button" class="end-again lobby-start">Start <kbd>Enter</kbd></button></div>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.lobby')!;
    this.code = this.el.querySelector('.lobby-code')!;
    this.link = this.el.querySelector('.lobby-link')!;
    this.list = this.el.querySelector('.lobby-players')!;
    this.botsRow = this.el.querySelector('.lobby-bots')!;
    this.botCount = this.el.querySelector('.lobby-bot-count')!;
    this.start = this.el.querySelector('.lobby-start')!;
    this.status = this.el.querySelector('.lobby-status')!;
    this.start.addEventListener('click', () => this.client.start(this.wantedBots));
    this.el.querySelector('.lobby-less')!.addEventListener('click', () => this.setBots(this.wantedBots - 1));
    this.el.querySelector('.lobby-more')!.addEventListener('click', () => this.setBots(this.wantedBots + 1));
    this.el.querySelector('.lobby-copy')!.addEventListener('click', () => {
      navigator.clipboard?.writeText(this.link.value).catch(() => this.link.select());
    });
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  /** Bots the host picked for the next match. */
  get bots(): number {
    return this.wantedBots;
  }

  show(): void {
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    this.el.hidden = true;
  }

  render(): void {
    const c = this.client;
    const lobby = c.lobby;
    this.code.textContent = c.code;
    const url = new URL(location.href);
    url.search = `?room=${c.code}`;
    this.link.value = url.toString();
    const humans = lobby?.seats.filter((s) => s.connected).length ?? 0;
    this.setBots(this.wantedBots, humans);
    this.list.replaceChildren(
      ...(lobby?.seats ?? []).map((s) => {
        const li = document.createElement('li');
        li.textContent = s.name + (s.seat === c.seat ? ' (you)' : '');
        if (s.host) li.dataset.host = 'true';
        if (!s.connected) li.dataset.away = 'true';
        return li;
      }),
    );
    this.botsRow.hidden = !c.isHost;
    this.start.hidden = !c.isHost;
    this.status.textContent =
      c.status !== 'open' ? 'Connecting to the server…' : c.error === 'full' ? 'This room is full.' : c.isHost ? 'Share the link, then start.' : 'Waiting for the host to start…';
  }

  private setBots(n: number, humans = this.client.lobby?.seats.filter((s) => s.connected).length ?? 1): void {
    this.wantedBots = Math.max(0, Math.min(MAX_PLAYERS - Math.max(1, humans), n));
    this.botCount.textContent = String(this.wantedBots);
  }
}
