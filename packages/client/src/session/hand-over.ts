// Moving to the game's own address (VITE_CANONICAL_ORIGIN, set by the deploy): a browser keeps
// what it stores per address, so the old one sends each device over with a one-time code for its
// profile and settings, and the new one swaps it for a token of its own (see ProfileStore.load).
// Until the variable is set (and in local development without it) nothing moves.
import { serverHost } from './room-client.ts';

const CANONICAL = ((import.meta.env.VITE_CANONICAL_ORIGIN as string | undefined) ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'stuffed.profile';

/** The game's settings stored on this device (not its token: the new address gets its own). */
function localPrefs(): Record<string, string> {
  const prefs: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('stuffed.') && key !== TOKEN_KEY) prefs[key] = localStorage.getItem(key) ?? '';
    }
  } catch {
    // storage blocked: nothing to carry
  }
  return prefs;
}

/**
 * On an old address: sends this device to the game's own one (its profile and settings with it)
 * and returns true (the page is leaving). Elsewhere, or if the hand-over can't be made (offline):
 * false, and the game carries on here.
 */
export async function leaveForNewAddress(): Promise<boolean> {
  if (!CANONICAL || location.origin === CANONICAL) return false;
  const target = new URL(location.pathname + location.search, CANONICAL);
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    // no storage: nothing to hand over
  }
  if (token) {
    try {
      const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
      const res = await fetch(`${protocol}//${serverHost()}/api/profile/transfer`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prefs: localPrefs() }),
      });
      if (!res.ok) return false;
      target.searchParams.set('transfer', ((await res.json()) as { code: string }).code);
    } catch {
      return false;
    }
  }
  location.replace(target.toString());
  return true;
}
