// The toy train: a few cars running round an oval track at a steady speed. Where they are is
// worked out from the match clock alone, so it needs no state (and online every player sees it
// in the same place). The cars are solid: they shove plushies out of the way, stop shots and
// knock beach balls along.
import { config } from '../config.ts';
import type { TrainTrack, Vec2 } from '../types.ts';

export const TRAIN = {
  carLength: 2.6,
  carGap: 0.5,
  carWidth: 1.5,
  /** Shots and plushies below this height meet the cars. */
  height: 1.5,
  /** How hard a car shoves a plush in its way (units/s). */
  shove: 9,
} as const;

export interface TrainCar {
  pos: Vec2;
  /** Unit direction it's heading. */
  dir: Vec2;
}

interface Table {
  points: Vec2[];
  /** Distance along the track to each point; the last is the full lap. */
  dist: number[];
}

const SAMPLES = 360;
const tables = new WeakMap<TrainTrack, Table>();

function tableFor(track: TrainTrack): Table {
  let t = tables.get(track);
  if (t) return t;
  const points: Vec2[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2;
    points.push({ x: track.center.x + Math.cos(a) * track.rx, y: track.center.y + Math.sin(a) * track.ry });
  }
  const dist = [0];
  for (let i = 1; i <= SAMPLES; i++) dist.push(dist[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  t = { points, dist };
  tables.set(track, t);
  return t;
}

/** The point `s` units along the track (wrapping), and the direction there. */
function along(t: Table, s: number): TrainCar {
  const lap = t.dist[SAMPLES]!;
  s = ((s % lap) + lap) % lap;
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.dist[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const a = t.points[lo]!;
  const b = t.points[hi]!;
  const seg = t.dist[hi]! - t.dist[lo]! || 1;
  const k = (s - t.dist[lo]!) / seg;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { pos: { x: a.x + dx * k, y: a.y + dy * k }, dir: { x: dx / len, y: dy / len } };
}

/** Where every car is at `tick` (may be fractional, for drawing between ticks); the engine first. */
export function trainCars(track: TrainTrack, tick: number): TrainCar[] {
  const t = tableFor(track);
  const head = (tick / config.tickRate) * track.speed;
  const cars: TrainCar[] = [];
  for (let i = 0; i < track.cars; i++) cars.push(along(t, head - i * (TRAIN.carLength + TRAIN.carGap)));
  return cars;
}

/** Each car as two circles along its length (for bumping into). */
export function trainCircles(track: TrainTrack, tick: number): { x: number; y: number; r: number; dir: Vec2 }[] {
  const out: { x: number; y: number; r: number; dir: Vec2 }[] = [];
  const off = TRAIN.carLength / 4;
  for (const car of trainCars(track, tick)) {
    for (const k of [-off, off]) out.push({ x: car.pos.x + car.dir.x * k, y: car.pos.y + car.dir.y * k, r: TRAIN.carWidth / 2 + 0.1, dir: car.dir });
  }
  return out;
}

/** Distance from `p` to the track's line (approximate, from the samples). */
export function distanceToTrack(track: TrainTrack, p: Vec2): number {
  const t = tableFor(track);
  let best = Infinity;
  for (const q of t.points) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
  return best;
}
