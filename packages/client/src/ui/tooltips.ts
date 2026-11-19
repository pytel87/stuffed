// Tooltips for the menus' icon buttons: their label (aria-label) in a little bubble, after a moment's
// hover with a mouse, or a long press on touch (which then doesn't press the button).

/** Where buttons get tooltips: the cards, the options, the ⚙ and the spectate bar (not the in-match HUD). */
const MENUS = '.overlay, .sheet, .gear, #spectating';
/** Milliseconds of hovering before it shows. */
const HOVER = 600;
/** Milliseconds of pressing (touch) before it shows, and how long it stays after the finger lifts. */
const PRESS = 450;
const LINGER = 1200;

export function installTooltips(): void {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);

  let timer = 0;
  let target: HTMLElement | null = null;
  /** A long press just showed the tooltip: the click it ends with doesn't press the button. */
  let swallowClick = false;

  const labelled = (el: EventTarget | null): HTMLElement | null => {
    const button = (el as Element | null)?.closest?.<HTMLElement>('button[aria-label]') ?? null;
    return button && button.closest(MENUS) ? button : null;
  };
  const show = (el: HTMLElement) => {
    const text = el.getAttribute('aria-label');
    if (!text || !el.isConnected) return;
    tip.textContent = text;
    tip.hidden = false;
    // Above the button (below it near the top of the screen), kept on screen.
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
    const y = r.top - t.height - 8 < 8 ? r.bottom + 8 : r.top - t.height - 8;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const hide = () => {
    clearTimeout(timer);
    tip.hidden = true;
    target = null;
  };

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = labelled(e.target);
    if (el === target) return;
    hide();
    if (!el) return;
    target = el;
    timer = window.setTimeout(() => show(el), HOVER);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'mouse' && !labelled(e.relatedTarget)) hide();
  });
  document.addEventListener('pointerdown', (e) => {
    hide();
    swallowClick = false;
    if (e.pointerType === 'mouse') return;
    const el = labelled(e.target);
    if (!el) return;
    target = el;
    timer = window.setTimeout(() => {
      show(el);
      swallowClick = true;
    }, PRESS);
  });
  document.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(timer);
    if (swallowClick) timer = window.setTimeout(hide, LINGER);
    else hide();
  });
  document.addEventListener('pointercancel', hide);
  document.addEventListener('keydown', hide);
  addEventListener('scroll', hide, true);
  // (Capturing, and installed before the menu click sound, so a long press is silent too.)
  document.addEventListener(
    'click',
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
}
