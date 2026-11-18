import type { MapData } from '@stuffed/sim';
import { parseRoomCode } from '@stuffed/sim/net';
import { bindBotLevel, botLevelHtml } from './bot-level.ts';
import { bindMapChoice, mapChoiceHtml } from './map-choice.ts';
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';

export interface MenuActions {
  solo: (name: string) => void;
  create: (name: string) => void;
  join: (name: string, code: string) => void;
  wardrobe: () => void;
  /** A different map picked (the backdrop switches to it). */
  mapChanged?: (map: MapData) => void;
}

/** Title menu: your name, Solo, Room (create), and a code field to join. */
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
           <h1 class="logo">STUFFED</h1>
           <div class="row">
             <label class="field">${icon('person')}<input id="menu-name" maxlength="16" autocomplete="nickname" spellcheck="false" aria-label="${tr('Your name')}"></label>
             <button type="button" class="round menu-wardrobe" aria-label="${tr('Wardrobe')}" hidden>${icon('hanger')}</button>
           </div>
           <div class="row">
             <button type="button" class="big primary menu-solo"><span>${tr('Solo')}</span></button>
             <button type="button" class="big menu-create"><span>${tr('Room')}</span></button>
             ${mapChoiceHtml()}
             ${botLevelHtml()}
           </div>
           <form class="row menu-join">
             <label class="field code">${icon('enter')}<input id="menu-code" maxlength="4" placeholder="${tr('CODE')}" autocomplete="off" spellcheck="false" aria-label="${tr('Room code')}"></label>
             <button type="submit" class="round primary" aria-label="${tr('Join')}">${icon('arrow')}</button>
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
    bindBotLevel(this.el.querySelector('.bot-level')!);
    bindMapChoice(this.el.querySelector('.map-choice')!, (map) => actions.mapChanged?.(map));
    this.el.querySelector('.menu-create')!.addEventListener('click', () => actions.create(name()));
    this.el.querySelector('.menu-wardrobe')!.addEventListener('click', () => actions.wardrobe());
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

  /** The Wardrobe needs a profile (a reachable server). */
  setWardrobe(available: boolean): void {
    this.el.querySelector<HTMLElement>('.menu-wardrobe')!.hidden = !available;
  }

  setBusy(busy: boolean): void {
    for (const b of this.buttons) b.disabled = busy;
  }

  showError(text: string): void {
    this.error.textContent = text;
    this.setBusy(false);
  }
}
