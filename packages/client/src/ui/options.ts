import { icon } from './icons.ts';
import { tr } from '../i18n.ts';

export interface OptionsActions {
  toggleSound: () => boolean;
  /** Music on or off (sound effects stay). */
  toggleMusic: () => boolean;
  isMusicOn: () => boolean;
  isMuted: () => boolean;
  help: () => void;
  leave: () => void;
}

/** The ⚙ button: sound, fullscreen, controls help, and leave (when there's something to leave). */
export class Options {
  private readonly sheet: HTMLElement;
  private readonly sound: HTMLButtonElement;
  private readonly leave: HTMLButtonElement;

  constructor(private readonly actions: OptionsActions) {
    const canFullscreen = !!document.documentElement.requestFullscreen;
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button type="button" class="gear" aria-label="${tr('Options')}">${icon('gear')}</button>
       <div class="sheet" hidden>
         <button type="button" class="round opt-sound" aria-label="${tr('Sound')}"></button>
         <button type="button" class="round opt-music" aria-label="${tr('Music')}"></button>
         ${canFullscreen ? `<button type="button" class="round opt-full" aria-label="${tr('Fullscreen')}">${icon('fullscreen')}</button>` : ''}
         <button type="button" class="round opt-help" aria-label="${tr('Controls')}">${icon('help')}</button>
         <button type="button" class="round opt-leave" aria-label="${tr('Leave')}">${icon('home')}</button>
       </div>
       <div class="overlay leave-confirm" hidden role="dialog" aria-modal="true" aria-label="${tr('Leave the match?')}">
         <div class="card">
           <div class="leave-icon">${icon('home', 'icon large')}<b>?</b></div>
           <div class="row">
             <button type="button" class="big primary leave-yes" aria-label="${tr('Leave')}">${icon('check')}</button>
             <button type="button" class="big leave-no" aria-label="${tr('Stay')}">${icon('close')}</button>
           </div>
         </div>
       </div>`,
    );
    const gear = document.querySelector<HTMLButtonElement>('.gear')!;
    this.sheet = document.querySelector<HTMLElement>('.sheet')!;
    this.sound = this.sheet.querySelector('.opt-sound')!;
    const music = this.sheet.querySelector<HTMLButtonElement>('.opt-music')!;
    const renderMusic = () => {
      music.innerHTML = icon('music');
      music.classList.toggle('off', !actions.isMusicOn());
    };
    renderMusic();
    music.addEventListener('click', () => {
      actions.toggleMusic();
      renderMusic();
    });
    this.leave = this.sheet.querySelector('.opt-leave')!;
    this.renderSound();

    gear.addEventListener('click', () => (this.sheet.hidden = !this.sheet.hidden));
    this.sound.addEventListener('click', () => {
      actions.toggleSound();
      this.renderSound();
    });
    this.sheet.querySelector('.opt-full')?.addEventListener('click', () => {
      this.sheet.hidden = true;
      if (document.fullscreenElement) void document.exitFullscreen();
      else
        void document.documentElement
          .requestFullscreen({ navigationUI: 'hide' })
          .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
          .catch(() => {});
    });
    this.sheet.querySelector('.opt-help')!.addEventListener('click', () => {
      this.sheet.hidden = true;
      actions.help();
    });
    // Leaving ends your match: ask first (✓ leave, ✕ stay).
    const confirm = document.querySelector<HTMLElement>('.leave-confirm')!;
    this.leave.addEventListener('click', () => {
      this.sheet.hidden = true;
      confirm.hidden = false;
    });
    confirm.querySelector('.leave-yes')!.addEventListener('click', () => {
      confirm.hidden = true;
      actions.leave();
    });
    confirm.querySelector('.leave-no')!.addEventListener('click', () => (confirm.hidden = true));
    confirm.addEventListener('click', (e) => {
      if (e.target === confirm) confirm.hidden = true;
    });
  }

  /** Leave is offered only during a match or in a room. */
  setCanLeave(can: boolean): void {
    this.leave.hidden = !can;
  }

  private renderSound(): void {
    this.sound.innerHTML = icon(this.actions.isMuted() ? 'mute' : 'sound');
  }
}
