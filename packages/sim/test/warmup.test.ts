import { describe, expect, it } from 'vitest';
import { addPlayer, applyDamage, BACKYARD, Btn, COVE, createGame, createWorld, removePlayer } from '../src/index.ts';
import { spawnPrize } from '../src/systems/minigames.ts';
import { decodeSnapshot, emptySnapshotParts, encodeSnapshot, type CompactSnapshot } from '../src/net/protocol.ts';
import { input, run } from './helpers.ts';

const warmup = (players = 1, map = BACKYARD) =>
  createGame({ seed: 5, map, roster: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, isBot: false })), peaceful: true });

describe('a warm-up (a room lobby)', () => {
  it('has no chests, piñata or Toss, and hurts nobody', () => {
    const state = warmup(2);
    expect(state.chests).toHaveLength(0);
    expect(state.pinata).toBeNull();
    expect(state.toss).toBeNull();
    const [a, b] = state.players;
    applyDamage(state, b!, 500, a!.id);
    expect(b!.alive).toBe(true);
    expect(b!.stuffing).toBe(100);
    expect(state.events.some((e) => e.type === 'hit')).toBe(true);
  });

  it('never ends, even with one plush in it, and the Rinse stays put', () => {
    const state = warmup(1, COVE);
    const world = createWorld(COVE);
    const radius = state.zone.current.radius;
    run(world, state, 30 * 60, () => input({ moveX: 1 }));
    expect(state.status).toBe('playing');
    expect(state.winnerId).toBeNull();
    expect(state.zone.current.radius).toBe(radius);
  });

  it("players' screens show the Rinse staying put too, long past when it would rise", () => {
    const state = warmup(1);
    const radius = state.zone.current.radius;
    state.tick = state.zone.endTick + 100;
    const json = encodeSnapshot(state, state.players, state.players[0]!.id, [], {});
    const shown = decodeSnapshot(JSON.parse(json) as CompactSnapshot, emptySnapshotParts())!.state;
    expect(shown.zone.current.radius).toBeCloseTo(radius, 1);
  });

  it('everyone gathers at the meeting spot; a newcomer pops in beside them, not on anyone', () => {
    const state = warmup(3);
    const first = state.players[0]!;
    const newcomer = addPlayer(state, BACKYARD, { name: 'Late', isBot: false })!;
    expect(state.players).toHaveLength(4);
    expect(newcomer.id).not.toBe(first.id);
    for (const p of state.players) {
      expect(Math.hypot(p.pos.x - first.pos.x, p.pos.y - first.pos.y)).toBeLessThan(6);
      for (const q of state.players) if (q !== p) expect(Math.hypot(p.pos.x - q.pos.x, p.pos.y - q.pos.y)).toBeGreaterThan(1.5);
    }
    removePlayer(state, first.id);
    expect(state.players.map((p) => p.name)).toEqual(['P1', 'P2', 'Late']);
  });

  it('B starts a dance (pressed again, or walking off, stops it); not in a real match', () => {
    const state = warmup(1);
    const world = createWorld(BACKYARD);
    const me = state.players[0]!;
    run(world, state, 1, () => input({ buttons: Btn.Dance }));
    expect(me.danceUntil).toBeGreaterThan(state.tick);
    run(world, state, 30, () => input());
    expect(me.danceUntil).toBeGreaterThan(state.tick);
    run(world, state, 1, () => input({ moveX: 1 }));
    expect(me.danceUntil).toBe(0);
    const match = createGame({ seed: 5, map: BACKYARD, roster: [{ name: 'A', isBot: false }, { name: 'B', isBot: false }] });
    run(world, match, 1, () => input({ buttons: Btn.Dance }));
    expect(match.players[0]!.danceUntil).toBe(0);
  });

  it("a mini-game's prize cheers but leaves nothing to pick up", () => {
    const state = warmup(1);
    const world = createWorld(BACKYARD);
    spawnPrize(world, state, { x: 40, y: 40 }, 0, 2, 2);
    expect(state.loot).toHaveLength(0);
    expect(state.events.some((e) => e.type === 'prize')).toBe(true);
  });
});
