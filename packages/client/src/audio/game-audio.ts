// Decides which sounds a frame of the game makes: from sim events (shots, hits, chests, ...)
// and from changes between frames the sim has no event for (jumps, landings, reloads, swaps).
import type { EntityId, GameEvent, GameState, WeaponKind } from '@stuffed/sim';
import type { Sound, SoundName } from './sound.ts';

const SHOT: Record<WeaponKind, { name: SoundName; volume: number }> = {
  cork_popper: { name: 'cork_pop', volume: 0.7 },
  foam_dart_smg: { name: 'dart_shot', volume: 0.45 },
  super_soaker: { name: 'soaker_shot', volume: 0.75 },
};

interface Seen {
  vz: number;
  reloading: boolean;
  slot: 0 | 1;
  opening: boolean;
}

export class GameAudio {
  private readonly seen = new Map<EntityId, Seen>();

  constructor(private readonly sound: Sound) {}

  /** Forget per-player history (new match). */
  reset(): void {
    this.seen.clear();
  }

  update(events: GameEvent[], state: GameState, localId: EntityId): void {
    const byId = new Map(state.players.map((p) => [p.id, p]));
    const s = this.sound;

    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          const p = byId.get(e.playerId);
          const shot = SHOT[e.weapon];
          if (p) s.play(shot.name, { at: p.pos, volume: shot.volume * (p.id === localId ? 1 : 0.8) });
          break;
        }
        case 'hit': {
          const p = byId.get(e.targetId);
          if (!p) break;
          if (e.sourceId === null) s.play('soggy', { at: p.pos, volume: p.id === localId ? 0.6 : 0.3 });
          else if (e.armorDamage > 0) s.play('hit_armor', { at: p.pos, volume: 0.7 });
          else s.play('hit_stuffing', { at: p.pos, volume: 0.8 });
          break;
        }
        case 'impact':
          s.play(e.weapon === 'super_soaker' ? 'splash' : 'impact', { at: e.pos, volume: 0.45 });
          break;
        case 'eliminated': {
          const p = byId.get(e.playerId);
          if (p) s.play('knockout', { at: p.pos, volume: 1 });
          break;
        }
        case 'chestOpened': {
          const c = state.chests.find((ch) => ch.id === e.chestId);
          if (c) s.play('chest_open', { at: c.pos, volume: 0.8 });
          break;
        }
        case 'pickup': {
          const p = byId.get(e.playerId);
          const weapon = e.what === 'cork_popper' || e.what === 'foam_dart_smg' || e.what === 'super_soaker';
          // Parts make their sound on the 'wear' event (which also covers swapping from the stash).
          if (p && e.what !== 'part') s.play(weapon ? 'pickup_weapon' : 'pickup_item', { at: p.pos, volume: 0.7 });
          break;
        }
        case 'wear': {
          const p = byId.get(e.playerId);
          if (p) s.play('pickup_item', { at: p.pos, volume: e.stashed ? 0.5 : 0.8 });
          break;
        }
        case 'itemUsed': {
          const p = byId.get(e.playerId);
          if (p) s.play(e.item === 'button_pack' ? 'armor_up' : 'heal', { at: p.pos, volume: 0.8 });
          break;
        }
        case 'zone':
          if (e.stage === 'shrinking') s.play('rinse_rising', { volume: 0.8, pitchSpread: 0 });
          break;
        default:
          break;
      }
    }

    // Things the sim has no event for: compare with what each plush did last frame.
    for (const p of state.players) {
      const weapon = p.weapons[p.activeSlot];
      const now: Seen = {
        vz: p.vz,
        reloading: !!weapon && weapon.reloadEndTick !== null,
        slot: p.activeSlot,
        opening: p.action?.kind === 'openChest',
      };
      const before = this.seen.get(p.id);
      this.seen.set(p.id, now);
      if (!before || !p.alive) continue;
      const mine = p.id === localId;
      if (before.vz <= 0 && now.vz > 0) s.play('jump', { at: p.pos, volume: mine ? 0.6 : 0.4 });
      if (before.vz < 0 && now.vz === 0) s.play('land', { at: p.pos, volume: mine ? 0.6 : 0.35 });
      if (!before.reloading && now.reloading) s.play('reload', { at: p.pos, volume: mine ? 0.7 : 0.4 });
      if (before.slot !== now.slot && mine) s.play('swap', { at: p.pos, volume: 0.6 });
      if (!before.opening && now.opening) s.play('chest_rattle', { at: p.pos, volume: mine ? 0.7 : 0.4 });
    }
  }
}
