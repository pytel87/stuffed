import { describe, expect, it } from 'vitest';
import { applyDamage, BACKYARD, BEDROOM, BotController, Btn, createGame, createWorld, makeWeapon, spawnLoot, step, wading } from '../src/index.ts';
import type { EntityId, Input, MapData, Player } from '../src/index.ts';
import { openChest } from '../src/systems/loot.ts';
import { input, roster, run } from './helpers.ts';

const insideBox = (x: number, y: number, b: { x: number; y: number; w: number; h: number }, margin: number) =>
  x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin;

function solo(map: MapData, at: { x: number; y: number }, z = 0) {
  const world = createWorld(map);
  const state = createGame({ seed: 1, map, roster: roster(2) });
  const [p, other] = state.players as [Player, Player];
  other.pos = { x: 4, y: 4 };
  p.pos = { ...at };
  p.z = z;
  return { world, state, p, other };
}

describe('the Backyard', () => {
  const map = BACKYARD;

  it('has room for 16 plushies, spread out and clear of walls and water', () => {
    expect(map.spawns.length).toBeGreaterThanOrEqual(16);
    for (const s of map.spawns) {
      expect(s.x).toBeGreaterThan(2);
      expect(s.y).toBeGreaterThan(2);
      expect(s.x).toBeLessThan(map.width - 2);
      expect(s.y).toBeLessThan(map.height - 2);
      for (const wall of map.walls) expect(insideBox(s.x, s.y, wall, 1)).toBe(false);
      for (const pool of map.pools ?? []) expect(Math.hypot(s.x - pool.center.x, s.y - pool.center.y)).toBeGreaterThan(pool.radius);
    }
    for (const a of map.spawns) for (const b of map.spawns) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5);
  });

  it('keeps every wall and chest inside the map, and chests clear of walls', () => {
    for (const wall of map.walls) {
      expect(wall.x).toBeGreaterThanOrEqual(0);
      expect(wall.y).toBeGreaterThanOrEqual(0);
      expect(wall.x + wall.w).toBeLessThanOrEqual(map.width);
      expect(wall.y + wall.h).toBeLessThanOrEqual(map.height);
    }
    for (const c of map.chestSpawns) {
      for (const wall of map.walls) expect(insideBox(c.x, c.y, wall, 0.7), `chest at ${c.x},${c.y}`).toBe(false);
    }
  });

  it('slows plushies wading in the pool', () => {
    const pool = map.pools![0]!;
    // Away from the chest in the middle of the water.
    const water = { x: pool.center.x - 5, y: pool.center.y - 2 };
    const walk = (at: { x: number; y: number }) => {
      const { world, state, p } = solo(map, at);
      expect(wading(world, p)).toBe(at === water);
      run(world, state, 15, (id) => (id === p.id ? input({ moveY: 1 }) : input()));
      return p.pos.y - at.y;
    };
    const inWater = walk(water);
    const onLawn = walk({ x: 120, y: 20 });
    expect(inWater).toBeLessThan(onLawn * 0.7);
  });

  it('opens high-level chests with rarer loot than low-level ones', () => {
    const average = (loot: 'low' | 'high') => {
      const world = createWorld(map);
      const state = createGame({ seed: 3, map, roster: roster(2) });
      let sum = 0;
      for (let i = 0; i < 300; i++) {
        const chest = { id: 9000 + i, pos: { x: 64, y: 30 }, opened: false, loot };
        state.loot = [];
        openChest(world, state, chest, null);
        const weapon = state.loot.find((l) => l.content.type === 'weapon');
        sum += weapon?.rarity ?? 0;
      }
      return sum / 300;
    };
    expect(average('high')).toBeGreaterThan(average('low') + 0.5);
  });

  it('lets you climb the treehouse crates onto the platform', () => {
    // On top of the tall crate south of the platform: jump north onto it.
    const { world, state, p } = solo(map, { x: 33.5, y: 33.5 }, 1.8);
    run(world, state, 3, (id) => (id === p.id ? input({ buttons: Btn.Jump, moveY: -1 }) : input()));
    run(world, state, 40, (id) => (id === p.id ? input({ moveY: -0.4 }) : input()));
    expect(p.pos.y).toBeLessThan(32);
    expect(p.z).toBeCloseTo(2.7, 1);
  });

  it('lets you get onto the house roof from the rain barrel', () => {
    const { world, state, p } = solo(map, { x: 50.5, y: 58 }, 1.3);
    run(world, state, 3, (id) => (id === p.id ? input({ buttons: Btn.Jump, moveX: 1 }) : input()));
    run(world, state, 40, (id) => (id === p.id ? input({ moveX: 0.5 }) : input()));
    expect(p.pos.x).toBeGreaterThan(53);
    expect(p.z).toBeCloseTo(2.6, 1);
  });

  it("can't pick up what lies on the lawn from a roof, or open a chest below", () => {
    // On the house roof, right above the chest in the west room.
    const { world, state, p } = solo(map, { x: 57, y: 69 }, 2.6);
    spawnLoot(world, state, { x: 57.5, y: 69 }, { type: 'weapon', weapon: makeWeapon('super_soaker', 4) });
    expect(state.loot.at(-1)!.z).toBe(0);
    run(world, state, 1, (id) => (id === p.id ? input({ buttons: Btn.Interact }) : input()));
    run(world, state, 40, (id) => (id === p.id ? input({ buttons: Btn.Interact }) : input()));
    expect(p.weapons.some((w) => w?.kind === 'super_soaker')).toBe(false);
    expect(state.chests.every((c) => !c.opened)).toBe(true);
    expect(p.z).toBeCloseTo(2.6, 1);
  });

  it('drops a knocked-out plush\'s things on the roof it stood on', () => {
    const { world, state, p } = solo(map, { x: 70, y: 64 }, 2.6);
    p.weapons = [makeWeapon('foam_dart_smg', 2), null];
    applyDamage(state, p, 1000, null);
    run(world, state, 1, () => input());
    const dropped = state.loot.filter((l) => l.content.type === 'weapon');
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.z).toBeCloseTo(2.6, 5);
  });

  it('plays a full bot match to the end', () => {
    const world = createWorld(map);
    const state = createGame({ seed: 7, map, roster: Array.from({ length: 16 }, (_, i) => ({ name: `b${i}`, isBot: true })) });
    const bots = new BotController(7);
    const limit = 30 * 700;
    while (state.status === 'playing' && state.tick < limit) step(world, state, bots.inputs(world, state) as Map<EntityId, Input>);
    expect(state.status).toBe('ended');
  });
});

