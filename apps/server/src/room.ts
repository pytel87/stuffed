// One Durable Object per room. It holds the lobby (seats for up to MAX_PLAYERS people) and,
// during a match, runs the authoritative simulation at 30 Hz: it applies each player's inputs,
// lets bots fill the remaining places, and sends every player a snapshot of what they can see.
import { BotController, canSee, config, createGame, createWorld, NEUTRAL_INPUT, step, TEST_MAP } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, Input, World } from '@stuffed/sim';
import {
  compactJson,
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  SNAPSHOT_EVERY,
  type ClientMessage,
  type LobbySeat,
  type RoomPhase,
  type ServerMessage,
} from '@stuffed/sim/net';
import { Server, type Connection, type WSMessage } from 'partyserver';

const TICK_MS = 1000 / config.tickRate;
/** Never run more than this many ticks to catch up after a stall. */
const MAX_CATCH_UP = 5;
/** Inputs queued beyond this are dropped (the client is running ahead). */
const MAX_QUEUED_INPUTS = 4;
/** Without input for this many ticks (e.g. a background tab), a player stands still. */
const INPUT_TIMEOUT_TICKS = 15;
/** Seconds after a match ends before the loop stops (final snapshots, effects). */
const LINGER_SECONDS = 3;
const DEFAULT_BOTS = 7;
const NAME_MAX = 16;

interface Seat {
  seat: number;
  token: string;
  name: string;
  connId: string | null;
}

interface Match {
  world: World;
  state: GameState;
  bots: BotController;
  /** Seat number → the plush it plays. */
  plushOf: Map<number, EntityId>;
  queued: Map<EntityId, Input[]>;
  last: Map<EntityId, Input>;
  lastInputTick: Map<EntityId, number>;
  events: GameEvent[];
  endedAtTick: number | null;
}

interface ConnState {
  seat: number | null;
}

export class Room extends Server<Env> {
  // The tick loop keeps the object awake during matches; hibernation would only help idle lobbies.
  static override options = { hibernate: false };

  private claimed = false;
  private phase: RoomPhase = 'lobby';
  private seats: Seat[] = [];
  private bots = DEFAULT_BOTS;
  private match: Match | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;
  private acc = 0;

  /** Called by the Worker when handing out a new code; false if this room is already in use. */
  async claim(): Promise<boolean> {
    if (this.claimed || this.seats.length > 0) return false;
    this.claimed = true;
    return true;
  }

  override onConnect(conn: Connection<ConnState>): void {
    conn.setState({ seat: null });
  }

