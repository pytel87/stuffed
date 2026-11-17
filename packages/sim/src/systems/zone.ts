// The Rinse: a soapy flood that shrinks the safe circle in phases.
import { config } from '../config.ts';
import { clamp } from '../math.ts';
import { nextFloat } from '../rng.ts';
import type { Circle, GameState, MapData, RngState, Vec2, Zone } from '../types.ts';
import type { World } from '../world.ts';
import { applyDamage } from './damage.ts';

const PHASES = config.zone.phases;
const LAST = PHASES.length - 1;

function ticks(seconds: number, scale: number): number {
  return Math.max(1, Math.round(seconds * scale * config.tickRate));
}

const copy = (c: Circle): Circle => ({ center: { x: c.center.x, y: c.center.y }, radius: c.radius });

/** Phase 1 starts waiting right away, with the whole map safe and the first circle shown. */
export function initialZone(map: MapData, rng: RngState, timeScale: number): Zone {
  const full: Circle = { center: { x: map.width / 2, y: map.height / 2 }, radius: Math.hypot(map.width, map.height) / 2 };
  return {
    phase: 0,
    stage: 'wait',
    stageStartTick: 0,
    stageEndTick: ticks(PHASES[0]!.wait, timeScale),
    timeScale,
    current: copy(full),
    from: copy(full),
    next: pickNextCircle(map, rng, full, radiusFor(map, 0)),
  };
}

function radiusFor(map: MapData, phase: number): number {
  return config.zone.radiusFractions[phase]! * Math.min(map.width, map.height);
}

/** A random circle of radius r fully inside `current` (and inside the map). */
export function pickNextCircle(map: MapData, rng: RngState, current: Circle, r: number): Circle {
  const room = Math.max(0, current.radius - r);
  const angle = nextFloat(rng) * Math.PI * 2;
  const dist = Math.sqrt(nextFloat(rng)) * room;
  const minX = Math.min(r, map.width / 2);
  const minY = Math.min(r, map.height / 2);
  return {
    center: {
      x: clamp(current.center.x + Math.cos(angle) * dist, minX, map.width - minX),
      y: clamp(current.center.y + Math.sin(angle) * dist, minY, map.height - minY),
    },
    radius: r,
  };
}

export function isOutside(zone: Zone, pos: Vec2): boolean {
  return Math.hypot(pos.x - zone.current.center.x, pos.y - zone.current.center.y) > zone.current.radius;
}

/** Seconds until the current stage ends (0 once the Rinse has closed). */
export function zoneSecondsLeft(zone: Zone, tick: number): number {
  return zone.stage === 'final' ? 0 : Math.max(0, zone.stageEndTick - tick) / config.tickRate;
}

export function updateZone(world: World, state: GameState): void {
  const z = state.zone;
  if (z.stage === 'shrink') {
    const t = clamp((state.tick - z.stageStartTick) / (z.stageEndTick - z.stageStartTick), 0, 1);
    z.current = {
      center: { x: z.from.center.x + (z.next.center.x - z.from.center.x) * t, y: z.from.center.y + (z.next.center.y - z.from.center.y) * t },
      radius: z.from.radius + (z.next.radius - z.from.radius) * t,
    };
  }

  if (z.stage !== 'final' && state.tick >= z.stageEndTick) {
    if (z.stage === 'wait') {
      z.stage = 'shrink';
      z.from = copy(z.current);
      z.stageStartTick = state.tick;
      z.stageEndTick = state.tick + ticks(PHASES[z.phase]!.shrink, z.timeScale);
    } else if (z.phase < LAST) {
      z.current = copy(z.next);
      z.phase++;
      z.stage = 'wait';
      z.next = pickNextCircle(world.map, state.rng, z.current, radiusFor(world.map, z.phase));
      z.stageStartTick = state.tick;
      z.stageEndTick = state.tick + ticks(PHASES[z.phase]!.wait, z.timeScale);
    } else {
      z.current = copy(z.next);
      z.stage = 'final';
      z.stageStartTick = state.tick;
      z.stageEndTick = state.tick;
    }
    state.events.push({ type: 'zone', phase: z.phase, stage: z.stage });
  }

  for (const p of state.players) if (p.alive) p.soggy = isOutside(z, p.pos);

  // Soggy plushies lose stuffing once per second; buttons don't protect against water.
  if (state.tick % config.tickRate === 0) {
    const dps = PHASES[Math.min(z.phase, LAST)]!.damagePerSecond;
    for (const p of state.players) {
      if (p.alive && p.soggy) applyDamage(state, p, dps, null, { ignoreArmor: true });
    }
  }
}
