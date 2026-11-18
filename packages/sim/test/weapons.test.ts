import { describe, expect, it } from 'vitest';
import { Btn, canSee, config, createGame, createWorld, makeWeapon, secondsToTicks, step } from '../src/index.ts';
import type { EntityId, GameEvent, Input, MapData, Player, WeaponKind } from '../src/index.ts';
import { input, OPEN_MAP, roster } from './helpers.ts';

/** You at (20, 40) holding `kind`, aiming +x; a second plush `gap` to your right. */
function duel(kind: WeaponKind, gap = 6, map: MapData = OPEN_MAP) {
  const world = createWorld(map);
  const state = createGame({ seed: 1, map, roster: roster(2) });
  const [you, other] = state.players as [Player, Player];
  you.pos = { x: 20, y: 40 };
  other.pos = { x: 20 + gap, y: 40 };
  you.weapons = [makeWeapon(kind, 0), null];
  const events: GameEvent[] = [];
  const play = (ticks: number, mine: Partial<Input>, theirs: Partial<Input> = {}) => {
    for (let t = 0; t < ticks; t++) {
      const inputs = new Map<EntityId, Input>([
        [you.id, input({ aimX: gap, aimY: 0, ...mine })],
        [other.id, input(theirs)],
      ]);
      step(world, state, inputs);
      events.push(...state.events);
    }
  };
  return { world, state, you, other, events, play };
}

const fire = { buttons: Btn.Fire };

describe('Rubber Band Rifle', () => {
  it('fires when you let go, harder the longer you held', () => {
    const quick = duel('rubber_band_rifle', 20);
    quick.play(2, fire);
    expect(quick.state.projectiles).toHaveLength(0); // still drawing
    quick.play(1, {});
    const tap = quick.state.projectiles[0]!;

    const full = duel('rubber_band_rifle', 20);
    full.play(secondsToTicks(1.2), fire);
    full.play(1, {});
    const drawn = full.state.projectiles[0]!;
    expect(drawn.damage).toBeCloseTo(config.weapons.rubber_band_rifle.damage, 5);
    expect(tap.damage).toBeLessThan(drawn.damage * 0.5);
    expect(Math.hypot(drawn.vel.x, drawn.vel.y)).toBeGreaterThan(Math.hypot(tap.vel.x, tap.vel.y));
  });

  it('slows you down while drawing', () => {
    const g = duel('rubber_band_rifle', 20);
    g.play(20, { ...fire, moveY: 1 });
    const charging = g.you.pos.y - 40;
    const h = duel('cork_popper', 20);
    h.play(20, { moveY: 1 });
    expect(charging).toBeLessThan((h.you.pos.y - 40) * 0.8);
  });
});

describe('Marble Launcher', () => {
  it('bounces off a wall, then bursts and hurts everyone nearby but you', () => {
    // A wall 4 to your right; a plush behind you, in the path of the marble coming back.
    const map: MapData = { ...OPEN_MAP, id: 'wall', walls: [{ x: 24, y: 36, w: 1, h: 8, height: 3 }] };
    const g = duel('marble_launcher', 1.5, map);
    g.other.pos = { x: 17.5, y: 40.24 };
    g.play(1, { ...fire, aimX: 4, aimY: 0 });
    g.play(60, {});
    expect(g.events.some((e) => e.type === 'bounce')).toBe(true);
    expect(g.events.some((e) => e.type === 'burst')).toBe(true);
    expect(g.other.stuffing).toBeLessThan(100);
    expect(g.you.stuffing).toBe(100);
  });
});

describe('Pillow Hammer', () => {
  it('bonks whoever is in front and knocks them away, not someone behind', () => {
    const g = duel('pillow_hammer', 1.5);
    const behind = g.state.players.length; // only two plushies; check the one in front
    expect(behind).toBe(2);
    g.play(1, fire);
    expect(g.other.stuffing).toBeLessThan(100);
    expect(g.other.knockback.x).toBeGreaterThan(5);
    expect(g.events.some((e) => e.type === 'bonk')).toBe(true);

    const miss = duel('pillow_hammer', 1.5);
    miss.play(1, { ...fire, aimX: -1, aimY: 0 }); // swinging the other way
    expect(miss.other.stuffing).toBe(100);
  });
});

