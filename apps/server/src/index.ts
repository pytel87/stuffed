// Worker entry: creates rooms, routes game sockets to the room's Durable Object, and serves
// the profile API (/api/profile...).
import { generateRoomCode, parseRoomCode } from '@stuffed/sim/net';
import { getServerByName, routePartykitRequest } from 'partyserver';
import { ANIMALS } from '@stuffed/sim';
import type { Animal } from '@stuffed/sim';
import { accountFor, accountProfiles, deleteAccount, linkProfile, mergeIntoAccount, unlinkProfile, useProfile } from './accounts.ts';
import { verifyGoogleToken } from './google.ts';
import { buySet, claimTransfer, createProfile, startTransfer, loadProfile, parseLook, profileIdForToken, recoverProfile, setLook } from './profiles.ts';
import type { Room } from './room.ts';

export { Room } from './room.ts';
export { Matchmaker } from './matchmaker.ts';

/**
 * Where new rooms live. A Durable Object is placed near whoever first contacts it and never
 * moves; ask for Western Europe so rooms sit near the players.
 */
const ROOM_LOCATION: DurableObjectLocationHint = 'weur';

/**
 * The Worker's own pages are always allowed; other sites only if listed in ALLOWED_ORIGINS. A
 * request without an Origin header is the game's own (browsers leave it off same-site GETs, a
 * returning player's profile load among them) or not from a browser at all: other sites' pages
 * always send theirs. Unless the browser itself says it came from another site.
 */
function originAllowed(req: Request, env: Env): boolean {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site';
  return origin === new URL(req.url).origin || allowed.includes(origin);
}

function cors(req: Request, env: Env, res: Response): Response {
  const origin = req.headers.get('origin');
  if (origin && originAllowed(req, env)) {
    res.headers.set('access-control-allow-origin', origin);
    res.headers.set('vary', 'origin');
  }
  return res;
}

/**
 * Whether this address is still under `limit` (see wrangler.jsonc's ratelimits). Without an
 * address (local tools), always.
 */
async function underLimit(req: Request, limit: RateLimit): Promise<boolean> {
  const key = req.headers.get('cf-connecting-ip');
  if (!key) return true;
  return (await limit.limit({ key })).success;
}

const tooMany = () => Response.json({ error: 'too_many' }, { status: 429 });

/** How long error reports are kept. */
const ERRORS_KEPT_MS = 30 * 86_400_000;

/**
 * Keeps one error report (from a player's device, or the server's own), trimmed to size, and
 * writes it to the Worker's logs too. Old ones go as new ones come.
 */
async function keepError(env: Env, e: { kind: string; message: string; detail?: unknown; build?: unknown; page?: unknown; agent?: string }): Promise<void> {
  const cut = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');
  const row = { kind: cut(e.kind, 30) || 'error', message: cut(e.message, 300) || '?', detail: cut(e.detail, 2000), build: cut(e.build, 40), page: cut(e.page, 200), agent: cut(e.agent, 200) };
  console.error('reported error', row);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO errors (at, kind, message, detail, build, page, agent) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(now, row.kind, row.message, row.detail, row.build, row.page, row.agent),
    env.DB.prepare('DELETE FROM errors WHERE at < ?').bind(now - ERRORS_KEPT_MS),
  ]);
}

/**
 * POST /solo {level, mapId}: a room for one player against bots, which starts as soon as they're in.
 * Solo matches are played here, like online ones, so what they earn can't be made up.
 */
async function soloRoom(env: Env, level: unknown, mapId: unknown): Promise<Response> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateRoomCode(Math.random);
    const stub = await getServerByName<Env, Room>(env.Room, code, { locationHint: ROOM_LOCATION });
    if (await stub.claimSolo(String(level ?? ''), String(mapId ?? ''))) return Response.json({ code });
  }
  return Response.json({ error: 'no_free_code' }, { status: 503 });
}

/** POST /public: the code of a public room to join (see matchmaker.ts). */
async function publicRoom(env: Env): Promise<Response> {
  try {
    return Response.json({ code: await env.Matchmaker.get(env.Matchmaker.idFromName('global')).find() });
  } catch {
    return Response.json({ error: 'no_free_code' }, { status: 503 });
  }
}

