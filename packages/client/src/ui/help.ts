import { icon, partIcon } from './icons.ts';
import { tr } from '../i18n.ts';

const keys = (...k: string[]) => k.map((x) => `<kbd>${x}</kbd>`).join('');

/** Controls at a glance, with icons: keyboard and mouse, or touch, whichever is in use. */
export class Help {
  private readonly el: HTMLElement;

  constructor() {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="overlay help" hidden>
         <div class="card">
           <button type="button" class="round close" aria-label="${tr('Close')}">${icon('close')}</button>
           <div class="help-body"></div>
           <p class="legal"><a href="${tr('/privacy.html')}" target="_blank" rel="noopener">${tr('Privacy')}</a> · <a href="${tr('/terms.html')}" target="_blank" rel="noopener">${tr('Terms')}</a> · <a href="mailto:hello@pluffs.cz">hello@pluffs.cz</a></p>
         </div>
       </div>`,
    );
    this.el = document.querySelector<HTMLElement>('.help')!;
    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  /** Filled in when shown: by then the real models' pictures are rendered (at startup there are
   *  only the drawn fallbacks). */
  show(): void {
    this.el.querySelector('.help-body')!.innerHTML = `
      <div class="help-grid desk">
        <span>${keys('W', 'A', 'S', 'D')}</span><span>${icon('person')}</span>
        <span>${icon('mouse')}</span><span>${icon('cork_popper')}</span>
        <span>${keys(tr('Space'))}</span><span>${icon('jump')}</span>
        <span>${keys('E')}</span><span>${icon('hand')} ${icon('chest:medium')} ${partIcon('head', 'shark')}</span>
        <span>${keys('Q')}</span><span>${icon('stash')} ${icon('swap')}</span>
        <span>${keys('1', '2')}</span><span>${icon('swap')}</span>
        <span>${keys('R')}</span><span>${icon('reload')}</span>
        <span>${keys('3', '4', '5')}</span><span>${icon('cotton_puff')} ${icon('patch_pack')} ${icon('juice_box')}</span>
      </div>
      <div class="help-touch">
        <div class="pad"><div class="stick"><div class="stick-knob"></div></div>${icon('person')}</div>
        <div class="pad"><div class="stick"><div class="stick-knob aim"></div></div>${icon('cork_popper')}</div>
        <div class="pad">${icon('jump', 'icon large')} ${icon('hand', 'icon large')}</div>
      </div>`;
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
