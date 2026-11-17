import { icon } from './icons.ts';

export interface EndView {
  tone: 'win' | 'lose';
  /** Short headline: "Winner!", "Unstitched!", "Over". */
  title: string;
  /** Trusted HTML (icons plus escaped names), e.g. who knocked you out. */
  subtitleHtml: string;
  /** e.g. "#3" */
  placement: string;
  /** Icon name and value. */
  stats: [icon: string, value: string][];
  /** Offer to keep watching (only while the match is still going). */
  canSpectate: boolean;
  /** Online, only the host can start the next match. */
  waitingForHost?: boolean;
}

/** The result card: placement, a few stats, Again (Enter), Spectate and Menu. */
export class EndScreen {
  private readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly placement: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly again: HTMLButtonElement;
  private readonly spectate: HTMLButtonElement;

  constructor(root: HTMLElement, onPlayAgain: () => void, onSpectate: () => void, onMenu: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay end" hidden role="dialog" aria-modal="true" aria-labelledby="end-title">
         <div class="card">
           <div class="place"></div>
           <h1 id="end-title"></h1>
           <p class="sub"></p>
           <div class="stats"></div>
           <div class="row">
             <button type="button" class="big primary end-again"></button>
             <button type="button" class="round end-spectate" aria-label="Spectate">${icon('eye')}</button>
             <button type="button" class="round end-menu" aria-label="Menu">${icon('home')}</button>
           </div>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.end')!;
    this.title = this.el.querySelector('h1')!;
    this.subtitle = this.el.querySelector('.sub')!;
    this.placement = this.el.querySelector('.place')!;
    this.stats = this.el.querySelector('.stats')!;
    this.again = this.el.querySelector('.end-again')!;
    this.spectate = this.el.querySelector('.end-spectate')!;
    this.again.addEventListener('click', onPlayAgain);
    this.spectate.addEventListener('click', onSpectate);
    this.el.querySelector('.end-menu')!.addEventListener('click', onMenu);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(view: EndView): void {
    this.el.dataset.tone = view.tone;
    this.title.textContent = view.title;
    this.subtitle.innerHTML = view.subtitleHtml;
    this.placement.textContent = view.placement;
    this.stats.innerHTML = view.stats.map(([name, value]) => `<div class="stat">${icon(name)}<b>${value}</b></div>`).join('');
    this.spectate.hidden = !view.canSpectate;
    this.again.disabled = !!view.waitingForHost;
    this.again.innerHTML = view.waitingForHost ? `${icon('timer')}<span>Host…</span>` : `${icon('play')}<span>Again</span><kbd>Enter</kbd>`;
    this.el.hidden = false;
    (view.waitingForHost ? this.spectate : this.again).focus();
  }

  hide(): void {
    this.el.hidden = true;
  }
}
