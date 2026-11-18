import { describe, expect, it } from 'vitest';
import { BACKYARD, BEDROOM, Btn, config, createGame, createWorld, findInteraction, onIce, PARK, secondsToTicks, wading } from '../src/index.ts';
import type { EntityId, Input, MapData, Player } from '../src/index.ts';
import { input, roster, run } from './helpers.ts';

/** You at the map's toy (ready), another plush at `other` (relative to where the toy acts). */
function atToy(map: MapData, other: { x: number; y: number }) {
  const world = createWorld(map);
  const state = createGame({ seed: 4, map, roster: roster(3) });
  const [you, them, far] = state.players as [Player, Player, Player];
  const toy = state.toy!;
  toy.readyTick = 0;
  you.pos = { x: toy.pos.x + 1, y: toy.pos.y + 0.5 };
  you.z = toy.z;
  them.pos = { x: toy.at.x + other.x, y: toy.at.y + other.y };
  far.pos = { x: 4, y: 4 };
  const press = () => run(world, state, 1, (id: EntityId): Input => (id === you.id ? input({ buttons: Btn.Interact }) : input()));
  const wait = (seconds: number) => run(world, state, secondsToTicks(seconds), () => input());
  return { world, state, you, them, far, toy, press, wait };
}

describe('the jack-in-the-box', () => {
  it('plays its tune, then pops and launches whoever is close; then needs a while', () => {
    const g = atToy(BEDROOM, { x: 2.5, y: 0 });
    // Out of your reach of the box, so only the one beside it gets launched.
    expect(findInteraction(g.state, g.you)?.kind).toBe('toy');
    g.press();
    g.you.pos = { x: g.toy.at.x - 8, y: g.toy.at.y };
    g.wait(config.toys.jack.windup - 0.2);
    expect(g.them.stuffing).toBe(100);
    const x0 = g.them.pos.x;
    g.wait(0.6);
    expect(g.them.stuffing).toBeLessThan(100);
    expect(g.them.pos.x).toBeGreaterThan(x0 + 1);
    expect(g.far.stuffing).toBe(100);
    expect(g.state.tick).toBeLessThan(g.toy.readyTick);
  });
});

describe('the sprinkler', () => {
  it('turned on at the tap, its arc sweeps round and pushes and soaks whoever is out on the lawn', () => {
    const g = atToy(BACKYARD, { x: 0, y: 3 });
    expect(findInteraction(g.state, g.you)?.kind).toBe('toy');
    g.press();
    let soaked = false;
    for (let i = 0; i < secondsToTicks(config.toys.sprinkler.duration); i++) {
      run(g.world, g.state, 1, () => input());
      if (g.state.tick < g.them.soakedUntil) soaked = true;
    }
    expect(soaked).toBe(true);
    expect(Math.hypot(g.them.pos.x - g.toy.at.x, g.them.pos.y - g.toy.at.y)).toBeGreaterThan(3.5);
  });
});

describe('the ice drill', () => {
  it('cracks the pond, then it breaks: whoever is on it is dunked, and it is open water for a while', () => {
    const g = atToy(PARK, { x: -6, y: 0 });
    const pond = PARK.ice![0]!;
    expect(onIce(g.world, g.them, g.state)).toBe(true);
    g.press();
    g.you.pos = { x: pond.center.x + pond.radius + 3, y: pond.center.y };
    g.wait(config.toys.icedrill.windup + 0.1);
    expect(g.them.stuffing).toBeLessThan(100);
    expect(g.state.tick).toBeLessThan(g.them.soakedUntil);
    expect(onIce(g.world, g.them, g.state)).toBe(false);
    expect(wading(g.world, g.them, g.state)).toBe(true);
    g.wait(config.toys.icedrill.open);
    expect(onIce(g.world, g.them, g.state)).toBe(true);
    expect(g.you.stuffing).toBe(100);
  });
});
