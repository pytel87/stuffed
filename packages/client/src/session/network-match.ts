// A match played on the server. Snapshots arrive about 15 times a second; everyone else is drawn
// a little in the past (DELAY_TICKS) so there are always two snapshots to interpolate between,
// and each snapshot's events play when the drawing reaches it. Inputs go up 30 times a second.
//
// Your own plush is predicted: every input moves it here at once (same code as the server), and
// every snapshot says which inputs the server has applied; the client takes that confirmed
// state, re-applies the inputs still in flight, and smooths away any small difference.
import { config, createWorld, DT, getMap, predictPlayer } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, Input, MapData, Player, World } from '@stuffed/sim';
import { decodeSnapshot, emptySnapshotParts, type CompactSnapshot } from '@stuffed/sim/net';
import type { GameSession, InputSource, RenderFrame } from './session.ts';

/** How far behind the newest snapshot to draw: 2 snapshot gaps plus jitter room. */
const DELAY_TICKS = 4;
/** Further off than this, jump instead of easing back. */
const RESYNC_TICKS = 15;
const KEEP_SNAPSHOTS = 20;
/** Inputs remembered for replay; more than this unconfirmed means something is badly wrong. */
const MAX_PENDING = 90;
/** Prediction errors smaller than this are smoothed out; bigger ones snap. */
const SMOOTH_LIMIT = 3;
/** How fast a smoothed correction fades (1/s). */
const CORRECTION_RATE = 12;

interface Snapshot {
  tick: number;
  state: GameState;
  events: GameEvent[];
  played: boolean;
}

export class NetworkMatch implements GameSession {
  readonly map: MapData;
  /** -1 when you only watch this match. */
  readonly localPlayerId: EntityId;
  private readonly snaps: Snapshot[] = [];
  private renderTick = -1;
  private inputAcc = 0;
  private events: GameEvent[] = [];
  private readonly world: World;
  /** Slow parts of the match (chests, loot, names, ...) kept between compact snapshots. */
  private readonly parts = emptySnapshotParts();
  /** Inputs sent but not yet confirmed by a snapshot, oldest first. */
  private pending: Input[] = [];
  /** Your plush after the latest input, and before it (to draw smoothly between inputs). */
  private predicted: Player | null = null;
  private predictedPrev: Player | null = null;
  /** Visual offset left over from a reconciliation; fades to zero. */
  private readonly correction = { x: 0, y: 0, z: 0 };

  constructor(
    you: EntityId | null,
    private readonly input: InputSource,
    private readonly sendInput: (input: Input) => void,
    mapId: string,
  ) {
    this.localPlayerId = you ?? -1;
    this.map = getMap(mapId);
    this.world = createWorld(this.map);
  }

  get ready(): boolean {
    return this.snaps.length > 0;
  }

  /** A compact snapshot from the server. */
  receiveCompact(msg: CompactSnapshot): void {
    const decoded = decodeSnapshot(msg, this.parts);
    if (decoded) this.receive(decoded.state, decoded.events);
  }

