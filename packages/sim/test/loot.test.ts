import { describe, expect, it } from 'vitest';
import { applyDamage, Btn, circleBoxPush, config, makeWeapon, rng, secondsToTicks, TEST_MAP } from '../src/index.ts';
import type { GameState, MapData, Player } from '../src/index.ts';
import { input, newGame, OPEN_MAP, run } from './helpers.ts';

const withChest = (x = 22, y = 40): MapData => ({ ...OPEN_MAP, id: 'chest', chestSpawns: [{ x, y }] });
const OPEN_TICKS = secondsToTicks(config.chest.openTime);
const holdE = input({ buttons: Btn.Interact });
const idle = input();

function solo(map: MapData = withChest()) {
  const g = newGame(1, 1, map);
  const p = g.state.players[0]!;
  p.pos = { x: 20.5, y: 40 };
  return { ...g, p };
}

const weaponsOnGround = (s: GameState) => s.loot.filter((l) => l.content.type === 'weapon');
const itemsOnGround = (s: GameState) => s.loot.filter((l) => l.content.type === 'item');

describe('chests', () => {
  it('open after holding E for the open time and drop a weapon and an item', () => {
    const { world, state, p } = solo();
    run(world, state, OPEN_TICKS, () => holdE);
    expect(state.chests[0]!.opened).toBe(false);
    run(world, state, 1, () => holdE);
    expect(state.chests[0]!.opened).toBe(true);
    expect(weaponsOnGround(state)).toHaveLength(1);
    expect(state.loot.length).toBeGreaterThanOrEqual(1);
    expect(state.events).toContainEqual({ type: 'chestOpened', chestId: state.chests[0]!.id, playerId: p.id });
  });

  it('cancel when E is released early', () => {
    const { world, state, p } = solo();
    run(world, state, OPEN_TICKS - 5, () => holdE);
    run(world, state, 1, () => idle);
    expect(p.action).toBeNull();
    run(world, state, 10, () => holdE); // a fresh press starts over
    expect(state.chests[0]!.opened).toBe(false);
  });

  it('cancel when you walk out of range', () => {
    const { world, state, p } = solo();
    run(world, state, 5, () => holdE);
    run(world, state, 25, () => input({ buttons: Btn.Interact, moveX: -1 }));
    expect(p.action).toBeNull();
    expect(state.chests[0]!.opened).toBe(false);
  });

  it('cancel when you shoot', () => {
    const { world, state, p } = solo();
    run(world, state, 5, () => holdE);
    run(world, state, 1, () => input({ buttons: Btn.Interact | Btn.Fire, aimX: -1 }));
    expect(p.action).toBeNull();
  });

  it('are solid', () => {
    const { world, state, p } = solo();
    run(world, state, 60, () => input({ moveX: 1 }));
    expect(p.pos.x).toBeLessThanOrEqual(22 - config.chest.radius - p.radius + 1e-9);
  });

  it('roll rarity close to the configured odds', () => {
    const r = rng.seedRng(11);
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 20_000; i++) counts[rng.pickIndexWeighted(r, config.chest.rarityWeights.medium)]!++;
    const total = config.chest.rarityWeights.medium.reduce((a, b) => a + b, 0);
    config.chest.rarityWeights.medium.forEach((w, i) => expect(counts[i]! / 20_000).toBeCloseTo(w / total, 1));
  });
});

describe('weapon pickup', () => {
  function withWeaponOnGround(slots: Player['weapons']) {
    const g = solo(OPEN_MAP);
    g.p.weapons = slots;
    g.state.loot.push({ id: 999, pos: { x: 21.5, y: 40 }, z: 0, rarity: 3, content: { type: 'weapon', weapon: makeWeapon('foam_dart_smg', 3) } });
    return g;
  }

  it('fills an empty slot with E and switches to it', () => {
    const { world, state, p } = withWeaponOnGround([makeWeapon('cork_popper', 0), null]);
    run(world, state, 1, () => holdE);
    expect(p.weapons[1]?.kind).toBe('foam_dart_smg');
    expect(p.activeSlot).toBe(1);
    expect(state.loot).toHaveLength(0);
  });

  it('swaps with the active weapon when both slots are full, dropping the old one', () => {
    const { world, state, p } = withWeaponOnGround([makeWeapon('cork_popper', 0), makeWeapon('super_soaker', 1)]);
    run(world, state, 1, () => holdE);
    expect(p.weapons[0]?.kind).toBe('foam_dart_smg');
    expect(weaponsOnGround(state).map((l) => l.content.type === 'weapon' && l.content.weapon.kind)).toEqual(['cork_popper']);
  });

  it('needs a fresh press, not a held E', () => {
    const { world, state, p } = withWeaponOnGround([makeWeapon('cork_popper', 0), null]);
    p.heldButtons = Btn.Interact;
    run(world, state, 1, () => holdE);
    expect(p.weapons[1]).toBeNull();
  });
});

