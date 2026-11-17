import * as THREE from 'three';
import { ANIMAL_RARITY, ANIMALS, PART_SLOTS } from '@stuffed/sim';
import type { Animal, PartLoadout, PartSlot } from '@stuffed/sim';
import type { Look, OwnedEntry } from '@stuffed/sim/net';
import { PlushView } from '../render/plush-view.ts';
import type { ProfileStore } from '../session/profile.ts';
import { renderPlushPictures } from '../render/model-icons.ts';
import { icon, partIcon } from './icons.ts';

/**
 * The Wardrobe: pick the look you start matches in from the parts you own (one row per slot,
 * flip with the arrows), see it on a turning plush, and the recovery code that puts this
 * profile on another device (or a field to enter one).
 */
export class Wardrobe {
  private readonly el: HTMLElement;
  private readonly rows: Record<PartSlot, { art: HTMLElement; count: HTMLElement; prev: HTMLButtonElement; next: HTMLButtonElement }>;
  private readonly code: HTMLElement;
  private readonly restoreInput: HTMLInputElement;
  private readonly message: HTMLElement;
  private readonly preview: Preview;
  /** The look being edited (saved after each change). */
  private look: Look | null = null;
  /** Called after a new look is saved. */
  onLookChanged: () => void = () => {};
  /** Every animal's full set, with the parts you own lit up (what to chase). */
  private readonly gallery: HTMLElement;
  private readonly galleryToggle: HTMLButtonElement;

