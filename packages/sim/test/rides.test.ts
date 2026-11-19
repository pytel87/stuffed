import { describe, expect, it } from 'vitest';
import { BACKYARD, BEDROOM, Btn, canSee, createGame, createWorld, PARK } from '../src/index.ts';
import type { EntityId, Input, MapData, Player } from '../src/index.ts';
import { input, roster, run } from './helpers.ts';

function game(map: MapData) {
  const world = createWorld(map);
  const state = createGame({ seed: 5, map, roster: roster(2) });
  const [you, other] = state.players as [Player, Player];
  other.pos = { x: 4, y: 4 };
  const go = (ticks: number, mine: Partial<Input> = {}, theirs: Partial<Input> = {}) =>
    run(world, state, ticks, (id: EntityId) => (id === you.id ? input(mine) : input(theirs)));
  return { world, state, you, other, go };
}

describe('the trampoline', () => {
  it('bounces you high enough to land on the house roof', () => {
    const g = game(BACKYARD);
    const t = BACKYARD.trampolines![0]!;
    g.you.pos = { ...t.center };
    let top = 0;
    for (let i = 0; i < 40; i++) {
      g.go(1);
      top = Math.max(top, g.you.z);
    }
    expect(top).toBeGreaterThan(3.2);
  });
});

describe('slides and sled runs', () => {
  it('step onto the top of the treehouse slide and you shoot off the bottom', () => {
    const g = game(BACKYARD);
    const r = BACKYARD.rides!.find((x) => x.kind === 'slide')!;
    g.you.pos = { x: r.from.x, y: r.from.y - 0.6 };
    g.you.z = r.from.z;
    g.go(12, { moveY: 1 });
    expect(g.you.ride).not.toBeNull();
    g.go(40);
    expect(g.you.ride).toBeNull();
    expect(g.you.z).toBeLessThan(0.05);
    expect(g.you.pos.y).toBeGreaterThan(r.to.y + 1); // pushed on past the end
  });

  it('you can walk up the slide (smoothly) onto the treehouse platform without sliding back', () => {
    const g = game(BACKYARD);
    const r = BACKYARD.rides!.find((x) => x.kind === 'slide')!;
    g.you.pos = { x: r.to.x, y: r.to.y + 0.8 };
    let last = 0;
    let biggestStep = 0;
    for (let i = 0; i < 70; i++) {
      g.go(1, { moveY: -1 });
      biggestStep = Math.max(biggestStep, g.you.z - last);
      last = g.you.z;
    }
    expect(g.you.ride).toBeNull();
    expect(g.you.z).toBeCloseTo(r.from.z, 1);
    expect(g.you.pos.y).toBeLessThan(r.from.y);
    expect(biggestStep).toBeLessThan(0.2);
  });

  it('you can walk under the high end of the slide (not the low end)', () => {
    const g = game(BACKYARD);
    const r = BACKYARD.rides!.find((x) => x.kind === 'slide')!;
    const high = { x: r.from.x, y: r.from.y + (r.to.y - r.from.y) * 0.15 };
    g.you.pos = { x: high.x - 2, y: high.y };
    g.go(30, { moveX: 1 });
    expect(g.you.pos.x).toBeGreaterThan(high.x + 1);
    expect(g.you.z).toBeLessThan(0.05);
  });

  it("is solid: you can't walk through the slide from its side", () => {
    const g = game(BACKYARD);
    const r = BACKYARD.rides!.find((x) => x.kind === 'slide')!;
    g.you.pos = { x: r.from.x - 2, y: (r.from.y + r.to.y) / 2 };
    g.go(40, { moveX: 1 });
    expect(g.you.pos.x).toBeLessThan(r.from.x - 0.55);
  });

  it('a shot into the side of the slide stops at its board; one under its raised end passes', () => {
    const r = BACKYARD.rides!.find((x) => x.kind === 'slide')!;
    // Low down, where the board is at shot height.
    const g = game(BACKYARD);
    const low = { x: r.from.x, y: r.from.y + (r.to.y - r.from.y) * 0.8 };
    g.you.pos = { x: low.x - 4, y: low.y };
    g.other.pos = { x: low.x + 3, y: low.y };
    g.go(1, { buttons: Btn.Fire, aimX: 7, aimY: 0 });
    g.go(30);
    expect(g.other.stuffing).toBe(100);
    // Up high, the board is over the shot: it flies on underneath.
    const h = game(BACKYARD);
    const high = { x: r.from.x, y: r.from.y + (r.to.y - r.from.y) * 0.25 };
    h.you.pos = { x: high.x - 4, y: high.y };
    h.other.pos = { x: high.x + 3, y: high.y };
    h.go(1, { buttons: Btn.Fire, aimX: 7, aimY: 0 });
    h.go(30);
    expect(h.other.stuffing).toBeLessThan(100);
  });

  it('the sled run ends with a hop off the little jump', () => {
    const g = game(PARK);
    const r = PARK.rides![0]!;
    g.you.pos = { x: r.from.x - 0.6, y: r.from.y };
    g.you.z = r.from.z;
    g.go(12, { moveX: 1 });
    expect(g.you.ride).not.toBeNull();
    let airborne = false;
    for (let i = 0; i < 60; i++) {
      g.go(1);
      if (!g.you.ride && g.you.z > 0.5) airborne = true;
    }
    expect(airborne).toBe(true);
  });
});

