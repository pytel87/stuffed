import * as THREE from 'three';
import { ANIMAL_RARITY, ANIMALS, getMap, HOME_MAP, PART_SLOTS, setOffer } from '@stuffed/sim';
import type { Animal, PartLoadout, PartSlot } from '@stuffed/sim';
import type { Look, OwnedEntry } from '@stuffed/sim/net';
import { PlushView } from '../render/plush-view.ts';
import type { ProfileStore } from '../session/profile.ts';
import { renderPlushPictures } from '../render/model-icons.ts';
import { icon, partIcon, RARITY_COLORS, starIcon } from './icons.ts';
import { tr } from '../i18n.ts';
import { mapName } from './map-choice.ts';
import { flashMessage } from './flash.ts';

/**
 * The Wardrobe: pick the look you start matches in from the parts you own (tap a slot, then a
 * part from all you own for it), and see it on a turning plush. The gallery shows every animal;
 * tapping an owned part there (or a complete set) puts it on.
 */
/** The rarities, common to legendary (the filter's stars; see ANIMAL_RARITY). */
const TIERS = [1, 2, 3, 4] as const;
const TIER_NAMES = ['Common', 'Uncommon', 'Rare', 'Legendary'] as const;
/** A filter's star: a rarity's in its colour (the gallery's star), the holo one in a rainbow. */
const star = (fill: string, defs = '') => starIcon(fill, 'filter-star', defs);
const HOLO_STAR = star(
  'url(#holo-star-fill)',
  '<defs><linearGradient id="holo-star-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7eb6"/><stop offset=".3" stop-color="#ffd36e"/><stop offset=".5" stop-color="#8affb0"/><stop offset=".7" stop-color="#6ee7ff"/><stop offset="1" stop-color="#b48cff"/></linearGradient></defs>',
);

export class Wardrobe {
  private readonly el: HTMLElement;
  private readonly tabs: Record<PartSlot, HTMLButtonElement>;
  private readonly picker: HTMLElement;
  /** The slot whose parts the picker shows. */
  private selected: PartSlot = 'head';
  /** The part list's filters (once it's long enough to scroll): one rarity, or only holo parts. */
  private tierFilter: number | null = null;
  private holoOnly = false;
  private readonly filters: HTMLElement;
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
  private updateGalleryEdges: () => void = () => {};

