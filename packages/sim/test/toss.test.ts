import { describe, expect, it } from 'vitest';
import { BACKYARD, BotController, Btn, canSee, config, createGame, createWorld, groundHeight, step } from '../src/index.ts';
import type { EntityId, Input, Player } from '../src/index.ts';
import { input, OPEN_MAP, roster } from './helpers.ts';

function tossed(players = 2, map = OPEN_MAP) {
  const world = createWorld(map);
  const state = createGame({ seed: 4, map, roster: roster(players), toss: true });
  const play = (ticks: number, inputFor: (p: Player) => Partial<Input>) => {
    for (let t = 0; t < ticks; t++) {
      const inputs = new Map<EntityId, Input>(state.players.map((p) => [p.id, input(inputFor(p))]));
      step(world, state, inputs);
    }
  };
  return { world, state, play };
}

describe('the Toss', () => {
  it('starts everyone riding the blimp, high up, and carries them along its line', () => {
    const { state, play } = tossed();
    const [a] = state.players as [Player];
    expect(state.toss).not.toBeNull();
    for (const p of state.players) expect(p).toMatchObject({ drop: 'riding', z: config.toss.height });
    const start = { ...a.pos };
    play(30, () => ({}));
    const moved = Math.hypot(a.pos.x - start.x, a.pos.y - start.y);
    expect(moved).toBeCloseTo(config.toss.speed, 0);
  });

  it('Jump drops you; you glide down, steering, and land', () => {
    const { state, play } = tossed();
    const [a] = state.players as [Player];
    play(60, () => ({}));
    play(1, (p) => (p.id === a.id ? { buttons: Btn.Jump } : {}));
    expect(a.drop).toBe('gliding');
    const x = a.pos.x;
    play(30, (p) => (p.id === a.id ? { moveX: 1 } : {}));
    expect(a.pos.x - x).toBeGreaterThan(config.toss.glideSpeed * 0.6);
    expect(a.z).toBeLessThan(config.toss.height - config.toss.fallSpeed * 0.9);
    play(Math.ceil((config.toss.height / config.toss.fallSpeed) * 30), () => ({}));
    expect(a.drop).toBeNull();
    expect(a.z).toBe(0);
  });

  it('drops whoever is still on board at the end of the line', () => {
    const { state, play } = tossed();
    play(state.toss!.endTick + 1, () => ({}));
    for (const p of state.players) expect(p.drop).toBe('gliding');
  });

  it('keeps riders hidden and droppers safe', () => {
    const { world, state, play } = tossed();
    const [a, b] = state.players as [Player, Player];
    expect(canSee(world, state, a, b)).toBe(false);
    play(1, () => ({ buttons: Btn.Jump }));
    expect(canSee(world, state, a, b)).toBe(true); // gliding: in plain sight
    b.weapons = [{ kind: 'cork_popper', rarity: 0, ammo: 8, nextFireTick: 0, reloadEndTick: null }, null];
    play(20, (p) => (p.id === b.id ? { buttons: Btn.Fire, aimX: 1, aimY: 0 } : {}));
    expect(state.projectiles.filter((q) => q.ownerId === b.id)).toHaveLength(0); // no shooting until landed
    expect(a.stuffing).toBe(100);
  });

  it('bots ride, drop, land and play a full match on the Backyard', () => {
    const world = createWorld(BACKYARD);
    const state = createGame({ seed: 9, map: BACKYARD, roster: Array.from({ length: 12 }, (_, i) => ({ name: `b${i}`, isBot: true })), toss: true });
    const bots = new BotController(9);
    const landedBy = state.toss!.endTick + Math.ceil((config.toss.height / config.toss.fallSpeed) * 30) + 5;
    while (state.tick < landedBy) step(world, state, bots.inputs(world, state));
    for (const p of state.players) expect(p.drop).toBeNull();
    // Nobody is left standing on a roof after a little while (they'd be stuck and hard to hit).
    for (let t = 0; t < 30 * 20; t++) step(world, state, bots.inputs(world, state));
    // (Standing up there: not just in the air, mid-jump, at this moment.)
    const onRoofs = state.players.filter((p) => p.alive && p.z > 1.5 && groundHeight(world, state, p.pos, p.z) > 1.5);
    expect(onRoofs.length).toBeLessThanOrEqual(1);
    // They spread out rather than all landing in one spot.
    const xs = state.players.map((p) => Math.round(p.pos.x / 10));
    expect(new Set(xs).size).toBeGreaterThan(3);
    while (state.status === 'playing' && state.tick < 30 * 700) step(world, state, bots.inputs(world, state));
    expect(state.status).toBe('ended');
  });
});