describe('the zip line and the hamster tube', () => {
  it('E at the treehouse end of the zip line carries you over to the house roof', () => {
    const g = game(BACKYARD);
    const r = BACKYARD.rides!.find((x) => x.kind === 'zip')!;
    g.you.pos = { x: r.from.x, y: r.from.y };
    g.you.z = r.from.z;
    g.go(1, { buttons: Btn.Interact });
    expect(g.you.ride).not.toBeNull();
    g.go(Math.ceil(r.seconds * 30) + 20);
    expect(Math.hypot(g.you.pos.x - r.to.x, g.you.pos.y - r.to.y)).toBeLessThan(3);
    expect(g.you.z).toBeCloseTo(2.6, 1);
  });

  it('the zip line works both ways: E on the house roof takes you back to the treehouse', () => {
    const g = game(BACKYARD);
    const back = BACKYARD.rides!.filter((x) => x.kind === 'zip')[1]!;
    g.you.pos = { x: back.from.x, y: back.from.y };
    g.you.z = back.from.z;
    g.go(1, { buttons: Btn.Interact });
    expect(g.you.ride).not.toBeNull();
    g.go(Math.ceil(back.seconds * 30) + 20);
    expect(Math.hypot(g.you.pos.x - back.to.x, g.you.pos.y - back.to.y)).toBeLessThan(3);
    expect(g.you.z).toBeCloseTo(2.7, 1);
  });

  it('inside the tube nobody sees you; you come out at the other end', () => {
    const g = game(BEDROOM);
    const r = BEDROOM.rides!.find((x) => x.kind === 'tube')!;
    g.you.pos = { x: r.from.x, y: r.from.y };
    g.other.pos = { x: r.from.x + 3, y: r.from.y };
    g.go(1, { buttons: Btn.Interact });
    g.go(10);
    expect(canSee(g.world, g.state, g.other, g.you)).toBe(false);
    g.go(Math.ceil(r.seconds * 30) + 10);
    expect(Math.hypot(g.you.pos.x - r.to.x, g.you.pos.y - r.to.y)).toBeLessThan(2.5);
  });

  it("is solid where it lies low, and you walk under its high middle", () => {
    const g = game(BEDROOM);
    const r = BEDROOM.rides!.find((x) => x.kind === 'tube')!;
    const x = r.from.x + 3;
    g.you.pos = { x, y: r.from.y - 2 };
    g.go(30, { moveY: 1 });
    expect(g.you.pos.y).toBeLessThan(r.from.y - 0.5);
    const mid = (r.from.x + r.to.x) / 2;
    g.you.pos = { x: mid, y: r.from.y - 2 };
    g.go(30, { moveY: 1 });
    expect(g.you.pos.y).toBeGreaterThan(r.from.y + 1);
  });
});

