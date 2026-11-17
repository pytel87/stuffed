// Worker entry: creates rooms, routes game sockets to the room's Durable Object, and serves
// the profile API (/api/profile...).
import { rollKeeps } from '@stuffed/sim';
import { generateRoomCode, parseRoomCode } from '@stuffed/sim/net';
import { getServerByName, routePartykitRequest } from 'partyserver';
import { addParts, createProfile, loadProfile, parseLook, parseParts, profileIdForToken, recoverProfile, setLook } from './profiles.ts';
import type { Room } from './room.ts';

export { Room } from './room.ts';

/**
 * Where new rooms live. A Durable Object is placed near whoever first contacts it and never
 * moves; ask for Western Europe so rooms sit near the players.
 */
const ROOM_LOCATION: DurableObjectLocationHint = 'weur';

/** The Worker's own pages are always allowed; other sites only if listed in ALLOWED_ORIGINS. */
function originAllowed(req: Request, env: Env): boolean {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  const origin = req.headers.get('origin');
  return !!origin && (origin === new URL(req.url).origin || allowed.includes(origin));
}

function cors(req: Request, env: Env, res: Response): Response {
  const origin = req.headers.get('origin');
  if (origin && originAllowed(req, env)) {
    res.headers.set('access-control-allow-origin', origin);
    res.headers.set('vary', 'origin');
  }
  return res;
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

/** The most parts one plush can carry home: five worn plus the stash. */
const MAX_CARRIED = 6;

/**
 * Profiles (all JSON; the device's token goes in `authorization: Bearer ...`):
 * POST /api/profile → new profile and its token · GET /api/profile → yours ·
 * PUT /api/profile/look {look} · POST /api/profile/recover {code} → a token for this device ·
 * POST /api/profile/solo {parts, won} → keep rolls for a solo match, saved; returns what was kept.
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

  if (path === '/api/profile' && req.method === 'POST') return json(await createProfile(env.DB));
  if (path === '/api/profile/recover' && req.method === 'POST') {
    const found = await recoverProfile(env.DB, String((await body()).code ?? ''));
    return found ? json(found) : json({ error: 'unknown_code' }, 404);
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const id = await profileIdForToken(env.DB, token);
  if (!id) return json({ error: 'no_profile' }, 401);

  if (path === '/api/profile' && req.method === 'GET') return json({ profile: await loadProfile(env.DB, id) });
  if (path === '/api/profile/look' && req.method === 'PUT') {
    const look = parseLook((await body()).look);
    const profile = look && (await setLook(env.DB, id, look));
    return profile ? json({ profile }) : json({ error: 'not_owned' }, 400);
  }
  if (path === '/api/profile/solo' && req.method === 'POST') {
    const b = await body();
    const parts = parseParts(b.parts, MAX_CARRIED);
    if (!parts) return json({ error: 'bad_parts' }, 400);
    const kept = rollKeeps(parts, b.won === true, Math.random);
    await addParts(env.DB, id, kept);
    return json({ kept, profile: await loadProfile(env.DB, id) });
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
      return cors(req, env, await profileApi(req, env, url.pathname));
    }
    if (url.pathname === '/create' && req.method === 'POST') {
      if (!originAllowed(req, env)) return new Response('forbidden origin', { status: 403 });
      return cors(req, env, await createRoom(env));
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
