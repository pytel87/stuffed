// On a phone or tablet in the browser (not the app on the home screen): a full-screen button in the
// title menu's top left corner. Android lets the page ask to install Pluffs (it then plays full
// screen from the home screen), or failing that it just goes full screen; iPhones and iPads can't be
// asked, so it shows where it's done instead (Share, Add to Home Screen).
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';

/** Chrome's offer to install, held until the button is pressed. */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

export class InstallHint {
  private readonly button: HTMLButtonElement;
  private readonly steps: HTMLElement;
  private offer: InstallPrompt | null = null;

  /** `menu`: the title menu's overlay (shown with it); `homeScreenApp`: already full screen there. */
  constructor(menu: HTMLElement, homeScreenApp: boolean) {
    menu.insertAdjacentHTML(
      'beforeend',
      `<button type="button" class="round fs-button" hidden aria-label="${tr('Fullscreen')}">${icon('fullscreen')}</button>`,
    );
    // The steps: a card over the menu, like the Buttons' breakdown over the results.
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay install-steps" hidden role="dialog" aria-modal="true" aria-labelledby="install-title">
         <div class="card">
           <button type="button" class="round close" aria-label="${tr('Close')}">${icon('close')}</button>
           <h2 id="install-title">${icon('fullscreen', 'icon large')}<span>${tr('Fullscreen')}</span></h2>
           <p class="install-lead">${tr('Put Pluffs on your home screen and open it from there:')}</p>
           <ol>
             ${apple
               ? `<li>${tr('Tap Share')} ${icon('share')} <small>${tr('(at the top in Safari on an iPad, at the bottom on an iPhone)')}</small></li>
             <li>${tr('Choose “Add to Home Screen”')}</li>`
               : `<li>${tr('Open the browser’s menu')} <b>⋮</b></li>
             <li>${tr('Choose “Install app” or “Add to Home screen”')}</li>`}
             <li>${tr('Open Pluffs from your home screen')}</li>
           </ol>
           ${'share' in navigator ? `<button type="button" class="big primary install-share">${icon('share')}<span>${tr('Share')}</span></button>` : ''}
         </div>
       </div>`,
    );
    this.button = menu.querySelector<HTMLButtonElement>('.fs-button')!;
    this.steps = document.querySelector<HTMLElement>('.overlay.install-steps')!;
    if (homeScreenApp || !matchMedia('(pointer: coarse)').matches) return;
    this.button.hidden = false;
    // (Not while the page is full screen already, as the button itself may have made it.)
    document.addEventListener('fullscreenchange', () => (this.button.hidden = !!document.fullscreenElement));
    // Android: Chrome's offer, kept for the button.
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.offer = e as InstallPrompt;
    });
    addEventListener('appinstalled', () => (this.steps.hidden = true));
    this.button.addEventListener('click', () => void this.go());
    this.steps.querySelector('.close')!.addEventListener('click', () => (this.steps.hidden = true));
    this.steps.addEventListener('click', (e) => {
      if (e.target === this.steps) this.steps.hidden = true;
    });
    // The system's share sheet, opened for them (on an iPhone or iPad it may offer Add to Home
    // Screen right there; if not, it's in Safari's own Share).
    this.steps.querySelector('.install-share')?.addEventListener('click', () => {
      void navigator.share({ title: 'Pluffs', url: location.origin }).catch(() => {});
    });
  }

  private async go(): Promise<void> {
    if (!this.steps.hidden) {
      this.steps.hidden = true;
      return;
    }
    // Apple: always the steps. Android: install, or plain full screen, or (neither) the steps.
    if (!apple && this.offer) {
      try {
        await this.offer.prompt();
        await this.offer.userChoice;
        this.offer = null;
        return;
      } catch {
        this.offer = null;
      }
    }
    if (!apple && document.fullscreenEnabled) {
      try {
        await document.documentElement.requestFullscreen();
        return;
      } catch {
        // not allowed: the steps
      }
    }
    this.steps.hidden = false;
  }
}
