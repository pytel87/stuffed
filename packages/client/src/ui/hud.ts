import { ANIMAL_RARITY, canUseItem, config, findInteraction, reloadTicks } from '@stuffed/sim';
import type { Animal, GameState, PartSlot, Player, Vec2, World } from '@stuffed/sim';
import * as THREE from 'three';
import type { KeyboardMouseInput } from '../input/keyboard-mouse.ts';
import { icon, partIcon } from './icons.ts';
import { tr } from '../i18n.ts';

/** Heights above the ground for things floating in the scene. */
const PROMPT_HEIGHT = 1.5;
const OVERHEAD_HEIGHT = 2.4;

/**
 * In-match HUD, mostly icons: one toughness bar (stuffing, with patches as a yellow coat over it),
 * the two weapon cards (ammo as a draining bar that refills while reloading; tap to switch, tap
 * the active one to reload), three item slots (tap to use), and in the scene: what E/Grab would
 * do, floating over the chest or item, and a progress bar over what's being opened or used.
 * Writes to the DOM only on change.
 */
export class Hud {
  private readonly vitals: HTMLElement;
  private readonly stuffingNum: HTMLElement;
  private readonly patchesNum: HTMLElement;
  private readonly weapons: { root: HTMLElement; art: HTMLElement; ammo: HTMLElement }[];
  private readonly items: { root: HTMLElement; art: HTMLElement; count: HTMLElement }[];
  private readonly prompt: HTMLElement;
  private readonly promptArt: HTMLElement;
  private readonly promptStash: HTMLElement;
  /** The bag's three slots. */
  private readonly bag: { root: HTMLElement; art: HTMLElement }[];
  private readonly progress: HTMLElement;
  private readonly progressArt: HTMLElement;
  private readonly progressFill: HTMLElement;
  private readonly cache = new Map<string, string>();
  /** Where the prompt and progress float, in world space (null: not shown). */
  /** Where the prompt floats: a spot and the height of what's there (a roof's, say). */
  private promptAnchor: (Vec2 & { z: number }) | null = null;
  /** The chest being opened; null while using an item (the bar floats over the plush then). */
  private progressChest: (Vec2 & { z: number }) | null = null;
  private readonly v = new THREE.Vector3();
  /** True when E/Grab would do something right now (lights the touch Grab button). */
  grabReady = false;
  /** True when a part is in reach (shows the touch Stash button). */
  stashReady = false;

