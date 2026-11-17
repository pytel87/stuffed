import { describe, expect, it } from 'vitest';
import { applyDamage, Btn, config, makeWeapon, muzzlePosition, reloadTicks, secondsToTicks, sweepCircle } from '../src/index.ts';
import type { GameState, Player, WeaponKind } from '../src/index.ts';
import { input, newGame, OPEN_MAP, run } from './helpers.ts';

/** Puts players 0 and 1 face to face, `gap` units apart (center to center), in open ground. */
function duel(gap: number, kind: WeaponKind = 'cork_popper', rarity: 0 | 1 | 2 | 3 | 4 = 0) {
  const g = newGame(1, 2);
  const [a, b] = g.state.players as [Player, Player];
  a.pos = { x: 20, y: 40 };
  b.pos = { x: 20 + gap, y: 40 };
  a.weapons = [makeWeapon(kind, rarity), null];
  return { ...g, a, b };
}

const fire = input({ aimX: 1, buttons: Btn.Fire });
const idle = input({ aimX: 1 });

describe('damage and armor', () => {
  it('takes damage from buttons first, then stuffing', () => {
    const { state, b } = duel(5);
    b.buttons = 30;
    applyDamage(state, b, 50, null);
    expect(b.buttons).toBe(0);
    expect(b.stuffing).toBe(80);
    expect(state.events).toContainEqual({ type: 'hit', targetId: b.id, sourceId: null, damage: 20, armorDamage: 30 });
  });

  it('leaves stuffing alone while armor covers the hit', () => {
    const { state, b } = duel(5);
    b.buttons = 100;
    applyDamage(state, b, 40, null);
    expect(b.buttons).toBe(60);
    expect(b.stuffing).toBe(100);
  });

  it('counts damage dealt and knockouts for the shooter', () => {
    const { state, a, b } = duel(5);
    b.buttons = 20;
    applyDamage(state, b, 50, a.id);
    expect(a.damageDealt).toBe(50);
    applyDamage(state, b, 200, a.id); // only 70 stuffing was left
    expect(a.damageDealt).toBe(120);
    expect(a.knockouts).toBe(1);
    expect(b.eliminatedBy).toBe(a.id);
  });

  it('the Rinse gets no credit', () => {
    const { state, a, b } = duel(5);
    applyDamage(state, b, 500, null);
    expect(b.eliminatedBy).toBeNull();
    expect(a.knockouts).toBe(0);
  });

  it('eliminates at 0 stuffing, assigns placement and ends a 2-player match', () => {
    const { world, state, a, b } = duel(5);
    applyDamage(state, b, 150, a.id);
    expect(b.alive).toBe(false);
    expect(b.stuffing).toBe(0);
    expect(b.placement).toBe(2);
    run(world, state, 1, () => idle);
    expect(state.status).toBe('ended');
    expect(state.winnerId).toBe(a.id);
    expect(a.placement).toBe(1);
  });
});

