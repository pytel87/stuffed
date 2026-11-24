import type { MapData } from '@stuffed/sim';
import { parseRoomCode } from '@stuffed/sim/net';
import { bindBotLevel, botLevelHtml } from './bot-level.ts';
import { bindMapChoice, mapChoiceHtml } from './map-choice.ts';
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';
import { flashMessage } from './flash.ts';

export interface MenuActions {
  solo: (name: string) => void;
  /** "Play online": a public match with whoever else is looking (see the server's matchmaker). */
  online: (name: string) => void;
  /** A private room, to invite friends to with its code. */
  create: (name: string) => void;
  join: (name: string, code: string) => void;
  wardrobe: () => void;
  /** The Profil card: the account (Google), the recovery code. */
  profile: () => void;
  /** A different map picked (the backdrop switches to it). */
  mapChanged?: (map: MapData) => void;
}

/** Title menu: your name, Solo, Online (a public match), and a code field to join a friend's room
 *  (or + to make one). */
export class MenuScreen {
  private readonly el: HTMLElement;
  private readonly name: HTMLInputElement;
  private readonly code: HTMLInputElement;
  private readonly error: HTMLElement;
  private readonly buttons: HTMLButtonElement[];

  constructor(root: HTMLElement, initialName: string, actions: MenuActions) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay menu" hidden>
         <div class="card">
           <span class="button-balance" hidden title="${tr('Buttons')}">${icon('button')}<b></b></span>
           <h1 class="logo">PLUFFS</h1>
           <div class="row">
             <label class="field">${icon('person')}<input id="menu-name" maxlength="16" autocomplete="nickname" spellcheck="false" aria-label="${tr('Your name')}"></label>
             <button type="button" class="round menu-wardrobe" aria-label="${tr('Wardrobe')}" hidden>${icon('hanger')}</button>
             <button type="button" class="round menu-profile" aria-label="${tr('Profile')}" hidden>${icon('cloud')}</button>
           </div>
           <hr class="stitch">
           <!-- Online on its own (its map and bots are the server's), stitched off from Solo and the
                map and bots Solo is played with. -->
           <div class="row">
             <button type="button" class="big primary menu-online"><span>${tr('Online')}</span></button>
             <span class="stitch-v" aria-hidden="true"></span>
             <button type="button" class="big menu-solo"><span>${tr('Solo')}</span></button>
             ${mapChoiceHtml()}
             ${botLevelHtml()}
           </div>
           <hr class="stitch">
           <form class="row menu-join">
             <label class="field code">${icon('enter')}<input id="menu-code" maxlength="4" placeholder="${tr('CODE')}" autocomplete="off" spellcheck="false" aria-label="${tr('Room code')}"></label>
             <button type="submit" class="round primary" aria-label="${tr('Join')}">${icon('arrow')}</button>
             <button type="button" class="round menu-create" aria-label="${tr('New room for friends')}">${icon('plus')}</button>
           </form>
           <p class="error" role="alert"></p>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.menu')!;
    this.name = this.el.querySelector('#menu-name')!;
    this.code = this.el.querySelector('#menu-code')!;
    this.error = this.el.querySelector('.error')!;
    this.buttons = [...this.el.querySelectorAll('button')];
    this.name.value = initialName;

    const name = () => this.name.value.trim().slice(0, 16) || tr('Plush');
    this.el.querySelector('.menu-solo')!.addEventListener('click', () => actions.solo(name()));
    this.el.querySelector('.menu-online')!.addEventListener('click', () => actions.online(name()));
    bindBotLevel(this.el.querySelector('.bot-level')!);
    bindMapChoice(this.el.querySelector('.map-choice')!, (map) => actions.mapChanged?.(map));
    this.el.querySelector('.menu-create')!.addEventListener('click', () => actions.create(name()));
    this.el.querySelector('.menu-wardrobe')!.addEventListener('click', () => actions.wardrobe());
    this.el.querySelector('.menu-profile')!.addEventListener('click', () => actions.profile());
    this.el.querySelector('.menu-join')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = parseRoomCode(this.code.value);
      if (!code) return this.showError(tr('4 letters, like BNFJ'));
      actions.join(name(), code);
    });
    this.code.addEventListener('input', () => (this.code.value = this.code.value.toUpperCase()));
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.el.hidden = false;
    this.setBusy(false);
  }

  hide(): void {
    this.el.hidden = true;
    this.showError('');
  }

  /** The Wardrobe and the Profil card need a profile (a reachable server). */
  setWardrobe(available: boolean): void {
    this.el.querySelector<HTMLElement>('.menu-wardrobe')!.hidden = !available;
    this.el.querySelector<HTMLElement>('.menu-profile')!.hidden = !available;
  }

  /** Signed in (the profile is linked to an account): the Profil button shows a tick. */
  setSignedIn(signedIn: boolean): void {
    this.el.querySelector('.menu-profile')!.classList.toggle('signed-in', signedIn);
  }

  /** Your Buttons (null: no profile, hidden). */
  setButtons(balance: number | null): void {
    const el = this.el.querySelector<HTMLElement>('.button-balance')!;
    el.hidden = balance === null;
    el.querySelector('b')!.textContent = String(balance ?? 0);
  }

  /** Waiting on the server after a press: every button off, the one pressed (`which`) turning. */
  setBusy(busy: boolean, which?: string): void {
    for (const b of this.buttons) {
      b.disabled = busy;
      b.classList.remove('busy');
    }
    if (busy && which) this.el.querySelector(which)?.classList.add('busy');
  }

  /** A pill on the card's bottom edge for a few seconds ('' clears it). */
  showError(text: string): void {
    flashMessage(this.error, text);
    this.setBusy(false);
  }
}