describe('the seesaw', () => {
  it("is solid: you can't walk through its middle", () => {
    const g = game(BACKYARD);
    const s = BACKYARD.seesaws![0]!;
    const mid = { x: (s.a.x + s.b.x) / 2, y: s.a.y };
    g.you.pos = { x: mid.x, y: mid.y - 2 };
    g.go(40, { moveY: 1 });
    expect(g.you.pos.y).toBeLessThan(mid.y - 0.3);
  });

  it('you can walk onto its low end, and up the plank', () => {
    const g = game(BACKYARD);
    const s = BACKYARD.seesaws![0]!;
    // End a starts down: walk on from beyond it, along the plank.
    g.you.pos = { x: s.a.x - 2, y: s.a.y };
    g.go(25, { moveX: 1 });
    expect(g.you.pos.x).toBeGreaterThan(s.a.x);
    expect(g.you.z).toBeGreaterThan(0.1);
  });

  it('landing on its raised end tips it, launching whoever stands on the low end', () => {
    const g = game(BACKYARD);
    const s = BACKYARD.seesaws![0]!;
    // a is down (someone stands on it); you drop onto b, the raised end.
    g.other.pos = { ...s.a };
    g.go(5);
    g.you.pos = { ...s.b };
    g.you.z = 2.5;
    let top = 0;
    for (let i = 0; i < 40; i++) {
      g.go(1);
      top = Math.max(top, g.other.z);
    }
    expect(g.state.seesaws[0]!.down).toBe('b');
    expect(top).toBeGreaterThan(2);
  });
});

describe('the catapult', () => {
  for (const map of [BACKYARD, BEDROOM, PARK]) {
    it(`${map.id}: one on each side of the map`, () => {
      const at = map.rides!.filter((x) => x.kind === 'catapult').map((r) => r.from);
      const mid = { x: map.width / 2, y: map.height / 2 };
      const sides = new Set(at.map((p) => (Math.abs(p.x - mid.x) > Math.abs(p.y - mid.y) ? (p.x > mid.x ? 'E' : 'W') : p.y > mid.y ? 'S' : 'N')));
      expect([...sides].sort()).toEqual(['E', 'N', 'S', 'W']);
    });

    map.rides!.forEach((r) => {
      if (r.kind !== 'catapult') return;
      it(`${map.id} (${r.from.x.toFixed(0)}, ${r.from.y.toFixed(0)}): E beside it flings you high, your umbrella opens and you glide down (no shooting meanwhile)`, () => {
        const g = game(map);
        g.you.pos = { x: r.from.x - 1.2, y: r.from.y };
        g.go(1, { buttons: Btn.Interact });
        expect(g.you.ride).not.toBeNull();
        g.go(Math.ceil(r.seconds * 30) + 1);
        expect(g.you.ride).toBeNull();
        expect(g.you.umbrella).toBe(true);
        expect(g.you.z).toBeGreaterThan(13);
        expect(Math.hypot(g.you.pos.x - r.to.x, g.you.pos.y - r.to.y)).toBeLessThan(1);
        g.go(1, { buttons: Btn.Fire, aimX: 5, aimY: 0 });
        expect(g.state.projectiles).toHaveLength(0);
        let ticks = 0;
        while (g.you.umbrella && ticks++ < 30 * 10) g.go(1);
        expect(g.you.umbrella).toBe(false);
        expect(ticks).toBeGreaterThan(30 * 2);
      });
    });
  }

  it('flings again only after its cooldown', () => {
    const g = game(BACKYARD);
    const r = BACKYARD.rides!.find((x) => x.kind === 'catapult')!;
    const beside = { x: r.from.x - 1.2, y: r.from.y };
    g.you.pos = { ...beside };
    g.go(1, { buttons: Btn.Interact });
    expect(g.you.ride).not.toBeNull();
    // Someone else right after: nothing.
    g.other.pos = { ...beside };
    g.go(2, {}, { buttons: Btn.Interact });
    g.go(1);
    expect(g.other.ride).toBeNull();
    g.go(20 * 30);
    g.other.pos = { ...beside };
    g.other.z = 0;
    g.go(1, {}, { buttons: Btn.Interact });
    expect(g.other.ride).not.toBeNull();
  });

  it('Jump folds the umbrella and you drop', () => {
    const g = game(BACKYARD);
    const r = BACKYARD.rides!.find((x) => x.kind === 'catapult')!;
    g.you.pos = { x: r.from.x - 1.2, y: r.from.y };
    g.go(1, { buttons: Btn.Interact });
    g.go(Math.ceil(r.seconds * 30) + 1);
    expect(g.you.umbrella).toBe(true);
    g.go(1, { buttons: Btn.Jump });
    expect(g.you.umbrella).toBe(false);
    g.go(45);
    expect(g.you.z).toBeLessThan(0.05);
  });
});