describe('Glitter Bomb', () => {
  it("lands where you aim, glitters who is there so they can't hide, and is used up after two throws", () => {
    const g = duel('glitter_bomb', 8);
    g.play(1, fire);
    expect(g.state.projectiles[0]!.lobbed).toBe(true);
    g.play(45, {});
    const burst = g.events.find((e) => e.type === 'burst');
    expect(burst).toBeDefined();
    expect(burst!.type === 'burst' && Math.abs(burst!.pos.x - 28)).toBeLessThan(1);
    expect(g.state.tick).toBeLessThan(g.other.glitteredUntil);
    // Glittered: seen even hiding in a bush.
    g.other.inBush = true;
    expect(canSee(g.world, g.state, g.you, g.other)).toBe(true);
    const now = g.state.tick;
    g.state.tick = g.other.glitteredUntil;
    expect(canSee(g.world, g.state, g.you, g.other)).toBe(false);
    g.state.tick = now;
    g.other.inBush = false;

    g.play(30, fire);
    g.play(1, {});
    expect(g.you.weapons[0]).toBeNull();
  });
});

describe('Bubble Wand', () => {
  it('traps whoever it hits: no walking, shooting or picking up', () => {
    const g = duel('bubble_wand', 4);
    g.other.weapons = [makeWeapon('cork_popper', 0), null];
    g.play(1, fire);
    g.play(20, {}, { moveX: 1 });
    expect(g.state.tick).toBeLessThan(g.other.bubbledUntil);
    const x = g.other.pos.x;
    g.play(10, {}, { moveX: 1, buttons: Btn.Fire, aimX: -1, aimY: 0 });
    expect(Math.abs(g.other.pos.x - x)).toBeLessThan(0.15); // only leftover drift
    expect(g.state.projectiles.filter((p) => p.ownerId === g.other.id)).toHaveLength(0);
    // A second bubble bounces off: it doesn't trap them for longer.
    const until = g.other.bubbledUntil;
    g.you.weapons[0]!.ammo = 3;
    g.other.pos.x = x;
    g.play(1, fire);
    g.play(8, {});
    expect(g.other.bubbledUntil).toBe(until);
    // Free again after the trap time.
    g.play(secondsToTicks(config.weapons.bubble_wand.effectTime! + 0.1), {}, { moveX: 1 });
    expect(g.other.pos.x).toBeGreaterThan(x + 2);
  });
});

describe('empty weapons', () => {
  it('firing an empty weapon reloads it, and switching to an empty one does too', () => {
    const g = duel('cork_popper', 20);
    g.you.weapons = [makeWeapon('cork_popper', 0), makeWeapon('foam_dart_smg', 0)];
    g.you.weapons[0]!.ammo = 0;
    g.play(1, fire);
    expect(g.you.weapons[0]!.reloadEndTick).not.toBeNull();

    g.you.weapons[1]!.ammo = 0;
    g.play(1, { weaponSlot: 1 });
    expect(g.you.activeSlot).toBe(1);
    expect(g.you.weapons[1]!.reloadEndTick).not.toBeNull();
  });
});

describe('lag compensation', () => {
  /**
   * The target takes a few quick steps away and stops; the shooter, seeing 6 ticks into the past,
   * fires at where it stood.
   */
  function shootAtOldSpot(withViewTick: boolean) {
    const g = duel('cork_popper', 2.5);
    g.play(10, {}); // settle
    const seen = { ...g.other.pos };
    g.play(6, {}, { moveY: 1 }); // walks off about a unit
    g.play(2, {}); // and stands there
    const shot = {
      buttons: Btn.Fire,
      aimX: seen.x - g.you.pos.x,
      aimY: seen.y - g.you.pos.y,
      ...(withViewTick ? { viewTick: g.state.tick - 6 } : {}),
    };
    g.play(1, shot);
    g.play(10, {});
    return g.other.stuffing;
  }

  it('hits where the shooter saw the target, not where it is now on the server', () => {
    expect(shootAtOldSpot(false)).toBe(100); // without: the target has moved on
    expect(shootAtOldSpot(true)).toBeLessThan(100); // with: tested against where it was
  });
});
