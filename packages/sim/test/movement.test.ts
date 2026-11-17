import { describe, expect, it } from 'vitest';
import { config, sanitizeInput } from '../src/index.ts';
import { input, newGame, run } from './helpers.ts';

describe('movement', () => {
  it('moves toward the input direction and reaches top speed', () => {
    const { world, state } = newGame();
    const p = state.players[0]!;
    const start = { ...p.pos };
    run(world, state, 30, () => input({ moveX: 1 }));
    expect(p.pos.x).toBeGreaterThan(start.x);
    expect(p.pos.y).toBeCloseTo(start.y, 6);
    expect(p.vel.x).toBeCloseTo(config.player.moveSpeed, 1);
  });

  it('is not faster diagonally', () => {
    const { world, state } = newGame();
    run(world, state, 60, () => input({ moveX: 1, moveY: 1 }));
    const v = state.players[0]!.vel;
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(config.player.moveSpeed, 1);
  });

  it('slows to a stop without input', () => {
    const { world, state } = newGame();
    run(world, state, 30, () => input({ moveY: 1 }));
    run(world, state, 60, () => input());
    expect(Math.hypot(state.players[0]!.vel.x, state.players[0]!.vel.y)).toBeLessThan(0.01);
  });

  it('stays inside the map bounds', () => {
    const { world, state } = newGame();
    run(world, state, 30 * 30, () => input({ moveX: -1, moveY: -1 }));
    const p = state.players[0]!;
    expect(p.pos.x).toBeCloseTo(p.radius, 6);
    expect(p.pos.y).toBeCloseTo(p.radius, 6);
  });

  it('keeps the previous aim when the aim input is zero', () => {
    const { world, state } = newGame();
    run(world, state, 1, () => input({ aimX: 0, aimY: -5 }));
    run(world, state, 1, () => input({ aimX: 0, aimY: 0 }));
    expect(state.players[0]!.aim).toEqual({ x: 0, y: -1 });
  });

  it('sanitizes NaN and out-of-range input', () => {
    const clean = sanitizeInput(input({ moveX: Number.NaN, moveY: 9, aimX: Infinity, weaponSlot: 7 as never }));
    expect(clean.moveX).toBe(0);
    expect(clean.moveY).toBe(1);
    expect(clean.aimX).toBe(0);
    expect(clean.weaponSlot).toBe(-1);
  });
});
