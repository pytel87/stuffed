// Connection to a room on the game server: lobby state, starting matches, and feeding the
// current NetworkMatch with snapshots. Reconnects by itself; a per-room token gets your seat back.
import PartySocket from 'partysocket';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '@stuffed/sim/net';
import type { BotLevel, ButtonAward, Input, Part } from '@stuffed/sim';
import { NetworkMatch } from './network-match.ts';
import type { InputSource } from './session.ts';

export type LobbyState = Extract<ServerMessage, { t: 'lobby' }>;

/**
 * Game server host: VITE_SERVER_HOST if set; in development the local `wrangler dev` on port
 * 1999; in production the same host that served the page (the Worker serves both).
 */
export function serverHost(): string {
  const configured = import.meta.env.VITE_SERVER_HOST as string | undefined;
  if (configured) return configured;
  return import.meta.env.DEV ? `${location.hostname}:1999` : location.host;
}

/** Asks the server for a fresh room code. */
export async function createRoom(): Promise<string> {
  const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
  const res = await fetch(`${protocol}//${serverHost()}/create`, { method: 'POST' });
  if (!res.ok) throw new Error(`Could not create a room (${res.status})`);
  const { code } = (await res.json()) as { code: string };
  return code;
}

/** Asks the server for a solo match (played there, so what it earns counts): its room's code. */
export async function createSoloRoom(level: string, mapId: string): Promise<string> {
  const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
  const res = await fetch(`${protocol}//${serverHost()}/solo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ level, mapId }) });
  if (!res.ok) throw new Error(`Could not start a solo match (${res.status})`);
  const { code } = (await res.json()) as { code: string };
  return code;
}

/** Asks the server for a public room to join ("Play online"; see the server's matchmaker). */
export async function findPublicRoom(): Promise<string> {
  const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
  const res = await fetch(`${protocol}//${serverHost()}/public`, { method: 'POST' });
  if (!res.ok) throw new Error(`Could not find a match (${res.status})`);
  const { code } = (await res.json()) as { code: string };
  return code;
}

/**
 * Identifies your seat in a room across reconnects and reloads. Per tab (sessionStorage), so two
 * tabs in one browser are two players.
 */
function seatToken(code: string): string {
  const key = `stuffed.token.${code}`;
  try {
    let token = sessionStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem(key, token);
    }
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

export class RoomClient {
  seat: number | null = null;
  lobby: LobbyState | null = null;
  match: NetworkMatch | null = null;
  status: 'connecting' | 'open' | 'closed' = 'connecting';
  error: string | null = null;
  onLobby: () => void = () => {};
  onMatch: (match: NetworkMatch) => void = () => {};
  /** After a match: the parts that went into your collection. */
  onKept: (parts: Part[]) => void = () => {};
  /** This match's Buttons, and the balance after them. */
  onButtons: (award: ButtonAward, balance: number) => void = () => {};
  /** The host took everyone back to the lobby after a match. */
  onBackToLobby: () => void = () => {};
  private readonly socket: PartySocket;

  /**
   * `lagMs` fakes a round trip of that many milliseconds (half each way), to try prediction
   * and interpolation on localhost.
   */
  constructor(
    readonly code: string,
    private name: string,
    private readonly input: InputSource,
    private readonly lagMs = 0,
    /** Your profile token, so the room starts you in your look and saves the parts you keep. */
    private readonly profileToken: string | null = null,
  ) {
    this.socket = new PartySocket({
      host: serverHost(),
      party: 'room',
      room: code,
      maxRetries: Infinity,
      minReconnectionDelay: 500,
      maxReconnectionDelay: 5000,
    });
    this.socket.addEventListener('open', () => {
      this.status = 'open';
      this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, token: seatToken(code), ...(this.profileToken ? { profile: this.profileToken } : {}) });
    });
    this.socket.addEventListener('close', () => {
      this.status = 'closed';
      this.onLobby();
    });
    this.socket.addEventListener('message', (e: MessageEvent) => {
      const msg = JSON.parse(String(e.data)) as ServerMessage;
      if (this.lagMs > 0) setTimeout(() => this.receive(msg), this.lagMs / 2);
      else this.receive(msg);
    });
  }

  /** A solo match played on the server: no lobby, one match. */
  get isSolo(): boolean {
    return this.lobby?.solo === true;
  }

  /** A matchmade room: no host, it starts by itself. */
  get isPublic(): boolean {
    return this.lobby?.public === true;
  }

  get isHost(): boolean {
    return !!this.lobby?.seats.some((s) => s.seat === this.seat && s.host);
  }

  start(bots: number, teams = false, level: BotLevel = 'normal', mapId?: string): void {
    this.send({ t: 'start', bots, teams, level, ...(mapId ? { mapId } : {}) });
  }

  /** Host, after a match: take everyone back to the lobby. */
  toLobby(): void {
    this.send({ t: 'lobby' });
  }

  /** Your look changed in the Wardrobe: the next match starts you in it. */
  lookChanged(): void {
    this.send({ t: 'look' });
  }

  rename(name: string): void {
    this.name = name;
    this.send({ t: 'rename', name });
  }

  /** Leave the room for good (no reconnect). */
  close(): void {
    this.onLobby = () => {};
    this.onMatch = () => {};
    this.onKept = () => {};
    this.onButtons = () => {};
    this.onBackToLobby = () => {};
    this.socket.close();
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.seat = msg.seat;
        break;
      case 'lobby':
        this.lobby = msg;
        // The host took everyone back to the lobby: the match is over for good.
        if (msg.phase === 'lobby' && this.match) {
          this.match = null;
          this.onBackToLobby();
        }
        this.onLobby();
        break;
      case 'start':
        this.match = new NetworkMatch(msg.you, this.input, (i: Input) => this.send({ t: 'input', i }), msg.mapId);
        this.onMatch(this.match);
        break;
      case 'snap':
        this.match?.receiveCompact(msg);
        break;
      case 'error':
        this.error = msg.code;
        this.onLobby();
        break;
      case 'kept':
        this.onKept(msg.parts);
        break;
      case 'buttons':
        this.onButtons(msg.award, msg.balance);
        break;
      case 'pong':
        break;
    }
  }

  private send(msg: ClientMessage): void {
    const data = JSON.stringify(msg);
    const go = () => {
      if (this.socket.readyState === WebSocket.OPEN) this.socket.send(data);
    };
    if (this.lagMs > 0) setTimeout(go, this.lagMs / 2);
    else go();
  }
}
