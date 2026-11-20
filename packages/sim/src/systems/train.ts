// The toy train: a few cars running round an oval track at a steady speed (or, on Pirate Cove, a
// pirate ship sailing round the lagoon: the same, with one long car; see SHIP). Where they are is
// worked out from the match clock alone, so it needs no state (and online every player sees it
// in the same place). The cars are solid: they shove plushies out of the way, stop shots and
// knock beach balls along. The wagons behind the engine have flat decks a jump can land on;
// whoever stands on one rides along.
import { config } from '../config.ts';
import type { GameState, TrainTrack, Vec2 } from '../types.ts';

/** The shape of what runs round a track. */
export interface TrainLayout {
  carLength: number;
  carGap: number;
  carWidth: number;
  /** The decks: a jump (apex about 1.5) lands on them. */
  deckHeight: number;
  /** The cars before `firstDeck` (the engine) are this tall: they can't be stood on. */
  engineHeight: number;
  firstDeck: number;
  /** How hard a car shoves a plush in its way (units/s). */
  shove: number;
  /** Where along each car its bumping circles sit (they're carWidth / 2 + 0.1 round). */
  hull: number[];
  /** How long a pointed bow is (the deck narrows to a point over it). */
  bow?: number;
  /** A mast standing up from the middle of each car: cover on deck. */
  mast?: { r: number; height: number };
  /** The tallest part, for shots. */
  tallest: number;
}

export const TRAIN: TrainLayout = {
  carLength: 2.6,
  carGap: 0.5,
  carWidth: 1.5,
  deckHeight: 1.2,
  // The engine is taller (its cab).
  engineHeight: 2,
  firstDeck: 1,
  shove: 9,
  hull: [-0.65, 0.65],
  tallest: 2,
};

/** The pirate ship: one long hull, its whole deck to stand on, a mast in the middle. */
export const SHIP: TrainLayout = {
  carLength: 11,
  carGap: 0,
  carWidth: 4.2,
  deckHeight: 1.2,
  engineHeight: 1.2,
  firstDeck: 0,
  shove: 7,
  // Close enough that the circles leave no gap along its sides; the end ones make the bow and stern.
  hull: [-3.3, -1.1, 1.1, 3.3],
  bow: 3.5,
  mast: { r: 0.4, height: 8 },
  tallest: 8,
};

export function layoutOf(track: TrainTrack): TrainLayout {
  return track.style === 'ship' ? SHIP : TRAIN;
}

export interface TrainCar {
  pos: Vec2;
  /** Unit direction it's heading. */
  dir: Vec2;
}

interface Table {
  /** The angle round the oval at each sample, and the distance along the track to it; the last is the full lap. */
  angle: number[];
  dist: number[];
}

const SAMPLES = 360;
const tables = new WeakMap<TrainTrack, Table>();

const ovalAt = (track: TrainTrack, a: number): Vec2 => ({ x: track.center.x + Math.cos(a) * track.rx, y: track.center.y + Math.sin(a) * track.ry });