  private receive(state: GameState, events: GameEvent[]): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && state.tick <= last.tick) {
      last.events.push(...events); // same tick re-sent (e.g. after the match ends)
      last.state = state;
      return;
    }
    this.snaps.push({ tick: state.tick, state, events, played: false });
    if (this.snaps.length > KEEP_SNAPSHOTS) this.snaps.shift();
    this.reconcile(state);
  }

  /** Confirmed state from the server, plus the inputs it hasn't applied yet. */
  private reconcile(state: GameState): void {
    const me = state.players.find((p) => p.id === this.localPlayerId);
    if (!me?.alive) {
      this.predicted = this.predictedPrev = null;
      this.pending = [];
      return;
    }
    this.pending = this.pending.filter((i) => i.seq > me.lastInputSeq);
    const fresh = structuredClone(me);
    for (const input of this.pending) predictPlayer(this.world, state, fresh, input);

    if (!this.predicted || !this.predictedPrev) {
      this.predicted = fresh;
      this.predictedPrev = structuredClone(fresh);
      return;
    }
    // Keep what's drawn where it was: move the error into the fading correction.
    const dx = this.predicted.pos.x - fresh.pos.x;
    const dy = this.predicted.pos.y - fresh.pos.y;
    const dz = this.predicted.z - fresh.z;
    if (Math.hypot(dx, dy, dz) < SMOOTH_LIMIT) {
      this.correction.x += dx;
      this.correction.y += dy;
      this.correction.z += dz;
    } else {
      this.correction.x = this.correction.y = this.correction.z = 0;
    }
    this.predictedPrev.pos.x -= dx;
    this.predictedPrev.pos.y -= dy;
    this.predictedPrev.z -= dz;
    this.predicted = fresh;
  }

  /** Applies one of your inputs to your plush right away. */
  private predict(input: Input): void {
    const latest = this.snaps[this.snaps.length - 1];
    if (!latest || !this.predicted) return;
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    this.predictedPrev = structuredClone(this.predicted);
    predictPlayer(this.world, latest.state, this.predicted, input);
  }

  advance(dtSeconds: number): void {
    // Inputs at the sim rate, whatever the frame rate.
    this.inputAcc += Math.min(dtSeconds, 0.25);
    while (this.inputAcc >= DT) {
      this.inputAcc -= DT;
      if (this.localPlayerId === -1) continue;
      const input = this.input.sample();
      this.sendInput(input);
      this.predict(input);
    }
    const fade = Math.exp(-CORRECTION_RATE * dtSeconds);
    this.correction.x *= fade;
    this.correction.y *= fade;
    this.correction.z *= fade;

    const latest = this.snaps[this.snaps.length - 1];
    if (!latest) return;
    const target = latest.tick - DELAY_TICKS;
    if (this.renderTick < 0 || Math.abs(this.renderTick - target) > RESYNC_TICKS) {
      this.renderTick = target;
    } else {
      this.renderTick += dtSeconds * config.tickRate;
      this.renderTick += (target - this.renderTick) * Math.min(1, dtSeconds * 2); // ease out drift
    }
    this.renderTick = Math.min(this.renderTick, latest.tick);

    for (const s of this.snaps) {
      if (s.played || s.tick > this.renderTick) continue;
      s.played = true;
      this.events.push(...s.events);
    }
  }

  frame(): RenderFrame {
    let prev = this.snaps[0]!;
    let curr = prev;
    for (const s of this.snaps) {
      if (s.tick <= this.renderTick) prev = s;
      if (s.tick >= this.renderTick) {
        curr = s;
        break;
      }
      curr = s;
    }
    const span = curr.tick - prev.tick;
    const alpha = span > 0 ? Math.min(1, Math.max(0, (this.renderTick - prev.tick) / span)) : 0;
    const me = this.predictedNow(curr.state);
    if (!me) return { prev: prev.state, curr: curr.state, alpha };
    // Your plush is drawn where prediction puts it now, not in the past with everyone else.
    const withMe = (s: GameState): GameState => ({ ...s, players: s.players.map((p) => (p.id === me.id ? me : p)) });
    return { prev: withMe(prev.state), curr: withMe(curr.state), alpha };
  }

  /** Your plush as predicted for this moment: server facts (stuffing, weapons) with predicted motion. */
  private predictedNow(state: GameState): Player | null {
    const p = this.predicted;
    const q = this.predictedPrev;
    const server = state.players.find((pl) => pl.id === this.localPlayerId);
    if (!p || !q || !server?.alive) return null;
    const t = this.inputAcc / DT;
    return {
      ...server,
      pos: { x: q.pos.x + (p.pos.x - q.pos.x) * t + this.correction.x, y: q.pos.y + (p.pos.y - q.pos.y) * t + this.correction.y },
      z: q.z + (p.z - q.z) * t + this.correction.z,
      vel: p.vel,
      vz: p.vz,
      aim: p.aim,
      inBush: p.inBush,
      building: p.building,
    };
  }

  takeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
