// Sign in with Google: the page gets an ID token (a JWT Google signed) from Google's own button, and
// sends it here. It's checked like any JWT: Google's RS256 signature (with its published keys), that
// it's for this game (the client ID), from Google, and not expired. Then its `sub` is the account.

/** What a valid token tells us. */
export interface GoogleIdentity {
  /** Google's ID for the account: stable, never reused. */
  sub: string;
  email: string;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

const CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
/** A little slack for clocks that disagree. */
const SKEW_S = 60;

let cached: { keys: Jwk[]; until: number } | null = null;

/** Google's current signing keys (kept as long as Google says they may be). */
export async function googleKeys(): Promise<Jwk[]> {
  if (cached && cached.until > Date.now()) return cached.keys;
  const res = await fetch(CERTS);
  if (!res.ok) throw new Error(`google certs ${res.status}`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  cached = { keys, until: Date.now() + Math.min(maxAge, 86_400) * 1000 };
  return keys;
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function decodePart(s: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(s))) as Record<string, unknown>;
}

/**
 * The identity in a Google ID token, or null if it isn't a valid one for `clientId`. `keys` (and
 * `now`, in seconds) can be given, for tests.
 */
export async function verifyGoogleToken(
  token: string,
  clientId: string,
  keys?: Jwk[],
  now = Math.floor(Date.now() / 1000),
): Promise<GoogleIdentity | null> {
  if (!clientId || typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = decodePart(parts[0]!);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    const jwk = (keys ?? (await googleKeys())).find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64Url(parts[2]!), signed))) return null;
    const p = decodePart(parts[1]!);
    if (!ISSUERS.includes(String(p.iss))) return null;
    // `aud` is our client ID (a string, or a list holding it).
    const aud = Array.isArray(p.aud) ? p.aud : [p.aud];
    if (!aud.includes(clientId)) return null;
    if (typeof p.exp !== 'number' || p.exp + SKEW_S < now) return null;
    if (typeof p.iat === 'number' && p.iat - SKEW_S > now) return null;
    if (typeof p.sub !== 'string' || !p.sub) return null;
    return { sub: p.sub, email: typeof p.email === 'string' && p.email_verified !== false ? p.email : '' };
  } catch {
    return null;
  }
}
