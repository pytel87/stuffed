// Decides which sounds a frame of the game makes: from sim events (shots, hits, chests, ...)
// and from changes between frames the sim has no event for (jumps, landings, reloads, swaps).
import { config, createWorld, currentAt, wading } from '@stuffed/sim';
import type { Animal, EntityId, GameEvent, GameState, ItemKind, LootLevel, MapData, Player, RideDef, StrikeKind, Vec2, WeaponKind, World } from '@stuffed/sim';
import type { Sound, SoundName, VoiceKind } from './sound.ts';
import { ANIMAL_KIND } from '../animal-kinds.ts';

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

/** Each chest opens its own way: the plain wooden one creaks, the red toy chest poofs and chimes,
 *  the royal one bursts open with a rising chime, the picnic basket crackles and pops. */
const CHEST_OPEN: Record<LootLevel, SoundName> = { low: 'chest_open_low', medium: 'chest_open', high: 'chest_open_high', food: 'chest_open_food' };

/** Using an item, while it lasts: cotton fluffed, stitching, buttons clicked on one by one, a straw
 *  slurped, stuffing stuffed in, cardboard unfolded. */
const USING: Record<ItemKind, SoundName> = {
  cotton_puff: 'use_puff', sewing_kit: 'use_sewing', big_stuffing_bag: 'use_bag',
  button_pack: 'use_buttons', button_pile: 'use_buttons', juice_box: 'use_juice', cardboard_wall: 'use_cardboard',
};
/** And when it's done: a small poof for a puff, stitches and a twinkle for the sewing kit, a big poof for the
 *  bag, buttons snapping into place, a happy gulp. (The cardboard wall thumps down on its own event.) */
const USED: Record<ItemKind, SoundName | null> = {
  cotton_puff: 'heal_small', sewing_kit: 'heal', big_stuffing_bag: 'heal_big',
  button_pack: 'armor_up', button_pile: 'armor_up', juice_box: 'juice_done', cardboard_wall: null,
};

/** Picking up an item: a rattle of buttons, a rustle of stuffing, a clink of the sewing tin, a slosh of juice, a flap of cardboard. */
const GRAB: Record<ItemKind, SoundName> = {
  button_pack: 'grab_buttons', button_pile: 'grab_buttons',
  cotton_puff: 'grab_stuffing', big_stuffing_bag: 'grab_stuffing',
  sewing_kit: 'grab_sewing', juice_box: 'grab_juice', cardboard_wall: 'grab_cardboard',
};

/** What a footstep lands on: wooden planks in the Bedroom and on the floors indoors elsewhere,
 *  snow on the Snowy Park, sand on Pirate Cove, grass on the Backyard. */
function surfaceAt(map: MapData, at: Vec2): 'grass' | 'wood' | 'snow' | 'sand' {
  if (map.theme === 'bedroom') return 'wood';
  if (map.theme === 'island') return 'sand';
  const indoors = map.grounds?.some((g) => g.kind === 'floor' && g.box && at.x >= g.box.x && at.x <= g.box.x + g.box.w && at.y >= g.box.y && at.y <= g.box.y + g.box.h);
  if (indoors) return 'wood';
  return map.theme === 'snow' ? 'snow' : 'grass';
}

interface Seen {
  vz: number;
  reloading: boolean;
  slot: 0 | 1;
  opening: boolean;
  digging: boolean;
  charging: boolean;
  bubbled: boolean;
  /** The item being used, if any. */
  using: ItemKind | null;
  drop: 'riding' | 'gliding' | null;
  umbrella: boolean;
}

/** How each kind of ride sounds setting off. */
const RIDE_SOUND: Record<RideDef['kind'], SoundName> = { zip: 'zip_line', tube: 'tube_pop', catapult: 'ball_boing', lookout: 'lighthouse_climb', slide: 'slide_whoosh', sled: 'slide_whoosh' };

