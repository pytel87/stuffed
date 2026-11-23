// This device's profile on the game server: created on first visit, remembered by a token in
// localStorage. Holds the collection and the look you start matches in. Everything here is
// optional: without a server (offline solo play) the game works, just without keeping parts.
import type { Animal } from '@stuffed/sim';
import type { Look, Profile, ProfileSummary } from '@stuffed/sim/net';
import { serverHost } from './room-client.ts';
import { reportError } from './report.ts';

const TOKEN_KEY = 'stuffed.profile';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // not remembered: a new profile next visit
  }
}

/**
 * The ?transfer= code, taken out of the address as soon as the page starts (before anything else
 * rewrites it, an invite link's room for one), so a reload or a shared link won't try it again.
 */
function takeTransferCode(): string | null {
  const url = new URL(location.href);
  const code = url.searchParams.get('transfer');
  if (!code) return null;
  url.searchParams.delete('transfer');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return code;
}

export class ProfileStore {
  profile: Profile | null = null;
  /** Called whenever the profile changes (loaded, look changed, parts kept). */
  onChange: () => void = () => {};
  private token: string | null = readToken();
  /** Arrived from the game's old address with a code for this device's profile (see hand-over.ts). */
  private readonly transferCode = takeTransferCode();

  /** The token rooms use to find your profile, if you have one. */
  get roomToken(): string | null {
    return this.profile ? this.token : null;
  }

  /**
   * Loads this device's profile, creating one on the first visit. Quietly gives up offline. Arrived
   * from the game's old address (?transfer=code, see hand-over.ts): takes that profile and the
   * settings along, then reloads so everything starts with them.
   */
  async load(): Promise<void> {
    try {
      if (await this.claimTransfer()) return;
      if (this.token) {
        const res = await this.call('GET', '/api/profile');
        if (res.ok) return this.set(((await res.json()) as { profile: Profile }).profile);
        if (res.status !== 401) return reportError('profile', `GET /api/profile ${res.status}`);
      }
      const made = await this.call('POST', '/api/profile');
      if (!made.ok) reportError('profile', `POST /api/profile ${made.status}`);
      await this.adopt(made);
    } catch (err) {
      console.warn('No profile (offline?)', err);
    }
  }

  /** Swaps a transfer code from the address for this device's own token (and settings). */
  private async claimTransfer(): Promise<boolean> {
    const code = this.transferCode;
    if (!code) return false;
    const res = await this.call('POST', '/api/profile/claim', { code });
    if (!res.ok) {
      reportError('transfer', `claim ${res.status}`);
      return false;
    }
    const { token, prefs } = (await res.json()) as { token: string; prefs: Record<string, string> };
    try {
      for (const [key, value] of Object.entries(prefs)) if (key.startsWith('stuffed.') && key !== TOKEN_KEY) localStorage.setItem(key, value);
    } catch {
      // settings not kept; the profile still is
    }
    saveToken(token);
    location.reload();
    return true;
  }

  /** Puts on a look built from owned parts. */
  async setLook(look: Look): Promise<boolean> {
    if (!this.profile) return false;
    const res = await this.call('PUT', '/api/profile/look', { look });
    if (!res.ok) return false;
    this.set(((await res.json()) as { profile: Profile }).profile);
    return true;
  }

  // ---------- accounts (Sign in with Google; `credential` is Google's ID token) ----------

  /** The account's profiles, and whether this device's is one of them. Null if it didn't work. */
  async accountSignin(credential: string): Promise<{ email: string; profiles: ProfileSummary[]; current: string | null } | null> {
    const res = await this.call('POST', '/api/account/signin', { credential });
    if (!res.ok) {
      reportError('account', `signin ${res.status}`);
      return null;
    }
    const { account, profiles, current } = (await res.json()) as { account: { email: string }; profiles: ProfileSummary[]; current: string | null };
    return { email: account.email, profiles, current };
  }

  /** This device's profile joins the account. 'elsewhere': it's another account's already. */
  async accountLink(credential: string): Promise<'ok' | 'elsewhere' | 'failed'> {
    const res = await this.call('POST', '/api/account/link', { credential });
    if (res.status === 409) return 'elsewhere';
    if (!res.ok) {
      reportError('account', `link ${res.status}`);
      return 'failed';
    }
    this.set(((await res.json()) as { profile: Profile }).profile);
    return 'ok';
  }

  /** Plays one of the account's profiles on this device from now on. */
  async accountUse(credential: string, profileId: string): Promise<boolean> {
    const res = await this.call('POST', '/api/account/use', { credential, profileId });
    if (!res.ok) {
      reportError('account', `use ${res.status}`);
      return false;
    }
    await this.adopt(res);
    return true;
  }

  /** This profile leaves its account. */
  async accountUnlink(): Promise<boolean> {
    const res = await this.call('POST', '/api/profile/unlink');
    if (!res.ok) return false;
    this.set(((await res.json()) as { profile: Profile }).profile);
    return true;
  }

  /** Deletes the account and all its profiles; this device starts afresh if its profile was one. */
  async accountDelete(credential: string): Promise<boolean> {
    const res = await this.call('POST', '/api/account/delete', { credential });
    if (!res.ok) {
      reportError('account', `delete ${res.status}`);
      return false;
    }
    if (this.profile?.account) {
      this.token = null;
      this.profile = null;
      await this.load();
    }
    return true;
  }

  /** Switches this device to the profile with that recovery code. */
  async recover(code: string): Promise<boolean> {
    const res = await this.call('POST', '/api/profile/recover', { code });
    if (!res.ok) return false;
    await this.adopt(res);
    return true;
  }

  /** An online match's Buttons came in: the new balance. */
  setButtons(balance: number): void {
    if (!this.profile) return;
    this.set({ ...this.profile, buttons: balance });
  }

  /**
   * Buys the parts missing from an animal's set (or holo set) with Buttons. 'ok', or why not.
   * (One request id per purchase: retried, it still counts once.)
   */
  async buySet(animal: Animal, holo: boolean): Promise<'ok' | 'too_few' | 'failed'> {
    if (!this.profile) return 'failed';
    try {
      const res = await this.call('POST', '/api/shop/buy', { animal, holo, requestId: crypto.randomUUID() });
      if (res.status === 402) return 'too_few';
      if (!res.ok) {
        reportError('shop', `POST /api/shop/buy ${res.status}`);
        return 'failed';
      }
      this.set(((await res.json()) as { profile: Profile }).profile);
      return 'ok';
    } catch {
      return 'failed';
    }
  }

  /** Reload after parts were added elsewhere (an online match). */
  async refresh(): Promise<void> {
    if (!this.profile) return;
    try {
      const res = await this.call('GET', '/api/profile');
      if (res.ok) this.set(((await res.json()) as { profile: Profile }).profile);
    } catch {
      // keep what we have
    }
  }

  private async adopt(res: Response): Promise<void> {
    if (!res.ok) return;
    const { token, profile } = (await res.json()) as { token: string; profile: Profile };
    this.token = token;
    saveToken(token);
    this.set(profile);
  }

  private set(profile: Profile): void {
    this.profile = profile;
    this.onChange();
  }

  private call(method: string, path: string, body?: unknown): Promise<Response> {
    const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
    const headers: Record<string, string> = {};
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${protocol}//${serverHost()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
}
