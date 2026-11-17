// This device's profile on the game server: created on first visit, remembered by a token in
// localStorage. Holds the collection and the look you start matches in. Everything here is
// optional: without a server (offline solo play) the game works, just without keeping parts.
import type { Part } from '@stuffed/sim';
import type { Look, Profile } from '@stuffed/sim/net';
import { serverHost } from './room-client.ts';

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

export class ProfileStore {
  profile: Profile | null = null;
  /** Called whenever the profile changes (loaded, look changed, parts kept). */
  onChange: () => void = () => {};
  private token: string | null = readToken();

  /** The token rooms use to find your profile, if you have one. */
  get roomToken(): string | null {
    return this.profile ? this.token : null;
  }

  /** Loads this device's profile, creating one on the first visit. Quietly gives up offline. */
  async load(): Promise<void> {
    try {
      if (this.token) {
        const res = await this.call('GET', '/api/profile');
        if (res.ok) return this.set(((await res.json()) as { profile: Profile }).profile);
        if (res.status !== 401) return;
      }
      await this.adopt(await this.call('POST', '/api/profile'));
    } catch (err) {
      console.warn('No profile (offline?)', err);
    }
  }

  /** Puts on a look built from owned parts. */
  async setLook(look: Look): Promise<boolean> {
    if (!this.profile) return false;
    const res = await this.call('PUT', '/api/profile/look', { look });
    if (!res.ok) return false;
    this.set(((await res.json()) as { profile: Profile }).profile);
    return true;
  }

  /** Switches this device to the profile with that recovery code. */
  async recover(code: string): Promise<boolean> {
    const res = await this.call('POST', '/api/profile/recover', { code });
    if (!res.ok) return false;
    await this.adopt(res);
    return true;
  }

  /** A solo match ended for you: roll which carried parts you keep. Returns the kept ones. */
  async soloResult(parts: Part[], won: boolean): Promise<Part[]> {
    if (!this.profile) return [];
    try {
      const res = await this.call('POST', '/api/profile/solo', { parts, won });
      if (!res.ok) return [];
      const { kept, profile } = (await res.json()) as { kept: Part[]; profile: Profile };
      this.set(profile);
      return kept;
    } catch {
      return [];
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
