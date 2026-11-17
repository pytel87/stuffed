import { describe, expect, it } from 'vitest';
import { Btn, config, createGame, createWorld, makeWeapon, secondsToTicks, step } from '../src/index.ts';
import type { EntityId, GameEvent, Input, ItemKind, Player } from '../src/index.ts';
import { input, OPEN_MAP, roster } from './helpers.ts';

/** You at (20, 40) aiming +x with `kind` in item slot 0; a second plush at (40, 60). */
function holding(kind: ItemKind, count = 1) {
  const world = createWorld(OPEN_MAP);
  const state = createGame({ seed: 1, map: OPEN_MAP, roster: roster(2) });
  const [you, other] = state.players as [Player, Player];
  you.pos = { x: 20, y: 40 };
  other.pos = { x: 40, y: 60 };
  you.items = [{ kind, count }, null, null];
  const events: GameEvent[] = [];
  const play = (ticks: number, mine: Partial<Input> = {}, theirs: Partial<Input> = {}) => {
    for (let t = 0; t < ticks; t++) {
      const inputs = new Map<EntityId, Input>([
        [you.id, input({ aimX: 1, aimY: 0, ...mine })],
        [other.id, input(theirs)],
      ]);
      step(world, state, inputs);
      events.push(...state.events);
    }
  };
  return { world, state, you, other, events, play };
}

const use = { useItemSlot: 0 as const };

describe('Big Stuffing Bag', () => {
  it('fills stuffing all the way, after a long 8 s', () => {
    const g = holding('big_stuffing_bag');
    g.you.stuffing = 20;
    g.play(1, use);
    g.play(secondsToTicks(7));
    expect(g.you.stuffing).toBe(20);
    g.play(secondsToTicks(1.1));
    expect(g.you.stuffing).toBe(100);
    expect(g.you.items[0]).toBeNull();
  });
});

describe('Juice Box', () => {
  it('heals a little every second for 10 s and speeds you up meanwhile', () => {
    const g = holding('juice_box');
    g.you.stuffing = 40;
    g.play(1, use);
    g.play(secondsToTicks(2.1));
    g.play(secondsToTicks(4));
    expect(g.you.stuffing).toBeGreaterThan(55);
    expect(g.you.stuffing).toBeLessThan(65);

    const start = g.you.pos.y;
    g.play(20, { moveY: 1 });
    const juiced = g.you.pos.y - start;
    const plain = holding('cotton_puff');
    plain.play(20, { moveY: 1 });
    expect(juiced).toBeGreaterThan((plain.you.pos.y - 40) * 1.1);
  });
});

describe('Bouncy Ball', () => {
  it('dashes you where you move, right away, with a hop', () => {
    const g = holding('bouncy_ball', 2);
    g.play(1, { ...use, moveX: 1 });
    expect(g.events.some((e) => e.type === 'dash')).toBe(true);
    expect(g.you.vz).toBeGreaterThan(0);
    g.play(10, { moveX: 1 });
    const dashed = g.you.pos.x - 20;
    const plain = holding('cotton_puff');
    plain.play(11, { moveX: 1 });
    expect(dashed).toBeGreaterThan((plain.you.pos.x - 20) * 1.5);
    expect(g.you.items[0]).toEqual({ kind: 'bouncy_ball', count: 1 });
  });
});

describe('Cardboard Wall', () => {
  it('stands up in front of you and blocks plushies and shots, until shot down', () => {
    const g = holding('cardboard_wall');
    g.play(1, use);
    g.play(secondsToTicks(1.1));
    expect(g.state.placedWalls).toHaveLength(1);
    const wall = g.state.placedWalls[0]!;
    // Across your aim (+x): thin in x, long in y, about 1.6 ahead.
    expect(wall.w).toBeLessThan(wall.h);
    expect(wall.x + wall.w / 2).toBeCloseTo(21.6, 1);

    // You can't walk through it.
    g.play(40, { moveX: 1 });
    expect(g.you.pos.x).toBeLessThan(wall.x);

    // The other plush shoots it from behind until it breaks.
    g.other.pos = { x: 26, y: 40 };
    g.other.weapons = [makeWeapon('cork_popper', 0), null];
    g.you.pos = { x: 18, y: 40 };
    g.play(12, {}, { aimX: -8, aimY: 0, buttons: Btn.Fire });
    // The wall takes the first shot, not you behind it.
    expect(wall.health).toBeLessThan(config.itemEffects.wall.health);
    expect(g.you.stuffing).toBe(100);
    g.play(90, {}, { aimX: -8, aimY: 0, buttons: Btn.Fire });
    expect(g.state.placedWalls).toHaveLength(0);
    expect(g.events.some((e) => e.type === 'wallBroken')).toBe(true);
  });

  it('folds away after a while, and only so many stand per plush', () => {
    const g = holding('cardboard_wall', config.items.cardboard_wall.maxStack);
    for (let i = 0; i < 2; i++) {
      g.play(1, use);
      g.play(secondsToTicks(1.1), { aimX: i ? 0 : 1, aimY: i ? 1 : 0 });
    }
    expect(g.state.placedWalls).toHaveLength(2);
    g.play(secondsToTicks(config.itemEffects.wall.seconds));
    expect(g.state.placedWalls).toHaveLength(0);
  });

  it("can't be put up from a roof", () => {
    const g = holding('cardboard_wall');
    g.you.z = 2.6;
    g.play(1, use);
    expect(g.you.action).toBeNull();
  });
});