  constructor(private readonly store: ProfileStore) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay wardrobe" hidden>
         <div class="card">
           <button type="button" class="round close" aria-label="${tr('Close')}">${icon('close')}</button>
           <button type="button" class="round gallery-toggle" aria-label="${tr('Gallery')}">${icon('gallery')}</button>
           <div class="gallery-balance" hidden title="${tr('Buttons')}">${icon('button')}<b></b></div>
           <div class="gallery" hidden></div>
           <div class="wardrobe-body">
             <canvas class="wardrobe-preview"></canvas>
             <div class="wardrobe-slots">
               ${PART_SLOTS.map((slot) => `<button type="button" class="wardrobe-slot" data-slot="${slot}" aria-label="${tr(slot)}"></button>`).join('')}
             </div>
             <div class="wardrobe-choose">
               <div class="wardrobe-filters" hidden>
                 ${TIERS.map((t) => `<button type="button" class="filter-tier tier-${t}" data-tier="${t}" aria-pressed="false" aria-label="${tr(TIER_NAMES[t - 1]!)}">${star(RARITY_COLORS[t - 1]!)}</button>`).join('')}
                 <button type="button" class="filter-holo" aria-pressed="false" aria-label="${tr('Only holo')}">${HOLO_STAR}</button>
               </div>
               <div class="wardrobe-picker"></div>
             </div>
           </div>
           <p class="error" role="alert"></p>
         </div>
       </div>`,
    );
    this.el = document.querySelector<HTMLElement>('.wardrobe')!;
    this.message = this.el.querySelector('.error')!;
    this.preview = new Preview(this.el.querySelector('.wardrobe-preview')!);
    this.gallery = this.el.querySelector('.gallery')!;
    // Fades only where there's more to scroll to.
    const edges = () => {
      const g = this.gallery;
      const more = [g.scrollTop > 2 ? 'up' : '', g.scrollTop + g.clientHeight < g.scrollHeight - 2 ? 'down' : ''].filter(Boolean).join(' ');
      g.dataset.more = more;
    };
    this.gallery.addEventListener('scroll', edges, { passive: true });
    this.updateGalleryEdges = edges;
    this.galleryToggle = this.el.querySelector('.gallery-toggle')!;
    this.galleryToggle.addEventListener('click', (e) => {
      if (e.detail > 0) this.galleryToggle.blur();
      this.showGallery(this.gallery.hidden === true);
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
    this.filters = this.el.querySelector('.wardrobe-filters')!;
    this.picker.addEventListener('scroll', () => this.updatePickerEdges(), { passive: true });
    // Tap a rarity to see only it (again to see all); the sparkle, only holo parts. They combine.
    this.filters.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      if (e.detail > 0) b.blur();
      if (b.classList.contains('filter-holo')) this.holoOnly = !this.holoOnly;
      else this.tierFilter = this.tierFilter === Number(b.dataset.tier) ? null : Number(b.dataset.tier);
      this.render();
    });
    this.picker.addEventListener('click', (e) => {
      const pick = (e.target as HTMLElement).closest<HTMLElement>('[data-animal]');
      if (pick) this.wear({ [this.selected]: { animal: pick.dataset.animal as Animal, holo: pick.dataset.holo === '1' } });
    });
    // In the gallery: tapping an animal's card puts on every part of it you own, and goes back
    // to the Wardrobe to show the look. Its buy button (tapped twice: once to ask, once to buy)
    // completes the set with Buttons.
    this.gallery.addEventListener('click', (e) => {
      const buy = (e.target as HTMLElement).closest<HTMLButtonElement>('.gallery-buy');
      if (buy) return void this.buyTapped(buy);
      if ((e.target as HTMLElement).closest('.gallery-home')) return;
      const card = (e.target as HTMLElement).closest<HTMLElement>('.gallery-card.owned');
      if (!card) return;
      this.wear(Object.fromEntries(PART_SLOTS.map((slot) => [slot, { animal: card.dataset.animal as Animal, holo: false }])));
      this.showGallery(false);
    });

    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
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
    flashMessage(this.message, '');
    this.render();
    this.showGallery(false);
    this.el.hidden = false;
    this.preview.start();
  }

  /** Switches between dressing up and the gallery of all the animals. */
  private showGallery(on: boolean): void {
    this.gallery.hidden = !on;
    this.el.querySelector<HTMLElement>('.gallery-balance')!.hidden = !on;
    this.el.querySelector<HTMLElement>('.wardrobe-body')!.hidden = on;
    this.galleryToggle.hidden = false;
    this.el.querySelector<HTMLElement>('.wardrobe-body')!.hidden = on;
    this.galleryToggle.innerHTML = icon(on ? 'hanger' : 'gallery');
    this.galleryToggle.setAttribute('aria-label', tr(on ? 'Wardrobe' : 'Gallery'));
    this.el.querySelector('.card')!.classList.toggle('showing-gallery', on);
    if (on) this.renderGallery();
  }

  private renderGallery(): void {
    const pictures = renderPlushPictures();
    const owned = this.store.profile?.parts ?? [];
    const has = (slot: PartSlot, animal: Animal) => owned.some((p) => p.slot === slot && p.animal === animal && !p.holo);
    const hasHolo = (slot: PartSlot, animal: Animal) => owned.some((p) => p.slot === slot && p.animal === animal && p.holo);
    // Common animals first, the legendary last; stars tell how rare each one is.
    const byRarity = [...ANIMALS].sort((a, b) => ANIMAL_RARITY[a] - ANIMAL_RARITY[b]);
    // The summary on top: how far the whole collection has got.
    const all = ANIMALS.length * PART_SLOTS.length;
    const countParts = (own: (slot: PartSlot, animal: Animal) => boolean) => ANIMALS.reduce((n, a) => n + PART_SLOTS.filter((slot) => own(slot, a)).length, 0);
    const countSets = (own: (slot: PartSlot, animal: Animal) => boolean) => ANIMALS.filter((a) => PART_SLOTS.every((slot) => own(slot, a))).length;
    const stat = (label: string, have: number, of: number, holo = false) =>
      `<div class="summary-stat${holo ? ' holo' : ''}"><span>${label}</span><b>${have}<small>/${of}</small></b><i style="--done:${(have / of) * 100}%"></i></div>`;
    this.el.querySelector('.gallery-balance b')!.textContent = String(this.store.profile?.buttons ?? 0);
    const summary = `<div class="gallery-summary">
        ${stat(tr('Parts'), countParts(has), all)}
        ${stat(tr('Sets'), countSets(has), ANIMALS.length)}
        ${stat(tr('Holo parts'), countParts(hasHolo), all, true)}
        ${stat(tr('Holo sets'), countSets(hasHolo), ANIMALS.length, true)}
      </div>`;
    this.gallery.innerHTML = summary + byRarity.map((animal) => {
      const count = PART_SLOTS.filter((slot) => has(slot, animal)).length;
      const holoCount = PART_SLOTS.filter((slot) => hasHolo(slot, animal)).length;
      const tier = ANIMAL_RARITY[animal];
      const parts = PART_SLOTS.map(
        // (A holo part owned shows with its sheen.)
        (slot) =>
          `<span class="gallery-part${has(slot, animal) || hasHolo(slot, animal) ? ' owned' : ''}${hasHolo(slot, animal) ? ' holo' : ''}" data-slot="${slot}" data-animal="${animal}">${partIcon(slot, animal, 'icon', hasHolo(slot, animal))}</span>`,
      ).join('');
      const picture = pictures.get(animal);
      // A set complete unlocks its holo parts: from then on, how many of them you have; all of them
      // turn the card holographic.
      const complete = count === PART_SLOTS.length;
      return `<div class="gallery-card tier-${tier}${count > 0 ? ' owned' : ''}${complete ? ' complete' : ''}${complete && holoCount === PART_SLOTS.length ? ' holo-complete' : ''}" data-animal="${animal}">
        ${picture ? `<img src="${picture}" alt="" draggable="false">` : ''}
        <b class="gallery-tier" aria-label="${'★'.repeat(tier)}">${starIcon(RARITY_COLORS[tier - 1]!).repeat(tier)}</b>
        ${this.homeBadge(animal)}
        <b class="gallery-count">${count}/${PART_SLOTS.length}</b>
        ${complete ? `<b class="gallery-holo" title="${tr('Holo')}">${holoCount === PART_SLOTS.length ? '✦ ' : ''}${holoCount}/${PART_SLOTS.length}</b>` : ''}
        <div class="gallery-parts">${parts}</div>
        ${this.buyButton(animal)}
      </div>`;
    }).join('');
    requestAnimationFrame(() => this.updateGalleryEdges());
  }

  /** Where to look for an animal: its home map's picture, its parts turn up most there. */
  private homeBadge(animal: Animal): string {
    const map = getMap(HOME_MAP[animal]);
    const hint = tr('Found most often on: {map}').replace('{map}', mapName(map));
    // (A button, so it gets the menus' tooltip on hover or a long press.)
    return `<button type="button" class="gallery-home" aria-label="${hint}">${icon(`map-${map.id}`)}</button>`;
  }

  /** The shop's offer on an animal's card: its missing parts, or (set complete) its holo set. */
  private buyButton(animal: Animal): string {
    const owned = this.store.profile?.parts ?? [];
    const plain = setOffer(owned, animal, false);
    const offer = plain.missing.length > 0 ? plain : setOffer(owned, animal, true);
    if (offer.missing.length === 0 || offer.locked) return '';
    const short = offer.price > (this.store.profile?.buttons ?? 0);
    const label = tr(offer.holo ? 'Holo set' : 'Complete');
    // (No aria-label: its text says it all, and a label would pop up the menus' tooltip.)
    return `<button type="button" class="gallery-buy${offer.holo ? ' holo' : ''}${short ? ' short' : ''}" data-animal="${animal}" data-holo="${offer.holo ? 1 : 0}"><span class="buy-label">${label}</span>${icon('button')}<b>${offer.price}</b></button>`;
  }

  /** First tap asks (the button turns into "Buy?"), a second one within a few seconds buys. */
  private async buyTapped(button: HTMLButtonElement): Promise<void> {
    if (button.classList.contains('short')) {
      // A little "no" wiggle, and why.
      button.classList.remove('nope');
      void button.offsetWidth;
      button.classList.add('nope');
      this.flashError(tr('Not enough Buttons yet: play matches to earn them'));
      return;
    }
    if (!button.classList.contains('confirm')) {
      for (const other of this.gallery.querySelectorAll('.gallery-buy.confirm')) other.classList.remove('confirm');
      button.classList.add('confirm');
      button.querySelector('.buy-label')!.textContent = tr('Buy?');
      setTimeout(() => {
        if (!button.isConnected || !button.classList.contains('confirm')) return;
        button.classList.remove('confirm');
        button.querySelector('.buy-label')!.textContent = tr(button.dataset.holo === '1' ? 'Holo set' : 'Complete');
      }, 3000);
      return;
    }
    button.disabled = true;
    const animal = button.dataset.animal as Animal;
    const result = await this.store.buySet(animal, button.dataset.holo === '1');
    if (result === 'too_few') this.flashError(tr('Not enough Buttons yet: play matches to earn them'));
    else if (result === 'failed') this.flashError(tr("Couldn't reach the game server."));
    const scroll = this.gallery.scrollTop;
    this.renderGallery();
    this.gallery.scrollTop = scroll;
    if (result === 'ok') this.gallery.querySelector(`.gallery-card[data-animal="${animal}"]`)?.classList.add('just-bought');
  }

  /** A message that pops in, stays a few seconds and fades away (see .error.flash). */
  private flashError(text: string): void {
    flashMessage(this.message, text);
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

  /** Owned parts for a slot, commonest animals first (as in the gallery), each holo one after its plain one. */
  private owned(slot: PartSlot): OwnedEntry[] {
    const parts = this.store.profile?.parts.filter((p) => p.slot === slot) ?? [];
    // One entry per animal and finish (older collections may hold the same part at several rarities).
    const unique = parts.filter((p, i) => parts.findIndex((q) => q.animal === p.animal && !!q.holo === !!p.holo) === i);
    return unique.sort(
      (a, b) => ANIMAL_RARITY[a.animal] - ANIMAL_RARITY[b.animal] || ANIMALS.indexOf(a.animal) - ANIMALS.indexOf(b.animal) || Number(!!a.holo) - Number(!!b.holo),
    );
  }

  /** Puts on owned parts (by slot) and saves the look; `focus` selects that slot's picker. */
  private wear(parts: Partial<Record<PartSlot, { animal: Animal; holo: boolean }>>, focus?: PartSlot): void {
    const look = this.look;
    if (!look) return;
    for (const [slot, want] of Object.entries(parts) as [PartSlot, { animal: Animal; holo: boolean }][]) {
      const owned = this.owned(slot).find((p) => p.animal === want.animal && !!p.holo === want.holo);
      if (owned) look[slot] = { animal: want.animal, rarity: owned.rarity, ...(want.holo ? { holo: true } : {}) };
    }
    if (focus) this.selected = focus;
    this.render();
    void this.store.setLook(structuredClone(look)).then((ok) => {
      if (!ok) this.message.textContent = '!';
      else this.onLookChanged();
    });
  }

  /** Fades the part list's top or bottom only where there's more to scroll to. */
  private updatePickerEdges(): void {
    const p = this.picker;
    p.dataset.more = [p.scrollTop > 2 ? 'up' : '', p.scrollTop + p.clientHeight < p.scrollHeight - 2 ? 'down' : ''].filter(Boolean).join(' ');
  }

  private render(): void {
    const look = this.look;
    if (!look) return;
    for (const slot of PART_SLOTS) {
      const tab = this.tabs[slot];
      tab.innerHTML = partIcon(slot, look[slot].animal, 'icon', !!look[slot].holo);
      tab.classList.toggle('holo', !!look[slot].holo);
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
    const cols = Math.min(short ? 6 : 5, Math.max(1, Math.ceil(most / rows)));
    // (On the list and its filters both: each filter over a column.)
    this.filters.parentElement!.style.setProperty('--cols', String(cols));
    // The filters, once the longest list scrolls (a few parts need none).
    const filtering = most > rows * cols;
    if (!filtering) (this.tierFilter = null), (this.holoOnly = false);
    this.filters.hidden = !filtering;
    this.filters.parentElement!.classList.toggle('filtering', filtering);
    const fits = (p: OwnedEntry, tier: number | null, holo: boolean) => (tier === null || ANIMAL_RARITY[p.animal] === tier) && (!holo || !!p.holo);
    for (const b of this.filters.querySelectorAll<HTMLButtonElement>('.filter-tier')) {
      const tier = Number(b.dataset.tier);
      b.setAttribute('aria-pressed', String(this.tierFilter === tier));
      // (None of that rarity here, with the holo filter as it is: nothing to show.)
      b.disabled = !owned.some((p) => fits(p, tier, this.holoOnly));
    }
    const holo = this.filters.querySelector<HTMLButtonElement>('.filter-holo')!;
    holo.setAttribute('aria-pressed', String(this.holoOnly));
    holo.hidden = !PART_SLOTS.some((sl) => this.owned(sl).some((p) => p.holo));
    holo.disabled = !owned.some((p) => fits(p, this.tierFilter, true));
    this.picker.innerHTML = owned
      .filter((p) => fits(p, this.tierFilter, this.holoOnly))
      .map(
        (p) =>
          `<button type="button" class="pick tier-${ANIMAL_RARITY[p.animal]}${p.holo ? ' holo' : ''}${p.animal === look[slot].animal && !!p.holo === !!look[slot].holo ? ' worn' : ''}" data-animal="${p.animal}" data-holo="${p.holo ? 1 : 0}" aria-label="${tr(p.animal)}${p.holo ? ` (${tr('Holo')})` : ''}">${partIcon(slot, p.animal, 'icon', !!p.holo)}</button>`,
      )
      .join('');
    this.updatePickerEdges();
    this.preview.setLook(look);
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
    this.plush.setHolo(PART_SLOTS.filter((slot) => look[slot].holo));
  }

  start(): void {
    // Its own small WebGL context, made on first open (the game's renderer keeps running behind).
    this.renderer ??= new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, stencil: true });
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
