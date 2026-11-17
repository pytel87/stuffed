// Connection to a room on the game server: lobby state, starting matches, and feeding the
// current NetworkMatch with snapshots. Reconnects by itself; a per-room token gets your seat back.
import PartySocket from 'partysocket';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '@stuffed/sim/net';
import type { Input } from '@stuffed/sim';
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
      this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, token: seatToken(code) });
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

  get isHost(): boolean {
    return !!this.lobby?.seats.some((s) => s.seat === this.seat && s.host);
  }

  start(bots: number): void {
    this.send({ t: 'start', bots });
  }

  rename(name: string): void {
    this.name = name;
    this.send({ t: 'rename', name });
  }

  /** Leave the room for good (no reconnect). */
  close(): void {
    this.onLobby = () => {};
    this.onMatch = () => {};
    this.socket.close();
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.seat = msg.seat;
        break;
      case 'lobby':
        this.lobby = msg;
        this.onLobby();
        break;
      case 'start':
        this.match = new NetworkMatch(msg.you, this.input, (i: Input) => this.send({ t: 'input', i }));
        this.onMatch(this.match);
        break;
      case 'snap':
        this.match?.receiveCompact(msg);
        break;
      case 'error':
        this.error = msg.code;
        this.onLobby();
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