/** POST /create: picks a free room code and claims it. */
async function createRoom(env: Env): Promise<Response> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateRoomCode(Math.random);
    const stub = await getServerByName<Env, Room>(env.Room, code, { locationHint: ROOM_LOCATION });
    if (await stub.claim()) return Response.json({ code });
  }
  return Response.json({ error: 'no_free_code' }, { status: 503 });
}


/**
 * Profiles (all JSON; the device's token goes in `authorization: Bearer ...`):
 * POST /api/profile → new profile and its token · GET /api/profile → yours ·
 * PUT /api/profile/look {look} · POST /api/profile/recover {code} → a token for this device ·
 * POST /api/profile/transfer {prefs} → a one-time code to take this profile to the game's new
 * address · POST /api/profile/claim {code} → a token for it there, and the settings · POST
 * /api/report {kind, message, detail, build, page} → an error from a player's device, kept ·
 * POST /api/shop/buy {animal, holo, requestId} → the parts missing from that set, for Buttons ·
 * accounts, each with {credential} (Google's ID token): POST /api/account/signin → the account's
 * profile (one per account) · /api/account/link → this device's profile becomes it, if it has none · /api/account/use {profileId} →
 * a token for one of them here · /api/account/merge → this device's profile merged into the account's · /api/account/delete → the account and its profiles, gone ·
 * POST /api/profile/unlink → this profile leaves its account.
 */
