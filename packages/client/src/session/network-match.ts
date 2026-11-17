// A match played on the server. Snapshots arrive about 15 times a second; everyone else is drawn
// a little in the past (DELAY_TICKS) so there are always two snapshots to interpolate between,
// and each snapshot's events play when the drawing reaches it. Inputs go up 30 times a second.
//
// Your own plush is predicted: every input moves it here at once (same code as the server), and
// every snapshot says which inputs the server has applied; the client takes that confirmed
// state, re-applies the inputs still in flight, and smooths away any small difference.
//
// Your own shots are predicted too (for the straight-shooting weapons): they leave the muzzle
// the moment you fire and are drawn here, while the server's copies of them are hidden. Damage
// and hits still come from the server.
import { Btn, config, createWorld, DT, getMap, muzzlePosition, predictPlayer, raycastWalls, secondsToTicks } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, Input, MapData, Player, Projectile, Rarity, Vec2, WeaponKind, World } from '@stuffed/sim';
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

/** Weapons whose shots fly straight and simple enough to draw before the server confirms them. */
function predictable(kind: WeaponKind): boolean {
  const s = config.weapons[kind];
  return (s.mode ?? 'auto') === 'auto' && !s.bounces && !s.blastRadius;
}

/** One of your shots, drawn before the server's copy exists. */
interface PredictedShot {
  id: number;
  weapon: WeaponKind;
  rarity: Rarity;
  prev: Vec2;
  pos: Vec2;
  vel: Vec2;
  z: number;
  radius: number;
  /** In prediction ticks (one per input sent). */
  expire: number;
}

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
  /** Your predicted shots in flight, and the inputs that fired shots the server hasn't seen yet. */
  private shots: PredictedShot[] = [];
  private unconfirmedShots: number[] = [];
  /** Counts inputs sent (the local clock for predicted shots). */
  private predTick = 0;
  private lastShotTick = -1e9;
  private nextShotId = -1;
  private localEvents: GameEvent[] = [];

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
      this.shots = [];
      this.unconfirmedShots = [];
      return;
    }
    this.pending = this.pending.filter((i) => i.seq > me.lastInputSeq);
    this.unconfirmedShots = this.unconfirmedShots.filter((seq) => seq > me.lastInputSeq);
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
    this.predTick++;
    this.moveShots(latest.state);
    this.predictShot(latest.state, input);
  }

  /**
   * Fires a predicted shot when the server would: Fire held, the weapon ready (by the same fire
   * rate, counted here) and ammo left after the shots it hasn't confirmed yet.
   */
  private predictShot(state: GameState, input: Input): void {
    const me = this.predicted;
    const server = state.players.find((p) => p.id === this.localPlayerId);
    if (!me || !server || !(input.buttons & Btn.Fire) || me.drop || state.tick < server.bubbledUntil) return;
    const weapon = server.weapons[server.activeSlot];
    if (!weapon || !predictable(weapon.kind) || weapon.reloadEndTick !== null) return;
    if (weapon.ammo - this.unconfirmedShots.length <= 0) return;
    const s = config.weapons[weapon.kind];
    if (this.predTick - this.lastShotTick < Math.max(1, secondsToTicks(s.fireInterval))) return;
    this.lastShotTick = this.predTick;
    this.unconfirmedShots.push(input.seq);

    const aim = me.aim;
    const tip = muzzlePosition(me.pos, aim, weapon.kind);
    const base = Math.atan2(aim.y, aim.x);
    const cone = (s.spreadDegrees * Math.PI) / 180;
    for (let i = 0; i < s.pellets; i++) {
      const even = s.pellets > 1 ? (i / (s.pellets - 1) - 0.5) * cone : 0;
      const jitter = (Math.random() - 0.5) * (s.pellets > 1 ? cone / s.pellets : cone);
      const a = base + even + jitter;
      this.shots.push({
        id: this.nextShotId--,
        weapon: weapon.kind,
        rarity: weapon.rarity,
        prev: { ...tip },
        pos: { ...tip },
        vel: { x: Math.cos(a) * s.projectileSpeed, y: Math.sin(a) * s.projectileSpeed },
        z: me.z + config.combat.shotHeight,
        radius: s.projectileRadius,
        expire: this.predTick + Math.max(1, secondsToTicks(s.range / s.projectileSpeed)),
      });
    }
    this.localEvents.push({ type: 'shot', playerId: me.id, weapon: weapon.kind, pos: { x: me.pos.x, y: me.pos.y } });
  }

  /** Moves predicted shots; they stop at walls, at a plush, or at the end of their range. */
  private moveShots(state: GameState): void {
    this.shots = this.shots.filter((shot) => {
      shot.prev = { ...shot.pos };
      shot.pos = { x: shot.pos.x + shot.vel.x * DT, y: shot.pos.y + shot.vel.y * DT };
      if (this.predTick >= shot.expire) return false;
      if (raycastWalls(this.world, shot.prev, shot.pos, shot.radius, shot.z - shot.radius) !== null) return false;
      return !state.players.some(
        (p) => p.alive && p.id !== this.localPlayerId && !p.drop && Math.hypot(p.pos.x - shot.pos.x, p.pos.y - shot.pos.y) < p.radius + shot.radius,
      );
    });
  }

  /** Predicted shots where they are right now, as projectiles for drawing. */
  private shotsNow(): Projectile[] {
    const t = this.inputAcc / DT;
    return this.shots.map((s) => {
      const z = s.z;
      return {
        id: s.id,
        ownerId: this.localPlayerId,
        weapon: s.weapon,
        rarity: s.rarity,
        pos: { x: s.prev.x + (s.pos.x - s.prev.x) * t, y: s.prev.y + (s.pos.y - s.prev.y) * t },
        vel: s.vel,
        z,
        vz: 0,
        zEnd: z,
        radius: s.radius,
        damage: 0,
        knockback: 0,
        expireTick: 0,
      };
    });
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
    // Your plush is drawn where prediction puts it now, not in the past with everyone else, and
    // so are your shots (in place of the server's copies of them).
    const mine = this.shotsNow();
    const withMe = (s: GameState): GameState => ({
      ...s,
      players: s.players.map((p) => (p.id === me.id ? me : p)),
      projectiles: [...s.projectiles.filter((q) => q.ownerId !== me.id || !predictable(q.weapon)), ...mine],
    });
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
    // Your predicted shots already made their muzzle puff and sound; skip the server's echo.
    const me = this.localPlayerId;
    const out = [
      ...this.events.filter((e) => !(e.type === 'shot' && e.playerId === me && predictable(e.weapon))),
      ...this.localEvents,
    ];
    this.events = [];
    this.localEvents = [];
    return out;
  }
}
