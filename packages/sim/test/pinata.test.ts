import { describe, expect, it } from 'vitest';
import { BACKYARD, BEDROOM, Btn, config, createGame, createWorld, makeWeapon, PARK } from '../src/index.ts';
import type { MapData, Player, WeaponKind } from '../src/index.ts';
import { input, roster, run } from './helpers.ts';

/** You `gap` south of the map's piñata, facing it with `kind`; nobody else around. */
function atPinata(map: MapData, kind: WeaponKind, gap = 4) {
  const world = createWorld(map);
  const state = createGame({ seed: 3, map, roster: roster(2) });
  const [you, other] = state.players as [Player, Player];
  const pin = state.pinata!;
  other.pos = { x: 4, y: 4 };
  you.pos = { x: pin.pos.x, y: pin.pos.y + gap };
  you.weapons = [makeWeapon(kind, 0), null];
  const fire = (ticks: number) => run(world, state, ticks, (id) => (id === you.id ? input({ aimX: 0, aimY: -gap, buttons: state.tick % 4 < 2 ? Btn.Fire : 0 }) : input()));
  return { world, state, you, pin, fire };
}

describe('the piñata', () => {
  it('each map has one, out in the open', () => {
    for (const map of [BACKYARD, BEDROOM, PARK]) {
      const p = map.pinata!;
      expect(p, map.id).toBeDefined();
      for (const w of map.walls) {
        const near = p.x > w.x - 1.2 && p.x < w.x + w.w + 1.2 && p.y > w.y - 1.2 && p.y < w.y + w.h + 1.2;
        expect(near, `${map.id} piñata by a wall at ${w.x},${w.y}`).toBe(false);
      }
    }
  });

  it('shots wear it down until it breaks and showers good loot around it', () => {
    for (const map of [BACKYARD, BEDROOM, PARK]) {
      const g = atPinata(map, 'foam_dart_smg');
      g.fire(10);
      expect(g.pin.hp, map.id).toBeLessThan(config.pinata.hp);
      for (let i = 0; i < 40 && !g.pin.broken; i++) {
        g.you.weapons[0]!.ammo = 30;
        g.you.weapons[0]!.reloadEndTick = null;
        g.fire(10);
      }
      expect(g.pin.broken, map.id).toBe(true);
      const loot = g.state.loot.filter((l) => Math.hypot(l.pos.x - g.pin.pos.x, l.pos.y - g.pin.pos.y) < 3);
      const { weapons, items, parts } = config.pinata.loot;
      expect(loot, map.id).toHaveLength(weapons + items + parts);
      for (const l of loot) if (l.content.type === 'weapon') expect(l.content.weapon.rarity).toBeGreaterThanOrEqual(2);
    }
  });

  it('a hammer whack counts, and a whole one is in the way; a broken one is not', () => {
    const g = atPinata(BACKYARD, 'pillow_hammer', 1.4);
    run(g.world, g.state, 1, (id) => (id === g.you.id ? input({ aimX: 0, aimY: -1, buttons: Btn.Fire }) : input()));
    expect(g.pin.hp).toBeLessThan(config.pinata.hp);
    run(g.world, g.state, 30, (id) => (id === g.you.id ? input({ moveY: -1 }) : input()));
    expect(g.you.pos.y).toBeGreaterThan(g.pin.pos.y + config.pinata.radius);
    g.pin.broken = true;
    run(g.world, g.state, 30, (id) => (id === g.you.id ? input({ moveY: -1 }) : input()));
    expect(g.you.pos.y).toBeLessThan(g.pin.pos.y);
  });
});
