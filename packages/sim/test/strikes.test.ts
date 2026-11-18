import { describe, expect, it } from 'vitest';
import { BACKYARD, BEDROOM, Btn, config, createGame, createWorld, findInteraction, PARK, secondsToTicks } from '../src/index.ts';
import type { EntityId, Input, MapData, Player } from '../src/index.ts';
import { input, roster, run } from './helpers.ts';

/** You at the Backyard's strike button (up on the treehouse), two others close together on the lawn. */
function setup(map: MapData = BACKYARD) {
  const world = createWorld(map);
  const state = createGame({ seed: 2, map, roster: roster(4) });
  const [you, a, b, far] = state.players as [Player, Player, Player, Player];
  const button = state.strikeButton!;
  button.readyTick = 0;
  you.pos = { x: button.pos.x + 0.8, y: button.pos.y };
  you.z = button.z;
  a.pos = { x: 64, y: 30 };
  b.pos = { x: 65.5, y: 30.5 };
  far.pos = { x: 110, y: 110 };
  const press = (ticks = 1) => run(world, state, ticks, (id: EntityId): Input => (id === you.id ? input({ buttons: Btn.Interact }) : input()));
  return { world, state, you, a, b, far, button, press };
}

describe('the air strike button', () => {
  it('each map has one, standing somewhere a plush can reach', () => {
    for (const map of [BACKYARD, BEDROOM, PARK]) {
      const s = map.strikeButton!;
      expect(s, map.id).toBeDefined();
      for (const w of map.walls) {
        const inside = s.x > w.x - 0.4 && s.x < w.x + w.w + 0.4 && s.y > w.y - 0.4 && s.y < w.y + w.h + 0.4;
        if (inside) expect(w.height, `${map.id} button on a wall`).toBeLessThanOrEqual(s.z);
      }
      // On a roof only where the roof is (else on the ground).
      const roof = map.buildings.find((b) => s.x >= b.x && s.x <= b.x + b.w && s.y >= b.y && s.y <= b.y + b.h);
      expect(s.z, map.id).toBe(roof ? roof.height : 0);
    }
  });

  it('calls a marked shower onto the crowd, then needs a while', () => {
    const g = setup();
    expect(findInteraction(g.state, g.you)?.kind).toBe('strike');
    g.press();
    expect(g.state.strikes).toHaveLength(config.strike.count);
    expect(g.state.strikes[0]!.pos).toEqual(g.a.pos);
    expect(g.state.events.some((e) => e.type === 'strikeCalled')).toBe(true);
    // Nothing yet: it lands after the warning.
    expect(g.a.stuffing).toBe(100);
    expect(g.button.readyTick).toBe(g.state.tick + secondsToTicks(config.strike.cooldown));
    expect(findInteraction(g.state, g.you)).toBeNull();
  });

  it('hurts, knocks back and soaks whoever is in a circle when it lands; a roof keeps you safe', () => {
    const g = setup();
    g.press();
    // A third plush hides inside the house, right under one of the drops.
    const drop = g.state.strikes[1]!;
    g.far.pos = { x: 60, y: 64 };
    drop.pos = { ...g.far.pos };
    run(g.world, g.state, secondsToTicks(config.strike.warning + config.strike.gap * config.strike.count) + 2, () => input());
    expect(g.state.strikes).toHaveLength(0);
    expect(g.a.stuffing + g.a.buttons).toBeLessThan(100);
    expect(g.state.tick).toBeLessThan(g.a.soakedUntil);
    expect(g.far.stuffing).toBe(100);
    // Soaked: slower (once the knockback has settled).
    run(g.world, g.state, 20, () => input());
    expect(g.state.tick).toBeLessThan(g.a.soakedUntil - 15);
    const x0 = g.a.pos.x;
    const slow = setup();
    run(g.world, g.state, 15, (id) => (id === g.a.id ? input({ moveX: 1 }) : input()));
    run(slow.world, slow.state, 15, (id) => (id === slow.a.id ? input({ moveX: 1 }) : input()));
    expect(g.a.pos.x - x0).toBeLessThan((slow.a.pos.x - 64) * 0.9);
  });

  it("can't be pressed from the ground under the treehouse", () => {
    const g = setup();
    g.you.z = 0;
    g.press(5);
    expect(g.state.strikes).toHaveLength(0);
  });
});
