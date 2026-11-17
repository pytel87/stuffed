import { canUseItem, config, findInteraction, reloadTicks } from '@stuffed/sim';
import type { Animal, GameState, PartSlot, Player, Vec2 } from '@stuffed/sim';
import * as THREE from 'three';
import type { KeyboardMouseInput } from '../input/keyboard-mouse.ts';
import { icon, partIcon } from './icons.ts';

/** Heights above the ground for things floating in the scene. */
const PROMPT_HEIGHT = 1.5;
const OVERHEAD_HEIGHT = 2.4;

/**
 * In-match HUD, mostly icons: one toughness bar (stuffing, with buttons as a blue coat over it),
 * the two weapon cards (ammo as a draining bar that refills while reloading; tap to switch, tap
 * the active one to reload), three item slots (tap to use), and in the scene: what E/Grab would
 * do, floating over the chest or item, and a progress bar over what's being opened or used.
 * Writes to the DOM only on change.
 */
export class Hud {
  private readonly vitals: HTMLElement;
  private readonly stuffingFill: HTMLElement;
  private readonly stuffingNum: HTMLElement;
  private readonly buttonsFill: HTMLElement;
  private readonly buttonsNum: HTMLElement;
  private readonly weapons: { root: HTMLElement; art: HTMLElement; ammo: HTMLElement }[];
  private readonly items: { root: HTMLElement; art: HTMLElement; count: HTMLElement }[];
  private readonly prompt: HTMLElement;
  private readonly promptArt: HTMLElement;
  private readonly promptStash: HTMLElement;
  private readonly stash: HTMLElement;
  private readonly stashArt: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly progressArt: HTMLElement;
  private readonly progressFill: HTMLElement;
  private readonly cache = new Map<string, string>();
  /** Where the prompt and progress float, in world space (null: not shown). */
  private promptAnchor: Vec2 | null = null;
  /** The chest being opened; null while using an item (the bar floats over the plush then). */
  private progressChest: Vec2 | null = null;
  private readonly v = new THREE.Vector3();
  /** True when E/Grab would do something right now (lights the touch Grab button). */
  grabReady = false;

  constructor(root: HTMLElement, input: KeyboardMouseInput) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="vitals">
         ${icon('stuffing')}
         <div class="track"><div class="fill stuffing"></div><div class="fill buttons"></div></div>
         <b class="num"></b>
         <b class="coat" hidden>${icon('buttons')}<span></span></b>
         <button type="button" class="stash-slot" hidden aria-label="Stash"><span class="art"></span><kbd>Q</kbd></button>
       </div>
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
         <span class="opt"><kbd>E</kbd>${icon('hand', 'icon tap')}<span class="art"></span></span>
         <button type="button" class="opt stash-opt" hidden aria-label="Stash"><kbd>Q</kbd>${icon('stash')}</button>
       </div>`,
    );
    const q = <T extends HTMLElement = HTMLElement>(sel: string, from: ParentNode = root) => from.querySelector<T>(sel)!;
    this.vitals = q('.vitals');
    this.stuffingFill = q('.vitals .stuffing');
    this.stuffingNum = q('.vitals .num');
    this.buttonsFill = q('.vitals .buttons');
    this.buttonsNum = q('.vitals .coat span');
    this.prompt = q('.prompt');
    this.promptArt = q('.prompt .art');
    this.promptStash = q('.prompt .stash-opt');
    this.stash = q('.stash-slot');
    this.stashArt = q('.stash-slot .art');
    // Tapping the stash option (or the stash slot) is the same as pressing Q.
    for (const el of [this.promptStash, this.stash]) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.stash();
      });
    }
    this.progress = q('.progress');
    this.progressArt = q('.progress .art');
    this.progressFill = q('.progress .fill');

    this.weapons = [0, 1].map((i) => {
      const el = q(`.weapon[data-slot="${i}"]`);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (el.classList.contains('active')) input.reload();
        else input.selectWeapon(i as 0 | 1);
      });
      return { root: el, art: q('.art', el), ammo: q('.ammo > i', el) };
    });
    this.items = [0, 1, 2].map((i) => {
      const el = q(`.item[data-item="${i}"]`);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.useItem(i as 0 | 1 | 2);
      });
      return { root: el, art: q('.art', el), count: q('.count', el) };
    });
  }

  /** `alpha` is how far render time is past `state.tick` (0..1), for smooth progress. */
  update(state: GameState, me: Player | undefined, alpha: number): void {
    if (!me) return;
    const stuffing = Math.ceil(me.stuffing);
    const buttons = Math.ceil(me.buttons);
    this.set('sW', `${(stuffing / config.player.maxStuffing) * 100}%`, (v) => (this.stuffingFill.style.width = v));
    this.set('sN', String(stuffing), (v) => (this.stuffingNum.textContent = v));
    this.set('sLow', String(stuffing <= 30), (v) => this.vitals.classList.toggle('low', v === 'true'));
    this.set('bW', `${(buttons / config.player.maxButtons) * 100}%`, (v) => (this.buttonsFill.style.width = v));
    this.set('bN', String(buttons), (v) => {
      this.buttonsNum.textContent = v;
      this.buttonsNum.parentElement!.hidden = v === '0';
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

    const stash = me.stash;
    this.set('st', stash ? `${stash.slot}:${stash.animal}` : '', (v) => {
      this.stash.hidden = v === '';
      if (stash) this.stashArt.innerHTML = partIcon(stash.slot, stash.animal);
    });
    this.set('stc', stash ? config.rarity[stash.rarity].color : 'transparent', (v) => this.stash.style.setProperty('--rarity', v));

    const action = me.alive ? me.action : null;
    const chest = action?.kind === 'openChest' ? state.chests.find((c) => c.id === action.chestId) : undefined;
    this.progressChest = chest?.pos ?? null;
    if (action) {
      const t = Math.min(1, (state.tick + alpha - action.startTick) / Math.max(1, action.endTick - action.startTick));
      this.set('pa', action.kind === 'openChest' ? 'chest' : action.item, (v) => (this.progressArt.innerHTML = icon(v)));
      this.progressFill.style.transform = `scaleX(${t.toFixed(3)})`;
    }
    this.set('ps', String(!!action), (v) => (this.progress.hidden = v !== 'true'));

    const interaction = action || !me.alive ? null : findInteraction(state, me);
    this.grabReady = !!interaction;
    this.promptAnchor = interaction?.kind === 'chest' ? interaction.chest.pos : (interaction?.loot.pos ?? null);
    let art = '';
    let color = '#ffffff';
    if (interaction?.kind === 'weapon' && interaction.loot.content.type === 'weapon') {
      const w = interaction.loot.content.weapon;
      art = w.kind;
      color = config.rarity[w.rarity].color;
    } else if (interaction?.kind === 'part') {
      const p = interaction.part;
      art = `part:${p.slot}:${p.animal}`;
      color = config.rarity[p.rarity].color;
    } else if (interaction?.kind === 'chest') {
      art = 'chest';
    }
    this.set('pr', art, (v) => {
      const [kind, slot, animal] = v.split(':');
      this.promptArt.innerHTML = !v ? '' : kind === 'part' ? partIcon(slot as PartSlot, animal as Animal) : icon(v);
      this.prompt.hidden = v === '';
      this.prompt.classList.toggle('hold', v === 'chest');
      // Parts can be worn (E) or stashed (Q).
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

  private float(el: HTMLElement, at: Vec2 | null, y: number, camera: THREE.Camera, width: number, height: number): void {
    if (!at || el.hidden) return;
    this.v.set(at.x, y, at.y).project(camera);
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
