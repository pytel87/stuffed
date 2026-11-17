import { describe, expect, it } from 'vitest';
import { Btn, config, makeWeapon } from '../src/index.ts';
import type { Building, Input, MapData, Player, Wall } from '../src/index.ts';
import { input, newGame, OPEN_MAP, run } from './helpers.ts';

const P = config.player;
const APEX = (P.jumpSpeed * P.jumpSpeed) / (2 * P.gravity);
const jump = input({ buttons: Btn.Jump });
const idle = input();

const mapWith = (walls: Wall[] = [], buildings: Building[] = [], chests: { x: number; y: number }[] = []): MapData => ({
  ...OPEN_MAP,
  id: 'jump',
  walls,
  buildings,
  chestSpawns: chests,
});

function solo(map: MapData, x = 20, y = 40) {
  const g = newGame(1, 1, map);
  const p = g.state.players[0]!;
  p.pos = { x, y };
  return { ...g, p };
}

/** Runs ticks with `inp` and returns the highest z reached. */
function peak(g: ReturnType<typeof solo>, ticks: number, inp: (t: number) => Input) {
  let max = 0;
  for (let t = 0; t < ticks; t++) {
    run(g.world, g.state, 1, () => inp(t));
    max = Math.max(max, g.p.z);
  }
  return max;
}

describe('jumping', () => {
  it('rises to about the configured apex and lands', () => {
    const g = solo(mapWith());
    const top = peak(g, 40, (t) => (t === 0 ? jump : idle));
    expect(top).toBeGreaterThan(APEX * 0.9);
    expect(top).toBeLessThan(APEX * 1.05);
    expect(g.p.z).toBe(0);
    expect(g.p.vz).toBe(0);
  });

  it('needs a fresh press: no double jumps, no auto-jump while held', () => {
    const g = solo(mapWith());
    run(g.world, g.state, 1, () => jump);
    run(g.world, g.state, 3, () => idle);
    const vzBefore = g.p.vz;
    run(g.world, g.state, 1, () => jump); // pressed again mid-air
    expect(g.p.vz).toBeLessThan(vzBefore);
    run(g.world, g.state, 60, () => jump); // held through the landing
    expect(g.p.z).toBe(0);
  });

  it('clears a low wall but not a toy block', () => {
    const low: Wall = { x: 22, y: 30, w: 1, h: 20, height: 1 };
    const g = solo(mapWith([low]));
    run(g.world, g.state, 40, () => input({ moveX: 1 }));
    expect(g.p.pos.x).toBeLessThan(low.x); // walking: blocked
    g.p.pos.x = 20;
    run(g.world, g.state, 5, () => input({ moveX: 1, buttons: Btn.Jump }));
    run(g.world, g.state, 40, () => input({ moveX: 1 }));
    expect(g.p.pos.x).toBeGreaterThan(low.x + low.w); // jumped over

    const block: Wall = { x: 22, y: 30, w: 2, h: 20, height: 2 };
    const h = solo(mapWith([block]));
    run(h.world, h.state, 5, () => input({ moveX: 1, buttons: Btn.Jump }));
    run(h.world, h.state, 40, () => input({ moveX: 1 }));
    expect(h.p.pos.x).toBeLessThan(block.x);
  });

  it('lands on a wall top, walks along it and falls off the end', () => {
    const ledge: Wall = { x: 21, y: 30, w: 4, h: 20, height: 1.4 };
    const g = solo(mapWith([ledge]));
    run(g.world, g.state, 1, () => input({ moveX: 1, buttons: Btn.Jump }));
    run(g.world, g.state, 30, () => input({ moveX: 0.4 }));
    expect(g.p.z).toBe(1.4);
    run(g.world, g.state, 30, () => input({ moveY: 1 })); // walk along the top
    expect(g.p.z).toBe(1.4);
    run(g.world, g.state, 60, () => input({ moveX: 1 })); // and off the far side
    expect(g.p.pos.x).toBeGreaterThan(ledge.x + ledge.w);
    expect(g.p.z).toBe(0);
  });

  it('stands on a chest', () => {
    const g = solo(mapWith([], [], [{ x: 21.6, y: 40 }]));
    run(g.world, g.state, 1, () => input({ moveX: 1, buttons: Btn.Jump }));
    run(g.world, g.state, 30, () => input({ moveX: 0.3 }));
    run(g.world, g.state, 1, () => idle);
    expect(Math.abs(g.p.pos.x - 21.6)).toBeLessThan(config.chest.radius);
    expect(g.p.z).toBe(config.chest.height);
  });

  it('cannot jump under a roof, but can walk on top of it', () => {
    const roof: Building = { x: 10, y: 30, w: 20, h: 20, height: 1.4 };
    const g = solo(mapWith([], [roof]));
    expect(peak(g, 20, (t) => (t === 0 ? jump : idle))).toBe(0);
    expect(g.p.building).toBe(0);
    g.p.z = 1.4; // up on the roof
    run(g.world, g.state, 30, () => input({ moveY: 1 }));
    expect(g.p.z).toBe(1.4);
    expect(g.p.building).toBe(-1);
  });

  it('leaves a bush when jumping high enough', () => {
    const g = solo({ ...mapWith(), bushes: [{ center: { x: 20, y: 40 }, radius: 2 }] });
    run(g.world, g.state, 1, () => idle);
    expect(g.p.inBush).toBe(true);
    run(g.world, g.state, 1, () => jump);
    run(g.world, g.state, 6, () => idle);
    expect(g.p.inBush).toBe(false);
  });
});

