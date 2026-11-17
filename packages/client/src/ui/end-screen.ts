export interface EndView {
  tone: 'win' | 'lose';
  title: string;
  subtitle: string;
  /** e.g. "#3 of 16" */
  placement: string;
  stats: [label: string, value: string][];
  /** Offer to keep watching (only while the match is still going). */
  canSpectate: boolean;
  /** Online, only the host can start the next match; others see this instead. */
  waitingForHost?: boolean;
}

/** The win/lose card: placement, stats, Play again (Enter) and Spectate. */
export class EndScreen {
  private readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly placement: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly spectate: HTMLButtonElement;

  constructor(root: HTMLElement, onPlayAgain: () => void, onSpectate: () => void, onMenu: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="end" hidden role="dialog" aria-modal="true" aria-labelledby="end-title">
         <div class="end-card">
           <div class="end-placement"></div>
           <h1 id="end-title"></h1>
           <p class="end-subtitle"></p>
           <dl class="end-stats"></dl>
           <div class="end-actions">
             <button type="button" class="end-again">Play again <kbd>Enter</kbd></button>
             <button type="button" class="end-spectate">Spectate</button>
             <button type="button" class="end-menu">Menu</button>
           </div>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.end')!;
    this.title = this.el.querySelector('h1')!;
    this.subtitle = this.el.querySelector('.end-subtitle')!;
    this.placement = this.el.querySelector('.end-placement')!;
    this.stats = this.el.querySelector('.end-stats')!;
    this.spectate = this.el.querySelector('.end-spectate')!;
    this.el.querySelector('.end-again')!.addEventListener('click', onPlayAgain);
    this.spectate.addEventListener('click', onSpectate);
    this.el.querySelector('.end-menu')!.addEventListener('click', onMenu);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(view: EndView): void {
    this.el.dataset.tone = view.tone;
    this.title.textContent = view.title;
    this.subtitle.textContent = view.subtitle;
    this.placement.textContent = view.placement;
    this.stats.replaceChildren(
      ...view.stats.flatMap(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }),
    );
    this.spectate.hidden = !view.canSpectate;
    const again = this.el.querySelector<HTMLButtonElement>('.end-again')!;
    again.disabled = !!view.waitingForHost;
    again.innerHTML = view.waitingForHost ? 'Waiting for host…' : 'Play again <kbd>Enter</kbd>';
    this.el.hidden = false;
    (view.waitingForHost ? this.spectate : again).focus();
  }

  hide(): void {
    this.el.hidden = true;
  }
}