describe('weapons', () => {
  it('fires a projectile toward the aim and uses a round', () => {
    const { world, state, a } = duel(10);
    run(world, state, 1, (id) => (id === a.id ? fire : idle));
    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.ownerId).toBe(a.id);
    expect(p.vel.x).toBeGreaterThan(0);
    expect(a.weapons[0]!.ammo).toBe(config.weapons.cork_popper.magazine - 1);
  });

  it('indoors, shots stay level instead of climbing toward the roof overhead', () => {
    const house = { ...OPEN_MAP, id: 'house', buildings: [{ x: 10, y: 30, w: 30, h: 20, height: 3.2 }] };
    const { world, state } = newGame(1, 2, house);
    const a = state.players[0]!;
    a.pos = { x: 15, y: 40 };
    a.weapons = [makeWeapon('cork_popper', 0), null];
    // Aim at a spot 10 units away, still inside the house.
    run(world, state, 1, (id) => (id === a.id ? input({ aimX: 10, buttons: Btn.Fire }) : idle));
    const shot = state.projectiles[0]!;
    expect(shot.vz).toBe(0);
    expect(shot.zEnd).toBeCloseTo(config.combat.shotHeight);
    // From outside, a spot on that roof is still worth aiming up at.
    const out = newGame(1, 2, house);
    const b = out.state.players[0]!;
    b.pos = { x: 4, y: 40 };
    b.weapons = [makeWeapon('cork_popper', 0), null];
    run(out.world, out.state, 1, (id) => (id === b.id ? input({ aimX: 10, buttons: Btn.Fire }) : idle));
    expect(out.state.projectiles[0]!.zEnd).toBeCloseTo(3.2 + config.combat.shotHeight);
  });

  it('spawns shots at the barrel tip, on the shooter\'s right', () => {
    const { world, state, a } = duel(30);
    a.aim = { x: 0, y: 1 };
    run(world, state, 1, (id) => (id === a.id ? input({ aimY: 1, buttons: Btn.Fire }) : idle));
    const p = state.projectiles[0]!;
    // Facing +y (down the map), the shooter's right is -x. One tick of flight has passed.
    const tip = muzzlePosition(a.pos, a.aim, 'cork_popper');
    expect(tip.x).toBeCloseTo(a.pos.x - config.combat.muzzleSide, 6);
    expect(tip.y).toBeCloseTo(a.pos.y + config.weapons.cork_popper.barrelLength, 6);
    expect(p.pos.x - p.vel.x / config.tickRate).toBeCloseTo(tip.x, 6);
    expect(p.pos.y - p.vel.y / config.tickRate).toBeCloseTo(tip.y, 6);
  });

  it('respects the fire interval while fire is held', () => {
    const { world, state, a } = duel(30);
    const ticks = secondsToTicks(1);
    run(world, state, ticks, (id) => (id === a.id ? fire : idle));
    const interval = secondsToTicks(config.weapons.cork_popper.fireInterval);
    const shots = state.players[0]!.weapons[0]!;
    expect(config.weapons.cork_popper.magazine - shots.ammo).toBe(Math.ceil(ticks / interval));
  });

  it('reloads automatically when empty and refills after the reload time', () => {
    const { world, state, a } = duel(30, 'super_soaker');
    const w = a.weapons[0]!;
    w.ammo = 1;
    run(world, state, 1, (id) => (id === a.id ? fire : idle));
    expect(w.ammo).toBe(0);
    expect(w.reloadEndTick).not.toBeNull();
    run(world, state, reloadTicks(w) - 1, () => idle);
    expect(w.ammo).toBe(0);
    run(world, state, 1, () => idle);
    expect(w.ammo).toBe(config.weapons.super_soaker.magazine);
  });

  it('reloads faster and hits harder at higher rarity', () => {
    const grey = makeWeapon('cork_popper', 0);
    const gold = makeWeapon('cork_popper', 4);
    expect(reloadTicks(gold)).toBeLessThan(reloadTicks(grey));
    const { world, state, a, b } = duel(3, 'cork_popper', 4);
    run(world, state, 3, (id) => (id === a.id ? (state.tick === 0 ? fire : idle) : idle));
    expect(b.stuffing).toBeCloseTo(100 - config.weapons.cork_popper.damage * 1.32, 6);
  });

  it('fires the Super Soaker as a cone of pellets', () => {
    const { world, state, a } = duel(30, 'super_soaker');
    run(world, state, 1, (id) => (id === a.id ? fire : idle));
    const pellets = state.projectiles;
    expect(pellets).toHaveLength(config.weapons.super_soaker.pellets);
    const angles = pellets.map((p) => Math.atan2(p.vel.y, p.vel.x));
    const halfCone = (config.weapons.super_soaker.spreadDegrees * Math.PI) / 180 / 2;
    const jitter = halfCone / config.weapons.super_soaker.pellets;
    for (const ang of angles) expect(Math.abs(ang)).toBeLessThanOrEqual(halfCone + jitter);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(halfCone);
  });

  it('switches slots with a short delay before the new weapon can fire', () => {
    const { world, state, a } = duel(30);
    a.weapons = [makeWeapon('cork_popper', 0), makeWeapon('foam_dart_smg', 0)];
    run(world, state, 1, (id) => (id === a.id ? input({ aimX: 1, weaponSlot: 1 }) : idle));
    expect(a.activeSlot).toBe(1);
    run(world, state, 1, (id) => (id === a.id ? fire : idle));
    expect(state.projectiles).toHaveLength(0);
    run(world, state, secondsToTicks(config.combat.weaponSwapTime), (id) => (id === a.id ? fire : idle));
    expect(state.projectiles.length).toBeGreaterThan(0);
  });

  it('cycles slots with the wheel but never to an empty slot', () => {
    const { world, state, a } = duel(30);
    run(world, state, 1, (id) => (id === a.id ? input({ cycleWeapon: true }) : idle));
    expect(a.activeSlot).toBe(0);
    a.weapons[1] = makeWeapon('super_soaker', 2);
    run(world, state, 1, (id) => (id === a.id ? input({ cycleWeapon: true }) : idle));
    expect(a.activeSlot).toBe(1);
  });
});

