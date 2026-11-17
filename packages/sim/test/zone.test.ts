import { describe, expect, it } from 'vitest';
import { config, createGame, createWorld, isOutside, step, zoneSecondsLeft } from '../src/index.ts';
import type { EntityId, GameState, Input, Player, Zone } from '../src/index.ts';
import { input, OPEN_MAP, roster, run } from './helpers.ts';

const PHASES = config.zone.phases;
const totalSeconds = PHASES.reduce((s, p) => s + p.wait + p.shrink, 0);

function game(seed = 1, players = 2, zoneTimeScale = 1) {
  const world = createWorld(OPEN_MAP);
  const state = createGame({ seed, map: OPEN_MAP, roster: roster(players), zoneTimeScale });
  return { world, state };
}

/** Steps until `done` holds (or a safety limit), recording every zone stage seen. */
function runUntil(world: ReturnType<typeof createWorld>, state: GameState, done: (s: GameState) => boolean, limit = 40_000) {
  const stages: string[] = [];
  const inputs = new Map<EntityId, Input>();
  for (let i = 0; i < limit && !done(state); i++) {
    step(world, state, inputs);
    for (const e of state.events) if (e.type === 'zone') stages.push(`${e.phase + 1}:${e.stage}`);
  }
  return stages;
}

const inside = (outer: Zone['current'], inner: Zone['current']) =>
  Math.hypot(inner.center.x - outer.center.x, inner.center.y - outer.center.y) + inner.radius <= outer.radius + 1e-9;

describe('the Rinse', () => {
  it('runs every phase in order, 10 minutes in total, and closes to nothing', () => {
    const { world, state } = game();
    for (const p of state.players) p.stuffing = 1e9; // survive the whole thing
    const stages = runUntil(world, state, (s) => s.zone.stage === 'final');
    expect(stages).toEqual([
      '1:shrink', '2:wait', '2:shrink', '3:wait', '3:shrink', '4:wait', '4:shrink', '5:wait', '5:shrink', '5:final',
    ]);
    expect(state.tick).toBe(totalSeconds * config.tickRate);
    expect(totalSeconds).toBe(600);
    expect(state.zone.current.radius).toBe(0);
  });

  it('shows the next circle during the wait and shrinks to exactly it', () => {
    const { world, state } = game(3);
    for (const p of state.players) p.stuffing = 1e9;
    for (let phase = 0; phase < PHASES.length; phase++) {
      runUntil(world, state, (s) => s.zone.phase === phase && s.zone.stage === 'wait' && s.tick > 0);
      const shown = structuredClone(state.zone.next);
      expect(inside(state.zone.current, shown)).toBe(true);
      expect(shown.radius).toBeCloseTo(config.zone.radiusFractions[phase]! * Math.min(OPEN_MAP.width, OPEN_MAP.height), 9);
      runUntil(world, state, (s) => s.zone.phase > phase || s.zone.stage === 'final');
      expect(state.zone.current).toEqual(shown);
    }
  });

  it('keeps every circle inside the previous one across many seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { world, state } = game(seed, 1, 0.02);
      state.players[0]!.stuffing = 1e9;
      const closed = () => state.zone.stage === 'final';
      let prev = structuredClone(state.zone.next);
      while (!closed()) {
        runUntil(world, state, (s) => s.zone.stage === 'final' || s.zone.next.radius !== prev.radius);
        if (closed()) break;
        expect(inside(prev, state.zone.next)).toBe(true);
        prev = structuredClone(state.zone.next);
      }
    }
  });

  it('counts down the current stage', () => {
    const { world, state } = game();
    expect(zoneSecondsLeft(state.zone, state.tick)).toBe(PHASES[0]!.wait);
    run(world, state, config.tickRate * 10, () => input());
    expect(zoneSecondsLeft(state.zone, state.tick)).toBe(PHASES[0]!.wait - 10);
  });

  it('damages soggy plushies once per second by the phase rate, ignoring buttons', () => {
    const { world, state } = game();
    const [a, b] = state.players as [Player, Player];
    state.zone.current = { center: { x: 20, y: 40 }, radius: 5 };
    a.pos = { x: 20, y: 40 };
    b.pos = { x: 60, y: 40 };
    b.buttons = 50;
    run(world, state, config.tickRate * 3, () => input());
    expect(a.soggy).toBe(false);
    expect(b.soggy).toBe(true);
    expect(a.stuffing).toBe(100);
    expect(b.stuffing).toBe(100 - 3 * PHASES[0]!.damagePerSecond);
    expect(b.buttons).toBe(50);
  });

  it('makes soggy plushies 20% slower', () => {
    const { world, state } = game();
    const p = state.players[0]!;
    state.zone.current = { center: { x: 5, y: 5 }, radius: 1 };
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

  it('time scale shortens every stage', () => {
    const { world, state } = game(1, 1, 0.1);
    state.players[0]!.stuffing = 1e9;
    runUntil(world, state, (s) => s.zone.stage === 'final');
    expect(state.tick).toBe(totalSeconds * config.tickRate * 0.1);
  });

  it('a closed Rinse ends the match: the last plush standing wins', () => {
    const { world, state } = game(1, 2, 0.02);
    const [a, b] = state.players as [Player, Player];
    a.stuffing = 1e9; // a outlasts b in the water
    runUntil(world, state, (s) => s.status === 'ended');
    expect(state.status).toBe('ended');
    expect(state.winnerId).toBe(a.id);
    expect(b.placement).toBe(2);
  });
});
