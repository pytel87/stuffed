// A card's passing message (an error, a hint): the pill on the card's bottom edge (see .card
// .error) pops in, stays a few seconds and fades away. The same on every card.

/** Shows `text` in `el` (the card's .error) for a few seconds; '' clears it at once. */
export function flashMessage(el: HTMLElement, text: string): void {
  el.classList.remove('flash');
  el.textContent = text;
  if (!text) return;
  // Restart the animation (the same message again plays it again).
  void el.offsetWidth;
  el.classList.add('flash');
  el.onanimationend = (e) => {
    if (e.target !== el || el.textContent !== text) return;
    el.classList.remove('flash');
    el.textContent = '';
  };
}
