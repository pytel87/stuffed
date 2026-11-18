// Skin parts: twenty animals, each with a part for every slot. Parts are cosmetic only.
import { config } from './config.ts';
import { pickWeighted } from './rng.ts';
import type { Animal, Part, PartLoadout, PartSlot, Player, Rarity, RngState } from './types.ts';

export const ANIMALS: readonly Animal[] = [
  'bear', 'frog', 'shark', 'chicken', 'dino', 'owl', 'axolotl', 'penguin',
  'bunny', 'unicorn', 'cat', 'fox', 'panda', 'pig', 'lion', 'elephant',
  'turtle', 'hedgehog', 'koala', 'octopus',
];

/**
 * How rare each animal's parts are, on the rarity scale (its colors light the ring under a part
 * on the ground): 1 common, 2 rare, 3 epic, 4 legendary. Chests roll animals by
 * `config.parts.animalWeights`.
 */
export const ANIMAL_RARITY: Record<Animal, Rarity> = {
  bear: 1, frog: 1, chicken: 1, bunny: 1, cat: 1, pig: 1, turtle: 1,
  shark: 2, owl: 2, penguin: 2, fox: 2, panda: 2, hedgehog: 2, koala: 2,
  dino: 3, axolotl: 3, lion: 3, elephant: 3, octopus: 3,
  unicorn: 4,
};

const ANIMAL_WEIGHTS = Object.fromEntries(ANIMALS.map((a) => [a, config.parts.animalWeights[ANIMAL_RARITY[a]]])) as Record<Animal, number>;

/** A random animal, rarer ones less often. */
export function pickAnimal(rng: RngState): Animal {
  return pickWeighted(rng, ANIMAL_WEIGHTS);
}

/** The common animals (a new profile's first look comes from these). */
export const COMMON_ANIMALS: readonly Animal[] = ANIMALS.filter((a) => ANIMAL_RARITY[a] === 1);

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

/** Parts a plush could take home: the ones it found and still wears, plus its bag. */
export function carriedParts(player: Pick<Player, 'parts' | 'stash'>): Part[] {
  const parts: Part[] = [];
  for (const slot of PART_SLOTS) {
    const worn = player.parts[slot];
    if (worn.found) parts.push({ slot, animal: worn.animal, rarity: worn.rarity });
  }
  for (const part of player.stash) parts.push({ ...part });
  return parts;
}
