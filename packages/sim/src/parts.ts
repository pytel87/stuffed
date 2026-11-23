// Skin parts: thirty-two animals, each with a part for every slot. Parts are cosmetic only.
import { config } from './config.ts';
import { nextFloat, pick, pickWeighted } from './rng.ts';
import type { Animal, MissingPart, Part, PartLoadout, PartSlot, Player, Rarity, RngState, WornPart } from './types.ts';

export const ANIMALS: readonly Animal[] = [
  'bear', 'frog', 'shark', 'chicken', 'dino', 'owl', 'axolotl', 'penguin',
  'bunny', 'unicorn', 'cat', 'fox', 'panda', 'pig', 'lion', 'elephant',
  'turtle', 'hedgehog', 'koala', 'octopus',
  'mouse', 'sheep', 'raccoon', 'bee', 'flamingo', 'giraffe', 'sloth', 'dragon', 'phoenix', 'yeti',
  'otter', 'mermaid',
];

/**
 * How rare each animal's parts are, on the rarity scale (its colors light the ring under a part
 * on the ground): 1 common, 2 rare, 3 epic, 4 legendary. Chests roll animals by
 * `config.parts.animalWeights`.
 */
export const ANIMAL_RARITY: Record<Animal, Rarity> = {
  bear: 1, frog: 1, chicken: 1, bunny: 1, cat: 1, pig: 1, turtle: 1, mouse: 1, sheep: 1,
  shark: 2, owl: 2, penguin: 2, fox: 2, panda: 2, hedgehog: 2, koala: 2, raccoon: 2, bee: 2,
  dino: 3, axolotl: 3, lion: 3, elephant: 3, octopus: 3, flamingo: 3, giraffe: 3, sloth: 3, otter: 3,
  unicorn: 4, dragon: 4, phoenix: 4, yeti: 4, mermaid: 4,
};

/**
 * Each animal's home map: its parts turn up there far more often (see config.parts.homeBoost), and
 * a legendary one only there. Eight animals to a map.
 */
export const HOME_MAP: Record<Animal, string> = {
  // The garden: the farm and garden animals, and the unicorn among the flowers.
  frog: 'backyard', bunny: 'backyard', chicken: 'backyard', hedgehog: 'backyard', bee: 'backyard', pig: 'backyard', sheep: 'backyard', unicorn: 'backyard',
  // The kid's room: the toy-box favorites, and the mouse in the walls.
  bear: 'bedroom', cat: 'bedroom', panda: 'bedroom', koala: 'bedroom', dino: 'bedroom', elephant: 'bedroom', mouse: 'bedroom', dragon: 'bedroom',
  // The snowy park, with its zoo animals.
  penguin: 'park', owl: 'park', raccoon: 'park', fox: 'park', sloth: 'park', giraffe: 'park', lion: 'park', yeti: 'park',
  // Pirate Cove: the sea folk, and the phoenix from its volcano.
  shark: 'cove', turtle: 'cove', otter: 'cove', octopus: 'cove', axolotl: 'cove', flamingo: 'cove', mermaid: 'cove', phoenix: 'cove',
};

const baseWeight = (a: Animal) => config.parts.animalWeights[ANIMAL_RARITY[a]]!;
const ANIMAL_WEIGHTS = Object.fromEntries(ANIMALS.map((a) => [a, baseWeight(a)])) as Record<Animal, number>;
const weightsOn = new Map<string, Record<Animal, number>>();

/** How likely each animal is on `mapId`: its home animals boosted, other maps' legendaries never. */
function weightsFor(mapId: string | undefined): Record<Animal, number> {
  if (!mapId || !Object.values(HOME_MAP).includes(mapId)) return ANIMAL_WEIGHTS;
  let w = weightsOn.get(mapId);
  if (!w) {
    w = Object.fromEntries(
      ANIMALS.map((a) => [a, HOME_MAP[a] === mapId ? baseWeight(a) * config.parts.homeBoost : ANIMAL_RARITY[a] === 4 ? 0 : baseWeight(a)]),
    ) as Record<Animal, number>;
    weightsOn.set(mapId, w);
  }
  return w;
}

/** A random animal, rarer ones less often; on a map, its home animals more often. */
export function pickAnimal(rng: RngState, mapId?: string): Animal {
  return pickWeighted(rng, weightsFor(mapId));
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

/** A worn part as a loose one (holo only when it is, so plain parts stay as they were). */
export function looseOf(slot: PartSlot, worn: WornPart): Part {
  return { slot, animal: worn.animal, rarity: worn.rarity, ...(worn.holo ? { holo: true } : {}) };
}

/** Animals whose whole regular set is in a collection: their holographic parts can drop for its owner. */
export function completeSets(owned: readonly Pick<Part, 'slot' | 'animal' | 'holo'>[]): Animal[] {
  return ANIMALS.filter((animal) => PART_SLOTS.every((slot) => owned.some((p) => p.slot === slot && p.animal === animal && !p.holo)));
}

/** The last piece of every set four-fifths owned (regular parts; holo ones don't count). */
export function missingPieces(owned: readonly Pick<Part, 'slot' | 'animal' | 'holo'>[]): MissingPart[] {
  const out: MissingPart[] = [];
  for (const animal of ANIMALS) {
    const missing = PART_SLOTS.filter((slot) => !owned.some((p) => p.slot === slot && p.animal === animal && !p.holo));
    if (missing.length === 1) out.push({ slot: missing[0]!, animal });
  }
  return out;
}

type Finder = Pick<Player, 'holoAnimals' | 'missingParts' | 'parts' | 'stash'>;

/**
 * A part found by `finder` (a chest opened, a piñata burst). Now and then it's the last piece of a
 * set they have four of (one they don't carry yet), and now and then holographic, once they own
 * that animal's whole set.
 */
export function rollPart(rng: RngState, finder: Finder | null | undefined, holoChance: number, mapId?: string): Part {
  const part: Part = { slot: pick(rng, PART_SLOTS), animal: pickAnimal(rng, mapId), rarity: 0 };
  // (Every roll made for every part, lucky or not, so the match's dice don't depend on who opened it.)
  const lucky = nextFloat(rng);
  const which = nextFloat(rng);
  const roll = nextFloat(rng);
  const carried = (m: MissingPart) => finder!.stash.some((p) => p.slot === m.slot && p.animal === m.animal) || (finder!.parts[m.slot].animal === m.animal && finder!.parts[m.slot].found);
  const wanted = finder ? finder.missingParts.filter((m) => !carried(m)) : [];
  if (wanted.length > 0) {
    // One of the missing pieces, by luck as good as that animal is common.
    const m = wanted[Math.min(wanted.length - 1, Math.floor(which * wanted.length))]!;
    if (lucky < config.parts.missingPieceChance[ANIMAL_RARITY[m.animal]]!) {
      part.slot = m.slot;
      part.animal = m.animal;
    }
  }
  if (finder?.holoAnimals.includes(part.animal) && roll < holoChance) part.holo = true;
  return part;
}

/** Parts a plush could take home: the ones it found and still wears, plus its bag. */
export function carriedParts(player: Pick<Player, 'parts' | 'stash'>): Part[] {
  const parts: Part[] = [];
  for (const slot of PART_SLOTS) {
    const worn = player.parts[slot];
    if (worn.found) parts.push(looseOf(slot, worn));
  }
  for (const part of player.stash) parts.push({ ...part });
  return parts;
}
