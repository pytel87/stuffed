import * as THREE from 'three';
import { ANIMAL_RARITY, ANIMALS, PART_SLOTS } from '@stuffed/sim';
import type { Animal, PartLoadout, PartSlot } from '@stuffed/sim';
import type { Look, OwnedEntry } from '@stuffed/sim/net';
import { PlushView } from '../render/plush-view.ts';
import type { ProfileStore } from '../session/profile.ts';
import { renderPlushPictures } from '../render/model-icons.ts';
import { icon, partIcon } from './icons.ts';
import { tr } from '../i18n.ts';

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
           <button type="button" class="round close" aria-label="${tr('Close')}">${icon('close')}</button>
           <button type="button" class="round gallery-toggle" aria-label="${tr('Gallery')}">${icon('gallery')}</button>
           <button type="button" class="round code-toggle" aria-label="${tr('Recovery code')}">${icon('code')}</button>
           <div class="gallery" hidden></div>
           <div class="wardrobe-body">
             <canvas class="wardrobe-preview"></canvas>
             <div class="wardrobe-slots">
               ${PART_SLOTS.map((slot) => `<button type="button" class="wardrobe-slot" data-slot="${slot}" aria-label="${tr(slot)}"></button>`).join('')}
             </div>
             <div class="wardrobe-picker"></div>
           </div>
           <div class="wardrobe-code" hidden>
             <h2>${icon('code', 'icon large')}</h2>
             <p class="code-hint">Your code: type it on another phone or tablet to play with the same plush and parts.</p>
             <div class="row code-row">
               <b class="code-box code"></b>
               <button type="button" class="round code-copy" aria-label="${tr('Copy code')}">${icon('copy')}</button>
             </div>
             <p class="code-hint">${tr('Got a code from another device?')}</p>
             <form class="row restore">
               <label class="field">${icon('enter')}<input maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false" aria-label="${tr('Recovery code')}"></label>
               <button type="submit" class="round primary" aria-label="${tr('Use code')}">${icon('arrow')}</button>
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
    this.galleryToggle.addEventListener('click', (e) => {
      if (e.detail > 0) this.galleryToggle.blur();
      this.showGallery(this.gallery.hidden === true);
    });
    // The recovery code (to open this profile on another device): its own view, in place of the
    // dressing up, until the key (now a hanger) is tapped again.
    const codeToggle = this.el.querySelector<HTMLButtonElement>('.code-toggle')!;
    codeToggle.addEventListener('click', (e) => {
      if (e.detail > 0) codeToggle.blur();
      this.showCode(this.el.querySelector<HTMLElement>('.wardrobe-code')!.hidden === true);
    });
    const copy = this.el.querySelector<HTMLButtonElement>('.code-copy')!;
    copy.addEventListener('click', (e) => {
      if (e.detail > 0) copy.blur();
      void navigator.clipboard?.writeText(this.code.textContent ?? '').then(() => {
        copy.innerHTML = icon('check');
        setTimeout(() => (copy.innerHTML = icon('copy')), 1200);
      });
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
    // In the gallery: tapping an animal's card puts on every part of it you own, and goes back
    // to the Wardrobe to show the look.
    this.gallery.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.gallery-card.owned');
      if (!card) return;
      this.wear(Object.fromEntries(PART_SLOTS.map((slot) => [slot, card.dataset.animal as Animal])));
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
    // Its own close button takes the corner where the options gear sits.
    document.body.classList.add('wardrobe-open');
    this.code.textContent = profile.recovery;
    this.message.textContent = '';
    this.render();
    this.showGallery(false);
    this.el.hidden = false;
    this.preview.start();
  }

  /** Switches between dressing up and the recovery code view. */
  private showCode(on: boolean): void {
    this.el.querySelector<HTMLElement>('.wardrobe-code')!.hidden = !on;
    this.el.querySelector<HTMLElement>('.wardrobe-body')!.hidden = on;
    this.galleryToggle.hidden = on;
    const toggle = this.el.querySelector<HTMLElement>('.code-toggle')!;
    toggle.innerHTML = icon(on ? 'hanger' : 'code');
    toggle.setAttribute('aria-label', tr(on ? 'Wardrobe' : 'Recovery code'));
    this.message.textContent = '';
  }

  /** Switches between dressing up and the gallery of all the animals. */
  private showGallery(on: boolean): void {
    this.gallery.hidden = !on;
    this.el.querySelector<HTMLElement>('.wardrobe-body')!.hidden = on;
    this.showCode(false);
    this.galleryToggle.hidden = false;
    this.el.querySelector<HTMLElement>('.wardrobe-body')!.hidden = on;
    this.el.querySelector<HTMLElement>('.code-toggle')!.hidden = on;
    this.galleryToggle.innerHTML = icon(on ? 'hanger' : 'gallery');
    this.galleryToggle.setAttribute('aria-label', tr(on ? 'Wardrobe' : 'Gallery'));
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
      return `<div class="gallery-card tier-${tier}${count > 0 ? ' owned' : ''}${count === PART_SLOTS.length ? ' complete' : ''}" data-animal="${animal}">
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
    document.body.classList.remove('wardrobe-open');
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
    // Only as wide as it needs: up to 5 columns of 4 rows before it scrolls; short screens
    // (phones in landscape) fit 3 rows, so they spread to up to 6 columns instead.
    const short = window.innerHeight <= 480;
    const rows = short ? 3 : 4;
    // Sized for the slot with the most parts, so the card keeps its width when switching slots.
    const most = Math.max(...PART_SLOTS.map((sl) => this.owned(sl).length));
    this.picker.style.setProperty('--cols', String(Math.min(short ? 6 : 5, Math.max(1, Math.ceil(most / rows)))));
    this.picker.innerHTML = owned
      .map(
        (p) => `<button type="button" class="pick tier-${ANIMAL_RARITY[p.animal]}${p.animal === look[slot].animal ? ' worn' : ''}" data-animal="${p.animal}" aria-label="${tr(p.animal)}">${partIcon(slot, p.animal)}</button>`,
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