describe('the Bedroom', () => {
  const map = BEDROOM;

  it('has room for 16 plushies, spread out and clear of walls and furniture', () => {
    expect(map.spawns.length).toBeGreaterThanOrEqual(16);
    for (const s of map.spawns) {
      for (const wall of map.walls) expect(insideBox(s.x, s.y, wall, 1), `spawn ${s.x},${s.y}`).toBe(false);
      for (const b of map.buildings) expect(insideBox(s.x, s.y, b, 1), `spawn ${s.x},${s.y}`).toBe(false);
    }
    for (const a of map.spawns) for (const b of map.spawns) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5);
  });

  it('keeps every wall and chest inside the map, and chests clear of walls', () => {
    for (const wall of map.walls) {
      expect(wall.x).toBeGreaterThanOrEqual(0);
      expect(wall.y).toBeGreaterThanOrEqual(0);
      expect(wall.x + wall.w).toBeLessThanOrEqual(map.width);
      expect(wall.y + wall.h).toBeLessThanOrEqual(map.height);
    }
    for (const c of map.chestSpawns) {
      for (const wall of map.walls) expect(insideBox(c.x, c.y, wall, 0.7), `chest at ${c.x},${c.y}`).toBe(false);
    }
  });

  it('lets you climb from the toy box onto the bed', () => {
    const { world, state, p } = solo(map, { x: 33.4, y: 18.1 }, 1.1);
    run(world, state, 3, (id) => (id === p.id ? input({ buttons: Btn.Jump, moveX: -1 }) : input()));
    run(world, state, 30, (id) => (id === p.id ? input({ moveX: -1 }) : input()));
    expect(p.pos.x).toBeLessThan(32);
    expect(p.z).toBeCloseTo(2.2, 1);
  });

  it('lets you climb from the chair onto the desk', () => {
    const { world, state, p } = solo(map, { x: 85.5, y: 20.9 }, 1.2);
    run(world, state, 3, (id) => (id === p.id ? input({ buttons: Btn.Jump, moveY: -1 }) : input()));
    run(world, state, 30, (id) => (id === p.id ? input({ moveY: -1 }) : input()));
    expect(p.pos.y).toBeLessThan(19);
    expect(p.z).toBeCloseTo(2.6, 1);
  });

  it('plays a whole bots-only match to the end', () => {
    const world = createWorld(map);
    const state = createGame({ seed: 4, map, roster: Array.from({ length: 16 }, (_, i) => ({ name: `b${i}`, isBot: true })), zoneTimeScale: 0.3 });
    const bots = new BotController(4);
    for (let t = 0; t < 30 * 60 * 4 && state.status === 'playing'; t++) step(world, state, bots.inputs(world, state));
    expect(state.status).toBe('ended');
    expect(state.chests.some((c) => c.opened)).toBe(true);
  });
});
