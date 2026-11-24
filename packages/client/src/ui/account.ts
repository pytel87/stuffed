// The account part of the Profil card: Sign in with Google links the profile to it (one profile per
// account), so the collection is safe and comes back on any device; a device that played without
// it merges into it. Shown only when the game has a Google client ID.
import { completeSets } from '@stuffed/sim';
import type { Profile, ProfileSummary } from '@stuffed/sim/net';
import type { ProfileStore } from '../session/profile.ts';
import { icon, partIcon } from './icons.ts';
import { escapeHtml } from './escape.ts';
import { whileBusy } from './busy.ts';
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
        <p class="code-hint">${tr('Linked to')} <b>${escapeHtml(account.email)}</b></p>
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
      // Filling its place beside the head (Google allows 200 to 400 pixels; the card's middle is
      // 23rem less the head and the gap, less on a narrow phone, if it isn't on screen to measure).
      const across = slot.clientWidth || Math.min(18 * 16, innerWidth - 11 * 16);
      const width = Math.round(Math.min(400, Math.max(200, across)));
      id.renderButton(slot, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: LANG, width });
    } catch {
      slot.textContent = tr("Couldn't reach Google.");
    }
  }

  /** Google said who it is: link this profile, or offer the account's profiles. */
  private async signedIn(credential: string): Promise<void> {
    this.credential = credential;
    if (this.intent === 'delete') return this.confirmDelete();
    const found = await whileBusy(this.area, this.store.accountSignin(credential));
    if (!found) return this.say(tr("Couldn't sign in. Try again."));
    const mine = found.current !== null && found.profiles.some((p) => p.id === found.current);
    if (mine) return this.render();
    if (found.profiles.length === 0) return this.link();
    this.offer(found.email, found.profiles[0]!);
  }

  /**
   * One profile per account, and this one already has another: merge this device's into it (both
   * collections and Buttons in one), or only play the account's here (this device's stays as it is,
   * under its code: a sibling's, say). Neither: the card's close button.
   */
  private offer(email: string, theirs: ProfileSummary): void {
    const mine = this.store.profile;
    this.el.innerHTML = `
      <p class="code-hint">${tr('{email} already has a profile.').replace('{email}', `<b>${escapeHtml(email)}</b>`)}</p>
      <div class="account-profiles">
        ${this.card(theirs, tr('Google account'))}
        ${mine ? this.card(summaryOf(mine), tr('This device')) : ''}
      </div>
      <p class="code-hint account-note">${tr('Merge: both collections in one. Switch: play the account’s, this one keeps its code.')}</p>
      <div class="row account-row">
        <button type="button" class="big account-use" data-id="${escapeHtml(theirs.id)}"><span>${tr('Switch')}</span></button>
        <button type="button" class="big primary account-merge"><span>${tr('Merge')}</span></button>
      </div>`;
  }

  /** A profile at a glance: its head, where it is, and how far its collection has got. */
  /** What dims while the server answers: on the Profil card the whole top (the account's rows sit
   *  in it, see .profile-top), else the account part itself. */
  private get area(): HTMLElement {
    return this.el.closest<HTMLElement>('.profile-top') ?? this.el;
  }

  private card(p: ProfileSummary, where: string): string {
    return `<div class="account-profile">
      ${partIcon('head', p.look.head.animal, 'icon large')}
      <span><small>${where}</small>${tr('Parts')} <b>${p.parts}</b> · ${tr('Sets')} <b>${p.sets}</b> · ${icon('button')}<b>${p.buttons}</b></span>
    </div>`;
  }

  private async link(): Promise<void> {
    const result = await whileBusy(this.area, this.store.accountLink(this.credential));
    if (result === 'elsewhere') this.say(tr('This profile belongs to another account.'));
    if (result === 'taken') return void this.signedIn(this.credential);
    else if (result === 'failed') this.say(tr("Couldn't sign in. Try again."));
    this.render();
  }

  private async clicked(e: Event): Promise<void> {
    const target = e.target as HTMLElement;
    const use = target.closest<HTMLElement>('.account-use');
    if (use) {
      if (await whileBusy(this.area, this.store.accountUse(this.credential, use.dataset.id!))) this.onSwitched();
      else this.say(tr("Couldn't sign in. Try again."));
      return;
    }
    if (target.closest('.account-merge')) {
      if (await whileBusy(this.area, this.store.accountMerge(this.credential))) {
        this.say(tr('Merged!'));
        this.onSwitched();
      } else this.say(tr("Couldn't sign in. Try again."));
      return;
    }
    if (target.closest('.account-unlink')) {
      await whileBusy(this.area, this.store.accountUnlink());
      // (The whole card again: unlinked, its code shows, and works, once more.)
      return this.onSwitched();
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
    if (await whileBusy(this.area, this.store.accountDelete(this.credential))) {
      this.say(tr('The account is deleted.'));
      this.onSwitched();
    } else {
      this.say(tr("Couldn't sign in. Try again."));
      this.render();
    }
  }
}

/** The same summary the server gives an account's profile (see accounts.ts summaryOf). */
function summaryOf(p: Profile): ProfileSummary {
  const plain = p.parts.filter((x) => !x.holo);
  return { id: p.id, look: p.look, parts: new Set(plain.map((x) => `${x.slot}:${x.animal}`)).size, sets: completeSets(plain).length, buttons: p.buttons };
}
