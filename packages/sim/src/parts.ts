// Skin parts: eight animals, each with a part for every slot. Parts are cosmetic only.
import { config } from './config.ts';
import type { Animal, Part, PartLoadout, PartSlot, Player } from './types.ts';

export const ANIMALS: readonly Animal[] = ['bear', 'frog', 'shark', 'chicken', 'dino', 'owl', 'axolotl', 'penguin'];

export const PART_SLOTS: readonly PartSlot[] = ['head', 'body', 'legs', 'tail', 'accessory'];

/** Wearing this many parts of one animal makes a set (a cosmetic bonus). */
export const SET_SIZE = 3;

export const DEFAULT_PARTS: PartLoadout = {
  head: { animal: 'bear', rarity: 0, found: false },
  body: { animal: 'bear', rarity: 0, found: false },
  legs: { animal: 'chicken', rarity: 0, found: false },
  tail: { animal: 'bear', rarity: 0, found: false },
  accessory: { animal: 'frog', rarity: 0, found: false },
};

/** The animal when all five worn parts are the same animal (a full set), or null. */
export function fullSet(parts: PartLoadout): Animal | null {
  const animal = parts.head.animal;
  return PART_SLOTS.every((slot) => parts[slot].animal === animal) ? animal : null;
}

/** The animal of a set the plush wears (3+ parts of it), or null. */
export function wornSet(parts: PartLoadout): Animal | null {
  for (const animal of ANIMALS) {
    let n = 0;
    for (const slot of PART_SLOTS) if (parts[slot].animal === animal) n++;
    if (n >= SET_SIZE) return animal;
  }
  return null;
}

/** Parts a plush could take home: the ones it found and still wears, plus its stash. */
export function carriedParts(player: Pick<Player, 'parts' | 'stash'>): Part[] {
  const parts: Part[] = [];
  for (const slot of PART_SLOTS) {
    const worn = player.parts[slot];
    if (worn.found) parts.push({ slot, animal: worn.animal, rarity: worn.rarity });
  }
  if (player.stash) parts.push({ ...player.stash });
  return parts;
}

/**
 * Which carried parts go into the collection after a match: all of them for the winner, each
 * with its rarity's keep chance otherwise. `random` returns [0, 1) (outside the sim's RNG: it's
 * rolled once, by whoever records the result).
 */
export function rollKeeps(parts: readonly Part[], won: boolean, random: () => number): Part[] {
  return parts.filter((p) => won || random() < (config.parts.keepChance[p.rarity] ?? 0));
}
