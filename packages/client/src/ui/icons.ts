// Small icon set in the game's look: chunky rounded strokes in the outline color, flat fills.
// All icons are 24x24 SVG strings; `currentColor` is the stroke, fills are fixed toy colors
// unless noted. Use icon('name') inside innerHTML.

const INK = '#2a1f2d';

const paths: Record<string, string> = {
  // stats
  stuffing: `<path d="M7 18a4 4 0 0 1-.6-8 5 5 0 0 1 9.6-1.5A4 4 0 0 1 17 18Z" fill="#fdfbf7"/>`,
  buttons: `<circle cx="12" cy="12" r="8" fill="#5d9cf5"/><circle cx="9.6" cy="9.6" r="1.2" fill="${INK}" stroke="none"/><circle cx="14.4" cy="9.6" r="1.2" fill="${INK}" stroke="none"/><circle cx="9.6" cy="14.4" r="1.2" fill="${INK}" stroke="none"/><circle cx="14.4" cy="14.4" r="1.2" fill="${INK}" stroke="none"/>`,
  // weapons (side views, barrel to the right)
  cork_popper: `<rect x="3" y="9" width="14" height="5" rx="2.5" fill="#2bb3a6"/><rect x="13" y="8.5" width="2.5" height="6" fill="#f2a03d"/><path d="M6 14v4.5h3.5V14" fill="#2bb3a6"/><rect x="17.5" y="9.5" width="4" height="4" rx="1.5" fill="#d9a066"/>`,
  foam_dart_smg: `<rect x="3" y="8" width="14" height="6" rx="1.5" fill="#f2873d"/><path d="M8 14v6h3v-6" fill="#3d7ff2"/><rect x="17" y="9.5" width="4.5" height="3" rx="1.5" fill="#3d7ff2"/>`,
  super_soaker: `<rect x="2.5" y="11" width="16" height="4.5" rx="2.2" fill="#f7c331"/><circle cx="9" cy="8" r="4" fill="#5fb7f0"/><path d="M5 15.5v4h3v-4" fill="#f7c331"/><rect x="18.5" y="11.6" width="3" height="3.2" rx="1" fill="#e2574c"/>`,
  // items
  cotton_puff: `<circle cx="9" cy="13" r="4.5" fill="#fdfbf7"/><circle cx="15" cy="12" r="4" fill="#fdfbf7"/><circle cx="12" cy="8.5" r="3.6" fill="#fdfbf7"/>`,
  sewing_kit: `<ellipse cx="12" cy="15" rx="8" ry="4.5" fill="#e2577c"/><rect x="11" y="5" width="5" height="8" rx="1.5" fill="#4a7fd6"/><path d="M5 5l8 8" stroke-width="1.6"/>`,
  button_pack: `<circle cx="9" cy="14" r="5" fill="#e2574c"/><circle cx="15" cy="10" r="5" fill="#f7c331"/><circle cx="14" cy="9" r=".9" fill="${INK}" stroke="none"/><circle cx="16" cy="11" r=".9" fill="${INK}" stroke="none"/>`,
  // world
  water: `<path d="M12 3c3.5 4.5 6 7.6 6 10.7A6 6 0 0 1 6 13.7C6 10.6 8.5 7.5 12 3Z" fill="#7fd0f7"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#fff" stroke-width="1.6"/>`,
  chest: `<rect x="3.5" y="10" width="17" height="9" rx="1.5" fill="#d9534f"/><path d="M3.5 10l1.5-4h14l1.5 4Z" fill="#f2c14e"/><path d="M12 12.5l.9 1.8 2 .2-1.5 1.3.5 2-1.9-1.1-1.9 1.1.5-2-1.5-1.3 2-.2Z" fill="#f7d046" stroke-width="1"/>`,
  // actions
  jump: `<path d="M12 4l6 7h-3.5v5h-5v-5H6Z" fill="#fff"/><path d="M6 20h12"/>`,
  hand: `<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11V5a1.5 1.5 0 0 1 3 0v6V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4.3 13a1.5 1.5 0 0 1 2.4-1.8Z" fill="#fff"/>`,
  reload: `<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4v4h-4" />`,
  swap: `<path d="M5 9h13l-3-3M19 15H6l3 3"/>`,
  // ui
  gear: `<circle cx="12" cy="12" r="3" fill="#fff"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/><circle cx="12" cy="12" r="6.5"/>`,
  sound: `<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4Z" fill="#fff"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>`,
  mute: `<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4Z" fill="#fff"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>`,
  fullscreen: `<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  help: `<circle cx="12" cy="12" r="9" fill="#fff"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><circle cx="12" cy="17" r="1" fill="${INK}" stroke="none"/>`,
  home: `<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4Z" fill="#fff"/>`,
  door: `<path d="M5 20V4h9v16" fill="#fff"/><path d="M14 12h7M18 9l3 3-3 3"/><circle cx="11.5" cy="12.5" r=".9" fill="${INK}" stroke="none"/>`,
  play: `<path d="M8 5l11 7-11 7Z" fill="#fff"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  enter: `<path d="M4 12h12M12 8l4 4-4 4"/><path d="M15 4h4v16h-4"/>`,
  share: `<path d="M12 15V4M8 7.5l4-4 4 4"/><path d="M6 11v8h12v-8"/>`,
  copy: `<rect x="8" y="8" width="11" height="12" rx="2" fill="#fff"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>`,
  bot: `<rect x="5" y="8" width="14" height="11" rx="3" fill="#fff"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1.2" fill="${INK}" stroke="none"/><circle cx="9.5" cy="13" r="1.3" fill="${INK}" stroke="none"/><circle cx="14.5" cy="13" r="1.3" fill="${INK}" stroke="none"/>`,
  crown: `<path d="M4 18l1-10 4.5 4L12 6l2.5 6L19 8l1 10Z" fill="#f7c331"/>`,
  person: `<circle cx="12" cy="8" r="4" fill="#fff"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0Z" fill="#fff"/>`,
  trophy: `<path d="M8 4h8v5a4 4 0 0 1-8 0Z" fill="#f7c331"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7l-.8-3h-5.4Z"/>`,
  knockout: `<path d="M12 3l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2Z" fill="#fdfbf7"/>`,
  damage: `<path d="M13 3L6 13h5l-1 8 8-11h-5Z" fill="#f7c331"/>`,
  timer: `<circle cx="12" cy="13" r="7.5" fill="#fff"/><path d="M12 9v4l2.5 2M10 3h4"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="#fff"/><circle cx="12" cy="12" r="3" fill="${INK}" stroke="none"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  arrow: `<path d="M4 12h15M14 7l5 5-5 5"/>`,
  rotate: `<rect x="3" y="7" width="12" height="16" rx="2" fill="#fff" transform="rotate(-90 9 15)"/><path d="M17 3a5 5 0 0 1 4 5M21 4v4h-4"/>`,
  key: `<rect x="3" y="5" width="18" height="14" rx="3" fill="#fff"/>`,
  mouse: `<rect x="6" y="3" width="12" height="18" rx="6" fill="#fff"/><path d="M12 3v6"/>`,
};

/** An icon as inline SVG markup. */
export function icon(name: keyof typeof paths | string, className = 'icon'): string {
  const body = paths[name] ?? paths.help!;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
