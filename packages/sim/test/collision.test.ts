import { describe, expect, it } from 'vitest';
import { Btn, canSee, circleBoxPush, config, createWorld, makeWeapon, raycastWalls, rng, segmentBoxT, StaticBoxHash, TEST_MAP } from '../src/index.ts';
import type { Building, MapData, Player, Wall } from '../src/index.ts';
import { input, newGame, OPEN_MAP, run } from './helpers.ts';

/** Too tall to jump, so these tests are about walls that always block. */
const WALL: Wall = { x: 30, y: 30, w: 2, h: 20, height: 3 };
const walled = (walls: Wall[] = [WALL], bushes: MapData['bushes'] = [], buildings: Building[] = []): MapData => ({
  ...OPEN_MAP,
  id: 'walled',
  walls,
  bushes,
  buildings,
});

function place(players: Player[], ...spots: [number, number][]) {
  spots.forEach(([x, y], i) => (players[i]!.pos = { x, y }));
}

describe('geometry', () => {
  it('pushes a circle out of a box along the nearest face', () => {
    expect(circleBoxPush(29.8, 35, 0.5, WALL)).toEqual({ nx: -1, ny: 0, depth: expect.closeTo(0.3, 9) });
    expect(circleBoxPush(29, 35, 0.5, WALL)).toBeNull();
    const inside = circleBoxPush(30.4, 40, 0.5, WALL)!;
    expect(inside.nx).toBe(-1);
    expect(inside.depth).toBeCloseTo(0.9, 9);
  });

  it('finds where a padded segment first touches a box', () => {
    expect(segmentBoxT(20, 35, 20, 0, WALL)).toBeCloseTo(0.5, 9);
    expect(segmentBoxT(20, 35, 20, 0, WALL, 1)).toBeCloseTo(0.45, 9);
    expect(segmentBoxT(20, 25, 20, 0, WALL)).toBeNull();
    expect(segmentBoxT(31, 35, 5, 0, WALL)).toBe(0);
  });

  it('spatial hash returns every box a brute-force search would', () => {
    const r = rng.seedRng(4);
    const boxes = Array.from({ length: 60 }, () => ({ x: rng.nextRange(r, 0, 70), y: rng.nextRange(r, 0, 70), w: rng.nextRange(r, 0.5, 8), h: rng.nextRange(r, 0.5, 8), height: 1 }));
    const hash = new StaticBoxHash(boxes);
    for (let q = 0; q < 200; q++) {
      const x = rng.nextRange(r, 0, 75);
      const y = rng.nextRange(r, 0, 75);
      const s = rng.nextRange(r, 0.1, 6);
      const brute = boxes.flatMap((b, i) => (b.x <= x + s && b.x + b.w >= x && b.y <= y + s && b.y + b.h >= y ? [i] : []));
      const found = hash.query(x, y, x + s, y + s);
      for (const i of brute) expect(found).toContain(i);
      expect(found).toEqual([...found].sort((a, b) => a - b));
    }
  });
});

describe('walls and movement', () => {
  it('stop a plush walking into them', () => {
    const { world, state } = newGame(1, 1, walled());
    place(state.players, [25, 35]);
    run(world, state, 90, () => input({ moveX: 1 }));
    const p = state.players[0]!;
    expect(p.pos.x).toBeCloseTo(WALL.x - p.radius, 6);
    expect(p.vel.x).toBeCloseTo(0, 6);
  });

  it('let a plush slide along them', () => {
    const { world, state } = newGame(1, 1, walled());
    place(state.players, [29.4, 35]);
    run(world, state, 30, () => input({ moveX: 1, moveY: 1 }));
    const p = state.players[0]!;
    expect(p.pos.x).toBeLessThanOrEqual(WALL.x - p.radius + 1e-9);
    expect(p.pos.y).toBeGreaterThan(37);
  });

  it('hold against strong knockback (no tunneling through a thin wall)', () => {
    const thin: Wall = { x: 30, y: 30, w: 1, h: 20, height: 3 };
    const { world, state } = newGame(1, 1, walled([thin]));
    place(state.players, [29, 35]);
    state.players[0]!.knockback = { x: 60, y: 0 };
    run(world, state, 30, () => input());
    expect(state.players[0]!.pos.x).toBeLessThan(thin.x);
  });

  it('plushies push each other apart instead of overlapping', () => {
    const { world, state } = newGame(1, 2);
    place(state.players, [20, 40], [24, 40]);
    run(world, state, 60, (id) => input({ moveX: id === state.players[0]!.id ? 1 : -1 }));
    const [a, b] = state.players as [Player, Player];
    expect(Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y)).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6);
  });

  it('separates plushies that start exactly on top of each other', () => {
    const { world, state } = newGame(1, 2);
    place(state.players, [20, 40], [20, 40]);
    run(world, state, 1, () => input());
    const [a, b] = state.players as [Player, Player];
    expect(Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y)).toBeCloseTo(a.radius + b.radius, 6);
  });
});

