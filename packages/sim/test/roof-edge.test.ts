import { describe, expect, it } from 'vitest';
import { BACKYARD, canSee, createGame, createWorld } from '../src/index.ts';
import type { Player } from '../src/index.ts';
import { roster } from './helpers.ts';

describe('jumping up onto a roof', () => {
  it('a plush whose feet are almost at the roof stays in sight (it is jumping up, not hiding inside)', () => {
    const world = createWorld(BACKYARD);
    const state = createGame({ seed: 1, map: BACKYARD, roster: roster(2) });
    const [you, other] = state.players as [Player, Player];
    const house = BACKYARD.buildings.findIndex((b) => b.kind === 'house');
    const b = BACKYARD.buildings[house]!;
    you.pos = { x: b.x - 4, y: b.y + 4 };
    you.building = -1;
    other.pos = { x: b.x + 1, y: b.y + 4 };
    other.building = house;
    other.z = 0;
    expect(canSee(world, state, you, other)).toBe(false); // inside: hidden
    other.z = b.height - 0.2;
    expect(canSee(world, state, you, other)).toBe(true); // on its way up onto the roof
  });
});
