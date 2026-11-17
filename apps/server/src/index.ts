// Worker entry: creates rooms and routes game sockets to the room's Durable Object.
import { generateRoomCode, parseRoomCode } from '@stuffed/sim/net';
import { getServerByName, routePartykitRequest } from 'partyserver';
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return cors(req, env, new Response(null, { headers: { 'access-control-allow-methods': 'POST', 'access-control-max-age': '86400' } }));
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
