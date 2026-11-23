// The parent's account in the Wardrobe's key view: Sign in with Google links the profile to it, so
// the collection is safe and comes back on any device (signing in there lists the account's
// profiles: siblings each have one). Shown only when the game has a Google client ID.
import type { ProfileSummary } from '@stuffed/sim/net';
import type { ProfileStore } from '../session/profile.ts';
import { icon, partIcon } from './icons.ts';
import { escapeHtml } from './escape.ts';
import { LANG, tr } from '../i18n.ts';

/** The game's Google OAuth client ID (public; the server checks tokens against the same one). */
const GOOGLE_CLIENT_ID = '776610072313-a92eldqipjfr00h32r2j5ojlmgm09k0q.apps.googleusercontent.com';
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || GOOGLE_CLIENT_ID;

interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean; ux_mode?: string }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
  disableAutoSelect(): void;
}

let gis: Promise<GoogleId> | null = null;
/** Google's sign-in script, loaded the first time it's needed. */
function loadGis(): Promise<GoogleId> {
  gis ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      const id = (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('gis'));
    };
    s.onerror = () => {
      gis = null;
      reject(new Error('gis'));
    };
    document.head.append(s);
  });
  return gis;
}

export class AccountPanel {
  readonly el: HTMLElement;
  /** What the next Google sign-in is for. */
  private intent: 'signin' | 'delete' = 'signin';
  private credential = '';

  constructor(
    private readonly store: ProfileStore,
    /** A message under the card (the Wardrobe's). */
    private readonly say: (text: string) => void,
    /** The profile on this device changed (signed in to another one): show it. */
    private readonly onSwitched: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'account';
    this.el.hidden = !CLIENT_ID;
    this.el.addEventListener('click', (e) => void this.clicked(e));
  }

  /** Shows the account part of the key view for the profile as it is now. */
  render(): void {
    if (!CLIENT_ID) return;
    const account = this.store.profile?.account ?? null;
    this.intent = 'signin';
    if (account) {
      this.el.innerHTML = `
        <p class="code-hint">${icon('check')} ${tr('Linked to')} <b>${escapeHtml(account.email)}</b></p>
        <div class="row account-row">
          <button type="button" class="big account-unlink"><span>${tr('Unlink')}</span></button>
          <button type="button" class="big account-delete"><span>${tr('Delete account')}</span></button>
        </div>`;
      return;
    }
    this.el.innerHTML = `
      <p class="code-hint">${tr('Sign in with Google to keep your collection safe and take it to any device.')}</p>
      <div class="google-slot"></div>`;
    void this.showGoogleButton();
  }

  private async showGoogleButton(): Promise<void> {
    const slot = this.el.querySelector<HTMLElement>('.google-slot');
    if (!slot) return;
    try {
      const id = await loadGis();
      id.initialize({ client_id: CLIENT_ID, callback: (r) => void this.signedIn(r.credential), auto_select: false });
      if (!slot.isConnected) return;
      id.renderButton(slot, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: LANG });
    } catch {
      slot.textContent = tr("Couldn't reach Google.");
    }
  }

  /** Google said who it is: link this profile, or offer the account's profiles. */
  private async signedIn(credential: string): Promise<void> {
    this.credential = credential;
    if (this.intent === 'delete') return this.confirmDelete();
    const found = await this.store.accountSignin(credential);
    if (!found) return this.say(tr("Couldn't sign in. Try again."));
    const mine = found.current !== null && found.profiles.some((p) => p.id === found.current);
    if (mine) return this.render();
    if (found.profiles.length === 0) return this.link();
    // The account has profiles already: play one of them here, or add this one (a sibling's).
    this.el.innerHTML = `
      <p class="code-hint">${tr('Profiles of')} <b>${escapeHtml(found.email)}</b>:</p>
      <div class="account-profiles">${found.profiles.map((p) => this.card(p)).join('')}</div>
      <button type="button" class="big account-add"><span>${tr('Add this profile too')}</span></button>`;
  }

  private card(p: ProfileSummary): string {
    return `<button type="button" class="account-profile" data-id="${escapeHtml(p.id)}">
      ${partIcon('head', p.look.head.animal, 'icon large')}
      <span>${tr('Parts')} <b>${p.parts}</b> · ${tr('Sets')} <b>${p.sets}</b> · ${icon('button')}<b>${p.buttons}</b></span>
    </button>`;
  }

  private async link(): Promise<void> {
    const result = await this.store.accountLink(this.credential);
    if (result === 'elsewhere') this.say(tr('This profile belongs to another account.'));
    else if (result === 'failed') this.say(tr("Couldn't sign in. Try again."));
    this.render();
  }

  private async clicked(e: Event): Promise<void> {
    const target = e.target as HTMLElement;
    const pick = target.closest<HTMLElement>('.account-profile');
    if (pick) {
      if (await this.store.accountUse(this.credential, pick.dataset.id!)) this.onSwitched();
      else this.say(tr("Couldn't sign in. Try again."));
      return;
    }
    if (target.closest('.account-add')) return this.link();
    if (target.closest('.account-unlink')) {
      await this.store.accountUnlink();
      return this.render();
    }
    if (target.closest('.account-delete')) {
      // Deleting needs the parent to sign in again, right now.
      this.intent = 'delete';
      this.el.innerHTML = `
        <p class="code-hint">${tr('Delete the account and all its profiles for good? Sign in to confirm.')}</p>
        <div class="google-slot"></div>
        <button type="button" class="big account-cancel"><span>${tr('Keep it')}</span></button>`;
      void this.showGoogleButton();
      return;
    }
    if (target.closest('.account-cancel')) this.render();
  }

  private async confirmDelete(): Promise<void> {
    if (await this.store.accountDelete(this.credential)) {
      this.say(tr('The account is deleted.'));
      this.onSwitched();
    } else {
      this.say(tr("Couldn't sign in. Try again."));
      this.render();
    }
  }
}
