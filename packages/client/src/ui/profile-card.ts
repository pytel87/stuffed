// The Profil card, from the title menu: whose profile this is (its head), Sign in with Google to
// keep it safe and take it to any device (see account.ts), and, without a Google account, the
// recovery code to copy and a field to enter one from another device.
import type { ProfileStore } from '../session/profile.ts';
import { AccountPanel } from './account.ts';
import { icon, partIcon } from './icons.ts';
import { tr } from '../i18n.ts';
import { flashMessage } from './flash.ts';

export class ProfileCard {
  private readonly el: HTMLElement;
  private readonly head: HTMLElement;
  private readonly code: HTMLElement;
  private readonly restoreInput: HTMLInputElement;
  private readonly message: HTMLElement;
  private readonly account: AccountPanel;
  /** Called once when the card closes (the card it was opened from comes back). */
  onClosed: (() => void) | null = null;

  constructor(private readonly store: ProfileStore) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay profile" hidden>
         <div class="card">
           <button type="button" class="round close" aria-label="${tr('Close')}">${icon('close')}</button>
           <div class="profile-body">
             <div class="profile-top"><div class="profile-head"></div></div>
             <p class="code-hint without-google">${tr('Your code for another device')}</p>
             <div class="row code-row">
               <b class="code-box code"></b>
               <button type="button" class="round code-copy" aria-label="${tr('Copy code')}">${icon('copy')}</button>
             </div>
             <p class="code-hint restore-hint">${tr('Code from another device')}</p>
             <form class="row restore">
               <label class="field">${icon('enter')}<input maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false" aria-label="${tr('Recovery code')}"></label>
               <button type="submit" class="round primary" aria-label="${tr('Use code')}">${icon('arrow')}</button>
             </form>
           </div>
           <p class="error" role="alert"></p>
         </div>
       </div>`,
    );
    this.el = document.querySelector<HTMLElement>('.overlay.profile')!;
    this.head = this.el.querySelector('.profile-head')!;
    this.code = this.el.querySelector('.code')!;
    this.restoreInput = this.el.querySelector('.restore input')!;
    this.message = this.el.querySelector('.error')!;
    this.account = new AccountPanel(store, (text) => this.flash(text), () => this.show());
    this.head.after(this.account.el);

    const copy = this.el.querySelector<HTMLButtonElement>('.code-copy')!;
    copy.addEventListener('click', (e) => {
      if (e.detail > 0) copy.blur();
      void navigator.clipboard?.writeText(this.code.textContent ?? '').then(() => {
        copy.innerHTML = icon('check');
        setTimeout(() => (copy.innerHTML = icon('copy')), 1200);
      });
    });
    this.restoreInput.addEventListener('input', () => (this.restoreInput.value = this.restoreInput.value.toUpperCase()));
    this.el.querySelector('.restore')!.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.restore();
    });
    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    const profile = this.store.profile;
    if (!profile) return;
    // Its own close button takes the corner where the options gear sits.
    document.body.classList.add('wardrobe-open');
    this.head.innerHTML = partIcon('head', profile.look.head.animal, 'icon large');
    this.code.textContent = profile.recovery;
    // Linked to Google: that's the way back to it (its code doesn't work then), so no code shown.
    const linked = !!profile.account;
    this.el.querySelector<HTMLElement>('.without-google')!.hidden = linked;
    this.el.querySelector<HTMLElement>('.code-row')!.hidden = linked;
    // (The green tick on the head, like the menu's Profil button.)
    this.head.classList.toggle('signed-in', linked);
    flashMessage(this.message, '');
    this.account.render();
    this.el.hidden = false;
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    document.body.classList.remove('wardrobe-open');
    const back = this.onClosed;
    this.onClosed = null;
    back?.();
  }

  private flash(text: string): void {
    flashMessage(this.message, text);
  }


  private async restore(): Promise<void> {
    const result = await this.store.recover(this.restoreInput.value);
    if (result === 'linked') return this.flash(tr('That profile is linked to Google: sign in with Google.'));
    if (result !== 'ok') return this.flash(tr("That code doesn't match any profile."));
    this.restoreInput.value = '';
    this.show();
  }
}