describe('items', () => {
  function withItems(kind: 'cotton_puff' | 'sewing_kit' | 'button_pack', count: number) {
    const g = solo(OPEN_MAP);
    g.state.loot.push({ id: 999, pos: { x: 21, y: 40 }, z: 0, rarity: 0, content: { type: 'item', item: { kind, count } } });
    return g;
  }

  it('are picked up by walking over them and stack up to the max', () => {
    const { world, state, p } = withItems('cotton_puff', 7);
    run(world, state, 1, () => idle);
    const max = config.items.cotton_puff.maxStack;
    expect(p.items[0]).toEqual({ kind: 'cotton_puff', count: max });
    expect(p.items[1]).toEqual({ kind: 'cotton_puff', count: 7 - max });
    expect(state.loot).toHaveLength(0);
  });

  it('stay on the ground when there is no room', () => {
    const { world, state, p } = withItems('sewing_kit', 1);
    p.items = [
      { kind: 'cotton_puff', count: 1 },
      { kind: 'button_pack', count: 1 },
      { kind: 'cotton_puff', count: 5 },
    ];
    run(world, state, 1, () => idle);
    expect(itemsOnGround(state)).toHaveLength(1);
  });

  it('Cotton Puff heals 15 up to full, and takes its use time', () => {
    const { world, state, p } = solo(OPEN_MAP);
    p.items[0] = { kind: 'cotton_puff', count: 2 };
    p.stuffing = 90;
    run(world, state, 1, () => input({ useItemSlot: 0 }));
    run(world, state, secondsToTicks(config.items.cotton_puff.useTime) - 1, () => idle);
    expect(p.stuffing).toBe(90);
    run(world, state, 1, () => idle);
    expect(p.stuffing).toBe(100);
    expect(p.items[0]).toEqual({ kind: 'cotton_puff', count: 1 });
    run(world, state, 1, () => input({ useItemSlot: 0 }));
    expect(p.action).toBeNull(); // already full: nothing to do
  });

  it('Sewing Kit heals 50 up to 100; Button Pack adds 25 armor up to 100', () => {
    const { world, state, p } = solo(OPEN_MAP);
    p.items = [{ kind: 'sewing_kit', count: 1 }, { kind: 'button_pack', count: 1 }, null];
    p.stuffing = 80;
    p.buttons = 90;
    run(world, state, 1, () => input({ useItemSlot: 0 }));
    run(world, state, secondsToTicks(config.items.sewing_kit.useTime), () => idle);
    expect(p.stuffing).toBe(100);
    expect(p.items[0]).toBeNull();
    run(world, state, 1, () => input({ useItemSlot: 1 }));
    run(world, state, secondsToTicks(config.items.button_pack.useTime), () => idle);
    expect(p.buttons).toBe(100);
  });

  it('slow you down while in use and are cancelled by shooting', () => {
    const { world, state, p } = solo(OPEN_MAP);
    p.items[0] = { kind: 'sewing_kit', count: 1 };
    p.stuffing = 50;
    run(world, state, 1, () => input({ useItemSlot: 0 }));
    run(world, state, 30, () => input({ moveY: 1 }));
    expect(Math.hypot(p.vel.x, p.vel.y)).toBeCloseTo(config.player.moveSpeed * config.itemUseMoveMultiplier, 1);
    run(world, state, 1, () => input({ buttons: Btn.Fire, aimX: 1 }));
    expect(p.action).toBeNull();
    expect(p.items[0]?.count).toBe(1);
  });
});

describe('knockouts', () => {
  it('drop every weapon and item the plush carried', () => {
    const { world, state } = newGame(1, 3, OPEN_MAP);
    const [a, b] = state.players as [Player, Player];
    a.pos = { x: 20, y: 40 };
    b.pos = { x: 40, y: 40 };
    b.weapons = [makeWeapon('super_soaker', 2), makeWeapon('foam_dart_smg', 1)];
    b.items = [{ kind: 'cotton_puff', count: 3 }, null, { kind: 'button_pack', count: 1 }];
    applyDamage(state, b, 200, a.id);
    run(world, state, 1, () => idle);
    expect(b.weapons).toEqual([null, null]);
    expect(state.loot).toHaveLength(4);
    for (const l of state.loot) expect(Math.hypot(l.pos.x - 40, l.pos.y - 40)).toBeLessThan(2);
  });
});

describe('test map chests', () => {
  it('are inside the map, clear of walls and spawns', () => {
    const r = config.chest.radius;
    expect(TEST_MAP.chestSpawns.length).toBeGreaterThanOrEqual(25);
    for (const c of TEST_MAP.chestSpawns) {
      expect(c.x).toBeGreaterThan(r);
      expect(c.y).toBeGreaterThan(r);
      for (const w of TEST_MAP.walls) expect(circleBoxPush(c.x, c.y, r + 0.3, w)).toBeNull();
      for (const s of TEST_MAP.spawns) expect(Math.hypot(s.x - c.x, s.y - c.y)).toBeGreaterThan(r + config.player.radius + 1);
    }
  });
});
