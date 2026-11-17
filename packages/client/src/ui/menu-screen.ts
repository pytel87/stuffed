import { parseRoomCode } from '@stuffed/sim/net';

export interface MenuActions {
  solo: (name: string) => void;
  create: (name: string) => void;
  join: (name: string, code: string) => void;
}

/** Title menu: your name, Play solo, Create a room, Join with a code. */
export class MenuScreen {
  private readonly el: HTMLElement;
  private readonly name: HTMLInputElement;
  private readonly code: HTMLInputElement;
  private readonly error: HTMLElement;
  private readonly buttons: HTMLButtonElement[];

  constructor(root: HTMLElement, initialName: string, actions: MenuActions) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="menu" hidden>
         <div class="menu-card">
           <h1 class="menu-title">STUFFED</h1>
           <p class="menu-tag">Last plush standing</p>
           <label class="menu-label" for="menu-name">Your name</label>
           <input id="menu-name" class="menu-input" maxlength="16" autocomplete="nickname" spellcheck="false">
           <div class="menu-actions">
             <button type="button" class="menu-solo">Play solo</button>
             <button type="button" class="menu-create">Create a room</button>
           </div>
           <form class="menu-join">
             <label class="menu-label" for="menu-code">Have a room code?</label>
             <div class="menu-join-row">
               <input id="menu-code" class="menu-input menu-code" maxlength="4" placeholder="BNFJ" autocomplete="off" spellcheck="false">
               <button type="submit">Join</button>
             </div>
           </form>
           <p class="menu-error" role="alert"></p>
         </div>
       </div>`,
    );
    this.el = root.querySelector<HTMLElement>('.menu')!;
    this.name = this.el.querySelector('#menu-name')!;
    this.code = this.el.querySelector('#menu-code')!;
    this.error = this.el.querySelector('.menu-error')!;
    this.buttons = [...this.el.querySelectorAll('button')];
    this.name.value = initialName;

    const name = () => this.name.value.trim().slice(0, 16) || 'Plush';
    this.el.querySelector('.menu-solo')!.addEventListener('click', () => actions.solo(name()));
    this.el.querySelector('.menu-create')!.addEventListener('click', () => actions.create(name()));
    this.el.querySelector('.menu-join')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = parseRoomCode(this.code.value);
      if (!code) return this.showError('Room codes are 4 letters, like BNFJ.');
      actions.join(name(), code);
    });
    this.code.addEventListener('input', () => (this.code.value = this.code.value.toUpperCase()));
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.el.hidden = false;
    this.setBusy(false);
    this.name.focus();
  }

  hide(): void {
    this.el.hidden = true;
    this.showError('');
  }

  setBusy(busy: boolean): void {
    for (const b of this.buttons) b.disabled = busy;
  }

  showError(text: string): void {
    this.error.textContent = text;
    this.setBusy(false);
  }
}
