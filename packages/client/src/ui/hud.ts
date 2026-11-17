import { config, reloadTicks } from '@stuffed/sim';
import type { GameState, Player } from '@stuffed/sim';

/** Stuffing and buttons bars plus the two weapon slots. Writes to the DOM only on change. */
export class Hud {
  private readonly stuffingFill: HTMLElement;
  private readonly stuffingText: HTMLElement;
  private readonly buttonsFill: HTMLElement;
  private readonly buttonsText: HTMLElement;
  private readonly slots: { root: HTMLElement; name: HTMLElement; ammo: HTMLElement; reload: HTMLElement }[];
  private readonly cache = new Map<string, string>();

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="vitals">
         <div class="bar buttons"><div class="fill"></div><span class="label"></span></div>
         <div class="bar stuffing"><div class="fill"></div><span class="label"></span></div>
       </div>
       <div class="weapons">
         ${[0, 1]
           .map(
             (i) => `<div class="slot" data-slot="${i}">
               <span class="key">${i + 1}</span>
               <span class="name"></span>
               <span class="ammo"></span>
               <div class="reload"></div>
             </div>`,
           )
           .join('')}
       </div>`,
    );
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    this.stuffingFill = q('.bar.stuffing .fill');
    this.stuffingText = q('.bar.stuffing .label');
    this.buttonsFill = q('.bar.buttons .fill');
    this.buttonsText = q('.bar.buttons .label');
    this.slots = [0, 1].map((i) => {
      const slot = q(`.slot[data-slot="${i}"]`);
      return {
        root: slot,
        name: slot.querySelector<HTMLElement>('.name')!,
        ammo: slot.querySelector<HTMLElement>('.ammo')!,
        reload: slot.querySelector<HTMLElement>('.reload')!,
      };
    });
  }

  update(state: GameState, me: Player | undefined): void {
    if (!me) return;
    const stuffing = Math.ceil(me.stuffing);
    const buttons = Math.ceil(me.buttons);
    this.set('stuffingW', `${(stuffing / config.player.maxStuffing) * 100}%`, (v) => (this.stuffingFill.style.width = v));
    this.set('stuffingT', `${stuffing} stuffing`, (v) => (this.stuffingText.textContent = v));
    this.set('buttonsW', `${(buttons / config.player.maxButtons) * 100}%`, (v) => (this.buttonsFill.style.width = v));
    this.set('buttonsT', `${buttons} buttons`, (v) => (this.buttonsText.textContent = v));

    me.weapons.forEach((w, i) => {
      const s = this.slots[i]!;
      const active = i === me.activeSlot;
      this.set(`active${i}`, String(active), (v) => s.root.classList.toggle('active', v === 'true'));
      if (!w) {
        this.set(`name${i}`, 'Empty', (v) => (s.name.textContent = v));
        this.set(`ammo${i}`, '', (v) => (s.ammo.textContent = v));
        this.set(`color${i}`, 'transparent', (v) => s.root.style.setProperty('--rarity', v));
        this.set(`reload${i}`, '0', (v) => (s.reload.style.transform = `scaleX(${v})`));
        return;
      }
      const stats = config.weapons[w.kind];
      const rarity = config.rarity[w.rarity];
      this.set(`name${i}`, stats.name, (v) => (s.name.textContent = v));
      this.set(`title${i}`, rarity.name, (v) => (s.root.title = v));
      this.set(`color${i}`, rarity.color, (v) => s.root.style.setProperty('--rarity', v));
      const reloading = w.reloadEndTick !== null;
      this.set(`ammo${i}`, reloading ? 'reloading' : `${w.ammo} / ${stats.magazine}`, (v) => (s.ammo.textContent = v));
      const progress = reloading ? 1 - (w.reloadEndTick! - state.tick) / reloadTicks(w) : 0;
      this.set(`reload${i}`, progress.toFixed(3), (v) => (s.reload.style.transform = `scaleX(${v})`));
    });
  }

  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }
}