describe('shots and heights', () => {
  function duel(map: MapData, gap = 8) {
    const g = newGame(1, 2, map);
    const [a, b] = g.state.players as [Player, Player];
    a.pos = { x: 20, y: 40 };
    b.pos = { x: 20 + gap, y: 40 };
    a.weapons = [makeWeapon('cork_popper', 0), null];
    return { ...g, a, b };
  }
  const fireAt = (gap: number) => input({ aimX: gap, buttons: Btn.Fire });

  it('a jump dodges a level shot; standing still does not', () => {
    const g = duel(mapWith());
    // The cork needs about 0.27 s to cover 7 units; jump so the target is high as it passes.
    run(g.world, g.state, 1, (id) => (id === g.a.id ? fireAt(8) : jump));
    run(g.world, g.state, 30, () => idle);
    expect(g.b.stuffing).toBe(100);

    const h = duel(mapWith());
    run(h.world, h.state, 1, (id) => (id === h.a.id ? fireAt(8) : idle));
    run(h.world, h.state, 30, () => idle);
    expect(h.b.stuffing).toBeLessThan(100);
  });

  it('a shot from a wall top angles down to hit a plush on the ground behind low cover', () => {
    const perch: Wall = { x: 18, y: 38, w: 3, h: 4, height: 1.4 };
    const cover: Wall = { x: 22.5, y: 30, w: 1, h: 20, height: 1 };
    const g = duel(mapWith([perch, cover]), 9);
    g.a.z = 1.4;
    run(g.world, g.state, 1, (id) => (id === g.a.id ? fireAt(9) : idle));
    run(g.world, g.state, 30, () => idle);
    expect(g.b.stuffing).toBeLessThan(100);
  });

  it('low cover stops a level shot from the ground', () => {
    const cover: Wall = { x: 23, y: 30, w: 1, h: 20, height: 1 };
    const g = duel(mapWith([cover]), 8);
    run(g.world, g.state, 1, (id) => (id === g.a.id ? fireAt(8) : idle));
    run(g.world, g.state, 30, () => idle);
    expect(g.b.stuffing).toBe(100);
  });

  it('a chest is cover against low shots', () => {
    const g = duel(mapWith([], [], [{ x: 24, y: 40 }]), 8);
    run(g.world, g.state, 1, (id) => (id === g.a.id ? fireAt(8) : idle));
    run(g.world, g.state, 30, () => idle);
    expect(g.b.stuffing).toBe(100);
  });

  it('shooting up at a plush on a ledge hits from range', () => {
    const ledge: Wall = { x: 27, y: 38, w: 3, h: 4, height: 1.2 };
    const g = duel(mapWith([ledge]), 8.5);
    g.b.z = 1.2;
    run(g.world, g.state, 1, (id) => (id === g.a.id ? fireAt(8.5) : idle));
    run(g.world, g.state, 30, () => idle);
    expect(g.b.stuffing).toBeLessThan(100);
  });
});
