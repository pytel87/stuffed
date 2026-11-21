// How each animal moves, by kind: its jumps and landings sound like it (audio/game-audio.ts) and it
// dances like it when it wins (render/plush-view.ts).
import type { Animal } from '@stuffed/sim';

/** A springy boing, a heavy whump, a flap of wings, a wet bloop or a cotton poof. */
export type AnimalKind = 'springy' | 'heavy' | 'winged' | 'squishy' | 'fluffy';

export const ANIMAL_KIND: Record<Animal, AnimalKind> = {
  frog: 'springy', bunny: 'springy', cat: 'springy', fox: 'springy', unicorn: 'springy', mouse: 'springy',
  bear: 'heavy', panda: 'heavy', pig: 'heavy', lion: 'heavy', elephant: 'heavy', yeti: 'heavy', dino: 'heavy', giraffe: 'heavy',
  chicken: 'winged', owl: 'winged', penguin: 'winged', flamingo: 'winged', phoenix: 'winged', dragon: 'winged', bee: 'winged',
  shark: 'squishy', axolotl: 'squishy', octopus: 'squishy', turtle: 'squishy', otter: 'squishy', mermaid: 'squishy',
  hedgehog: 'fluffy', koala: 'fluffy', raccoon: 'fluffy', sloth: 'fluffy', sheep: 'fluffy',
};
