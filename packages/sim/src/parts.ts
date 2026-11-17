// Skin parts: four animals, each with a part for every slot. Parts are cosmetic only.
import type { Animal, PartLoadout, PartSlot } from './types.ts';

export const ANIMALS: readonly Animal[] = ['bear', 'frog', 'shark', 'chicken'];

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

/** The animal of a set the plush wears (3+ parts of it), or null. */
export function wornSet(parts: PartLoadout): Animal | null {
  for (const animal of ANIMALS) {
    let n = 0;
    for (const slot of PART_SLOTS) if (parts[slot].animal === animal) n++;
    if (n >= SET_SIZE) return animal;
  }
  return null;
}
