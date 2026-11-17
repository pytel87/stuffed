import { describe, expect, it } from 'vitest';
import { BOT, BotController, createGame, createWorld, step, TEST_MAP } from '../src/index.ts';
import type { EntityId, GameEvent, GameState, Input, MapData, Player, World } from '../src/index.ts';
import { OPEN_MAP } from './helpers.ts';

function botMatch(seed: number, count = 16, map: MapData = TEST_MAP, zoneTimeScale = 1) {
  const world = createWorld(map);
  const roster = Array.from({ length: count }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true }));
  const state = createGame({ seed, map, roster, zoneTimeScale });
  return { world, state, bots: new BotController(seed) };
}

/** Steps with bot inputs (plus optional fixed inputs for non-bots); returns all events seen. */
function play(world: World, state: GameState, bots: BotController, ticks: number, extra: Map<EntityId, Input> = new Map()): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < ticks && state.status === 'playing'; t++) {
    const inputs = bots.inputs(world, state);
    for (const [id, input] of extra) inputs.set(id, input);
    step(world, state, inputs);
    events.push(...state.events);
  }
  return events;
}

describe('bots', () => {
  it('are deterministic: same seed, same match', () => {
    const a = botMatch(42);
    const b = botMatch(42);
    play(a.world, a.state, a.bots, 1800);
    play(b.world, b.state, b.bots, 1800);
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  });

  it('open chests and pick things up in the first minute', () => {
    const { world, state, bots } = botMatch(7);
    const events = play(world, state, bots, 60 * 30);
    expect(state.chests.filter((c) => c.opened).length).toBeGreaterThanOrEqual(8);
    expect(events.filter((e) => e.type === 'pickup').length).toBeGreaterThanOrEqual(5);
  });

  it('keep moving around the map instead of getting stuck', () => {
    const { world, state, bots } = botMatch(3);
    const travelled = new Map<EntityId, number>();
    let last = new Map(state.players.map((p) => [p.id, { ...p.pos }]));
    for (let t = 0; t < 60 * 30; t++) {
      step(world, state, bots.inputs(world, state));
      for (const p of state.players) {
        const before = last.get(p.id)!;
        travelled.set(p.id, (travelled.get(p.id) ?? 0) + Math.hypot(p.pos.x - before.x, p.pos.y - before.y));
      }
      last = new Map(state.players.map((p) => [p.id, { ...p.pos }]));
    }
    for (const p of state.players) if (p.alive) expect(travelled.get(p.id)!).toBeGreaterThan(30);
  });

  /** A bot and you `gap` apart; by default after the opening truce. */
  function standoff(gap: number, afterTruce = true) {
    const world = createWorld(OPEN_MAP);
    const state = createGame({ seed: 1, map: OPEN_MAP, roster: [{ name: 'bot', isBot: true }, { name: 'you', isBot: false }] });
    const [bot, you] = state.players as [Player, Player];
    bot.pos = { x: 20, y: 40 };
    you.pos = { x: 20 + gap, y: 40 };
    if (afterTruce) state.tick = BOT.truce * 30;
    return { world, state, bot, you };
  }

  it('shoot at an enemy close by', () => {
    const { world, state, you } = standoff(4);
    play(world, state, new BotController(1), 4 * 30);
    expect(you.stuffing).toBeLessThan(100);
  });

  it('only loot during the opening truce, unless hurt', () => {
    const { world, state, you } = standoff(4, false);
    const events = play(world, state, new BotController(1), 4 * 30);
    expect(events.filter((e) => e.type === 'shot').length).toBe(0);
    expect(you.stuffing).toBe(100);
  });

  it('with only the starter weapon, leave a distant enemy alone until hurt', () => {
    const { world, state, you } = standoff(12);
    const events = play(world, state, new BotController(1), 3 * 30);
    expect(events.filter((e) => e.type === 'shot').length).toBe(0);
    expect(you.stuffing).toBe(100);
  });

  it('leave an enemy hidden in a bush alone', () => {
    const map: MapData = { ...OPEN_MAP, id: 'bush', bushes: [{ center: { x: 24, y: 40 }, radius: 2 }] };
    const world = createWorld(map);
    const state = createGame({ seed: 1, map, roster: [{ name: 'bot', isBot: true }, { name: 'you', isBot: false }] });
    const [bot, you] = state.players as [Player, Player];
    bot.pos = { x: 20, y: 40 };
    you.pos = { x: 24, y: 40 };
    const events = play(world, state, new BotController(1), 2 * 30);
    expect(events.filter((e) => e.type === 'shot').length).toBe(0);
  });

  it('head back inside the circle when soggy', () => {
    const { world, state, bots } = botMatch(5, 1, OPEN_MAP);
    const bot = state.players[0]!;
    state.zone.start = state.zone.end = { center: { x: 40, y: 40 }, radius: 10 };
    bot.pos = { x: 70, y: 40 };
    play(world, state, bots, 5 * 30);
    expect(Math.hypot(bot.pos.x - 40, bot.pos.y - 40)).toBeLessThan(10);
  });

  it('play a whole match down to one winner', () => {
    const { world, state, bots } = botMatch(11, 16, TEST_MAP, 0.25);
    const events = play(world, state, bots, 30 * 60 * 4);
    expect(state.status).toBe('ended');
    expect(state.winnerId).not.toBeNull();
    const shooters = new Set(events.flatMap((e) => (e.type === 'hit' && e.sourceId !== null ? [e.sourceId] : [])));
    expect(shooters.size).toBeGreaterThanOrEqual(3); // knockouts came from fights, not only the water
  });
});
