import type { Part } from '@stuffed/sim';
import { icon, partIcon } from './icons.ts';

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
  private readonly kept: HTMLElement;
  private readonly again: HTMLButtonElement;
  private readonly spectate: HTMLButtonElement;

  private readonly wardrobe: HTMLButtonElement;
  private readonly lobby: HTMLButtonElement;

  /**
   * `canLobby`: whether to offer Lobby (online, the host, once the match is over) — back to the
   * room's lobby to change the map, bots or teams.
   */
  constructor(
    root: HTMLElement,
    onPlayAgain: () => void,
    onSpectate: () => void,
    onMenu: () => void,
    onWardrobe: () => void,
    onLobby: () => void = () => {},
    private readonly canLobby: () => boolean = () => false,
  ) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay end" hidden role="dialog" aria-modal="true" aria-labelledby="end-title">
         <div class="card">
           <button type="button" class="round end-wardrobe" aria-label="Wardrobe" hidden>${icon('hanger')}</button>
           <button type="button" class="round end-menu" aria-label="Menu">${icon('home')}</button>
           <div class="place"></div>
           <h1 id="end-title"></h1>
           <p class="sub"></p>
           <div class="stats"></div>
           <div class="kept" hidden></div>
           <div class="row">
             <button type="button" class="big primary end-again"></button>
             <button type="button" class="big end-spectate"><span>Watch</span></button>
             <button type="button" class="big end-lobby" hidden><span>Lobby</span></button>
           </div>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.end')!;
    this.title = this.el.querySelector('h1')!;
    this.subtitle = this.el.querySelector('.sub')!;
    this.placement = this.el.querySelector('.place')!;
    this.stats = this.el.querySelector('.stats')!;
    this.kept = this.el.querySelector('.kept')!;
    this.again = this.el.querySelector('.end-again')!;
    this.spectate = this.el.querySelector('.end-spectate')!;
    this.again.addEventListener('click', onPlayAgain);
    this.spectate.addEventListener('click', onSpectate);
    this.el.querySelector('.end-menu')!.addEventListener('click', onMenu);
    this.wardrobe = this.el.querySelector('.end-wardrobe')!;
    this.wardrobe.addEventListener('click', onWardrobe);
    this.lobby = this.el.querySelector('.end-lobby')!;
    this.lobby.addEventListener('click', onLobby);
  }

  /** Shows or hides Lobby (it becomes available when the room's match ends). */
  refreshLobby(): void {
    this.lobby.hidden = !this.canLobby();
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(view: EndView): void {
    this.el.dataset.tone = view.tone;
    this.title.textContent = view.title;
    this.subtitle.innerHTML = view.subtitleHtml;
    this.placement.textContent = view.placement;
    // Kept parts arrive separately (after the server rolls them); keep showing them for this match.
    if (!this.keptShown) this.kept.hidden = true;
    this.stats.innerHTML = view.stats.map(([name, value]) => `<div class="stat">${icon(name)}<b>${value}</b></div>`).join('');
    this.spectate.hidden = !view.canSpectate;
    this.again.disabled = !!view.waitingForHost;
    this.again.innerHTML = view.waitingForHost ? `${icon('timer')}<span>Host…</span>` : `<span>Again</span><kbd>Enter</kbd>`;
    this.refreshLobby();
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Shows the card again as it was (back from spectating). */
  reopen(): void {
    this.el.hidden = false;
  }

  /** The Wardrobe button needs a profile. */
  setWardrobe(available: boolean): void {
    this.wardrobe.hidden = !available;
  }

  private keptShown = false;

  /** The parts that went into your collection this match (null: a new match, clear them). */
  setKept(parts: Part[] | null): void {
    this.keptShown = !!parts && parts.length > 0;
    this.kept.hidden = !this.keptShown;
    this.kept.innerHTML = this.keptShown
      ? `${icon('hanger')}${parts!.map((p) => `<span class="kept-part">${partIcon(p.slot, p.animal)}</span>`).join('')}`
      : '';
  }
}