describe('walls and projectiles', () => {
  it('stop shots and protect whoever is behind them', () => {
    const { world, state } = newGame(1, 2, walled());
    place(state.players, [25, 35], [36, 35]);
    const [a, b] = state.players as [Player, Player];
    run(world, state, 1, (id) => (id === a.id ? input({ aimX: 1, buttons: Btn.Fire }) : input()));
    let impacts = 0;
    for (let t = 0; t < 30; t++) {
      run(world, state, 1, () => input());
      impacts += state.events.filter((e) => e.type === 'impact').length;
    }
    expect(b.stuffing).toBe(100);
    expect(impacts).toBe(1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('a barrel pushed into a wall cannot shoot through it', () => {
    const { world, state } = newGame(1, 2, walled());
    place(state.players, [29.45, 35], [33, 35]);
    const [a, b] = state.players as [Player, Player];
    a.weapons = [makeWeapon('super_soaker', 0), null];
    run(world, state, 1, (id) => (id === a.id ? input({ aimX: 1, buttons: Btn.Fire }) : input()));
    run(world, state, 30, () => input());
    expect(b.stuffing).toBe(100);
  });
});

describe('sight: bushes and roofs', () => {
  it('raycastWalls finds walls on a path and nothing on open ground', () => {
    const world = createWorld(walled());
    expect(raycastWalls(world, { x: 25, y: 35 }, { x: 36, y: 35 })).not.toBeNull();
    expect(raycastWalls(world, { x: 25, y: 25 }, { x: 36, y: 25 })).toBeNull();
  });

  it('canSee: walls do not hide, bushes do, range limits', () => {
    const bushMap = walled([WALL], [{ center: { x: 20, y: 60 }, radius: 2 }]);
    const { world, state } = newGame(1, 3, bushMap);
    place(state.players, [25, 35], [36, 35], [20, 60]);
    const [a, b, c] = state.players as [Player, Player, Player];
    run(world, state, 1, () => input());
    expect(canSee(world, state, a, b)).toBe(true); // a wall between them doesn't hide
    expect(c.inBush).toBe(true);
    place(state.players, [20, 50]);
    expect(canSee(world, state, a, c)).toBe(false); // hidden in the bush
    c.revealedUntilTick = state.tick + 10;
    expect(canSee(world, state, a, c)).toBe(true); // shooting reveals
    c.revealedUntilTick = 0;
    place(state.players, [20, 58.6]);
    expect(canSee(world, state, a, c)).toBe(true); // right next to the bush
    a.pos = { x: 5, y: 5 };
    b.pos = { x: 5 + config.vision.range + 1, y: 5 };
    expect(canSee(world, state, a, b)).toBe(false); // out of range
  });

  it('canSee: a roof hides those inside from those outside, not from each other', () => {
    const roofed = walled([], [], [{ x: 40, y: 40, w: 10, h: 10, height: 1.4 }]);
    const { world, state } = newGame(1, 3, roofed);
    place(state.players, [30, 45], [45, 45], [47, 42]);
    const [outside, inA, inB] = state.players as [Player, Player, Player];
    run(world, state, 1, () => input());
    expect(inA.building).toBe(0);
    expect(outside.building).toBe(-1);
    expect(canSee(world, state, outside, inA)).toBe(false);
    expect(canSee(world, state, inA, inB)).toBe(true);
    expect(canSee(world, state, inA, outside)).toBe(true); // you can see out
    inA.revealedUntilTick = state.tick + 30;
    expect(canSee(world, state, outside, inA)).toBe(false); // shooting doesn't lift the roof
  });

  it('shooting from a bush reveals the shooter for a while', () => {
    const bushMap = walled([], [{ center: { x: 20, y: 40 }, radius: 2 }]);
    const { world, state } = newGame(1, 1, bushMap);
    place(state.players, [20, 40]);
    run(world, state, 1, () => input({ aimX: 1, buttons: Btn.Fire }));
    const p = state.players[0]!;
    expect(p.inBush).toBe(true);
    expect(p.revealedUntilTick).toBeGreaterThan(state.tick);
  });
});

describe('test map', () => {
  it('has every spawn inside the map, clear of walls', () => {
    const r = config.player.radius;
    for (const s of TEST_MAP.spawns) {
      expect(s.x).toBeGreaterThan(r);
      expect(s.y).toBeGreaterThan(r);
      expect(s.x).toBeLessThan(TEST_MAP.width - r);
      expect(s.y).toBeLessThan(TEST_MAP.height - r);
      for (const w of TEST_MAP.walls) expect(circleBoxPush(s.x, s.y, r + 0.5, w)).toBeNull();
    }
  });
});