describe('projectiles', () => {
  function flyUntilDone(g: { world: ReturnType<typeof duel>['world']; state: GameState }, shooterId: number) {
    run(g.world, g.state, 1, (id) => (id === shooterId ? fire : idle));
    run(g.world, g.state, 60, () => idle);
  }

  it('hit the target in their path and deal the weapon damage', () => {
    const g = duel(8);
    flyUntilDone(g, g.a.id);
    expect(g.b.stuffing).toBeCloseTo(100 - config.weapons.cork_popper.damage, 6);
    expect(g.state.projectiles).toHaveLength(0);
  });

  it('can be dodged: a target off the line is not hit', () => {
    const g = duel(8);
    g.b.pos.y += 2;
    flyUntilDone(g, g.a.id);
    expect(g.b.stuffing).toBe(100);
  });

  it('expire after their range', () => {
    const g = duel(config.weapons.super_soaker.range + 3, 'super_soaker');
    flyUntilDone(g, g.a.id);
    expect(g.b.stuffing).toBe(100);
    expect(g.state.projectiles).toHaveLength(0);
  });

  it('never hit their owner', () => {
    const g = duel(30);
    run(g.world, g.state, 1, (id) => (id === g.a.id ? fire : idle));
    // walk forward into your own shot
    run(g.world, g.state, 30, (id) => (id === g.a.id ? input({ moveX: 1, aimX: 1 }) : idle));
    expect(g.a.stuffing).toBe(100);
  });

  it('Super Soaker knocks the target back', () => {
    const g = duel(3, 'super_soaker');
    const startX = g.b.pos.x;
    run(g.world, g.state, 1, (id) => (id === g.a.id ? fire : idle));
    run(g.world, g.state, 20, () => idle);
    expect(g.b.pos.x - startX).toBeGreaterThan(1);
  });

  it('sweep test catches a fast projectile that would skip past a target', () => {
    // moves 3 units in one tick straight through a radius-0.5 circle centered 1.5 ahead
    expect(sweepCircle(0, 0, 3, 0, 1.5, 0, 0.5)).toBeCloseTo(1 / 3, 6);
    expect(sweepCircle(0, 0, 3, 0, 1.5, 2, 0.5)).toBeNull();
    expect(sweepCircle(0, 0, 0, 0, 0.2, 0, 0.5)).toBe(0);
  });
});

describe('beach balls', () => {
  const pool = { ...OPEN_MAP, id: 'pool', walls: [{ x: 29.2, y: 39.2, w: 1.6, h: 1.6, height: 1.6, kind: 'ball' as const }] };

  it('bounce back a plush that runs into one, with a boing', () => {
    const { world, state } = newGame(1, 2, pool);
    const a = state.players[0]!;
    a.pos = { x: 26, y: 40 };
    let bounced = false;
    for (let i = 0; i < 30 && !bounced; i++) {
      run(world, state, 1, (id) => (id === a.id ? input({ moveX: 1 }) : idle));
      bounced = state.events.some((e) => e.type === 'ballBounce' && e.playerId === a.id);
    }
    expect(bounced).toBe(true);
    // Knocked back away from the ball (toward -x; it fades a little the same tick), never inside it.
    expect(a.knockback.x).toBeLessThan(-config.beachBall.bounce * 0.6);
    expect(Math.hypot(a.pos.x - 30, a.pos.y - 40)).toBeGreaterThanOrEqual(a.radius + 0.8 - 1e-6);
  });

  it('are round: a plush can slide around one instead of catching on a corner', () => {
    const { world, state } = newGame(1, 2, pool);
    const a = state.players[0]!;
    // Just off the ball's corner diagonal, walking slowly enough not to bounce.
    a.pos = { x: 28.9, y: 38.9 };
    run(world, state, 1, (id) => (id === a.id ? idle : idle));
    expect(Math.hypot(a.pos.x - 30, a.pos.y - 40)).toBeGreaterThanOrEqual(a.radius + 0.8 - 1e-6);
  });
});