/** How each kind of air strike drop sounds landing. */
const LAND_SOUND: Record<StrikeKind, SoundName> = { balloons: 'balloon_splash', blocks: 'block_clatter', snowballs: 'snow_thud', cannonballs: 'cannonball_land' };

export class GameAudio {
  private readonly seen = new Map<EntityId, Seen>();
  /** Chest rattles still playing, to cut short when the opening stops early. */
  private readonly rattles = new Map<EntityId, () => void>();
  /** Item-use sounds still playing, likewise; and zip line whirs (cut short on letting go). */
  private readonly uses = new Map<EntityId, () => void>();
  private readonly zips = new Map<EntityId, () => void>();
  /** When each plush last yelped (so a hail of darts is a yelp or two, not one per dart). */
  private readonly yelped = new Map<EntityId, number>();
  /** The winners have cheered (the victory lap is on). */
  private cheered = false;

  constructor(private readonly sound: Sound) {}

  /** Forget per-player history (new match). */
  reset(): void {
    this.inCurrent = false;
    this.seen.clear();
    this.yelped.clear();
    this.cheered = false;
    for (const stop of [...this.rattles.values(), ...this.uses.values(), ...this.zips.values()]) stop();
    this.rattles.clear();
    this.uses.clear();
    this.zips.clear();
  }

  private map: MapData | null = null;

  /** A new map: what footsteps land on, and the place's background sounds. */
  setMap(map: MapData): void {
    this.map = map;
    this.world = map.currents || map.wanderers?.some((w) => w.kind === 'shark') ? createWorld(map) : null;
    for (const l of this.ambience.values()) l.stop();
    this.ambience.clear();
    this.gullIn = 6;
  }

  /** The place's background sounds now playing (Pirate Cove: the sea, the waterfall). */
  private readonly ambience = new Map<SoundName, { set: (volume: number) => void; stop: () => void }>();
  private gullIn = 6;
  private lastFrame = 0;
  /** For telling where the sea's currents are (maps with any). */
  private world: World | null = null;
  /** A shark was hunting your plush (for its warning, once each time). */
  private hunted = false;
  /** Your plush was being carried along by a current. */
  private inCurrent = false;

  /** Pirate Cove's sounds: the sea lapping all round, the waterfall louder the nearer you are,
   *  a gull now and then far off. */
  private updateAmbience(): void {
    const map = this.map;
    const now = performance.now() / 1000;
    const dt = Math.min(0.5, this.lastFrame ? now - this.lastFrame : 0);
    this.lastFrame = now;
    if (map?.theme !== 'island') return;
    const at = this.sound.listener;
    const want = new Map<SoundName, number>([['sea_waves', 0.8]]);
    const fall = map.decor?.find((d) => d.kind === 'waterfall');
    if (fall) want.set('waterfall_rush', Math.max(0, 1 - Math.hypot(at.x - fall.x, at.y - fall.y) / 22) ** 1.5);
    for (const [name, volume] of want) {
      const playing = this.ambience.get(name);
      if (playing) playing.set(volume);
      else {
        const started = this.sound.loop(name, volume);
        if (started) this.ambience.set(name, started);
      }
    }
    this.gullIn -= dt;
    if (this.gullIn <= 0) {
      this.gullIn = 9 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2;
      this.sound.play('gull_cry', { at: { x: at.x + Math.cos(a) * 14, y: at.y + Math.sin(a) * 14 }, volume: 0.9, pitchSpread: 0.2 });
    }
  }

  /** A footstep on dry ground (grass, wooden planks or snow), the same for every plush: soft (yours a little louder), felt more than heard. */
  step(at: Vec2, mine: boolean): void {
    if (this.map) this.sound.play(`step_${surfaceAt(this.map, at)}`, { at, volume: mine ? 0.25 : 0.12, pitchSpread: 0.2 });
  }

