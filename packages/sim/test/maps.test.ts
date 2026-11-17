import { describe, expect, it } from 'vitest';
import { applyDamage, BACKYARD, BEDROOM, BotController, Btn, createGame, createWorld, makeWeapon, spawnLoot, step, TRAIN, trainCars, wading } from '../src/index.ts';
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

describe('the toy train', () => {
  const map = BEDROOM;
  const track = map.track!;

  it('runs round the track at its speed, the same at the same tick', () => {
    const a = trainCars(track, 300);
    const b = trainCars(track, 300);
    expect(a).toEqual(b);
    expect(a).toHaveLength(track.cars);
    const later = trainCars(track, 330);
    const moved = Math.hypot(later[0]!.pos.x - a[0]!.pos.x, later[0]!.pos.y - a[0]!.pos.y);
    expect(moved).toBeCloseTo(track.speed, 0);
  });

  it('shoves a plush standing on the rails out of the way', () => {
    const engine = trainCars(track, 100)[0]!;
    // Just ahead of the engine, on the rails, when it gets there.
    const at = { x: engine.pos.x + engine.dir.x * 3, y: engine.pos.y + engine.dir.y * 3 };
    const { world, state, p } = solo(map, at);
    state.tick = 100;
    let bumped = false;
    for (let i = 0; i < 40 && !bumped; i++) {
      run(world, state, 1, () => input());
      bumped = state.events.some((e) => e.type === 'trainBump' && e.playerId === p.id);
    }
    expect(bumped).toBe(true);
    for (const car of trainCars(track, state.tick)) expect(Math.hypot(p.pos.x - car.pos.x, p.pos.y - car.pos.y)).toBeGreaterThan(0.9);
  });

  it('carries a plush standing on a wagon round the track', () => {
    const wagon = trainCars(track, 150)[2]!;
    const { world, state, p } = solo(map, { ...wagon.pos }, TRAIN.deckHeight);
    state.tick = 150;
    run(world, state, 60, () => input());
    const now = trainCars(track, state.tick)[2]!;
    expect(p.z).toBeCloseTo(TRAIN.deckHeight, 2);
    expect(Math.hypot(p.pos.x - now.pos.x, p.pos.y - now.pos.y)).toBeLessThan(0.3);
  });

  it('can be jumped onto from beside the track', () => {
    const tick = 400;
    const wagon = trainCars(track, tick + 10)[2]!;
    const side = { x: -wagon.dir.y, y: wagon.dir.x };
    // Beside where the wagon will be in a moment: jump toward it, and let go once on board.
    const { world, state, p } = solo(map, { x: wagon.pos.x + side.x * 3, y: wagon.pos.y + side.y * 3 });
    state.tick = tick;
    let onBoard = false;
    for (let i = 0; i < 25 && !onBoard; i++) {
      run(world, state, 1, (id) => (id === p.id ? input({ buttons: i < 2 ? Btn.Jump : 0, moveX: -side.x, moveY: -side.y }) : input()));
      onBoard = i > 3 && Math.abs(p.z - TRAIN.deckHeight) < 0.01 && p.vz === 0;
    }
    expect(onBoard).toBe(true);
    // Standing still, it rides along.
    run(world, state, 30, () => input());
    expect(p.z).toBeCloseTo(TRAIN.deckHeight, 2);
  });

  it('stops shots', () => {
    const car = trainCars(track, 200)[1]!;
    // Beside the car, shooting straight at it.
    const side = { x: -car.dir.y, y: car.dir.x };
    const { world, state, p } = solo(map, { x: car.pos.x + side.x * 4, y: car.pos.y + side.y * 4 });
    state.tick = 200;
    p.weapons = [makeWeapon('cork_popper', 0), null];
    run(world, state, 1, (id) => (id === p.id ? input({ aimX: -side.x * 4, aimY: -side.y * 4, buttons: Btn.Fire }) : input()));
    run(world, state, 8, () => input());
    expect(state.projectiles).toHaveLength(0);
  });
});

describe('the toy train and loot', () => {
  it('pushes loot off the rails instead of running through it', () => {
    const map = BEDROOM;
    const engine = trainCars(map.track!, 200)[0]!;
    const { world, state } = solo(map, { x: 4, y: 60 });
    state.tick = 200;
    const at = { x: engine.pos.x + engine.dir.x * 4, y: engine.pos.y + engine.dir.y * 4 };
    const loot = spawnLoot(world, state, at, { type: 'weapon', weapon: makeWeapon('cork_popper', 0) });
    run(world, state, 60, () => input());
    for (let t = state.tick - 60; t <= state.tick; t += 5) {
      for (const car of trainCars(map.track!, t)) expect(Math.hypot(loot.pos.x - car.pos.x, loot.pos.y - car.pos.y)).toBeGreaterThan(0.9);
    }
    expect(Math.hypot(loot.pos.x - at.x, loot.pos.y - at.y)).toBeGreaterThan(0.5);
  });
});
