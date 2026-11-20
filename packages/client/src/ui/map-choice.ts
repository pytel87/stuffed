// Which map to play: one round button showing the map (a tree for the Backyard, a bed for the
// Bedroom); a tap moves to the next. Remembered on this device. On the title menu (solo) and
// in a room's lobby (the host's choice).
import { getMap, PLAYABLE_MAPS } from '@stuffed/sim';
import type { MapData } from '@stuffed/sim';
import { icon } from './icons.ts';
import { tr } from '../i18n.ts';

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

const mapName = (map: MapData) => tr(map.id === 'bedroom' ? 'Bedroom' : map.id === 'park' ? 'Snowy Park' : 'Backyard');

function remember(map: MapData): void {
  try {
    localStorage.setItem(KEY, map.id);
  } catch {
    // not remembered; fine
  }
}

/** Every map side by side, the chosen one picked out (the lobby's Map section). */
export function mapPickerHtml(): string {
  return `<div class="bots map-picker" role="radiogroup" aria-label="${tr('Map')}">${PLAYABLE_MAPS.map(
    (m) => `<button type="button" class="round map-pick" role="radio" data-map="${m.id}" aria-label="${mapName(m)}">${icon(`map-${m.id}`)}</button>`,
  ).join('')}</div>`;
}

/** Wires a picker made by mapPickerHtml(): a tap picks that map (remembered on this device). */
export function bindMapPicker(picker: HTMLElement, onChange: (map: MapData) => void = () => {}): void {
  const show = (id: string) =>
    picker.querySelectorAll<HTMLButtonElement>('.map-pick').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.map === id)));
  show(savedMap().id);
  picker.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.map-pick');
    if (!b) return;
    if (e.detail > 0) b.blur();
    const map = getMap(b.dataset.map!);
    remember(map);
    show(map.id);
    onChange(map);
  });
}

export function mapChoiceHtml(): string {
  return `<button type="button" class="round map-choice" aria-label="${tr('Map')}"></button>`;
}

/** Wires a button made by mapChoiceHtml(); `onChange` hears the new map. */
export function bindMapChoice(button: HTMLButtonElement, onChange: (map: MapData) => void = () => {}): void {
  let map = savedMap();
  const show = () => {
    button.innerHTML = icon(`map-${map.id}`);
    button.setAttribute('aria-label', mapName(map));
  };
  show();
  button.addEventListener('click', (e) => {
    if (e.detail > 0) button.blur();
    const i = PLAYABLE_MAPS.findIndex((m) => m.id === map.id);
    map = PLAYABLE_MAPS[(i + 1) % PLAYABLE_MAPS.length]!;
    remember(map);
    show();
    onChange(map);
  });
}
