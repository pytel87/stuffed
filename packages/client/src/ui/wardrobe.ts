import * as THREE from 'three';
import { ANIMAL_RARITY, ANIMALS, PART_SLOTS } from '@stuffed/sim';
import type { Animal, PartLoadout, PartSlot } from '@stuffed/sim';
import type { Look, OwnedEntry } from '@stuffed/sim/net';
import { PlushView } from '../render/plush-view.ts';
import type { ProfileStore } from '../session/profile.ts';
import { renderPlushPictures } from '../render/model-icons.ts';
import { icon, partIcon } from './icons.ts';

/**
 * The Wardrobe: pick the look you start matches in from the parts you own (tap a slot, then a
 * part from all you own for it), see it on a turning plush, and the recovery code that puts
 * this profile on another device (or a field to enter one). The gallery shows every animal;
 * tapping an owned part there (or a complete set) puts it on.
 */
export class Wardrobe {
  private readonly el: HTMLElement;
  private readonly tabs: Record<PartSlot, HTMLButtonElement>;
  private readonly picker: HTMLElement;
  /** The slot whose parts the picker shows. */
  private selected: PartSlot = 'head';
  private readonly code: HTMLElement;
  private readonly restoreInput: HTMLInputElement;
  private readonly message: HTMLElement;
  private readonly preview: Preview;
  /** The look being edited (saved after each change). */
  private look: Look | null = null;
  /** Called after a new look is saved. */
  onLookChanged: () => void = () => {};
  /** Called when it closes (the card it was opened from comes back). */
  onClosed: (() => void) | null = null;
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
           <button type="button" class="round code-toggle" aria-label="Recovery code">${icon('code')}</button>
           <div class="gallery" hidden></div>
           <div class="wardrobe-body">
             <canvas class="wardrobe-preview"></canvas>
             <div class="wardrobe-slots">
               ${PART_SLOTS.map((slot) => `<button type="button" class="wardrobe-slot" data-slot="${slot}" aria-label="${slot}"></button>`).join('')}
             </div>
             <div class="wardrobe-picker"></div>
           </div>
           <div class="wardrobe-code" hidden>
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
    // The recovery code (to open this profile on another device) stays tucked away until asked for.
    this.el.querySelector('.code-toggle')!.addEventListener('click', () => {
      const code = this.el.querySelector<HTMLElement>('.wardrobe-code')!;
      code.hidden = !code.hidden;
    });
    this.tabs = Object.fromEntries(
      PART_SLOTS.map((slot) => {
        const tab = this.el.querySelector<HTMLButtonElement>(`.wardrobe-slot[data-slot="${slot}"]`)!;
        tab.addEventListener('click', () => {
          this.selected = slot;
          this.render();
        });
        return [slot, tab];
      }),
    ) as Wardrobe['tabs'];
    this.picker = this.el.querySelector('.wardrobe-picker')!;
    this.picker.addEventListener('click', (e) => {
      const pick = (e.target as HTMLElement).closest<HTMLElement>('[data-animal]');
      if (pick) this.wear({ [this.selected]: pick.dataset.animal as Animal });
    });
    // In the gallery: an owned part puts it on; a complete set puts on all five.
    this.gallery.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const part = target.closest<HTMLElement>('.gallery-part.owned');
      const card = target.closest<HTMLElement>('.gallery-card.complete');
      if (part) this.wear({ [part.dataset.slot as PartSlot]: part.dataset.animal as Animal }, part.dataset.slot as PartSlot);
      else if (card) this.wear(Object.fromEntries(PART_SLOTS.map((slot) => [slot, card.dataset.animal as Animal])));
      else return;
      this.showGallery(false);
    });

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
    this.el.querySelector<HTMLElement>('.wardrobe-code')!.hidden = true;
    this.el.querySelector<HTMLElement>('.code-toggle')!.hidden = on;
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
      const parts = PART_SLOTS.map(
        (slot) => `<span class="gallery-part${has(slot, animal) ? ' owned' : ''}" data-slot="${slot}" data-animal="${animal}">${partIcon(slot, animal)}</span>`,
      ).join('');
      const picture = pictures.get(animal);
      return `<div class="gallery-card tier-${tier}${count === PART_SLOTS.length ? ' complete' : ''}" data-animal="${animal}">
        ${picture ? `<img src="${picture}" alt="" draggable="false">` : ''}
        <b class="gallery-tier">${'★'.repeat(tier)}</b>
        <b class="gallery-count">${count}/${PART_SLOTS.length}</b>
        <div class="gallery-parts">${parts}</div>
      </div>`;
    }).join('');
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.preview.stop();
    const back = this.onClosed;
    this.onClosed = null;
    back?.();
  }

  /** Owned parts for a slot, commonest animals first (as in the gallery). */
  private owned(slot: PartSlot): OwnedEntry[] {
    const parts = this.store.profile?.parts.filter((p) => p.slot === slot) ?? [];
    // One entry per animal (older collections may hold the same part at several rarities).
    const unique = parts.filter((p, i) => parts.findIndex((q) => q.animal === p.animal) === i);
    return unique.sort((a, b) => ANIMAL_RARITY[a.animal] - ANIMAL_RARITY[b.animal] || ANIMALS.indexOf(a.animal) - ANIMALS.indexOf(b.animal));
  }

  /** Puts on owned parts (by slot) and saves the look; `focus` selects that slot's picker. */
  private wear(parts: Partial<Record<PartSlot, Animal>>, focus?: PartSlot): void {
    const look = this.look;
    if (!look) return;
    for (const [slot, animal] of Object.entries(parts) as [PartSlot, Animal][]) {
      const owned = this.owned(slot).find((p) => p.animal === animal);
      if (owned) look[slot] = { animal, rarity: owned.rarity };
    }
    if (focus) this.selected = focus;
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
      const tab = this.tabs[slot];
      tab.innerHTML = partIcon(slot, look[slot].animal);
      tab.classList.toggle('selected', slot === this.selected);
    }
    const slot = this.selected;
    const owned = this.owned(slot);
    // Only as wide as it needs: up to 4 columns of 4 rows before it scrolls; short screens
    // (phones in landscape) fit 3 rows, so they spread to up to 6 columns instead.
    const short = window.innerHeight <= 480;
    const rows = short ? 3 : 4;
    this.picker.style.setProperty('--cols', String(Math.min(short ? 6 : 4, Math.max(1, Math.ceil(owned.length / rows)))));
    this.picker.innerHTML = owned
      .map(
        (p) => `<button type="button" class="pick tier-${ANIMAL_RARITY[p.animal]}${p.animal === look[slot].animal ? ' worn' : ''}" data-animal="${p.animal}" aria-label="${p.animal}">${partIcon(slot, p.animal)}</button>`,
      )
      .join('');
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
