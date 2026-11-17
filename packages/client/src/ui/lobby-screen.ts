import { MAX_PLAYERS } from '@stuffed/sim/net';
import type { RoomClient } from '../session/room-client.ts';
import { escapeHtml } from './escape.ts';
import { icon } from './icons.ts';

/** Room card before a match: the code to share, who's in, bots, Start (host) and Leave. */
export class LobbyScreen {
  private readonly el: HTMLElement;
  private readonly code: HTMLElement;
  private readonly share: HTMLButtonElement;
  private readonly list: HTMLElement;
  private readonly botsRow: HTMLElement;
  private readonly botCount: HTMLElement;
  private readonly start: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private wantedBots = 7;

  constructor(
    root: HTMLElement,
    private readonly client: RoomClient,
    onLeave: () => void,
    onRename: (name: string) => void,
    onWardrobe: (() => void) | null = null,
  ) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay lobby" hidden>
         <div class="card">
           <div class="room-code"><span class="code"></span><button type="button" class="round lobby-share" aria-label="Share invite">${icon('share')}</button></div>
           <div class="row">
             <label class="field">${icon('person')}<input id="lobby-name-input" maxlength="16" spellcheck="false" aria-label="Your name"></label>
             <button type="button" class="round lobby-wardrobe" aria-label="Wardrobe">${icon('hanger')}</button>
           </div>
           <ul class="chips"></ul>
           <div class="bots">${icon('bot')}
             <button type="button" class="round small lobby-less" aria-label="Fewer bots">−</button>
             <b class="bot-count"></b>
             <button type="button" class="round small lobby-more" aria-label="More bots">+</button>
           </div>
           <p class="status"></p>
           <div class="row">
             <button type="button" class="big primary lobby-start">${icon('play')}<span>Start</span></button>
             <button type="button" class="round lobby-leave" aria-label="Leave">${icon('door')}</button>
           </div>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.lobby')!;
    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    this.code = q('.code');
    this.share = q('.lobby-share');
    this.list = q('.chips');
    this.botsRow = q('.bots');
    this.botCount = q('.bot-count');
    this.start = q('.lobby-start');
    this.status = q('.status');
    this.nameInput = q('#lobby-name-input');

    this.start.addEventListener('click', () => this.client.start(this.wantedBots));
    q('.lobby-less').addEventListener('click', () => this.setBots(this.wantedBots - 1));
    q('.lobby-more').addEventListener('click', () => this.setBots(this.wantedBots + 1));
    q('.lobby-leave').addEventListener('click', onLeave);
    const wardrobe = q('.lobby-wardrobe');
    wardrobe.hidden = !onWardrobe;
    if (onWardrobe) wardrobe.addEventListener('click', onWardrobe);
    this.share.addEventListener('click', () => void this.shareInvite());
    const commitName = () => {
      const name = this.nameInput.value.trim().slice(0, 16);
      if (name) onRename(name);
    };
    this.nameInput.addEventListener('change', commitName);
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.nameInput.blur();
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

  remove(): void {
    this.el.remove();
  }

  render(): void {
    const c = this.client;
    const lobby = c.lobby;
    this.code.textContent = c.code;
    const humans = lobby?.seats.filter((s) => s.connected).length ?? 0;
    this.setBots(this.wantedBots, humans);
    const mine = lobby?.seats.find((s) => s.seat === c.seat);
    if (mine && document.activeElement !== this.nameInput) this.nameInput.value = mine.name;
    this.list.innerHTML = (lobby?.seats ?? [])
      .map((s) => `<li class="${s.seat === c.seat ? 'me' : ''} ${s.connected ? '' : 'away'}">${icon(s.host ? 'crown' : 'person')}<span>${escapeHtml(s.name)}</span></li>`)
      .join('');
    this.botsRow.hidden = !c.isHost;
    this.start.hidden = !c.isHost;
    this.status.textContent = c.status !== 'open' ? '…' : c.error === 'full' ? 'Full' : c.isHost ? '' : 'Waiting for host…';
  }

  private async shareInvite(): Promise<void> {
    const url = new URL(location.href);
    url.search = `?room=${this.client.code}`;
    const link = url.toString();
    try {
      if (navigator.share) await navigator.share({ title: 'STUFFED', url: link });
      else await navigator.clipboard.writeText(link);
      this.share.classList.add('done');
      setTimeout(() => this.share.classList.remove('done'), 1200);
    } catch {
      // cancelled or not allowed: nothing to do
    }
  }

  private setBots(n: number, humans = this.client.lobby?.seats.filter((s) => s.connected).length ?? 1): void {
    this.wantedBots = Math.max(0, Math.min(MAX_PLAYERS - Math.max(1, humans), n));
    this.botCount.textContent = String(this.wantedBots);
  }
}
