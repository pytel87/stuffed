// Decides which sounds a frame of the game makes: from sim events (shots, hits, chests, ...)
// and from changes between frames the sim has no event for (jumps, landings, reloads, swaps).
import { config } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, WeaponKind } from '@stuffed/sim';
import type { Sound, SoundName } from './sound.ts';

const SHOT: Record<WeaponKind, { name: SoundName; volume: number }> = {
  cork_popper: { name: 'cork_pop', volume: 0.7 },
  foam_dart_smg: { name: 'dart_shot', volume: 0.45 },
  super_soaker: { name: 'soaker_shot', volume: 0.75 },
  rubber_band_rifle: { name: 'band_twang', volume: 0.8 },
  marble_launcher: { name: 'marble_shot', volume: 0.7 },
  pillow_hammer: { name: 'pillow_swing', volume: 0.7 },
  glitter_bomb: { name: 'glitter_throw', volume: 0.6 },
  bubble_wand: { name: 'bubble_blow', volume: 0.6 },
};

interface Seen {
  vz: number;
  reloading: boolean;
  slot: 0 | 1;
  opening: boolean;
  charging: boolean;
  bubbled: boolean;
  bagging: boolean;
  drop: 'riding' | 'gliding' | null;
}

export class GameAudio {
  private readonly seen = new Map<EntityId, Seen>();
  /** Chest rattles still playing, to cut short when the opening stops early. */
  private readonly rattles = new Map<EntityId, () => void>();

  constructor(private readonly sound: Sound) {}

  /** Forget per-player history (new match). */
  reset(): void {
    this.seen.clear();
    for (const stop of this.rattles.values()) stop();
    this.rattles.clear();
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
          s.play(e.weapon === 'super_soaker' ? 'splash' : e.weapon === 'bubble_wand' ? 'bubble_pop' : 'impact', { at: e.pos, volume: 0.45 });
          break;
        case 'burst':
          s.play(e.weapon === 'glitter_bomb' ? 'glitter_burst' : 'marble_burst', { at: e.pos, volume: 0.9 });
          break;
        case 'bounce':
          s.play('marble_bounce', { at: e.pos, volume: 0.6 });
          break;
        case 'ballBounce':
          s.play('ball_boing', { at: e.pos, volume: 0.7 });
          break;
        case 'trainBump':
          s.play('train_toot', { at: e.pos, volume: 0.8 });
          s.play('pillow_bonk', { at: e.pos, volume: 0.6 });
          break;
        case 'goal':
          s.play('chest_open', { at: e.pos, volume: 1, pitchSpread: 0 });
          s.play('glitter_burst', { at: e.pos, volume: 0.7 });
          break;
        case 'bonk': {
          const p = byId.get(e.targetId);
          if (p) s.play('pillow_bonk', { at: p.pos, volume: 0.9 });
          break;
        }
        case 'eliminated': {
          const p = byId.get(e.playerId);
          if (p) s.play('knockout', { at: p.pos, volume: 1 });
          break;
        }
        case 'revived': {
          const p = byId.get(e.playerId);
          if (p) s.play('heal', { at: p.pos, volume: 1, pitchSpread: 0 });
          break;
        }
        case 'chestOpened': {
          const c = state.chests.find((ch) => ch.id === e.chestId);
          if (c) s.play('chest_open', { at: c.pos, volume: 0.8 });
          break;
        }
        case 'pickup': {
          const p = byId.get(e.playerId);
          const weapon = e.what in config.weapons;
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
          const sound: SoundName | null =
            e.item === 'button_pack' || e.item === 'button_pile' ? 'armor_up' : e.item === 'juice_box' ? 'juice_slurp' : e.item === 'cardboard_wall' ? null : 'heal';
          if (p && sound) s.play(sound, { at: p.pos, volume: 0.8 });
          break;
        }
        case 'wallPlaced': {
          const p = byId.get(e.playerId);
          if (p) s.play('cardboard_place', { at: p.pos, volume: 0.8 });
          break;
        }
        case 'wallBroken':
          s.play('impact', { at: e.pos, volume: 0.9 });
          break;
        case 'zone':
          if (e.stage === 'shrinking') s.play('rinse_rising', { volume: 0.8, pitchSpread: 0 });
          break;
        case 'strikeCalled': {
          // The button's click where it was pressed; the falling whistle over where it's coming down.
          const by = state.players.find((p) => p.id === e.playerId);
          if (by) s.play('click', { at: by.pos, volume: 1, pitchSpread: 0 });
          s.play('strike_whistle', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        }
        case 'pinataHit':
          s.play('pinata_hit', { at: e.pos, volume: 0.7 });
          break;
        case 'pinataBurst':
          s.play('pinata_burst', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        case 'toyStarted':
          s.play(e.kind === 'jack' ? 'jack_tune' : e.kind === 'sprinkler' ? 'sprinkler_spray' : 'ice_crack', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        case 'toyPop':
          s.play(e.kind === 'jack' ? 'jack_pop' : 'ice_break', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        case 'strikeLand':
          s.play(e.kind === 'balloons' ? 'balloon_splash' : e.kind === 'blocks' ? 'block_clatter' : 'snow_thud', { at: e.pos, volume: 0.9 });
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
        charging: p.chargeStartTick !== null,
        bubbled: state.tick < p.bubbledUntil,
        bagging: p.action?.kind === 'useItem' && p.action.item === 'big_stuffing_bag',
        drop: p.drop,
      };
      const before = this.seen.get(p.id);
      this.seen.set(p.id, now);
      if (!before || !p.alive) continue;
      const mine = p.id === localId;
      if (before.vz <= 0 && now.vz > 0) s.play('jump', { at: p.pos, volume: mine ? 0.6 : 0.4 });
      if (before.vz < 0 && now.vz === 0) s.play('land', { at: p.pos, volume: mine ? 0.6 : 0.35 });
      if (!before.reloading && now.reloading) s.play('reload', { at: p.pos, volume: mine ? 0.7 : 0.4 });
      if (before.slot !== now.slot && mine) s.play('swap', { at: p.pos, volume: 0.6 });
      if (!before.opening && now.opening) this.rattles.set(p.id, s.play('chest_rattle', { at: p.pos, volume: mine ? 0.7 : 0.4 }));
      if (before.opening && !now.opening) {
        this.rattles.get(p.id)?.();
        this.rattles.delete(p.id);
      }
      if (!before.charging && now.charging) s.play('band_stretch', { at: p.pos, volume: mine ? 0.6 : 0.35, pitchSpread: 0 });
      if (before.bubbled && !now.bubbled) s.play('bubble_pop', { at: p.pos, volume: 0.7 });
      if (!before.bagging && now.bagging) s.play('bag_rustle', { at: p.pos, volume: mine ? 0.7 : 0.4 });
      // The Toss: a whoosh when you drop off the blimp, a thump when you land.
      if (mine && before.drop === 'riding' && now.drop === 'gliding') s.play('pillow_swing', { at: p.pos, volume: 0.8, pitchSpread: 0 });
      if (before.drop === 'gliding' && now.drop === null) s.play('land', { at: p.pos, volume: mine ? 0.8 : 0.4 });
    }
  }
}