  constructor(private readonly store: ProfileStore) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay wardrobe" hidden>
         <div class="card">
           <button type="button" class="round close" aria-label="Close">${icon('close')}</button>
           <button type="button" class="round gallery-toggle" aria-label="Gallery">${icon('gallery')}</button>
           <div class="gallery" hidden></div>
           <div class="wardrobe-body">
             <canvas class="wardrobe-preview"></canvas>
             <div class="wardrobe-slots">
               ${PART_SLOTS.map(
                 (slot) => `<div class="wardrobe-slot" data-slot="${slot}">
                   <button type="button" class="round small prev" aria-label="Previous">${icon('arrow', 'icon flip')}</button>
                   <span class="part"><span class="art"></span><b class="count"></b></span>
                   <button type="button" class="round small next" aria-label="Next">${icon('arrow')}</button>
                 </div>`,
               ).join('')}
             </div>
           </div>
           <div class="wardrobe-code">
             ${icon('code')}<b class="code"></b>
             <form class="row restore">
               <label class="field">${icon('enter')}<input maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false" aria-label="Recovery code"></label>
               <button type="submit" class="round primary" aria-label="Use code">${icon('arrow')}</button>
             </form>
           </div>
           <p class="error" role="alert"></p>
         </div>
       </div>`,
    );
    this.el = document.querySelector<HTMLElement>('.wardrobe')!;
    this.code = this.el.querySelector('.code')!;
    this.restoreInput = this.el.querySelector('.restore input')!;
    this.message = this.el.querySelector('.error')!;
    this.preview = new Preview(this.el.querySelector('.wardrobe-preview')!);
    this.gallery = this.el.querySelector('.gallery')!;
    this.galleryToggle = this.el.querySelector('.gallery-toggle')!;
    this.galleryToggle.addEventListener('click', () => this.showGallery(this.gallery.hidden === true));
    this.rows = Object.fromEntries(
      PART_SLOTS.map((slot) => {
        const row = this.el.querySelector<HTMLElement>(`.wardrobe-slot[data-slot="${slot}"]`)!;
        const prev = row.querySelector<HTMLButtonElement>('.prev')!;
        const next = row.querySelector<HTMLButtonElement>('.next')!;
        prev.addEventListener('click', () => this.flip(slot, -1));
        next.addEventListener('click', () => this.flip(slot, 1));
        return [slot, { art: row.querySelector<HTMLElement>('.art')!, count: row.querySelector<HTMLElement>('.count')!, prev, next }];
      }),
    ) as Wardrobe['rows'];

    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
    this.restoreInput.addEventListener('input', () => (this.restoreInput.value = this.restoreInput.value.toUpperCase()));
    this.el.querySelector('.restore')!.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.restore();
    });
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    const profile = this.store.profile;
    if (!profile) return;
    this.look = structuredClone(profile.look);
    this.code.textContent = profile.recovery;
    this.message.textContent = '';
    this.render();
    this.showGallery(false);
    this.el.hidden = false;
    this.preview.start();
  }

  /** Switches between dressing up and the gallery of all the animals. */
  private showGallery(on: boolean): void {
    this.gallery.hidden = !on;
    this.el.querySelector<HTMLElement>('.wardrobe-body')!.hidden = on;
    this.el.querySelector<HTMLElement>('.wardrobe-code')!.hidden = on;
    this.galleryToggle.innerHTML = icon(on ? 'hanger' : 'gallery');
    this.galleryToggle.setAttribute('aria-label', on ? 'Wardrobe' : 'Gallery');
    this.el.querySelector('.card')!.classList.toggle('showing-gallery', on);
    if (on) this.renderGallery();
  }

  private renderGallery(): void {
    const pictures = renderPlushPictures();
    const owned = this.store.profile?.parts ?? [];
    const has = (slot: PartSlot, animal: Animal) => owned.some((p) => p.slot === slot && p.animal === animal);
    // Common animals first, the legendary last; stars tell how rare each one is.
    const byRarity = [...ANIMALS].sort((a, b) => ANIMAL_RARITY[a] - ANIMAL_RARITY[b]);
    this.gallery.innerHTML = byRarity.map((animal) => {
      const count = PART_SLOTS.filter((slot) => has(slot, animal)).length;
      const tier = ANIMAL_RARITY[animal];
      const parts = PART_SLOTS.map((slot) => `<span class="gallery-part${has(slot, animal) ? ' owned' : ''}">${partIcon(slot, animal)}</span>`).join('');
      const picture = pictures.get(animal);
      return `<div class="gallery-card tier-${tier}${count === PART_SLOTS.length ? ' complete' : ''}">
        ${picture ? `<img src="${picture}" alt="" draggable="false">` : ''}
        <b class="gallery-tier">${'★'.repeat(tier)}</b>
        <b class="gallery-count">${count}/${PART_SLOTS.length}</b>
        <div class="gallery-parts">${parts}</div>
      </div>`;
    }).join('');
  }

  hide(): void {
    this.el.hidden = true;
    this.preview.stop();
  }

  /** Owned parts for a slot, in a stable order: by animal, then rarity. */
  private owned(slot: PartSlot): OwnedEntry[] {
    const parts = this.store.profile?.parts.filter((p) => p.slot === slot) ?? [];
    // One entry per animal (older collections may hold the same part at several rarities).
    const unique = parts.filter((p, i) => parts.findIndex((q) => q.animal === p.animal) === i);
    return unique.sort((a, b) => ANIMALS.indexOf(a.animal) - ANIMALS.indexOf(b.animal));
  }

  private flip(slot: PartSlot, step: 1 | -1): void {
    const look = this.look;
    if (!look) return;
    const options = this.owned(slot);
    if (options.length < 2) return;
    const at = options.findIndex((p) => p.animal === look[slot].animal);
    const next = options[(at + step + options.length) % options.length]!;
    look[slot] = { animal: next.animal, rarity: next.rarity };
    this.render();
    void this.store.setLook(structuredClone(look)).then((ok) => {
      if (!ok) this.message.textContent = '!';
      else this.onLookChanged();
    });
  }

  private render(): void {
    const look = this.look;
    if (!look) return;
    for (const slot of PART_SLOTS) {
      const row = this.rows[slot];
      const part = look[slot];
      const options = this.owned(slot);
      const entry = options.find((p) => p.animal === part.animal);
      row.art.innerHTML = partIcon(slot, part.animal);
      row.count.textContent = `${options.findIndex((p) => p === entry) + 1}/${options.length}`;
      row.prev.disabled = row.next.disabled = options.length < 2;
    }
    this.preview.setLook(look);
  }

  private async restore(): Promise<void> {
    this.message.textContent = '';
    const ok = await this.store.recover(this.restoreInput.value);
    if (!ok) {
      this.message.textContent = '?';
      return;
    }
    this.restoreInput.value = '';
    this.show();
  }
}

/** A small scene with your plush slowly turning, drawn only while the Wardrobe is open. */
class Preview {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private plush: PlushView | null = null;
  private frame = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#9a8aa8', 1.4));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4);
    sun.position.set(-3, 6, 5);
    this.scene.add(sun);
    this.camera.position.set(0, 2.2, 5.2);
    this.camera.lookAt(0, 0.75, 0);
  }

  setLook(look: Look): void {
    const parts = Object.fromEntries(PART_SLOTS.map((slot) => [slot, { ...look[slot], found: false }])) as PartLoadout;
    if (!this.plush) {
      this.plush = new PlushView(parts);
      this.scene.add(this.plush.root);
    } else {
      this.plush.setParts(parts);
    }
  }

  start(): void {
    // Its own small WebGL context, made on first open (the game's renderer keeps running behind).
    this.renderer ??= new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    cancelAnimationFrame(this.frame);
    const draw = (now: number) => {
      const r = this.renderer!;
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (w > 0 && h > 0 && (this.canvas.width !== Math.round(w * r.getPixelRatio()) || this.canvas.height !== Math.round(h * r.getPixelRatio()))) {
        r.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      const t = now / 1000;
      const turn = Math.sin(t * 0.6) * 0.9;
      this.plush?.update({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: Math.sin(turn), y: Math.cos(turn) }, 0, 0, 1 / 60, t);
      r.render(this.scene, this.camera);
      this.frame = requestAnimationFrame(draw);
    };
    this.frame = requestAnimationFrame(draw);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
  }
}
