import { MAX_PLAYERS } from '@stuffed/sim/net';
import type { RoomClient } from '../session/room-client.ts';
import { bindBotLevel, botLevelHtml, savedBotLevel } from './bot-level.ts';
import { bindMapChoice, mapChoiceHtml, savedMap } from './map-choice.ts';
import { escapeHtml } from './escape.ts';
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';

/** Room card before a match: the code to share, who's in, bots, Start (host) and Leave. */
export class LobbyScreen {
  private readonly el: HTMLElement;
  private readonly code: HTMLElement;
  private readonly share: HTMLButtonElement;
  private readonly list: HTMLElement;
  private readonly botsRow: HTMLElement;
  private readonly optionsRow: HTMLElement;
  private readonly botCount: HTMLElement;
  private readonly start: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private wantedBots = 15;
  /** Team mode: all of us against the bots (on by default; families play together). */
  private wantedTeams = true;
  private readonly teamToggle: HTMLButtonElement;

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
           <button type="button" class="round lobby-share" aria-label="${tr('Share invite')}">${icon('share')}</button>
           <button type="button" class="round lobby-leave" aria-label="${tr('Leave')}">${icon('door')}</button>
           <div class="room-code"><span class="code"></span></div>
           <div class="row">
             <label class="field">${icon('person')}<input id="lobby-name-input" maxlength="16" spellcheck="false" aria-label="${tr('Your name')}"></label>
             <button type="button" class="round lobby-wardrobe" aria-label="${tr('Wardrobe')}">${icon('hanger')}</button>
           </div>
           <ul class="chips"></ul>
           <div class="bots">
             <span class="bot-label">${icon('bot')}</span>
             <button type="button" class="round lobby-less" aria-label="${tr('Fewer bots')}">−</button>
             <span class="bot-number"><b class="bot-count"></b></span>
             <button type="button" class="round lobby-more" aria-label="${tr('More bots')}">+</button>
           </div>
           <div class="bots lobby-options">
             ${mapChoiceHtml()}
             ${botLevelHtml()}
             <button type="button" class="round lobby-team" aria-label="${tr('Team up against the bots')}" aria-pressed="true">${icon('team')}</button>
           </div>
           <p class="status"></p>
           <button type="button" class="big primary lobby-start"><span>${tr('Start')}</span></button>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.lobby')!;
    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    this.code = q('.code');
    this.share = q('.lobby-share');
    this.list = q('.chips');
    this.botsRow = q('.bots');
    bindBotLevel(q<HTMLButtonElement>('.bot-level'));
    bindMapChoice(q<HTMLButtonElement>('.map-choice'));
    this.optionsRow = q('.lobby-options');
    this.botCount = q('.bot-count');
    this.start = q('.lobby-start');
    this.status = q('.status');
    this.nameInput = q('#lobby-name-input');

    this.teamToggle = q('.lobby-team');
    try {
      this.wantedTeams = localStorage.getItem('stuffed.teams') !== '0';
    } catch {
      // storage blocked: keep the default
    }
    this.teamToggle.setAttribute('aria-pressed', String(this.wantedTeams));
    this.teamToggle.addEventListener('click', (e) => {
      if (e.detail > 0) this.teamToggle.blur();
      this.wantedTeams = !this.wantedTeams;
      this.teamToggle.setAttribute('aria-pressed', String(this.wantedTeams));
      try {
        localStorage.setItem('stuffed.teams', this.wantedTeams ? '1' : '0');
      } catch {
        // not remembered; fine
      }
    });
    // With the map and bot level picked here (the same choices Enter and Again send).
    this.start.addEventListener('click', () => this.client.start(this.wantedBots, this.wantedTeams, savedBotLevel(), savedMap().id));
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

  /** Whether the host wants team mode for the next match. */
  get teams(): boolean {
    return this.wantedTeams;
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
    this.optionsRow.hidden = !c.isHost;
    this.start.hidden = !c.isHost;
    this.status.textContent = c.status !== 'open' ? '…' : c.error === 'full' ? tr('Full') : c.isHost ? '' : tr('Waiting for host…');
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
