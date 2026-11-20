// First-time tips: each shown once on this device, at the moment it matters (the first chest in
// reach, the first part, an item picked up, the water rising...), as a toast. Also the controls
// card on your very first match. Nothing for players who have seen it all.
import { completeSets, findInteraction, PART_SLOTS } from '@stuffed/sim';
import type { GameEvent, GameState, Player, World } from '@stuffed/sim';
import { tr } from '../i18n.ts';

const KEY = 'stuffed.tips';
/** The least time between two tips. */
const GAP = 8;

/** Seconds a tip stays up: long enough to read it (longer ones longer). */
const readTime = (text: string) => Math.min(10, Math.max(6, 2 + text.length / 15));

type TipId = 'controls' | 'chest' | 'part' | 'stash' | 'item' | 'rinse' | 'set' | 'holo' | 'gallery';

export class Tips {
  private readonly seen: Set<TipId>;
  private quietFor = 0;
  /** A tip about your collection, saved for the next match (the results card covers the toast). */
  private pending: { id: TipId; text: string } | null = null;

  constructor(
    private readonly announce: (text: string, seconds: number) => void,
    private readonly showHelp: () => void,
  ) {
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
    } catch {
      // storage blocked: every tip once per visit
    }
    this.seen = new Set(stored as TipId[]);
  }

  /** A match of your own has started: the controls card the very first time. */
  matchStarted(): void {
    this.quietFor = 3;
    if (this.mark('controls')) this.showHelp();
  }

  /** Once landed: a collection tip saved from the last match. */
  private showPending(): void {
    if (!this.pending || this.quietFor > 0) return;
    const { id, text } = this.pending;
    this.pending = null;
    this.seen.delete(id);
    this.tip(id, text);
  }

  /** Each frame of a match you play: shows the first tip whose moment has come. */
  update(dt: number, state: GameState, me: Player | undefined, world: World | undefined, events: readonly GameEvent[], touch: boolean): void {
    this.quietFor -= dt;
    if (!me || !me.alive || me.drop) return;
    this.showPending();
    const mine = (e: GameEvent) => 'playerId' in e && e.playerId === me.id;
    const interaction = world && !me.action ? findInteraction(state, me, world) : null;
    const press = (key: string) => (touch ? tr('Tap the hand') : tr('Press {key}').replace('{key}', key));
    // (In the order they'd come up; one at a time.)
    if (interaction?.kind === 'chest') this.tip('chest', `${press('E')}: ${tr('hold to open the chest')}`);
    else if (interaction?.kind === 'part') this.tip('part', `${press('E')}: ${tr('put the part on')}. ${touch ? tr('Tap the bag') : press('Q')}: ${tr('keep it for later')}`);
    if (events.some((e) => e.type === 'pickup' && mine(e) && e.what !== 'part' && !(e.what in WEAPONS_SKIP))) {
      this.tip('item', touch ? tr('Tap an item to use it; hold it to drop it') : tr('Keys 3, 4, 5 use your items; hold a slot to drop it'));
    }
    if (events.some((e) => e.type === 'wear' && mine(e) && e.stashed)) this.tip('stash', tr('Parts in your bag and the ones you wear come home with you'));
    if (events.some((e) => e.type === 'zone' && e.stage === 'shrinking')) this.tip('rinse', tr('The Rinse is rising: stay inside the circle, the water hurts'));
  }

  /** After a match, given your whole collection: a tip on what sets and holo parts are about, shown
   *  early in the next match. */
  collection(owned: readonly { slot: string; animal: string; holo?: boolean }[]): void {
    const sets = completeSets(owned as Parameters<typeof completeSets>[0]);
    const next = (id: TipId, text: string) => {
      if (this.seen.has(id) || this.pending) return false;
      this.pending = { id, text };
      this.mark(id);
      return true;
    };
    if (sets.length > 0 && next('holo', tr('Set complete! Its parts can now drop holographic for you'))) return;
    if (sets.length === 0 && Math.max(0, ...countByAnimal(owned)) >= 2 && next('set', tr('Collect all five parts of one animal for a set: it glows, and unlocks holo parts'))) return;
    if (owned.length >= 8) next('gallery', tr('See your whole collection in the Wardrobe gallery'));
  }

  /** Shows a tip not seen before (if none is up); true if it did. */
  private tip(id: TipId, text: string): boolean {
    if (this.seen.has(id) || this.quietFor > 0) return false;
    this.mark(id);
    this.announce(text, readTime(text));
    this.quietFor = GAP;
    return true;
  }

  private mark(id: TipId): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.seen]));
    } catch {
      // not remembered; fine
    }
    return true;
  }
}

/** (Weapons picked up aren't "items" for the tip.) */
const WEAPONS_SKIP: Record<string, true> = {
  cork_popper: true, foam_dart_smg: true, super_soaker: true, rubber_band_rifle: true, marble_launcher: true, pillow_hammer: true, glitter_bomb: true, bubble_wand: true,
};

function countByAnimal(owned: readonly { slot: string; animal: string; holo?: boolean }[]): number[] {
  const counts = new Map<string, Set<string>>();
  for (const p of owned) if (!p.holo) counts.set(p.animal, (counts.get(p.animal) ?? new Set()).add(p.slot));
  return [...counts.values()].map((s) => s.size).filter((n) => n <= PART_SLOTS.length);
}
