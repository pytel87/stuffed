// Connection to a room on the game server: lobby state, starting matches, and feeding the
// current NetworkMatch with snapshots. Reconnects by itself; a per-room token gets your seat back.
import PartySocket from 'partysocket';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '@stuffed/sim/net';
import type { Input } from '@stuffed/sim';
import { NetworkMatch } from './network-match.ts';
import type { InputSource } from './session.ts';

export type LobbyState = Extract<ServerMessage, { t: 'lobby' }>;

/** Game server host: VITE_SERVER_HOST, or this page's host on port 1999 (wrangler dev). */
export function serverHost(): string {
  return (import.meta.env.VITE_SERVER_HOST as string | undefined) ?? `${location.hostname}:1999`;
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

  constructor(
    readonly code: string,
    private readonly name: string,
    private readonly input: InputSource,
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
    this.socket.addEventListener('message', (e: MessageEvent) => this.receive(JSON.parse(String(e.data)) as ServerMessage));
  }

  get isHost(): boolean {
    return !!this.lobby?.seats.some((s) => s.seat === this.seat && s.host);
  }

  start(bots: number): void {
    this.send({ t: 'start', bots });
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
        this.match?.receive(msg.s, msg.ev);
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
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }
}
