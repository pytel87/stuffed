import { describe, expect, it } from 'vitest';
import { ANIMALS, applyDamage, awardOf, Btn, BUTTONS, config, HOME_MAP, matchButtons, PART_SLOTS, pickAnimal, PLAYABLE_MAPS, rng, setOffer } from '../src/index.ts';
import type { MapData, Part } from '../src/index.ts';
import { input, newGame, OPEN_MAP, run } from './helpers.ts';

describe('Buttons for a match', () => {
  it('pays a little for playing, plus what was found, knockouts and placing', () => {
    expect(awardOf(matchButtons({ placement: 9, knockouts: 0, won: false, found: 0 })).total).toBe(BUTTONS.match);
    expect(awardOf(matchButtons({ placement: 9, knockouts: 0, won: false, found: 12 })).total).toBe(BUTTONS.match + 12);
    expect(awardOf(matchButtons({ placement: 4, knockouts: 2, won: false, found: 0 })).total).toBe(BUTTONS.match + 2 * BUTTONS.knockout + BUTTONS.top5);
    expect(awardOf(matchButtons({ placement: 2, knockouts: 0, won: false, found: 0 })).total).toBe(BUTTONS.match + BUTTONS.top3);
  });

  it('a win replaces the placing bonus; knockouts and found Buttons are capped', () => {
    const lines = matchButtons({ placement: 1, knockouts: 99, won: true, found: 99999 });
    expect(lines.map((l) => l.reason)).toEqual(['match', 'found', 'knockouts', 'win']);
    expect(awardOf(lines).total).toBe(BUTTONS.match + BUTTONS.maxFound + BUTTONS.maxKnockouts * BUTTONS.knockout + BUTTONS.win);
  });
});

describe('Buttons in chests', () => {
  const withChest = (loot: 'low' | 'high'): MapData => ({ ...OPEN_MAP, id: 'chest', chestSpawns: [{ x: 22, y: 40, loot }] });

  for (const loot of ['low', 'high'] as const) {
    it(`a ${loot} chest puts Buttons in its opener's pocket`, () => {
      const { world, state } = newGame(1, 1, withChest(loot));
      const p = state.players[0]!;
      p.pos = { x: 20.5, y: 40 };
      run(world, state, 70, () => input({ buttons: Btn.Interact }));
      const [few, most] = config.chest.buttons[loot];
      expect(p.pocket).toBeGreaterThanOrEqual(few);
      expect(p.pocket).toBeLessThanOrEqual(most);
      expect(state.chests[0]!.opened).toBe(true);
    });
  }

  it('a knocked-out plush keeps what it found', () => {
    const { state } = newGame(1, 2, OPEN_MAP);
    const [a, b] = state.players;
    b!.pocket = 9;
    applyDamage(state, b!, 999, a!.id);
    expect(b!.alive).toBe(false);
    expect(b!.pocket).toBe(9);
  });
});

describe('the set shop', () => {
  const own = (animal: Part['animal'], slots: readonly Part['slot'][], holo = false) => slots.map((slot) => ({ slot, animal, holo }));

  it('charges only for the missing parts, by rarity', () => {
    const offer = setOffer(own('bear', ['head', 'body']), 'bear', false);
    expect(offer.missing).toEqual(['legs', 'tail', 'accessory']);
    expect(offer.price).toBe(3 * BUTTONS.partPrice[1]);
    expect(setOffer([], 'mermaid', false).price).toBe(PART_SLOTS.length * BUTTONS.partPrice[4]);
  });

  it('a complete set costs nothing more', () => {
    expect(setOffer(own('frog', PART_SLOTS), 'frog', false)).toMatchObject({ missing: [], price: 0 });
  });

  it('a holo set needs the plain set first, and costs more', () => {
    expect(setOffer(own('fox', ['head']), 'fox', true).locked).toBe(true);
    const offer = setOffer([...own('fox', PART_SLOTS), ...own('fox', ['head'], true)], 'fox', true);
    expect(offer.locked).toBe(false);
    expect(offer.price).toBe(4 * BUTTONS.partPrice[2] * BUTTONS.holoFactor);
  });
});

describe('home maps', () => {
  it('every animal has a playable home map, eight to a map', () => {
    const counts = new Map<string, number>();
    for (const a of ANIMALS) counts.set(HOME_MAP[a], (counts.get(HOME_MAP[a]) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual(PLAYABLE_MAPS.map((m) => m.id).sort());
    expect([...counts.values()].every((n) => n === 8)).toBe(true);
  });

  it("a map's home animals turn up far more often, and other maps' legendaries never", () => {
    const r = rng.seedRng(7);
    const seen = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const a = pickAnimal(r, 'cove');
      seen.set(a, (seen.get(a) ?? 0) + 1);
    }
    expect(seen.get('shark')! > 2 * seen.get('owl')!).toBe(true);
    expect(seen.get('mermaid') ?? 0).toBeGreaterThan(0);
    for (const legendary of ['unicorn', 'dragon', 'yeti'] as const) expect(seen.get(legendary) ?? 0).toBe(0);
  });
});
