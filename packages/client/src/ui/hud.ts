import { canUseItem, config, findInteraction, reloadTicks } from '@stuffed/sim';
import type { GameState, Player } from '@stuffed/sim';

/**
 * Stuffing and buttons bars, the two weapon slots, three item slots, the E prompt and the
 * progress bar for opening chests and using items. Writes to the DOM only on change.
 */
export class Hud {
  private readonly stuffingFill: HTMLElement;
  private readonly stuffingText: HTMLElement;
  private readonly buttonsFill: HTMLElement;
  private readonly buttonsText: HTMLElement;
  private readonly slots: { root: HTMLElement; name: HTMLElement; ammo: HTMLElement; reload: HTMLElement }[];
  private readonly itemSlots: { root: HTMLElement; name: HTMLElement; count: HTMLElement }[];
  private readonly prompt: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly progressLabel: HTMLElement;
  private readonly progressFill: HTMLElement;
  private readonly cache = new Map<string, string>();

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="center-stack">
         <div class="progress" hidden><span class="label"></span><div class="track"><div class="fill"></div></div></div>
         <div class="prompt" hidden></div>
       </div>
       <div class="vitals">
         <div class="bar buttons"><div class="fill"></div><span class="label"></span></div>
         <div class="bar stuffing"><div class="fill"></div><span class="label"></span></div>
       </div>
       <div class="items">
         ${[0, 1, 2]
           .map((i) => `<div class="item" data-item="${i}"><span class="key">${i + 3}</span><span class="name"></span><span class="count"></span></div>`)
           .join('')}
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
    this.prompt = q('.prompt');
    this.progress = q('.progress');
    this.progressLabel = q('.progress .label');
    this.progressFill = q('.progress .fill');
    this.slots = [0, 1].map((i) => {
      const slot = q(`.slot[data-slot="${i}"]`);
      return {
        root: slot,
        name: slot.querySelector<HTMLElement>('.name')!,
        ammo: slot.querySelector<HTMLElement>('.ammo')!,
        reload: slot.querySelector<HTMLElement>('.reload')!,
      };
    });
    this.itemSlots = [0, 1, 2].map((i) => {
      const slot = q(`.item[data-item="${i}"]`);
      return { root: slot, name: slot.querySelector<HTMLElement>('.name')!, count: slot.querySelector<HTMLElement>('.count')! };
    });
  }

  /** `alpha` is how far render time is past `state.tick` (0..1), for smooth progress bars. */
  update(state: GameState, me: Player | undefined, alpha: number): void {
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

    me.items.forEach((stack, i) => {
      const s = this.itemSlots[i]!;
      this.set(`iname${i}`, stack ? config.items[stack.kind].name : '', (v) => (s.name.textContent = v));
      this.set(`icount${i}`, stack ? `×${stack.count}` : '', (v) => (s.count.textContent = v));
      this.set(`iempty${i}`, String(!stack), (v) => s.root.classList.toggle('empty', v === 'true'));
      const usable = !!stack && canUseItem(me, stack.kind);
      this.set(`iuse${i}`, String(usable), (v) => s.root.classList.toggle('unusable', v !== 'true'));
      const color = stack ? config.rarity[config.items[stack.kind].rarity].color : 'transparent';
      this.set(`icolor${i}`, color, (v) => s.root.style.setProperty('--rarity', v));
    });

    const action = me.alive ? me.action : null;
    if (action) {
      const label = action.kind === 'openChest' ? 'Opening toy box' : `Using ${config.items[action.item].name}`;
      const t = Math.min(1, (state.tick + alpha - action.startTick) / Math.max(1, action.endTick - action.startTick));
      this.set('plabel', label, (v) => (this.progressLabel.textContent = v));
      this.progressFill.style.transform = `scaleX(${t.toFixed(3)})`;
    }
    this.set('pshow', String(!!action), (v) => (this.progress.hidden = v !== 'true'));

    const interaction = action || !me.alive ? null : findInteraction(state, me);
    let prompt = '';
    let promptColor = '#ffffff';
    if (interaction?.kind === 'weapon' && interaction.loot.content.type === 'weapon') {
      const w = interaction.loot.content.weapon;
      prompt = `<kbd>E</kbd> Pick up ${config.weapons[w.kind].name} · ${config.rarity[w.rarity].name}`;
      promptColor = config.rarity[w.rarity].color;
    } else if (interaction?.kind === 'chest') {
      prompt = '<kbd>Hold E</kbd> Open toy box';
    }
    this.set('prompt', prompt, (v) => {
      this.prompt.innerHTML = v;
      this.prompt.hidden = v === '';
    });
    this.set('promptColor', promptColor, (v) => this.prompt.style.setProperty('--rarity', v));
  }

  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }
}