  constructor(root: HTMLElement, input: KeyboardMouseInput) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="vitals">
         <span class="health">${icon('stuffing')}<b class="num"></b></span>
         <div class="track"><div class="fill stuffing"></div><div class="fill patches"></div></div>
         <b class="coat">${icon('patches')}<span></span></b>
       </div>
       <div class="bag">${[0, 1, 2].map((i) => `<button type="button" class="stash-slot" data-bag="${i}" hidden aria-label="${tr('Bag')} ${i + 1}"><span class="art"></span>${i === 0 ? '<kbd>Q</kbd>' : ''}</button>`).join('')}</div>
       <div class="loadout">
         <div class="items">
           ${[0, 1, 2].map((i) => `<button type="button" class="item" data-item="${i}"><span class="art"></span><b class="count"></b><kbd>${i + 3}</kbd></button>`).join('')}
         </div>
         <div class="weapons">
           ${[0, 1].map((i) => `<button type="button" class="weapon" data-slot="${i}"><span class="art"></span><kbd>${i + 1}</kbd><i class="ammo"><i></i></i></button>`).join('')}
         </div>
       </div>
       <div class="progress in-world" hidden><span class="art"></span><div class="track"><div class="fill"></div></div></div>
       <div class="prompt in-world" hidden>
         <span class="opt use"><kbd>E</kbd>${icon('hand', 'icon tap')}</span>
         <span class="art"></span>
         <button type="button" class="opt stash-opt" hidden aria-label="${tr('Stash')}"><kbd>Q</kbd>${icon('stash')}</button>
       </div>`,
    );
    const q = <T extends HTMLElement = HTMLElement>(sel: string, from: ParentNode = root) => from.querySelector<T>(sel)!;
    this.vitals = q('.vitals');
    this.stuffingNum = q('.vitals .num');
    this.patchesNum = q('.vitals .coat span');
    this.prompt = q('.prompt');
    this.promptArt = q('.prompt .art');
    this.promptStash = q('.prompt .stash-opt');
    this.bag = [0, 1, 2].map((i) => {
      const root = q(`.stash-slot[data-bag="${i}"]`);
      // Tap to wear that part; long press (or right-click) drops it.
      pressable(root, () => input.wearBag(i), () => input.drop(5 + i));
      return { root, art: q('.art', root) };
    });
    // Tapping the bag option on the prompt is the same as pressing Q.
    this.promptStash.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      input.stash();
    });
    this.progress = q('.progress');
    this.progressArt = q('.progress .art');
    this.progressFill = q('.progress .fill');

    this.weapons = [0, 1].map((i) => {
      const el = q(`.weapon[data-slot="${i}"]`);
      pressable(
        el,
        () => (el.classList.contains('active') ? input.reload() : input.selectWeapon(i as 0 | 1)),
        () => input.drop(i),
      );
      return { root: el, art: q('.art', el), ammo: q('.ammo > i', el) };
    });
    this.items = [0, 1, 2].map((i) => {
      const el = q(`.item[data-item="${i}"]`);
      pressable(el, () => input.useItem(i as 0 | 1 | 2), () => input.drop(2 + i));
      return { root: el, art: q('.art', el), count: q('.count', el) };
    });
    // Keys 1-5 (and the wheel) press their slot on screen too, so you see which one you used.
    window.addEventListener('keydown', (e) => {
      if (e.repeat || (e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (n >= 0) tapped(n < 2 ? this.weapons[n]!.root : this.items[n - 2]!.root);
    });
    window.addEventListener('wheel', (e) => {
      if (e.deltaY === 0 || (e.target as HTMLElement | null)?.closest?.('.overlay')) return;
      const other = this.weapons.find((w) => !w.root.classList.contains('active'));
      if (other) tapped(other.root);
    }, { passive: true });
  }

  /** `alpha` is how far render time is past `state.tick` (0..1), for smooth progress. */
  /** `world`: the map (its zip lines and tubes are offered too). */
  update(state: GameState, me: Player | undefined, alpha: number, world?: World): void {
    if (!me) return;
    const stuffing = Math.ceil(me.stuffing);
    const patches = Math.ceil(me.patches);
    // (How full each is, for the style sheet: the bar's two halves, and the phones' pill.)
    this.set('sW', `${(stuffing / config.player.maxStuffing) * 100}%`, (v) => this.vitals.style.setProperty('--hp', v));
    this.set('sN', String(stuffing), (v) => (this.stuffingNum.textContent = v));
    this.set('sLow', String(stuffing <= 30), (v) => this.vitals.classList.toggle('low', v === 'true'));
    this.set('bW', `${(patches / config.player.maxPatches) * 100}%`, (v) => this.vitals.style.setProperty('--coat', v));
    this.set('bN', String(patches), (v) => {
      this.patchesNum.textContent = v;
      // (Always there, so you know where they'd show; dimmed with none.)
      this.patchesNum.parentElement!.classList.toggle('none', v === '0');
    });

    me.weapons.forEach((w, i) => {
      const s = this.weapons[i]!;
      this.set(`wa${i}`, String(i === me.activeSlot), (v) => s.root.classList.toggle('active', v === 'true'));
      this.set(`wk${i}`, w?.kind ?? '', (v) => {
        s.art.innerHTML = v ? icon(v) : '';
        s.root.classList.toggle('empty', !v);
      });
      this.set(`wc${i}`, w ? config.rarity[w.rarity].color : 'transparent', (v) => s.root.style.setProperty('--rarity', v));
      // The ammo bar drains as you fire and fills back up while reloading.
      const reloading = !!w && w.reloadEndTick !== null;
      const fill = !w ? 0 : reloading
        ? Math.min(1, 1 - (w.reloadEndTick! - state.tick - alpha) / reloadTicks(w))
        : w.ammo / config.weapons[w.kind].magazine;
      this.set(`wf${i}`, fill.toFixed(3), (v) => (s.ammo.style.transform = `scaleX(${v})`));
      this.set(`wl${i}`, String(reloading), (v) => s.root.classList.toggle('reloading', v === 'true'));
      this.set(`wo${i}`, String(!!w && !reloading && w.ammo === 0), (v) => s.root.classList.toggle('dry', v === 'true'));
    });

    me.items.forEach((stack, i) => {
      const s = this.items[i]!;
      this.set(`ik${i}`, stack?.kind ?? '', (v) => {
        s.art.innerHTML = v ? icon(v) : '';
        s.root.classList.toggle('empty', !v);
      });
      this.set(`in${i}`, stack && stack.count > 1 ? String(stack.count) : '', (v) => (s.count.textContent = v));
      this.set(`iu${i}`, String(!!stack && canUseItem(me, stack.kind)), (v) => s.root.classList.toggle('unusable', v !== 'true'));
      this.set(`ic${i}`, stack ? config.rarity[config.items[stack.kind].rarity].color : 'transparent', (v) => s.root.style.setProperty('--rarity', v));
    });

    // The bag: each slot shows its part, ringed in the animal's rarity color.
    this.bag.forEach((b, i) => {
      const part = me.stash[i];
      this.set(`st${i}`, part ? `${part.slot}:${part.animal}:${part.holo ? 1 : 0}` : '', (v) => {
        b.root.hidden = v === '';
        if (part) b.art.innerHTML = partIcon(part.slot, part.animal, 'icon', !!part.holo);
        b.root.classList.toggle('holo', !!part?.holo);
        b.root.style.setProperty('--rarity', part ? config.rarity[ANIMAL_RARITY[part.animal]].color : 'transparent');
      });
    });

    const action = me.alive ? me.action : null;
    const chest = action?.kind === 'openChest' ? state.chests.find((c) => c.id === action.chestId) : undefined;
    const mate = action?.kind === 'revive' ? state.players.find((p) => p.id === action.targetId) : undefined;
    const dug = action?.kind === 'dig' ? digAnchor(world, action.index) : null;
    this.progressChest = chest ? { ...chest.pos, z: chest.z } : mate ? { ...mate.pos, z: mate.z } : dug ? { ...dug, z: 0 } : null;
    if (action) {
      const t = Math.min(1, (state.tick + alpha - action.startTick) / Math.max(1, action.endTick - action.startTick));
      // Opening a chest or re-stitching a teammate: just the bar over them. Using an item: its picture too.
      this.set('pa', action.kind === 'useItem' ? action.item : '', (v) => {
        this.progressArt.innerHTML = v ? icon(v) : '';
        this.progressArt.hidden = !v;
      });
      this.progressFill.style.transform = `scaleX(${t.toFixed(3)})`;
    }
    this.set('ps', String(!!action), (v) => (this.progress.hidden = v !== 'true'));

    const interaction = action || !me.alive ? null : findInteraction(state, me, world);
    // Up in a lookout: E (the hand) brings you down, so the prompt says so, over its door.
    const lookout = me.alive && me.ride ? world?.map.rides?.[me.ride.index] : undefined;
    const lookingOut = lookout?.kind === 'lookout' ? lookout : null;
    this.grabReady = !!interaction || !!lookingOut;
    this.stashReady = interaction?.kind === 'part';
    this.promptAnchor =
      interaction?.kind === 'chest'
        ? { ...interaction.chest.pos, z: interaction.chest.z }
        : interaction?.kind === 'revive'
          ? { ...interaction.target.pos, z: interaction.target.z }
          : interaction?.kind === 'strike'
            ? state.strikeButton && { ...state.strikeButton.pos, z: state.strikeButton.z + 0.6 }
            : interaction?.kind === 'toy'
              ? state.toy && { ...state.toy.pos, z: state.toy.z + 0.8 }
              : interaction?.kind === 'ride'
                ? rideAnchor(world, interaction.index)
                : lookingOut
                  ? { x: lookingOut.from.x, y: lookingOut.from.y, z: lookingOut.from.z + 0.8 }
                : interaction?.kind === 'dig'
                  ? digAnchor(world, interaction.index)
                  : interaction?.kind === 'switch'
                    ? switchAnchor(world, interaction.index)
                    : interaction
              ? { ...interaction.loot.pos, z: interaction.loot.z }
              : null;
    let art = '';
    let color = '#ffffff';
    if (interaction?.kind === 'weapon' && interaction.loot.content.type === 'weapon') {
      const w = interaction.loot.content.weapon;
      art = w.kind;
      color = config.rarity[w.rarity].color;
    } else if (interaction?.kind === 'part') {
      const p = interaction.part;
      art = `part:${p.slot}:${p.animal}:${p.holo ? 1 : 0}`;
      // The animal's rarity, like a weapon's.
      color = config.rarity[ANIMAL_RARITY[p.animal]].color;
    } else if (interaction?.kind === 'chest') {
      // The exact chest you're about to open.
      art = `chest:${interaction.chest.loot}`;
    } else if (interaction?.kind === 'switch') {
      art = 'switch';
    } else if (interaction?.kind === 'dig') {
      // Hold to dig up the treasure: a little spade.
      art = 'dig';
    } else if (interaction?.kind === 'ride') {
      // Off you go: along the zip line, or into the tube; up a lookout.
      art = world?.map.rides?.[interaction.index]?.kind === 'lookout' ? 'arrow-up' : 'arrow';
    } else if (lookingOut) {
      art = 'arrow-down';
    } else if (interaction?.kind === 'toy' && state.toy) {
      // The toy's crank, tap or drill.
      art = `toy:${state.toy.kind}`;
    } else if (interaction?.kind === 'strike' && state.strikeButton) {
      // The air strike button (with what it calls floating over it).
      art = `strike:${state.strikeButton.kind}`;
    } else if (interaction?.kind === 'revive') {
      // Hold to re-stitch a teammate: the stuffing heart.
      art = 'revive';
    }
    this.set('pr', art, (v) => {
      const [kind, slot, animal, holo] = v.split(':');
      this.promptArt.innerHTML = !v ? '' : kind === 'part' ? partIcon(slot as PartSlot, animal as Animal, 'icon', holo === '1') : icon(v);
      this.prompt.hidden = v === '';
      this.prompt.classList.toggle('hold', kind === 'chest' || kind === 'revive');
      // Parts: wear it (E, the hand) or stash it (Q, the bag), either side of the part.
      this.prompt.classList.toggle('part', kind === 'part');
      this.promptStash.hidden = kind !== 'part';
    });
    this.set('prc', color, (v) => this.prompt.style.setProperty('--rarity', v));
  }

  /**
   * Floats the prompt over the chest or weapon it's about, and the progress bar over what's
   * being opened (or the plush using an item). Call after the camera has moved this frame.
   */
  place(camera: THREE.Camera, width: number, height: number, me: Vec2): void {
    this.float(this.prompt, this.promptAnchor, PROMPT_HEIGHT, camera, width, height);
    if (this.progressChest) this.float(this.progress, this.progressChest, PROMPT_HEIGHT, camera, width, height);
    else this.float(this.progress, me, OVERHEAD_HEIGHT, camera, width, height);
  }

  private float(el: HTMLElement, at: (Vec2 & { z?: number }) | null, y: number, camera: THREE.Camera, width: number, height: number): void {
    if (!at || el.hidden) return;
    this.v.set(at.x, (at.z ?? 0) + y, at.y).project(camera);
    const sx = (this.v.x * 0.5 + 0.5) * width;
    const sy = (-this.v.y * 0.5 + 0.5) * height;
    el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
  }

  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }
}

/** A slot used by key: it sinks for a moment, like a tap. */
function tapped(el: HTMLElement): void {
  if (el.classList.contains('empty')) return;
  el.classList.add('tapped');
  setTimeout(() => el.classList.remove('tapped'), 120);
}

/** Holding a slot this long drops what's in it. */
const LONG_PRESS_MS = 450;

/**
 * A HUD slot: a tap does `tap`; a long press (or right-click) does `long` (drop it). The slot
 * shrinks while held so you can feel the long press coming.
 */
function pressable(el: HTMLElement, tap: () => void, long: () => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    el.classList.remove('pressing');
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.button === 2) return; // right-click: handled by contextmenu
    fired = false;
    el.classList.add('pressing');
    timer = setTimeout(() => {
      fired = true;
      cancel();
      if (!el.classList.contains('empty')) long();
    }, LONG_PRESS_MS);
  });
  el.addEventListener('pointerup', () => {
    const wasPressing = timer !== null;
    cancel();
    if (wasPressing && !fired) tap();
  });
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!el.classList.contains('empty')) long();
  });
}

/** Over the start of a zip line or a tube, for the prompt. */
function rideAnchor(world: World | undefined, index: number): (Vec2 & { z: number }) | null {
  const r = world?.map.rides?.[index];
  return r ? { x: r.from.x, y: r.from.y, z: r.from.z + 0.8 } : null;
}

/** Over a buried treasure spot, for the prompt and the dig bar. */
function digAnchor(world: World | undefined, index: number): (Vec2 & { z: number }) | null {
  const d = world?.map.digs?.[index];
  return d ? { x: d.x, y: d.y, z: 0.2 } : null;
}

/** Over the mower's or plow's switch, for the prompt. */
function switchAnchor(world: World | undefined, index: number): (Vec2 & { z: number }) | null {
  const s = world?.map.wanderers?.[index]?.switch;
  return s ? { x: s.x, y: s.y, z: 1 } : null;
}
