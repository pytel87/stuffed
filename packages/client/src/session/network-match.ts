// A match played on the server. Snapshots arrive about 15 times a second; the match is drawn a
// little in the past (DELAY_TICKS) so there are always two snapshots to interpolate between,
// and each snapshot's events play when the drawing reaches it. Inputs go up 30 times a second.
// Your own plush moves when the server says so (client prediction comes next).
import { config, DT, TEST_MAP } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, Input, MapData } from '@stuffed/sim';
import type { GameSession, InputSource, RenderFrame } from './session.ts';

/** How far behind the newest snapshot to draw: 2 snapshot gaps plus jitter room. */
const DELAY_TICKS = 4;
/** Further off than this, jump instead of easing back. */
const RESYNC_TICKS = 15;
const KEEP_SNAPSHOTS = 20;

interface Snapshot {
  tick: number;
  state: GameState;
  events: GameEvent[];
  played: boolean;
}

export class NetworkMatch implements GameSession {
  readonly map: MapData = TEST_MAP;
  /** -1 when you only watch this match. */
  readonly localPlayerId: EntityId;
  private readonly snaps: Snapshot[] = [];
  private renderTick = -1;
  private inputAcc = 0;
  private events: GameEvent[] = [];

  constructor(
    you: EntityId | null,
    private readonly input: InputSource,
    private readonly sendInput: (input: Input) => void,
  ) {
    this.localPlayerId = you ?? -1;
  }

  get ready(): boolean {
    return this.snaps.length > 0;
  }

  receive(state: GameState, events: GameEvent[]): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && state.tick <= last.tick) {
      last.events.push(...events); // same tick re-sent (e.g. after the match ends)
      last.state = state;
      return;
    }
    this.snaps.push({ tick: state.tick, state, events, played: false });
    if (this.snaps.length > KEEP_SNAPSHOTS) this.snaps.shift();
  }

  advance(dtSeconds: number): void {
    // Inputs at the sim rate, whatever the frame rate.
    this.inputAcc += Math.min(dtSeconds, 0.25);
    while (this.inputAcc >= DT) {
      this.inputAcc -= DT;
      if (this.localPlayerId !== -1) this.sendInput(this.input.sample());
    }

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
    return { prev: prev.state, curr: curr.state, alpha };
  }

  takeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
