import { describe, expect, it } from 'vitest';
import { applyDamage, BotController, Btn, config, createGame, fullSet, PART_SLOTS, secondsToTicks, spawnLoot, step, wornSet } from '../src/index.ts';
import type { GameState, MapData, Part, Player } from '../src/index.ts';
import { input, newGame, OPEN_MAP, run } from './helpers.ts';

const withChest = (x = 22, y = 40): MapData => ({ ...OPEN_MAP, id: 'chest', chestSpawns: [{ x, y }] });
const pressE = input({ buttons: Btn.Interact });
const pressQ = input({ buttons: Btn.Stash });
const idle = input();

function solo(map: MapData = OPEN_MAP) {
  const g = newGame(1, 1, map);
  const p = g.state.players[0]!;
  p.pos = { x: 20.5, y: 40 };
  return { ...g, p };
}

const partsOnGround = (s: GameState) => s.loot.filter((l) => l.content.type === 'part');
const shark = (slot: Part['slot'], rarity: Part['rarity'] = 2): Part => ({ slot, animal: 'shark', rarity });

/** One press: a tick with the button held, then a tick with it released. */
function press(world: ReturnType<typeof newGame>['world'], state: GameState, which = pressE): void {
  run(world, state, 1, () => which);
  run(world, state, 1, () => idle);
}

describe('skin parts', () => {
  it('every plush starts with its own look: one animal per slot, Hand-me-down, not found', () => {
    const { state } = newGame(3, 6);
    for (const p of state.players) {
      for (const slot of PART_SLOTS) expect(p.parts[slot]).toMatchObject({ rarity: 0, found: false });
      expect(p.stash).toBeNull();
    }
  });

  it('a roster can pick the look', () => {
    const state = createGame({ seed: 1, map: OPEN_MAP, roster: [{ name: 'a', isBot: false, parts: { head: 'frog', legs: 'chicken' } }] });
    expect(state.players[0]!.parts.head.animal).toBe('frog');
    expect(state.players[0]!.parts.legs.animal).toBe('chicken');
  });

  it('chests also drop a part', () => {
    const { world, state } = solo(withChest());
    run(world, state, secondsToTicks(config.chest.openTime) + 1, () => pressE);
    expect(state.chests[0]!.opened).toBe(true);
    expect(partsOnGround(state)).toHaveLength(1);
  });

  it('E puts a part on; your own part does not drop', () => {
    const { world, state, p } = solo();
    spawnLoot(world, state, { x: 21, y: 40 }, { type: 'part', part: shark('head') });
    press(world, state);
    expect(p.parts.head).toEqual({ animal: 'shark', rarity: 2, found: true });
    expect(state.loot).toHaveLength(0);
  });

  it('E swaps a found part for another: the old one drops', () => {
    const { world, state, p } = solo();
    p.parts.tail = { animal: 'frog', rarity: 1, found: true };
    spawnLoot(world, state, { x: 21, y: 40 }, { type: 'part', part: shark('tail', 3) });
    press(world, state);
    expect(p.parts.tail).toEqual({ animal: 'shark', rarity: 3, found: true });
    expect(partsOnGround(state).map((l) => l.content)).toEqual([{ type: 'part', part: { slot: 'tail', animal: 'frog', rarity: 1 } }]);
  });

  it('Q stashes a part; a part already in the stash drops', () => {
    const { world, state, p } = solo();
    const look = structuredClone(p.parts);
    spawnLoot(world, state, { x: 21, y: 40 }, { type: 'part', part: shark('legs') });
    press(world, state, pressQ);
    expect(p.stash).toEqual(shark('legs'));
    expect(p.parts).toEqual(look);

    spawnLoot(world, state, { x: 21, y: 40 }, { type: 'part', part: shark('body', 4) });
    press(world, state, pressQ);
    expect(p.stash).toEqual(shark('body', 4));
    expect(partsOnGround(state).map((l) => l.content)).toEqual([{ type: 'part', part: shark('legs') }]);
  });

  it('Q with nothing in reach puts the stashed part on, and stashes a found part it replaces', () => {
    const { world, state, p } = solo();
    p.stash = shark('head', 4);
    press(world, state, pressQ);
    expect(p.parts.head).toEqual({ animal: 'shark', rarity: 4, found: true });
    expect(p.stash).toBeNull(); // the plush's own head just came off

    p.stash = { slot: 'head', animal: 'chicken', rarity: 1 };
    press(world, state, pressQ);
    expect(p.parts.head.animal).toBe('chicken');
    expect(p.stash).toEqual(shark('head', 4));
  });

  it('holding E or Q does nothing more than one press', () => {
    const { world, state, p } = solo();
    spawnLoot(world, state, { x: 21, y: 40 }, { type: 'part', part: shark('head') });
    spawnLoot(world, state, { x: 21.2, y: 40 }, { type: 'part', part: shark('head', 4) });
    run(world, state, 10, () => pressE);
    expect(p.parts.head.rarity).toBe(2);
    expect(partsOnGround(state)).toHaveLength(1);
  });

  it('knocked out: found parts and the stash drop, your own look does not', () => {
    const { world, state, p } = solo();
    p.parts.head = { animal: 'shark', rarity: 3, found: true };
    p.parts.legs = { animal: 'frog', rarity: 1, found: true };
    p.stash = shark('tail', 4);
    applyDamage(state, p, 1000, null);
    run(world, state, 1, () => idle);
    const dropped = partsOnGround(state).map((l) => (l.content.type === 'part' ? l.content.part : null));
    expect(dropped).toHaveLength(3);
    expect(dropped).toContainEqual(shark('head', 3));
    expect(dropped).toContainEqual({ slot: 'legs', animal: 'frog', rarity: 1 });
    expect(dropped).toContainEqual(shark('tail', 4));
    expect(p.stash).toBeNull();
    // Nothing more drops on later ticks.
    run(world, state, 3, () => idle);
    expect(partsOnGround(state)).toHaveLength(3);
  });

  it('three parts of one animal make a set', () => {
    const { p } = solo();
    for (const slot of PART_SLOTS) p.parts[slot] = { animal: 'bear', rarity: 0, found: false };
    p.parts.head.animal = 'frog';
    p.parts.body.animal = 'shark';
    expect(wornSet(p.parts)).toBe('bear');
    p.parts.tail.animal = 'chicken';
    expect(wornSet(p.parts)).toBeNull();
  });

  it('all five parts of one animal make a full set', () => {
    const { p } = solo();
    for (const slot of PART_SLOTS) p.parts[slot] = { animal: 'frog', rarity: 0, found: false };
    expect(fullSet(p.parts)).toBe('frog');
    p.parts.legs.animal = 'chicken';
    expect(fullSet(p.parts)).toBeNull();
  });

  it('bots put on parts rarer than what they wear', () => {
    const { world, state } = newGame(5, 2);
    const [you, bot] = state.players as [Player, Player];
    you.isBot = false;
    bot.isBot = true;
    you.pos = { x: 70, y: 70 }; // far away and out of sight range
    bot.pos = { x: 20, y: 40 };
    spawnLoot(world, state, { x: 23, y: 40 }, { type: 'part', part: shark('accessory', 3) });
    const bots = new BotController(5);
    for (let t = 0; t < 150 && bot.parts.accessory.rarity !== 3; t++) {
      const inputs = bots.inputs(world, state);
      inputs.set(you.id, idle);
      step(world, state, inputs);
    }
    expect(bot.parts.accessory).toEqual({ animal: 'shark', rarity: 3, found: true });
  });
});
