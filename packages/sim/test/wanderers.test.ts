import { describe, expect, it } from 'vitest';
import { BACKYARD, BEDROOM, Btn, config, createGame, createWorld, makeWeapon, PARK, secondsToTicks, spawnLoot } from '../src/index.ts';
import type { EntityId, Input, MapData, Player } from '../src/index.ts';
import { input, roster, run } from './helpers.ts';

function game(map: MapData) {
  const world = createWorld(map);
  const state = createGame({ seed: 8, map, roster: roster(2) });
  const [you, other] = state.players as [Player, Player];
  you.pos = { x: 3, y: 3 };
  other.pos = { x: 5, y: 3 };
  const go = (ticks: number, mine: Partial<Input> = {}) => run(world, state, ticks, (id: EntityId) => (id === you.id ? input(mine) : input()));
  return { world, state, you, other, go };
}

describe('the robot vacuum', () => {
  it('roams its patch, staying in it', () => {
    const g = game(BEDROOM);
    const area = BEDROOM.wanderers![0]!.area!;
    const start = { ...g.state.wanderers[0]!.pos };
    let moved = 0;
    for (let i = 0; i < 600; i++) {
      g.go(1);
      const p = g.state.wanderers[0]!.pos;
      expect(p.x).toBeGreaterThanOrEqual(area.x - 0.01);
      expect(p.x).toBeLessThanOrEqual(area.x + area.w + 0.01);
      moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
    }
    expect(moved).toBeGreaterThan(3);
  });

  it('sucks up loot it rolls over and spits it out again later', () => {
    const g = game(BEDROOM);
    const v = g.state.wanderers[0]!;
    spawnLoot(g.world, g.state, { ...v.pos }, { type: 'weapon', weapon: makeWeapon('super_soaker', 3) });
    g.go(1);
    expect(v.carried).toHaveLength(1);
    expect(g.state.loot.some((l) => l.content.type === 'weapon' && l.content.weapon.kind === 'super_soaker')).toBe(false);
    g.go(secondsToTicks(config.wanderers.vacuum.holdFor) + 2);
    expect(v.carried).toHaveLength(0);
    expect(g.state.loot.some((l) => l.content.type === 'weapon' && l.content.weapon.kind === 'super_soaker')).toBe(true);
  });
});

describe('the lawnmower and the snowplow', () => {
  it('the switch sends the mower down its line, bonking whoever is in the way; it comes back next time', () => {
    const g = game(BACKYARD);
    const d = BACKYARD.wanderers![0]!;
    const m = g.state.wanderers[0]!;
    m.readyTick = 0;
    g.you.pos = { ...d.switch! };
    g.other.pos = { x: d.x, y: (d.y + d.to!.y) / 2 };
    g.go(1, { buttons: Btn.Interact });
    expect(m.mode).toBe('moving');
    g.you.pos = { x: 3, y: 3 };
    g.go(secondsToTicks(30 / config.wanderers.vehicle.mowerSpeed) + 10);
    expect(m.mode).toBe('idle');
    expect(Math.hypot(m.pos.x - d.to!.x, m.pos.y - d.to!.y)).toBeLessThan(0.1);
    expect(g.other.stuffing).toBeLessThan(100);
    expect(m.back).toBe(true);
  });

  it('the plow shoves plushies along ahead of it', () => {
    const g = game(PARK);
    const d = PARK.wanderers![0]!;
    const p = g.state.wanderers[0]!;
    p.readyTick = 0;
    g.you.pos = { ...d.switch! };
    g.other.pos = { x: d.x + 6, y: d.y };
    g.go(1, { buttons: Btn.Interact });
    g.you.pos = { x: 3, y: 3 };
    g.go(secondsToTicks(4));
    expect(g.other.pos.x).toBeGreaterThan(d.x + 10);
    expect(g.other.stuffing).toBe(100);
  });
});
