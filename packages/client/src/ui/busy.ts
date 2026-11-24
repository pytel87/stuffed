// Waiting on the server (signing in, a code, a purchase): what was tapped says so. A button shows
// a small turning ring in place of its label; a part of a card (the account) dims under one. Only
// after a moment, so quick answers don't flash it, and nothing in it can be pressed meanwhile.

/** How long an answer may take before the ring shows (ms). */
const SHOW_AFTER = 150;

/** Marks `target` busy until `work` settles, and gives back its result. */
export async function whileBusy<T>(target: HTMLElement, work: Promise<T>): Promise<T> {
  target.setAttribute('aria-busy', 'true');
  const controls = [...(target.matches('button, input') ? [target] : []), ...target.querySelectorAll('button, input')].filter(
    (c): c is HTMLButtonElement | HTMLInputElement => (c instanceof HTMLButtonElement || c instanceof HTMLInputElement) && !c.disabled,
  );
  for (const c of controls) c.disabled = true;
  const timer = setTimeout(() => target.classList.add('busy'), SHOW_AFTER);
  try {
    return await work;
  } finally {
    clearTimeout(timer);
    target.classList.remove('busy');
    target.removeAttribute('aria-busy');
    // (Only if it's still there: the work may have replaced it.)
    for (const c of controls) if (c.isConnected) c.disabled = false;
  }
}
