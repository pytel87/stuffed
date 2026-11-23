import { icon, partIcon } from './icons.ts';
import { tr } from '../i18n.ts';

const keys = (...k: string[]) => k.map((x) => `<kbd>${x}</kbd>`).join('');
/** One line of the desk controls: the keys, what it's about, and in a few words what it does. */
const row = (k: string, pictures: string, text: string) => `<span class="keys">${k}</span><span class="pics">${pictures}</span><span class="what">${text}</span>`;

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
           <div class="edge-links">
             <a class="edge-pill" href="${tr('/privacy')}" target="_blank" rel="noopener">${tr('Privacy')}</a>
             <a class="edge-pill" href="${tr('/terms')}" target="_blank" rel="noopener">${tr('Terms')}</a>
             <a class="edge-pill" href="mailto:hello@pluffs.cz" title="hello@pluffs.cz">${tr('Contact')}</a>
           </div>
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
        ${row(keys('W', 'A', 'S', 'D'), icon('person'), tr('Walk'))}
        ${row(icon('mouse'), icon('cork_popper'), tr('Aim, click to shoot'))}
        ${row(keys(tr('Space')), icon('jump'), tr('Jump'))}
        ${row(keys('E'), `${icon('hand')} ${icon('chest:medium')} ${partIcon('head', 'shark')}`, tr('Pick up, hold to open a chest'))}
        ${row(keys('Q'), icon('stash'), tr('Bag: keep a part for later'))}
        ${row(`${keys('1', '2')}<span class="or">/</span>${icon('mouse')}`, icon('swap'), tr('Switch weapons (or the wheel)'))}
        ${row(keys('R'), icon('reload'), tr('Reload the weapon'))}
        ${row(keys('G'), icon('cork_popper'), tr('Drop the weapon'))}
        ${row(keys('3', '4', '5'), `${icon('cotton_puff')} ${icon('patch_pack')} ${icon('juice_box')}`, tr('Use an item'))}
      </div>
      <div class="help-touch">
        <div class="demo-screen" aria-hidden="true">
          <div class="demo-items">${['cotton_puff', 'patch_pack', 'juice_box'].map((k) => `<span class="demo-slot">${icon(k)}</span>`).join('')}</div>
          <div class="demo-half demo-left">
            <div class="demo-stick"><div class="demo-knob move"></div></div>
          </div>
          <div class="demo-half demo-right">
            <div class="demo-stick"><div class="demo-ring"></div><div class="demo-knob aim"></div></div>
          </div>
          <span class="demo-btn demo-jump">${icon('jump')}</span>
          <span class="demo-btn demo-grab">${icon('hand')}</span>
          <span class="demo-btn demo-stash">${icon('stash')}</span>
        </div>
        <ul class="demo-notes">
          <li><span class="demo-dot move"></span><span>${tr('Left thumb anywhere: walk')}</span></li>
          <li><span class="demo-dot aim"></span><span>${tr('Right thumb: aim, drag further to shoot')}</span></li>
          <li>${icon('jump')}<span>${tr('Jump')}</span></li>
          <li>${icon('hand')}<span>${tr('Pick up, hold to open a chest')}</span></li>
          <li>${icon('stash')}<span>${tr('Bag: keep a part for later')}</span></li>
          <li>${icon('cotton_puff')}<span>${tr('Items: tap to use, hold to drop')}</span></li>
        </ul>
      </div>`;
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
