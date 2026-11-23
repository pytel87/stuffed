// Buttons (Knoflíky): the currency earned in matches and spent in the shop on whole sets. Shared
// by the server (which awards and charges them) and the client (which shows the same prices).
// Nothing here touches the simulation.
import { ANIMAL_RARITY, PART_SLOTS } from './parts.ts';
import type { Animal, Part, PartSlot } from './types.ts';

export const BUTTONS = {
  /** For playing a match at all (so nobody goes home with nothing). */
  match: 5,
  /** The most a match's found Buttons (chests, piñatas) can count for, reported by a browser. */
  maxFound: 400,
  /** Each knockout, up to `maxKnockouts` of them. */
  knockout: 5,
  maxKnockouts: 10,
  /** Finishing in the top five / top three (not stacked with each other or a win). */
  top5: 10,
  top3: 20,
  win: 40,
  /** The first win of each day (UTC), on top. */
  dailyWin: 50,
  /**
   * Solo matches are played in the browser and reported by it, so two guards against scripts (not
   * players): one reported sooner than this after the previous one earns nothing (no real match is
   * that short), and no more than `soloDailyCeiling` a day from them (far more than anyone plays).
   */
  soloMinGapMs: 60_000,
  soloDailyCeiling: 2000,
  /** What one missing part of a set costs, by the animal's rarity (1 common … 4 legendary). */
  partPrice: [0, 20, 40, 80, 200] as const,
  /** A holo part costs this many times its plain one. */
  holoFactor: 3,
} as const;

export type ButtonReason = 'match' | 'found' | 'knockouts' | 'top5' | 'top3' | 'win' | 'dailyWin';

/** One line of a match's Buttons, as shown on the end screen. */
export interface ButtonLine {
  reason: ButtonReason;
  amount: number;
}

/** What a match earned, line by line. */
export interface ButtonAward {
  lines: ButtonLine[];
  total: number;
}

export function awardOf(lines: readonly ButtonLine[]): ButtonAward {
  const kept = lines.filter((l) => l.amount > 0);
  return { lines: kept, total: kept.reduce((sum, l) => sum + l.amount, 0) };
}

/**
 * The Buttons a finished match earns (before the daily bonus and the solo cap, which need to know
 * the rest of the day: see the server). `placement` 1 is the winner.
 */
export function matchButtons(result: { placement: number | null; knockouts: number; won: boolean; found: number }): ButtonLine[] {
  const lines: ButtonLine[] = [{ reason: 'match', amount: BUTTONS.match }];
  const found = Math.max(0, Math.min(BUTTONS.maxFound, Math.floor(result.found)));
  if (found > 0) lines.push({ reason: 'found', amount: found });
  const knockouts = Math.max(0, Math.min(BUTTONS.maxKnockouts, Math.floor(result.knockouts)));
  if (knockouts > 0) lines.push({ reason: 'knockouts', amount: knockouts * BUTTONS.knockout });
  const place = result.placement ?? Infinity;
  if (result.won) lines.push({ reason: 'win', amount: BUTTONS.win });
  else if (place <= 3) lines.push({ reason: 'top3', amount: BUTTONS.top3 });
  else if (place <= 5) lines.push({ reason: 'top5', amount: BUTTONS.top5 });
  return lines;
}

/** What the shop would sell you for one animal: the parts missing from its set, and their price. */
export interface SetOffer {
  animal: Animal;
  holo: boolean;
  missing: PartSlot[];
  price: number;
  /** A holo set needs its plain set first. */
  locked: boolean;
}

export function setOffer(owned: readonly Pick<Part, 'slot' | 'animal' | 'holo'>[], animal: Animal, holo: boolean): SetOffer {
  const has = (slot: PartSlot, wantHolo: boolean) => owned.some((p) => p.slot === slot && p.animal === animal && !!p.holo === wantHolo);
  const missing = PART_SLOTS.filter((slot) => !has(slot, holo));
  const each = BUTTONS.partPrice[ANIMAL_RARITY[animal]] * (holo ? BUTTONS.holoFactor : 1);
  const locked = holo && !PART_SLOTS.every((slot) => has(slot, false));
  return { animal, holo, missing, price: missing.length * each, locked };
}
