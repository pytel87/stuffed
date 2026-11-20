import { describe, expect, it } from 'vitest';
import { BACKYARD, BEDROOM, COVE, Btn, config, createGame, createWorld, makeWeapon, PARK, secondsToTicks } from '../src/index.ts';
import type { EntityId, Input, MapData, Player } from '../src/index.ts';
import { galleryTargets } from '../src/systems/minigames.ts';
import { input, roster, run } from './helpers.ts';

function game(map: MapData, players = 2) {
  const world = createWorld(map);
  const state = createGame({ seed: 6, map, roster: roster(players) });
  const ps = state.players as Player[];
  ps.forEach((p, i) => (p.pos = { x: 3 + i, y: 3 }));
  const you = ps[0]!;
  const go = (ticks: number, mine: (tick: number) => Partial<Input> = () => ({})) =>
    run(world, state, ticks, (id: EntityId) => (id === you.id ? input(mine(state.tick)) : input()));
  return { world, state, you, ps, go };
}
const prizeNear = (g: ReturnType<typeof game>, at: { x: number; y: number }) =>
  g.state.loot.filter((l) => Math.hypot(l.pos.x - at.x, l.pos.y - at.y) < 3.5);

describe('buried treasure', () => {
  it('hold E at a sparkling spot to dig up a prize, once', () => {
    for (const map of [BACKYARD, PARK, COVE]) {
      const g = game(map);
      const spot = map.digs![0]!;
      g.you.pos = { ...spot };
      g.go(secondsToTicks(config.games.digTime) + 3, () => ({ buttons: Btn.Interact }));
      expect(g.state.games.digs[0], map.id).toBe(true);
      expect(prizeNear(g, spot).length, map.id).toBe(2);
      // Dug: nothing more there.
      const before = g.state.loot.length;
      g.go(5, () => ({}));
      g.go(secondsToTicks(config.games.digTime) + 3, () => ({ buttons: Btn.Interact }));
      expect(g.state.loot.length).toBe(before);
    }
  });
});

describe('the shooting gallery', () => {
  it('five ducks in a row win a prize in front of the counter', () => {
    const g = game(BACKYARD);
    const targets = galleryTargets(BACKYARD);
    const gal = g.state.games.gallery!;
    g.you.weapons = [makeWeapon('foam_dart_smg', 2), null];
    g.you.pos = { x: BACKYARD.gallery!.x, y: BACKYARD.gallery!.y + 5 };
    for (let i = 0; i < 600 && g.state.tick >= gal.readyTick; i++) {
      g.you.weapons[0]!.ammo = 30;
      g.you.weapons[0]!.reloadEndTick = null;
      const up = gal.up >= 0 ? targets[gal.up]! : null;
      g.go(1, () => (up ? { aimX: up.x - g.you.pos.x, aimY: up.y - g.you.pos.y, buttons: Btn.Fire } : {}));
    }
    expect(g.state.tick).toBeLessThan(gal.readyTick);
    expect(prizeNear(g, { x: BACKYARD.gallery!.x, y: BACKYARD.gallery!.y + 3.2 }).length).toBe(2);
  });

  it('you can walk into the booth round the end of its counter', () => {
    const g = game(BACKYARD);
    const gal = BACKYARD.gallery!;
    const half = ((config.games.gallery.targets - 1) / 2) * config.games.gallery.spacing + 1;
    g.you.pos = { x: gal.x + half + 1, y: gal.y + 0.2 };
    g.go(20, () => ({ moveX: -1 }));
    expect(g.you.pos.x).toBeLessThan(gal.x + half - 1);
  });

  it('a duck that drops unhit breaks the run', () => {
    const g = game(BACKYARD);
    const gal = g.state.games.gallery!;
    gal.hits = 3;
    g.go(secondsToTicks(config.games.gallery.gap + config.games.gallery.upTime + 0.3));
    expect(gal.hits).toBe(0);
  });
});

describe('bowling', () => {
  it('the beach ball knocks the pins down; all down pays out, then they stand back up', () => {
    const g = game(BEDROOM);
    const pins = BEDROOM.pins!;
    const ball = g.state.balls.find((b) => Math.hypot(b.pos.x - 60, b.pos.y - 90) < 1)!;
    // Roll it straight up the middle, then once more for any left standing.
    for (let k = 0; k < 4 && !g.state.games.pins!.down.every(Boolean); k++) {
      const left = pins.filter((_, i) => !g.state.games.pins!.down[i]);
      const aim = left[0]!;
      ball.pos = { x: aim.x, y: aim.y - 4 };
      ball.vel = { x: 0, y: 12 };
      g.go(30);
    }
    expect(g.state.games.pins!.down.every(Boolean)).toBe(true);
    expect(prizeNear(g, { x: 60, y: 96.3 }).length).toBe(2);
    g.go(secondsToTicks(config.games.pins.reset) + 2);
    expect(g.state.games.pins!.down.some(Boolean)).toBe(false);
  });

  it("standing pins are in a plush's way", () => {
    const g = game(BEDROOM);
    g.you.pos = { x: 60, y: 93 };
    g.go(30, () => ({ moveY: 1 }));
    expect(g.you.pos.y).toBeLessThan(95);
  });
});

describe('king of the hill', () => {
  it('holding the castle keep alone long enough wins a prize up there; someone else on it stops the clock', () => {
    const g = game(BEDROOM, 3);
    const hill = BEDROOM.hills![0]!;
    const [you, rival] = [g.ps[0]!, g.ps[1]!];
    you.pos = { x: hill.x, y: hill.y };
    you.z = hill.z;
    g.go(secondsToTicks(4));
    const progress = g.state.games.hills[0]!.progress;
    expect(progress).toBeGreaterThan(secondsToTicks(3));
    rival.pos = { x: hill.x + 1, y: hill.y };
    rival.z = hill.z;
    g.go(secondsToTicks(2));
    expect(g.state.games.hills[0]!.progress).toBe(progress);
    rival.pos = { x: 3, y: 9 };
    rival.z = 0;
    g.go(secondsToTicks(config.games.hill.hold));
    const prize = g.state.loot.filter((l) => Math.hypot(l.pos.x - hill.x, l.pos.y - hill.y) < 2.5);
    expect(prize.length).toBe(2);
    for (const l of prize) expect(l.z).toBeCloseTo(hill.z, 3);
  });
});

describe('beach-ball goals', () => {
  it('a goal drops a weapon in front of it', () => {
    const g = game(BACKYARD);
    const goal = BACKYARD.goals![0]!;
    const ball = g.state.balls.find((b) => b.kind !== 'duck')!;
    ball.pos = { x: goal.mouth.x + goal.mouth.w / 2, y: goal.mouth.y + goal.mouth.h / 2 };
    ball.vel = { x: 0, y: 0.5 };
    const before = g.state.loot.length;
    g.go(2);
    expect(g.state.goals[0]).toBe(1);
    expect(g.state.loot.length).toBe(before + 1);
  });
});
