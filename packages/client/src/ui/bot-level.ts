// How tough the bots are: one button cycling one, two or three bars, remembered on this device.
// Shown on the title menu (solo) and in a room's lobby (the host's choice).
import { BOT_LEVELS } from '@stuffed/sim';
import type { BotLevel } from '@stuffed/sim';
import { icon } from './icons.ts';

const KEY = 'stuffed.botLevel';

export function savedBotLevel(): BotLevel {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (BOT_LEVELS as readonly string[]).includes(v)) return v as BotLevel;
  } catch {
    // storage blocked: the default
  }
  return 'normal';
}

const LABELS: Record<BotLevel, string> = { easy: 'Easy bots', normal: 'Normal bots', hard: 'Hard bots' };

/** One round button showing the level (one, two or three bars); a tap moves to the next. */
export function botLevelHtml(): string {
  return `<button type="button" class="round bot-level" aria-label="Bot difficulty"></button>`;
}

/** Wires a button made by botLevelHtml(); `onChange` hears the new level. */
export function bindBotLevel(button: HTMLButtonElement, onChange: (level: BotLevel) => void = () => {}): void {
  let level = savedBotLevel();
  const show = () => {
    button.innerHTML = icon(`level-${level}`);
    button.dataset.level = level;
    button.setAttribute('aria-label', LABELS[level]);
  };
  show();
  button.addEventListener('click', (e) => {
    // A tap or click (not the keyboard): no lingering focus ring.
    if (e.detail > 0) button.blur();
    level = BOT_LEVELS[(BOT_LEVELS.indexOf(level) + 1) % BOT_LEVELS.length]!;
    try {
      localStorage.setItem(KEY, level);
    } catch {
      // not remembered; fine
    }
    show();
    onChange(level);
  });
}