function tableFor(track: TrainTrack): Table {
  let t = tables.get(track);
  if (t) return t;
  const angle: number[] = [];
  const dist = [0];
  for (let i = 0; i <= SAMPLES; i++) angle.push((i / SAMPLES) * Math.PI * 2);
  for (let i = 1; i <= SAMPLES; i++) {
    const a = ovalAt(track, angle[i - 1]!);
    const b = ovalAt(track, angle[i]!);
    dist.push(dist[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  t = { angle, dist };
  tables.set(track, t);
  return t;
}

/** The point `s` units along the track (wrapping), and the direction there: on the oval itself,
 *  turning smoothly (a long ship turning in steps from one sample to the next looked choppy). */
function along(track: TrainTrack, t: Table, s: number): TrainCar {
  const lap = t.dist[SAMPLES]!;
  s = ((s % lap) + lap) % lap;
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.dist[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const seg = t.dist[hi]! - t.dist[lo]! || 1;
  const a = t.angle[lo]! + (t.angle[hi]! - t.angle[lo]!) * ((s - t.dist[lo]!) / seg);
  // The way round (increasing angle): the oval's tangent there.
  const dx = -Math.sin(a) * track.rx;
  const dy = Math.cos(a) * track.ry;
  const len = Math.hypot(dx, dy) || 1;
  return { pos: ovalAt(track, a), dir: { x: dx / len, y: dy / len } };
}

/** Where every car is at `tick` (may be fractional, for drawing between ticks); the engine first. */
export function trainCars(track: TrainTrack, tick: number): TrainCar[] {
  const t = tableFor(track);
  const L = layoutOf(track);
  const head = (tick / config.tickRate) * track.speed;
  // Going the other way round: the cars trail the other way, and face it.
  const way = track.speed < 0 ? -1 : 1;
  const cars: TrainCar[] = [];
  for (let i = 0; i < track.cars; i++) {
    const car = along(track, t, head - way * i * (L.carLength + L.carGap));
    if (way < 0) car.dir = { x: -car.dir.x, y: -car.dir.y };
    cars.push(car);
  }
  return cars;
}

/** How tall car `i` is (the engine first). */
export function carTop(track: TrainTrack, i: number): number {
  const L = layoutOf(track);
  return i < L.firstDeck ? L.engineHeight : L.deckHeight;
}

/** Each car as circles along its length (for bumping into), with its height, and its mast; a mast
 *  doesn't shove (it rides along with whoever bumps it on deck). */
export function trainCircles(track: TrainTrack, tick: number): { x: number; y: number; r: number; dir: Vec2; top: number; shoves: boolean }[] {
  const out: { x: number; y: number; r: number; dir: Vec2; top: number; shoves: boolean }[] = [];
  const L = layoutOf(track);
  trainCars(track, tick).forEach((car, i) => {
    for (const k of L.hull) out.push({ x: car.pos.x + car.dir.x * k, y: car.pos.y + car.dir.y * k, r: L.carWidth / 2 + 0.1, dir: car.dir, top: carTop(track, i), shoves: true });
    if (L.mast) out.push({ x: car.pos.x, y: car.pos.y, r: L.mast.r, dir: car.dir, top: L.deckHeight + L.mast.height, shoves: false });
  });
  return out;
}

/** Where `p` is on car `car` (along its length, and to its side), or null if off its footprint. */
function onCar(L: TrainLayout, car: TrainCar, p: Vec2): { along: number; side: number } | null {
  const dx = p.x - car.pos.x;
  const dy = p.y - car.pos.y;
  const along = dx * car.dir.x + dy * car.dir.y;
  const side = dx * -car.dir.y + dy * car.dir.x;
  return Math.abs(along) <= L.carLength / 2 && Math.abs(side) <= halfWidthAt(L, along) ? { along, side } : null;
}

/** How far out to each side a car's deck reaches, `along` from its middle (a bow narrows to a point;
 *  the ship's hull is drawn to the same line). */
export function halfWidthAt(L: TrainLayout, along: number): number {
  const half = L.carWidth / 2;
  const tip = L.carLength / 2;
  if (!L.bow || along <= tip - L.bow) return half;
  return half * Math.sqrt(Math.max(0, (tip - along) / L.bow));
}

/** The highest wagon deck under `p` at `tick` that's at most `reach` high (0 if none). */
export function trainFloor(track: TrainTrack, tick: number, p: Vec2, reach: number): number {
  const L = layoutOf(track);
  let best = 0;
  trainCars(track, tick).forEach((car, i) => {
    const top = carTop(track, i);
    if (i >= L.firstDeck && top <= reach && top > best && onCar(L, car, p)) best = top;
  });
  return best;
}

/**
 * A plush standing on a wagon deck (feet at `z`) is carried with it: where the same spot on that
 * wagon is at `toTick` (it turns with the track), or null if it isn't riding.
 */
export function carriedBy(track: TrainTrack, fromTick: number, toTick: number, p: Vec2, z: number): Vec2 | null {
  const L = layoutOf(track);
  if (Math.abs(z - L.deckHeight) > 0.05) return null;
  const before = trainCars(track, fromTick);
  for (let i = L.firstDeck; i < before.length; i++) {
    const at = onCar(L, before[i]!, p);
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
  for (const a of t.angle) {
    const q = ovalAt(track, a);
    best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
  }
  return best;
}

/** Loot lying on the rails is pushed aside as the train comes, like a snowplough. */
export function plowLoot(track: TrainTrack, state: GameState): void {
  if (state.loot.length === 0) return;
  for (const c of trainCircles(track, state.tick)) {
    if (!c.shoves) continue;
    for (const loot of state.loot) {
      if (loot.z > c.top) continue;
      const dx = loot.pos.x - c.x;
      const dy = loot.pos.y - c.y;
      const min = c.r + 0.5;
      if (dx * dx + dy * dy >= min * min) continue;
      // Out to the side it's already on, across the track.
      const across = dx * -c.dir.y + dy * c.dir.x >= 0 ? 1 : -1;
      const along = dx * c.dir.x + dy * c.dir.y;
      loot.pos = {
        x: c.x + c.dir.x * along - c.dir.y * across * (min + 0.05),
        y: c.y + c.dir.y * along + c.dir.x * across * (min + 0.05),
      };
    }
  }
}
