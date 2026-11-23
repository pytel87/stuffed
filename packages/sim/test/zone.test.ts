import { describe, expect, it } from 'vitest';
import { circleAt, config, createGame, createWorld, isOutside, step, zoneDamagePerSecond, zoneSecondsLeft } from '../src/index.ts';
import type { Circle, EntityId, GameState, Input, Player } from '../src/index.ts';
import { input, OPEN_MAP, roster, run } from './helpers.ts';

const Z = config.zone;
const T = config.tickRate;

function game(seed = 1, players = 2, zoneTimeScale = 1) {
  const world = createWorld(OPEN_MAP);
  const state = createGame({ seed, map: OPEN_MAP, roster: roster(players), zoneTimeScale });
  return { world, state };
}

function runUntil(world: ReturnType<typeof createWorld>, state: GameState, done: (s: GameState) => boolean, limit = 40_000) {
  const stages: string[] = [];
  const inputs = new Map<EntityId, Input>();
  for (let i = 0; i < limit && !done(state); i++) {
    step(world, state, inputs);
    for (const e of state.events) if (e.type === 'zone') stages.push(e.stage);
  }
  return stages;
}

const contains = (outer: Circle, inner: Circle) =>
  Math.hypot(inner.center.x - outer.center.x, inner.center.y - outer.center.y) + inner.radius <= outer.radius + 1e-9;

describe('the Rinse', () => {
  it('waits for the grace period, then shrinks without pause until it closes', () => {
    const { world, state } = game();
    for (const p of state.players) p.stuffing = 1e9;
    const startRadius = state.zone.current.radius;
    run(world, state, Z.delay * T - 1, () => input());
    expect(state.zone.stage).toBe('waiting');
    expect(state.zone.current.radius).toBe(startRadius);
    const stages = runUntil(world, state, (s) => s.zone.stage === 'closed');
    expect(stages).toEqual(['shrinking', 'closed']);
    expect(state.tick).toBe((Z.delay + Z.duration) * T);
    expect(state.zone.current.radius).toBe(0);
  });

  it('shrinks steadily: the radius drops every tick while shrinking', () => {
    const { world, state } = game(2, 1, 0.05);
    state.players[0]!.stuffing = 1e9;
    runUntil(world, state, (s) => s.zone.stage === 'shrinking');
    let last = state.zone.current.radius;
    while (state.zone.stage === 'shrinking') {
      run(world, state, 1, () => input());
      expect(state.zone.current.radius).toBeLessThan(last);
      last = state.zone.current.radius;
    }
  });

  it('every later circle lies inside every earlier one, for many seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { state } = game(seed, 1);
      const z = state.zone;
      let prev = circleAt(z, 0);
      for (let tick = z.startTick; tick <= z.endTick; tick += 97) {
        const c = circleAt(z, tick);
        expect(contains(prev, c)).toBe(true);
        prev = c;
      }
      const m = Z.finalCenterMargin;
      expect(z.end.center.x).toBeGreaterThanOrEqual(OPEN_MAP.width * m);
      expect(z.end.center.x).toBeLessThanOrEqual(OPEN_MAP.width * (1 - m));
    }
  });

  it('counts down to the water rising, then to it closing', () => {
    const { world, state } = game();
    expect(zoneSecondsLeft(state.zone, state.tick)).toBe(Z.delay);
    run(world, state, (Z.delay + 10) * T, () => input());
    expect(zoneSecondsLeft(state.zone, state.tick)).toBe(Z.duration - 10);
  });

  it('damage ramps from the start to the end rate while shrinking', () => {
    const { state } = game();
    const z = state.zone;
    expect(zoneDamagePerSecond(z, z.startTick)).toBe(Z.damagePerSecond.start);
    expect(zoneDamagePerSecond(z, z.endTick)).toBe(Z.damagePerSecond.end);
    expect(zoneDamagePerSecond(z, (z.startTick + z.endTick) / 2)).toBeCloseTo((Z.damagePerSecond.start + Z.damagePerSecond.end) / 2, 9);
  });

  it('damages soggy plushies once per second, ignoring patches', () => {
    const { world, state } = game();
    const [a, b] = state.players as [Player, Player];
    state.zone.start = { center: { x: 20, y: 40 }, radius: 5 };
    state.zone.end = { center: { x: 20, y: 40 }, radius: 5 };
    a.pos = { x: 20, y: 40 };
    b.pos = { x: 60, y: 40 };
    b.patches = 50;
    run(world, state, T * 3, () => input());
    expect(a.soggy).toBe(false);
    expect(b.soggy).toBe(true);
    expect(a.stuffing).toBe(100);
    expect(b.stuffing).toBe(100 - 3 * Z.damagePerSecond.start);
    expect(b.patches).toBe(50);
  });

  it('makes soggy plushies 20% slower', () => {
    const { world, state } = game();
    const p = state.players[0]!;
    state.zone.start = state.zone.end = { center: { x: 5, y: 5 }, radius: 1 };
    p.pos = { x: 40, y: 40 };
    run(world, state, 45, () => input({ moveX: 1 }));
    expect(p.vel.x).toBeCloseTo(config.player.moveSpeed * config.player.soggySpeedMultiplier, 2);
  });

  it('isOutside measures against the current circle', () => {
    const { state } = game();
    state.zone.current = { center: { x: 10, y: 10 }, radius: 2 };
    expect(isOutside(state.zone, { x: 11, y: 10 })).toBe(false);
    expect(isOutside(state.zone, { x: 13, y: 10 })).toBe(true);
  });

  it('time scale shortens the delay and duration', () => {
    const { world, state } = game(1, 1, 0.1);
    state.players[0]!.stuffing = 1e9;
    runUntil(world, state, (s) => s.zone.stage === 'closed');
    expect(state.tick).toBe((Z.delay + Z.duration) * T * 0.1);
  });

  it('a closed Rinse ends the match: the last plush standing wins', () => {
    const { world, state } = game(1, 2, 0.02);
    const [a, b] = state.players as [Player, Player];
    a.stuffing = 1e9;
    runUntil(world, state, (s) => s.status === 'ended');
    expect(state.winnerId).toBe(a.id);
    expect(b.placement).toBe(2);
  });
});
