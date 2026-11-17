// The toy train: a few cars running round an oval track at a steady speed. Where they are is
// worked out from the match clock alone, so it needs no state (and online every player sees it
// in the same place). The cars are solid: they shove plushies out of the way, stop shots and
// knock beach balls along. The wagons behind the engine have flat decks a jump can land on;
// whoever stands on one rides along.
import { config } from '../config.ts';
import type { TrainTrack, Vec2 } from '../types.ts';

export const TRAIN = {
  carLength: 2.6,
  carGap: 0.5,
  carWidth: 1.5,
  /** The wagons' decks: a jump (apex about 1.5) lands on them. */
  deckHeight: 1.2,
  /** The engine is taller (its cab): it can't be stood on. */
  engineHeight: 2,
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

/** How tall car `i` is (the engine first). */
export function carTop(i: number): number {
  return i === 0 ? TRAIN.engineHeight : TRAIN.deckHeight;
}

/** Each car as two circles along its length (for bumping into), with its height. */
export function trainCircles(track: TrainTrack, tick: number): { x: number; y: number; r: number; dir: Vec2; top: number }[] {
  const out: { x: number; y: number; r: number; dir: Vec2; top: number }[] = [];
  const off = TRAIN.carLength / 4;
  trainCars(track, tick).forEach((car, i) => {
    for (const k of [-off, off]) out.push({ x: car.pos.x + car.dir.x * k, y: car.pos.y + car.dir.y * k, r: TRAIN.carWidth / 2 + 0.1, dir: car.dir, top: carTop(i) });
  });
  return out;
}

/** Where `p` is on car `car` (along its length, and to its side), or null if off its footprint. */
function onCar(car: TrainCar, p: Vec2): { along: number; side: number } | null {
  const dx = p.x - car.pos.x;
  const dy = p.y - car.pos.y;
  const along = dx * car.dir.x + dy * car.dir.y;
  const side = dx * -car.dir.y + dy * car.dir.x;
  return Math.abs(along) <= TRAIN.carLength / 2 && Math.abs(side) <= TRAIN.carWidth / 2 ? { along, side } : null;
}

/** The highest wagon deck under `p` at `tick` that's at most `reach` high (0 if none). */
export function trainFloor(track: TrainTrack, tick: number, p: Vec2, reach: number): number {
  let best = 0;
  trainCars(track, tick).forEach((car, i) => {
    const top = carTop(i);
    if (i > 0 && top <= reach && top > best && onCar(car, p)) best = top;
  });
  return best;
}

/**
 * A plush standing on a wagon deck (feet at `z`) is carried with it: where the same spot on that
 * wagon is at `toTick` (it turns with the track), or null if it isn't riding.
 */
export function carriedBy(track: TrainTrack, fromTick: number, toTick: number, p: Vec2, z: number): Vec2 | null {
  if (Math.abs(z - TRAIN.deckHeight) > 0.05) return null;
  const before = trainCars(track, fromTick);
  for (let i = 1; i < before.length; i++) {
    const at = onCar(before[i]!, p);
    if (!at) continue;
    const car = trainCars(track, toTick)[i]!;
    return {
      x: car.pos.x + car.dir.x * at.along - car.dir.y * at.side,
      y: car.pos.y + car.dir.y * at.along + car.dir.x * at.side,
    };
  }
  return null;
}

/** Distance from `p` to the track's line (approximate, from the samples). */
export function distanceToTrack(track: TrainTrack, p: Vec2): number {
  const t = tableFor(track);
  let best = Infinity;
  for (const q of t.points) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
  return best;
}