async function profileApi(req: Request, env: Env, path: string): Promise<Response> {
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const body = async (): Promise<Record<string, unknown>> => {
    try {
      const value: unknown = await req.json();
      return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };

  // (Creating things and reporting results, limited per address; reading isn't.)
  if (req.method !== 'GET' && !(await underLimit(req, path === '/api/profile' ? env.LIMIT_PROFILES : env.LIMIT_WRITES))) return tooMany();
  if (path === '/api/report' && req.method === 'POST') {
    const b = await body();
    await keepError(env, { kind: String(b.kind ?? ''), message: String(b.message ?? ''), detail: b.detail, build: b.build, page: b.page, agent: req.headers.get('user-agent') ?? '' });
    return json({ ok: true });
  }
  if (path === '/api/profile' && req.method === 'POST') return json(await createProfile(env.DB));
  if (path === '/api/profile/claim' && req.method === 'POST') {
    const found = await claimTransfer(env.DB, String((await body()).code ?? ''));
    return found ? json(found) : json({ error: 'unknown_code' }, 404);
  }
  if (path === '/api/profile/recover' && req.method === 'POST') {
    const found = await recoverProfile(env.DB, String((await body()).code ?? ''));
    if (found === 'linked') return json({ error: 'linked' }, 403);
    return found ? json(found) : json({ error: 'unknown_code' }, 404);
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  // Accounts (Sign in with Google): each call carries Google's ID token, checked here.
  if (path.startsWith('/api/account/') && req.method === 'POST') {
    if (!env.GOOGLE_CLIENT_ID) return json({ error: 'accounts_off' }, 503);
    const b = await body();
    const who = await verifyGoogleToken(String(b.credential ?? ''), env.GOOGLE_CLIENT_ID);
    if (!who) return json({ error: 'bad_credential' }, 401);
    const account = await accountFor(env.DB, who);
    const current = await profileIdForToken(env.DB, token);
    if (path === '/api/account/signin') {
      // The account's profiles, and whether this device's is one of them.
      return json({ account: { email: account.email }, profiles: await accountProfiles(env.DB, account.id), current });
    }
    if (path === '/api/account/link') {
      if (!current) return json({ error: 'no_profile' }, 401);
      const linked = await linkProfile(env.DB, current, account.id);
      if (linked === 'elsewhere') return json({ error: 'linked_elsewhere' }, 409);
      if (linked === 'taken') return json({ error: 'account_has_profile' }, 409);
      return json({ profile: await loadProfile(env.DB, current) });
    }
    if (path === '/api/account/merge') {
      if (!current) return json({ error: 'no_profile' }, 401);
      const merged = await mergeIntoAccount(env.DB, account.id, current);
      return merged ? json({ profile: merged }) : json({ error: 'nothing_to_merge' }, 409);
    }
    if (path === '/api/account/use') {
      const used = await useProfile(env.DB, account.id, String(b.profileId ?? ''));
      return used ? json(used) : json({ error: 'not_yours' }, 403);
    }
    if (path === '/api/account/delete') {
      await deleteAccount(env.DB, account.id);
      return json({ ok: true });
    }
    return json({ error: 'not_found' }, 404);
  }

  const id = await profileIdForToken(env.DB, token);
  if (!id) return json({ error: 'no_profile' }, 401);
  if (path === '/api/profile/unlink' && req.method === 'POST') {
    await unlinkProfile(env.DB, id);
    return json({ profile: await loadProfile(env.DB, id) });
  }

  if (path === '/api/profile' && req.method === 'GET') return json({ profile: await loadProfile(env.DB, id) });
  if (path === '/api/profile/transfer' && req.method === 'POST') {
    // The device's settings: a few short strings under the game's own keys.
    const raw = (await body()).prefs;
    const prefs: Record<string, string> = {};
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
        // (Never the device's token: the new address gets its own.)
        if (/^stuffed\.[\w.-]{1,30}$/.test(k) && k !== 'stuffed.profile' && typeof v === 'string' && v.length <= 200) prefs[k] = v;
      }
    }
    return json({ code: await startTransfer(env.DB, id, prefs) });
  }
  if (path === '/api/profile/look' && req.method === 'PUT') {
    const look = parseLook((await body()).look);
    const profile = look && (await setLook(env.DB, id, look));
    return profile ? json({ profile }) : json({ error: 'not_owned' }, 400);
  }
  // Solo results used to be reported by the browser; solo matches are played here now (/solo).
  if (path === '/api/profile/solo') return json({ error: 'gone' }, 410);
  if (path === '/api/shop/buy' && req.method === 'POST') {
    const b = await body();
    const animal = b.animal as Animal;
    const requestId = typeof b.requestId === 'string' && /^[\w-]{6,64}$/.test(b.requestId) ? b.requestId : null;
    if (!ANIMALS.includes(animal) || !requestId) return json({ error: 'bad_request' }, 400);
    const result = await buySet(env.DB, id, animal, b.holo === true, requestId);
    return 'error' in result ? json(result, result.error === 'too_few_buttons' ? 402 : 400) : json(result);
  }
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return cors(
        req,
        env,
        new Response(null, {
          headers: {
            'access-control-allow-methods': 'GET, POST, PUT',
            'access-control-allow-headers': 'authorization, content-type',
            'access-control-max-age': '86400',
          },
        }),
      );
    }
    if (url.pathname.startsWith('/api/')) {
      if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403 });
      try {
        return cors(req, env, await profileApi(req, env, url.pathname));
      } catch (err) {
        // Kept like the players' reports, so `pnpm errors` shows the server's failures too.
        await keepError(env, { kind: 'server', message: `${req.method} ${url.pathname}: ${err instanceof Error ? err.message : String(err)}`, detail: err instanceof Error ? (err.stack ?? '') : '' }).catch(() => {});
        return cors(req, env, Response.json({ error: 'server' }, { status: 500 }));
      }
    }
    if (url.pathname === '/create' && req.method === 'POST') {
      if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403 });
      if (!(await underLimit(req, env.LIMIT_ROOMS))) return cors(req, env, tooMany());
      return cors(req, env, await createRoom(env));
    }
    if (url.pathname === '/solo' && req.method === 'POST') {
      if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403 });
      if (!(await underLimit(req, env.LIMIT_ROOMS))) return cors(req, env, tooMany());
      let b: Record<string, unknown> = {};
      try {
        b = ((await req.json()) as Record<string, unknown>) ?? {};
      } catch {
        // defaults
      }
      return cors(req, env, await soloRoom(env, b.level, b.mapId));
    }
    if (url.pathname === '/public' && req.method === 'POST') {
      if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403 });
      if (!(await underLimit(req, env.LIMIT_ROOMS))) return cors(req, env, tooMany());
      return cors(req, env, await publicRoom(env));
    }
    if (url.pathname === '/health') return new Response('ok');

    const response = await routePartykitRequest(req, env, {
      locationHint: ROOM_LOCATION,
      onBeforeConnect: (r, lobby) => {
        if (!parseRoomCode(lobby.name)) return new Response('bad room code', { status: 400 });
        if (!originAllowed(r, env)) return new Response('forbidden origin', { status: 403 });
      },
      onBeforeRequest: () => new Response('not found', { status: 404 }),
    });
    return response ?? new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
