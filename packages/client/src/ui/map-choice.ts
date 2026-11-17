// Which map to play: one round button showing the map (a tree for the Backyard, a bed for the
// Bedroom); a tap moves to the next. Remembered on this device. On the title menu (solo) and
// in a room's lobby (the host's choice).
import { getMap, PLAYABLE_MAPS } from '@stuffed/sim';
import type { MapData } from '@stuffed/sim';
import { icon } from './icons.ts';

const KEY = 'stuffed.map';

export function savedMap(): MapData {
  try {
    const id = localStorage.getItem(KEY);
    if (id && PLAYABLE_MAPS.some((m) => m.id === id)) return getMap(id);
  } catch {
    // storage blocked: the default
  }
  return PLAYABLE_MAPS[0]!;
}

export function mapChoiceHtml(): string {
  return `<button type="button" class="round map-choice" aria-label="Map"></button>`;
}

/** Wires a button made by mapChoiceHtml(); `onChange` hears the new map. */
export function bindMapChoice(button: HTMLButtonElement, onChange: (map: MapData) => void = () => {}): void {
  let map = savedMap();
  const show = () => {
    button.innerHTML = icon(`map-${map.id}`);
    button.setAttribute('aria-label', map.id === 'bedroom' ? 'Bedroom' : 'Backyard');
  };
  show();
  button.addEventListener('click', (e) => {
    if (e.detail > 0) button.blur();
    const i = PLAYABLE_MAPS.findIndex((m) => m.id === map.id);
    map = PLAYABLE_MAPS[(i + 1) % PLAYABLE_MAPS.length]!;
    try {
      localStorage.setItem(KEY, map.id);
    } catch {
      // not remembered; fine
    }
    show();
    onChange(map);
  });
}
