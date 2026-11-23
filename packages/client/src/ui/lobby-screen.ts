import { MAX_PLAYERS } from '@stuffed/sim/net';
import type { RoomClient } from '../session/room-client.ts';
import { bindBotLevel, botLevelHtml, savedBotLevel } from './bot-level.ts';
import { bindMapPicker, mapPickerHtml, savedMap } from './map-choice.ts';
import { escapeHtml } from './escape.ts';
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';


/** The Multi card before a match: the code to invite friends with, who's in, bots, Start (host) and Leave. */
/** How many bots the host can pick: a few presets, and as many as fit. */
const BOT_PRESETS = [0, 5, 10, 'max'] as const;

export class LobbyScreen {
  private readonly el: HTMLElement;
  private readonly code: HTMLElement;
  private readonly share: HTMLButtonElement;
  /** "Players 2/16", over who's in. */
  private readonly players: HTMLElement;
  private readonly list: HTMLElement;
  private readonly wardrobe: HTMLElement;
  /** The bots and the map (the host only). */
  private readonly matchSection: HTMLElement;
  /** The bot presets (0, 5, 10, as many as fit). */
  private readonly botPicks: HTMLButtonElement[];
  private readonly start: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private wantedBots = 15;
  /** "Max" picked: the room filled with bots, fewer as friends join. */
  private maxBots = true;
  /** Team mode: all of us against the bots (on by default; families play together). */
  private wantedTeams = true;
  private readonly teamToggle: HTMLButtonElement;
  /** A public room: the invite (its code isn't for sharing). */
  private readonly inviteSection: HTMLElement;
  /** Ticks the public room's countdown while the lobby shows. */
  private countdown: ReturnType<typeof setInterval> | null = null;

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
           <button type="button" class="round lobby-leave" aria-label="${tr('Leave')}">${icon('door')}</button>
           <div class="lobby-side lobby-you">
           <p class="code-hint lobby-invite">${tr('Invite friends: send them this code')}</p>
           <div class="row code-row">
             <button type="button" class="code-box lobby-code" aria-label="${tr('Copy code')}"><span class="code"></span></button>
             <button type="button" class="round lobby-share" aria-label="${tr('Share invite')}">${icon('share')}</button>
           </div>
           </div>
           <div class="lobby-side lobby-name">
           <div class="row">
             <label class="field">${icon('person')}<input id="lobby-name-input" maxlength="16" spellcheck="false" aria-label="${tr('Your name')}"></label>
             <button type="button" class="round lobby-wardrobe" aria-label="${tr('Wardrobe')}">${icon('hanger')}</button>
           </div>
           </div>
           <div class="lobby-side lobby-match">
           <p class="code-hint lobby-bots-label">${tr('Bots')}</p>
           <div class="bots bot-row">
             ${BOT_PRESETS.map((p) => `<button type="button" class="round bot-pick" role="radio" data-bots="${p}">${p === 'max' ? tr('Max') : p}</button>`).join('')}
             ${botLevelHtml()}
           </div>
           <p class="code-hint lobby-map-label">${tr('Map')}</p>
           ${mapPickerHtml()}
           </div>
           <div class="lobby-side lobby-go">
           <p class="code-hint lobby-players"></p>
           <div class="row lobby-who">
             <ul class="chips"></ul>
             <button type="button" class="round lobby-team" aria-label="${tr('Team up against the bots')}" aria-pressed="true"></button>
           </div>
           <p class="status"></p>
           <button type="button" class="big primary lobby-start"><span>${tr('Start')}</span></button>
           </div>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.lobby')!;
    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    this.code = q('.code');
    this.share = q('.lobby-share');
    this.players = q('.lobby-players');
    this.list = q('.chips');
    bindBotLevel(q<HTMLButtonElement>('.bot-level'));
    bindMapPicker(q('.map-picker'));
    this.matchSection = q('.lobby-match');
    this.inviteSection = q('.lobby-you');
    this.botPicks = [...this.el.querySelectorAll<HTMLButtonElement>('.bot-pick')];
    this.start = q('.lobby-start');
    this.status = q('.status');
    this.nameInput = q('#lobby-name-input');

