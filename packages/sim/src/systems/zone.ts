// The Rinse: after a grace period a soapy flood rises without pause, shrinking the safe circle
// smoothly from the whole map to a random final point.
import { config } from '../config.ts';
import { clamp } from '../math.ts';
import { nextFloat } from '../rng.ts';
import type { Circle, GameState, MapData, RngState, Tick, Vec2, Zone } from '../types.ts';
import { applyDamage } from './damage.ts';

const Z = config.zone;

const ticks = (seconds: number, scale: number) => Math.max(1, Math.round(seconds * scale * config.tickRate));
const copy = (c: Circle): Circle => ({ center: { x: c.center.x, y: c.center.y }, radius: c.radius });

/**
 * The circle starts covering the whole map and ends at a random point away from the edges.
 * Because the center moves no faster than the radius shrinks (the final point is within the
 * starting radius of the start center), every later circle lies inside every earlier one.
 */
export function initialZone(map: MapData, rng: RngState, timeScale: number): Zone {
  const start: Circle = { center: { x: map.width / 2, y: map.height / 2 }, radius: Math.hypot(map.width, map.height) / 2 };
  const mx = map.width * Z.finalCenterMargin;
  const my = map.height * Z.finalCenterMargin;
  const end: Circle = {
    center: { x: mx + nextFloat(rng) * (map.width - 2 * mx), y: my + nextFloat(rng) * (map.height - 2 * my) },
    radius: 0,
  };
  const startTick = ticks(Z.delay, timeScale);
  return {
    stage: 'waiting',
    startTick,
    endTick: startTick + ticks(Z.duration, timeScale),
    start,
    end,
    current: copy(start),
    timeScale,
  };
}

/** Shrink progress at a tick: 0 before the water rises, 1 once it has closed. */
export function zoneProgress(zone: Zone, tick: Tick): number {
  return clamp((tick - zone.startTick) / (zone.endTick - zone.startTick), 0, 1);
}

export function circleAt(zone: Zone, tick: Tick): Circle {
  const t = zoneProgress(zone, tick);
  return {
    center: {
      x: zone.start.center.x + (zone.end.center.x - zone.start.center.x) * t,
      y: zone.start.center.y + (zone.end.center.y - zone.start.center.y) * t,
    },
    radius: zone.start.radius + (zone.end.radius - zone.start.radius) * t,
  };
}

/** Stuffing per second lost while soggy at this tick. */
export function zoneDamagePerSecond(zone: Zone, tick: Tick): number {
  return Z.damagePerSecond.start + (Z.damagePerSecond.end - Z.damagePerSecond.start) * zoneProgress(zone, tick);
}

export function isOutside(zone: Zone, pos: Vec2): boolean {
  return Math.hypot(pos.x - zone.current.center.x, pos.y - zone.current.center.y) > zone.current.radius;
}

/** Seconds until the water starts rising, or until it closes; 0 once closed. */
export function zoneSecondsLeft(zone: Zone, tick: Tick): number {
  const until = zone.stage === 'waiting' ? zone.startTick : zone.stage === 'shrinking' ? zone.endTick : tick;
  return Math.max(0, until - tick) / config.tickRate;
}

export function updateZone(state: GameState): void {
  const z = state.zone;
  const stage: Zone['stage'] = state.tick < z.startTick ? 'waiting' : state.tick < z.endTick ? 'shrinking' : 'closed';
  if (stage !== z.stage) {
    z.stage = stage;
    state.events.push({ type: 'zone', stage });
  }
  z.current = circleAt(z, state.tick);

  for (const p of state.players) if (p.alive) p.soggy = !p.drop && isOutside(z, p.pos);

  // Soggy plushies lose stuffing once per second; buttons don't protect against water.
  if (state.tick % config.tickRate === 0) {
    const dps = zoneDamagePerSecond(z, state.tick);
    for (const p of state.players) {
      if (p.alive && p.soggy) applyDamage(state, p, dps, null, { ignoreArmor: true, cause: 'rinse' });
    }
  }
}