  override onMessage(conn: Connection<ConnState>, raw: WSMessage): void {
    if (typeof raw !== 'string') return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.send(conn, { t: 'error', code: 'bad_message' });
    }
    switch (msg.t) {
      case 'hello':
        return this.hello(conn, msg);
      case 'input':
        return this.input(conn, msg.i);
      case 'start':
        return this.startRequest(conn, msg.bots);
      case 'ping':
        return this.send(conn, { t: 'pong', c: Number(msg.c) || 0, s: Date.now() });
      default:
        return this.send(conn, { t: 'error', code: 'bad_message' });
    }
  }

  override onClose(conn: Connection<ConnState>): void {
    const seat = this.seats.find((s) => s.connId === conn.id);
    if (seat) seat.connId = null;
    this.broadcastLobby();
    if (![...this.getConnections()].some((c) => c.id !== conn.id)) this.stopLoop();
  }

  // ---------- lobby ----------

  private hello(conn: Connection<ConnState>, msg: Extract<ClientMessage, { t: 'hello' }>): void {
    if (msg.v !== PROTOCOL_VERSION) {
      this.send(conn, { t: 'error', code: 'version' });
      return conn.close(4000, 'protocol version');
    }
    this.claimed = true;
    const token = String(msg.token).slice(0, 64);
    const name = String(msg.name).trim().slice(0, NAME_MAX) || 'Plush';

    // Same token = the same person reconnecting: give the seat back.
    let seat = this.seats.find((s) => s.token === token) ?? null;
    if (seat) {
      seat.connId = conn.id;
      seat.name = name;
    } else if (this.seats.length < MAX_PLAYERS) {
      seat = { seat: this.seats.length, token, name, connId: conn.id };
      this.seats.push(seat);
    }
    conn.setState({ seat: seat?.seat ?? null });
    this.send(conn, { t: 'welcome', code: this.name, seat: seat?.seat ?? null });
    this.broadcastLobby();
    // Joining a match in progress: watch it (or rejoin your plush if you were in it).
    if (this.match && this.phase !== 'lobby') {
      this.send(conn, { t: 'start', mapId: this.match.state.mapId, you: seat ? (this.match.plushOf.get(seat.seat) ?? null) : null });
      this.sendSnapshot(conn, this.match);
    }
    if (this.match && this.phase === 'playing') this.startLoop();
  }

  private host(): Seat | undefined {
    return this.seats.find((s) => s.connId !== null);
  }

  private lobbyMessage(): ServerMessage {
    const host = this.host();
    const seats: LobbySeat[] = this.seats.map((s) => ({ seat: s.seat, name: s.name, connected: s.connId !== null, host: s === host }));
    return { t: 'lobby', phase: this.phase, seats, bots: this.bots };
  }

  private broadcastLobby(): void {
    this.broadcast(JSON.stringify(this.lobbyMessage()));
  }

  private startRequest(conn: Connection<ConnState>, bots: number): void {
    const seat = conn.state?.seat;
    if (seat === null || seat === undefined || this.host()?.seat !== seat) return this.send(conn, { t: 'error', code: 'not_host' });
    if (this.phase === 'playing') return;
    const humans = this.seats.filter((s) => s.connId !== null);
    this.bots = Math.max(0, Math.min(MAX_PLAYERS - humans.length, Math.trunc(Number(bots) || 0)));
    this.startMatch(humans);
  }

  private startMatch(humans: Seat[]): void {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const roster = [
      ...humans.map((s) => ({ name: s.name, isBot: false })),
      ...Array.from({ length: this.bots }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true })),
    ];
    const state = createGame({ seed, map: TEST_MAP, roster });
    const plushOf = new Map<number, EntityId>(humans.map((s, i) => [s.seat, state.players[i]!.id]));
    this.match = {
      world: createWorld(TEST_MAP),
      state,
      bots: new BotController(seed),
      plushOf,
      queued: new Map(),
      last: new Map(),
      lastInputTick: new Map(),
      events: [],
      endedAtTick: null,
    };
    this.phase = 'playing';
    this.broadcastLobby();
    for (const conn of this.getConnections<ConnState>()) {
      const seat = conn.state?.seat;
      this.send(conn, { t: 'start', mapId: state.mapId, you: seat === null || seat === undefined ? null : (plushOf.get(seat) ?? null) });
    }
    this.startLoop();
  }

  // ---------- match ----------

  private input(conn: Connection<ConnState>, input: Input): void {
    const m = this.match;
    const seat = conn.state?.seat;
    if (!m || this.phase !== 'playing' || seat === null || seat === undefined || typeof input !== 'object' || input === null) return;
    const id = m.plushOf.get(seat);
    if (id === undefined) return;
    let q = m.queued.get(id);
    if (!q) m.queued.set(id, (q = []));
    q.push(input);
    if (q.length > MAX_QUEUED_INPUTS) q.splice(0, q.length - MAX_QUEUED_INPUTS);
  }

  private startLoop(): void {
    if (this.timer) return;
    this.lastTime = Date.now();
    this.acc = 0;
    this.timer = setInterval(() => this.loop(), TICK_MS / 2);
  }

  private stopLoop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private loop(): void {
    const now = Date.now();
    this.acc = Math.min(this.acc + (now - this.lastTime), TICK_MS * MAX_CATCH_UP);
    this.lastTime = now;
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.tick();
    }
  }

  private tick(): void {
    const m = this.match;
    if (!m) return this.stopLoop();
    if (m.state.status === 'ended') {
      if (m.endedAtTick === null) m.endedAtTick = m.state.tick;
      // Keep sending a little after the end so everyone gets the final state, then rest.
      m.state.tick++;
      if (m.state.tick - m.endedAtTick > LINGER_SECONDS * config.tickRate) this.stopLoop();
      else if (m.state.tick % SNAPSHOT_EVERY === 0) this.sendSnapshots(m);
      return;
    }

    const inputs = m.bots.inputs(m.world, m.state);
    for (const id of m.plushOf.values()) {
      const next = m.queued.get(id)?.shift();
      if (next) {
        m.last.set(id, next);
        m.lastInputTick.set(id, m.state.tick);
        inputs.set(id, next);
      } else {
        // A late input: keep holding what was held, but don't repeat one-shot actions. Inputs gone
        // for a while (tab in the background, dropped connection): stand still.
        const last = m.last.get(id);
        const stale = m.state.tick - (m.lastInputTick.get(id) ?? -Infinity) > INPUT_TIMEOUT_TICKS;
        inputs.set(id, last && !stale ? { ...last, weaponSlot: -1, cycleWeapon: false, useItemSlot: -1 } : { ...NEUTRAL_INPUT, aimX: last?.aimX ?? 0, aimY: last?.aimY ?? 0 });
      }
    }
    step(m.world, m.state, inputs);
    m.events.push(...m.state.events);

    const ended = hasEnded(m.state);
    if (ended) {
      this.phase = 'ended';
      this.broadcastLobby();
    }
    if (m.state.tick % SNAPSHOT_EVERY === 0 || ended) this.sendSnapshots(m);
  }

  private sendSnapshots(m: Match): void {
    for (const conn of this.getConnections<ConnState>()) this.sendSnapshot(conn, m);
    m.events = [];
  }

  /** The match as this connection's plush can see it; watchers and the knocked-out see everyone. */
  private sendSnapshot(conn: Connection<ConnState>, m: Match): void {
    const seat = conn.state?.seat;
    const you = seat === null || seat === undefined ? undefined : m.plushOf.get(seat);
    const viewer = you === undefined ? undefined : m.state.players.find((p) => p.id === you);
    const players =
      viewer?.alive && m.state.status === 'playing'
        ? m.state.players.filter((p) => p.id === viewer.id || !p.alive || canSee(m.world, m.state, viewer, p))
        : m.state.players;
    const s: GameState = { ...m.state, players, rng: [0, 0, 0, 0], events: [] };
    conn.send(compactJson({ t: 'snap', s, ev: m.events } satisfies ServerMessage));
  }

  private send(conn: Connection<ConnState>, msg: ServerMessage): void {
    conn.send(JSON.stringify(msg));
  }
}

/** step() can end the match; a function call keeps TypeScript from assuming it didn't. */
function hasEnded(state: GameState): boolean {
  return state.status === 'ended';
}