    this.teamToggle = q('.lobby-team');
    try {
      this.wantedTeams = localStorage.getItem('stuffed.teams') !== '0';
    } catch {
      // storage blocked: keep the default
    }
    // Teams: two blue plushies side by side; off, one red plush on its own (everyone for themselves).
    const showTeams = () => {
      this.teamToggle.setAttribute('aria-pressed', String(this.wantedTeams));
      this.teamToggle.innerHTML = icon(this.wantedTeams ? 'team' : 'alone');
    };
    showTeams();
    this.teamToggle.addEventListener('click', (e) => {
      if (e.detail > 0) this.teamToggle.blur();
      this.wantedTeams = !this.wantedTeams;
      showTeams();
      try {
        localStorage.setItem('stuffed.teams', this.wantedTeams ? '1' : '0');
      } catch {
        // not remembered; fine
      }
    });
    // With the map and bot level picked here (the same choices Enter and Again send).
    this.start.addEventListener('click', () => this.client.start(this.wantedBots, this.wantedTeams, savedBotLevel(), savedMap().id));
    for (const b of this.botPicks) {
      b.addEventListener('click', (e) => {
        if (e.detail > 0) b.blur();
        this.maxBots = b.dataset.bots === 'max';
        this.setBots(this.maxBots ? MAX_PLAYERS : Number(b.dataset.bots));
      });
    }
    q('.lobby-leave').addEventListener('click', onLeave);
    this.wardrobe = q('.lobby-wardrobe');
    this.wardrobe.hidden = !onWardrobe;
    if (onWardrobe) this.wardrobe.addEventListener('click', onWardrobe);
    this.share.addEventListener('click', () => void this.shareInvite());
    // Tapping the code copies it (the label says so for a moment).
    const invite = q('.lobby-invite');
    q('.lobby-code').addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.client.code).then(() => {
        invite.textContent = tr('Code copied!');
        setTimeout(() => (invite.textContent = tr('Invite friends: send them this code')), 1500);
      });
    });
    const commitName = () => {
      const name = this.nameInput.value.trim().slice(0, 16);
      if (name) onRename(name);
    };
    this.nameInput.addEventListener('change', commitName);
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.nameInput.blur();
    });
  }

  /** The Wardrobe button: shown once there's a profile (it may come after the lobby opens). */
  setWardrobe(available: boolean): void {
    this.wardrobe.hidden = !available;
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
    // A public room's "starting in" counts down by itself.
    this.countdown ??= setInterval(() => {
      if (!this.el.hidden && this.client.isPublic) this.render();
    }, 500);
  }

  hide(): void {
    this.el.hidden = true;
    this.stopCountdown();
  }

  remove(): void {
    this.stopCountdown();
    this.el.remove();
  }

  private stopCountdown(): void {
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = null;
  }

  render(): void {
    const c = this.client;
    const lobby = c.lobby;
    this.code.textContent = c.code;
    const humans = lobby?.seats.filter((s) => s.connected).length ?? 0;
    this.setBots(this.wantedBots, humans);
    const mine = lobby?.seats.find((s) => s.seat === c.seat);
    if (mine && document.activeElement !== this.nameInput) this.nameInput.value = mine.name;
    const seats = lobby?.seats ?? [];
    this.players.textContent = `${tr('Players')} ${seats.filter((s) => s.connected).length}/${MAX_PLAYERS}`;
    this.list.innerHTML = seats
      .map((s) => `<li class="${s.seat === c.seat ? 'me' : ''} ${s.connected ? '' : 'away'}">${icon(s.host ? 'crown' : 'person')}<span>${escapeHtml(s.name)}</span></li>`)
      .join('');
    // The match settings (bots, map): the host's; hidden whole for guests (no empty gap left).
    this.matchSection.hidden = !c.isHost;
    // The host's choices: teams (by the players), the map and Start.
    this.teamToggle.hidden = !c.isHost;
    this.start.hidden = !c.isHost;
    // A public room: nobody to invite and no host; it says when it starts instead.
    this.inviteSection.hidden = c.isPublic;
    this.el.classList.toggle('public', c.isPublic);
    if (c.isPublic) {
      const startsAt = lobby?.startsAt ?? null;
      const left = startsAt === null ? null : Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
      this.status.textContent =
        c.status !== 'open' ? '…' : left === null ? tr('Looking for players…') : left > 0 ? tr('Starting in {s} s').replace('{s}', String(left)) : tr('Starting…');
      return;
    }
    this.status.textContent = c.status !== 'open' ? '…' : c.error === 'full' ? tr('Full') : c.isHost ? '' : tr('Waiting for host…');
  }

  private async shareInvite(): Promise<void> {
    const url = new URL(location.href);
    url.search = `?room=${this.client.code}`;
    const link = url.toString();
    try {
      if (navigator.share) await navigator.share({ title: 'Pluffs', url: link });
      else await navigator.clipboard.writeText(link);
      this.share.classList.add('done');
      setTimeout(() => this.share.classList.remove('done'), 1200);
    } catch {
      // cancelled or not allowed: nothing to do
    }
  }

  private setBots(n: number, humans = this.client.lobby?.seats.filter((s) => s.connected).length ?? 1): void {
    const most = MAX_PLAYERS - Math.max(1, humans);
    this.wantedBots = Math.max(0, Math.min(most, this.maxBots ? most : n));
    // The pick that matches (Max when it's as many as fit); presets that no longer fit are off.
    for (const b of this.botPicks) {
      const p = b.dataset.bots === 'max' ? most : Number(b.dataset.bots);
      const on = b.dataset.bots === 'max' ? this.maxBots || this.wantedBots === most : !this.maxBots && p === this.wantedBots;
      b.setAttribute('aria-checked', String(on));
      b.disabled = p > most;
      b.setAttribute('aria-label', `${tr('Bots')}: ${p}`);
    }
  }
}
