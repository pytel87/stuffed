import { describe, expect, it } from 'vitest';
import { addPlayer, applyDamage, BACKYARD, COVE, createGame, createWorld, removePlayer } from '../src/index.ts';
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

  it('players come and go: a newcomer stands apart from the others', () => {
    const state = warmup(1);
    const first = state.players[0]!;
    const newcomer = addPlayer(state, BACKYARD, { name: 'Late', isBot: false })!;
    expect(state.players).toHaveLength(2);
    expect(newcomer.id).not.toBe(first.id);
    expect(Math.hypot(newcomer.pos.x - first.pos.x, newcomer.pos.y - first.pos.y)).toBeGreaterThan(5);
    removePlayer(state, first.id);
    expect(state.players.map((p) => p.name)).toEqual(['Late']);
  });
});