  update(events: GameEvent[], state: GameState, localId: EntityId): void {
    const byId = new Map(state.players.map((p) => [p.id, p]));
    const s = this.sound;
    this.updateAmbience();
    // Caught by a current: a whoosh of water as it takes you.
    const me = byId.get(localId);
    const carried = !!me?.alive && !!this.world?.map.currents && wading(this.world, me) && currentAt(this.world.map.currents, me.pos) !== null;
    if (carried && !this.inCurrent && me) s.play('current_whoosh', { at: me.pos, volume: 0.9 });
    this.inCurrent = carried;
    // A shark coming for you in the water: dun-dun (once each time one closes in).
    const sharks = this.map?.wanderers ?? [];
    // (Not in the shallows by a beach: sharks leave you alone there.)
    const shallows = !!me && (this.map?.islands ?? []).some((c) => Math.hypot(me.pos.x - c.center.x, me.pos.y - c.center.y) < c.radius + config.wanderers.shark.shallows);
    if (me?.alive && this.world && sharks.some((d) => d.kind === 'shark') && wading(this.world, me) && !shallows) {
      const hunted = state.wanderers.some((w, i) => sharks[i]?.kind === 'shark' && state.tick >= w.readyTick && Math.hypot(w.pos.x - me.pos.x, w.pos.y - me.pos.y) < config.wanderers.shark.sight);
      if (hunted && !this.hunted) s.play('shark_warning', { volume: 0.9, pitchSpread: 0 });
      this.hunted = hunted;
    } else this.hunted = false;
    // Each plush speaks with its head's animal.
    for (const p of state.players) s.needVoice(p.parts.head.animal);
    const voice = (p: Player, kind: VoiceKind, volume: number) =>
      s.play(`voice_${p.parts.head.animal}_${kind}`, { at: p.pos, volume: volume * (p.id === localId ? 1 : 0.75), pitchSpread: 0.14 });
    const land = (p: Player, volume: number) => s.play(`land_${ANIMAL_KIND[p.parts.head.animal]}`, { at: p.pos, volume, pitchSpread: 0.16 });

    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          const p = byId.get(e.playerId);
          const shot = SHOT[e.weapon];
          // One sound per weapon; each shot a touch different in pitch and loudness.
          if (p) s.play(shot.name, { at: p.pos, volume: shot.volume * (p.id === localId ? 1 : 0.8) * (0.9 + Math.random() * 0.2) });
          break;
        }
        case 'hit': {
          const p = byId.get(e.targetId);
          if (!p) break;
          // Your shot landed: a small tick (not for the hit that knocks it out: that one chimes).
          if (e.sourceId === localId && e.targetId !== localId && p.alive) s.play('hit_confirm', { volume: 0.5, pitchSpread: 0.08 });
          // The Rinse only makes the plush yelp (below); a hit thumps (or clacks off its buttons) too.
          if (e.sourceId !== null) s.play(e.armorDamage > 0 ? 'hit_armor' : 'hit_stuffing', { at: p.pos, volume: e.armorDamage > 0 ? 0.7 : 0.8 });
          // A yelp, the Rinse's too (not on the hit that knocks it out: that one wails).
          if (p.alive && state.tick - (this.yelped.get(p.id) ?? -Infinity) >= config.tickRate) {
            this.yelped.set(p.id, state.tick);
            voice(p, 'hurt', 0.7);
          }
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
        case 'burn':
          s.play('lava_sizzle', { at: e.pos, volume: 0.9 });
          break;
        case 'trainBump':
          // The toy train toots; the pirate ship's bow wave splashes over you.
          if (this.map?.track?.style === 'ship') s.play('splash', { at: e.pos, volume: 0.9 });
          else s.play('train_toot', { at: e.pos, volume: 0.8 });
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
          if (p) {
            s.play('knockout', { at: p.pos, volume: 1 });
            voice(p, 'ko', 0.9);
          }
          if (e.byId === localId && e.playerId !== localId) s.play('ko_confirm', { volume: 0.7, pitchSpread: 0 });
          break;
        }
        case 'revived': {
          const p = byId.get(e.playerId);
          if (p) {
            s.play('heal', { at: p.pos, volume: 1, pitchSpread: 0 });
            voice(p, 'cheer', 0.8);
          }
          break;
        }
        case 'chestOpened': {
          const c = state.chests.find((ch) => ch.id === e.chestId);
          if (c) s.play(CHEST_OPEN[c.loot], { at: c.pos, volume: 0.8 });
          break;
        }
        case 'pickup': {
          const p = byId.get(e.playerId);
          // Parts make their sound on the 'wear' event (which also covers swapping from the stash).
          if (p && e.what !== 'part') s.play(e.what in config.weapons ? 'pickup_weapon' : GRAB[e.what as ItemKind], { at: p.pos, volume: 0.7 });
          break;
        }
        case 'wear': {
          const p = byId.get(e.playerId);
          // Each slot its own: a head snaps on, a body zips up, feet pat, a tail sticks, an accessory chimes.
          if (p) s.play(`part_${e.part.slot}`, { at: p.pos, volume: e.stashed ? 0.5 : 0.8 });
          break;
        }
        case 'itemUsed': {
          const p = byId.get(e.playerId);
          const sound = USED[e.item];
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
          // Heard all over the map: an alarm, so everyone knows something's coming down (the pirate
          // ship's cannons firing, on Pirate Cove).
          s.play(e.kind === 'cannonballs' ? 'cannon_fire' : 'strike_whistle', { volume: 0.8, pitchSpread: 0 });
          break;
        }
        case 'pinataHit':
          s.play('pinata_hit', { at: e.pos, volume: 0.7 });
          // The paper parrot squawks.
          if (this.map?.pinata?.kind === 'parrot') s.play('parrot_squawk', { at: e.pos, volume: 0.8, pitchSpread: 0.25 });
          break;
        case 'pinataBurst':
          s.play('pinata_burst', { at: e.pos, volume: 1, pitchSpread: 0 });
          if (this.map?.pinata?.kind === 'parrot') s.play('parrot_squawk', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        case 'sucked':
          s.play('vacuum_slurp', { at: e.pos, volume: 0.8 });
          break;
        case 'wandererBump':
          if (this.map?.wanderers?.[e.index]?.kind === 'shark') {
            s.play('shark_chomp', { at: e.pos, volume: 1 });
            break;
          }
          s.play(e.index >= 0 && state.wanderers[e.index] && state.wanderers[e.index]!.mode === 'moving' ? 'pillow_bonk' : 'vacuum_bump', { at: e.pos, volume: 0.8 });
          break;
        case 'wandererStarted':
          s.play(e.kind === 'plow' ? 'plow_horn' : 'mower_engine', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        case 'prize':
          s.play('prize_fanfare', { at: e.pos, volume: 1, pitchSpread: 0 });
          s.play('pinata_burst', { at: e.pos, volume: 0.7, pitchSpread: 0 });
          break;
        case 'duckHit':
          s.play('duck_ding', { at: e.pos, volume: 0.9, pitchSpread: 0 });
          break;
        case 'pinDown':
          s.play('pin_knock', { at: e.pos, volume: 0.8 });
          break;
        case 'rideStarted': {
          const stop = s.play(RIDE_SOUND[e.kind], { at: e.pos, volume: 0.9 });
          if (e.kind === 'zip') this.zips.set(e.playerId, stop);
          break;
        }
        case 'rideEnded':
          if (e.kind === 'tube') s.play('tube_pop', { at: e.pos, volume: 0.9 });
          // Down the lighthouse's stairs and out of its door.
          if (e.kind === 'lookout') s.play('lighthouse_climb', { at: e.pos, volume: 0.7, pitchSpread: 0.15 });
          // Off the zip line (at its end, or let go early with Jump): its whir stops.
          if (e.kind === 'zip') {
            this.zips.get(e.playerId)?.();
            this.zips.delete(e.playerId);
          }
          break;
        case 'bounced':
          s.play('ball_boing', { at: e.pos, volume: 0.8 });
          break;
        case 'toyStarted':
          s.play(e.kind === 'jack' ? 'jack_tune' : e.kind === 'sprinkler' ? 'sprinkler_spray' : 'ice_crack', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        case 'toyPop':
          s.play(e.kind === 'jack' ? 'jack_pop' : 'ice_break', { at: e.pos, volume: 1, pitchSpread: 0 });
          break;
        case 'strikeLand':
          s.play(LAND_SOUND[e.kind], { at: e.pos, volume: 0.9 });
          break;
        default:
          break;
      }
    }

    // The winner is decided: the plushies left standing cheer as their victory lap starts.
    if (!this.cheered && state.victoryUntil !== null) {
      this.cheered = true;
      for (const p of state.players) {
        if (p.alive && (p.id === state.winnerId || (state.winnerTeam !== null && p.team === state.winnerTeam))) voice(p, 'cheer', 1);
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
        digging: p.action?.kind === 'dig',
        charging: p.chargeStartTick !== null,
        bubbled: state.tick < p.bubbledUntil,
        using: p.action?.kind === 'useItem' ? p.action.item : null,
        drop: p.drop,
        umbrella: p.umbrella,
      };
      const before = this.seen.get(p.id);
      this.seen.set(p.id, now);
      // Using an item: its sound lasts while the use does (cut short if it's interrupted).
      if (before?.using !== now.using || !p.alive) {
        this.uses.get(p.id)?.();
        this.uses.delete(p.id);
        if (now.using && p.alive) this.uses.set(p.id, s.play(USING[now.using], { at: p.pos, volume: p.id === localId ? 0.7 : 0.4 }));
      }
      if (!before || !p.alive) continue;
      const mine = p.id === localId;
      if (before.vz <= 0 && now.vz > 0) s.play(`jump_${ANIMAL_KIND[p.parts.head.animal]}`, { at: p.pos, volume: mine ? 0.6 : 0.4, pitchSpread: 0.16 });
      if (before.vz < 0 && now.vz === 0) land(p, mine ? 0.6 : 0.35);
      if (!before.reloading && now.reloading) s.play('reload', { at: p.pos, volume: mine ? 0.7 : 0.4 });
      if (before.slot !== now.slot && mine) s.play('swap', { at: p.pos, volume: 0.6 });
      if (!before.opening && now.opening) this.rattles.set(p.id, s.play('chest_rattle', { at: p.pos, volume: mine ? 0.7 : 0.4 }));
      if (before.opening && !now.opening) {
        this.rattles.get(p.id)?.();
        this.rattles.delete(p.id);
      }
      if (!before.digging && now.digging) s.play('dig_scrape', { at: p.pos, volume: mine ? 0.8 : 0.45 });
      if (!before.charging && now.charging) s.play('band_stretch', { at: p.pos, volume: mine ? 0.6 : 0.35, pitchSpread: 0 });
      if (before.bubbled && !now.bubbled) s.play('bubble_pop', { at: p.pos, volume: 0.7 });
      // The Toss: a whoosh when you drop off the blimp, a thump when you land.
      if (mine && before.drop === 'riding' && now.drop === 'gliding') s.play('pillow_swing', { at: p.pos, volume: 0.8, pitchSpread: 0 });
      if (before.drop === 'gliding' && now.drop === null) land(p, mine ? 0.8 : 0.4);
      // A catapult: the umbrella opening at the top of the throw, a thump when you land.
      if (!before.umbrella && now.umbrella) s.play('pillow_swing', { at: p.pos, volume: mine ? 0.8 : 0.4, pitchSpread: 0 });
      if (before.umbrella && !now.umbrella && p.z < 0.05) land(p, mine ? 0.8 : 0.4);
    }
  }
}
