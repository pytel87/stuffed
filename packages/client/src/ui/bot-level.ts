// How tough the bots are: three buttons (one, two or three bars), remembered on this device.
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

/** The row's HTML: a bot and the three levels. */
export function botLevelHtml(): string {
  const labels: Record<BotLevel, string> = { easy: 'Easy bots', normal: 'Normal bots', hard: 'Hard bots' };
  return `<div class="bot-level" role="group" aria-label="Bot difficulty">${icon('bot')}${BOT_LEVELS.map(
    (l) => `<button type="button" class="round level" data-level="${l}" aria-label="${labels[l]}">${icon(`level-${l}`)}</button>`,
  ).join('')}</div>`;
}

/** Wires a row made by botLevelHtml(); `onChange` hears the new level. */
export function bindBotLevel(row: HTMLElement, onChange: (level: BotLevel) => void = () => {}): void {
  const buttons = [...row.querySelectorAll<HTMLButtonElement>('.level')];
  const show = (level: BotLevel) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
  show(savedBotLevel());
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const level = b.dataset.level as BotLevel;
      try {
        localStorage.setItem(KEY, level);
      } catch {
        // not remembered; fine
      }
      show(level);
      onChange(level);
    });
  }
}
