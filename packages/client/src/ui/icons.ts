// Small icon set in the game's look: chunky rounded strokes in the outline color, flat fills.
// All icons are 24x24 SVG strings; `currentColor` is the stroke, fills are fixed toy colors
// unless noted. Use icon('name') inside innerHTML.

import type { Animal, PartSlot } from '@stuffed/sim';
import { ANIMAL_COLORS } from '../render/animal-colors.ts';

const INK = '#2a1f2d';

const paths: Record<string, string> = {
  // stats
  // a stitched plush heart: stuffing (health)
  stuffing: `<path d="M12 20.5 4.3 12.8a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 0 1 6.5 6.5Z" fill="#ff5a6e"/>`,
  buttons: `<circle cx="12" cy="12" r="8.5" fill="#ffd23f" stroke="${INK}"/><circle cx="12" cy="12" r="5.6" stroke="#e0a800" stroke-width="1.2"/><circle cx="9.6" cy="9.6" r="1.2" fill="${INK}" stroke="none"/><circle cx="14.4" cy="9.6" r="1.2" fill="${INK}" stroke="none"/><circle cx="9.6" cy="14.4" r="1.2" fill="${INK}" stroke="none"/><circle cx="14.4" cy="14.4" r="1.2" fill="${INK}" stroke="none"/>`,
  // weapons (side views, barrel to the right)
  cork_popper: `<rect x="3" y="9" width="14" height="5" rx="2.5" fill="#2bb3a6"/><rect x="13" y="8.5" width="2.5" height="6" fill="#f2a03d"/><path d="M6 14v4.5h3.5V14" fill="#2bb3a6"/><rect x="17.5" y="9.5" width="4" height="4" rx="1.5" fill="#d9a066"/>`,
  foam_dart_smg: `<rect x="3" y="8" width="14" height="6" rx="1.5" fill="#f2873d"/><path d="M8 14v6h3v-6" fill="#3d7ff2"/><rect x="17" y="9.5" width="4.5" height="3" rx="1.5" fill="#3d7ff2"/>`,
  super_soaker: `<rect x="2.5" y="11" width="16" height="4.5" rx="2.2" fill="#f7c331"/><circle cx="9" cy="8" r="4" fill="#5fb7f0"/><path d="M5 15.5v4h3v-4" fill="#f7c331"/><rect x="18.5" y="11.6" width="3" height="3.2" rx="1" fill="#e2574c"/>`,
  // items
  cotton_puff: `<circle cx="9" cy="13" r="4.5" fill="#fdfbf7"/><circle cx="15" cy="12" r="4" fill="#fdfbf7"/><circle cx="12" cy="8.5" r="3.6" fill="#fdfbf7"/>`,
  sewing_kit: `<ellipse cx="12" cy="15" rx="8" ry="4.5" fill="#e2577c"/><rect x="11" y="5" width="5" height="8" rx="1.5" fill="#4a7fd6"/><path d="M5 5l8 8" stroke-width="1.6"/>`,
  button_pack: `<circle cx="9" cy="14" r="5" fill="#e2574c"/><circle cx="15" cy="10" r="5" fill="#f7c331"/><circle cx="14" cy="9" r=".9" fill="${INK}" stroke="none"/><circle cx="16" cy="11" r=".9" fill="${INK}" stroke="none"/>`,
  button_pile: `<rect x="6" y="7" width="12" height="14" rx="3" fill="#e8f7ff"/><rect x="5.5" y="3.5" width="13" height="4" rx="1.5" fill="#e2433f"/><circle cx="10" cy="16.5" r="2" fill="#3d7ff2" stroke="none"/><circle cx="14.5" cy="15" r="2" fill="#f7c331" stroke="none"/><circle cx="11.5" cy="11.5" r="2" fill="#e2574c" stroke="none"/>`,
  // world
  // stuffing drained of its color: you're out in the Rinse
  drained: `<path d="M12 20.5 4.3 12.8a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 0 1 6.5 6.5Z" fill="#b9b9c2"/>`,
  // Knocked out by something that isn't a plush (the Rinse, an air strike, a map toy).
  broken: `<path d="M12 20.5 4.3 12.8a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 0 1 6.5 6.5Z" fill="#ff5a7a"/><path d="M12.6 7.6 10.4 11l2.6 1.6-2 4.4" stroke="#fffaf3" stroke-width="1.8"/>`,
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
  music: `<path d="M9 17V6l10-2v11"/><circle cx="7" cy="17" r="2.6" fill="#fff"/><circle cx="17" cy="15" r="2.6" fill="#fff"/>`,
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
  // re-stitch a teammate: the same heart as your own stuffing
  revive: `<path d="M12 20.5 4.3 12.8a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 0 1 6.5 6.5Z" fill="#ff5a6e"/>`,
  // the maps: a tree (the Backyard) and a bed (the Bedroom)
  'map-backyard': `<rect x="10.5" y="13" width="3" height="8" rx="1" fill="#a0693f"/><circle cx="12" cy="9.5" r="6.5" fill="#5bb46a"/><path d="M3 21h18" stroke-width="1.8"/>`,
  'map-park': `<circle cx="12" cy="16.5" r="4.5" fill="#fff"/><circle cx="12" cy="9" r="3.2" fill="#fff"/><path d="M8.5 6.2h7M9.8 6.2V3.5h4.4v2.7" fill="#2a1f2d"/><path d="M12 9.3l2.4.6" stroke="#f28a2c" stroke-width="1.6"/>`,
  'map-bedroom': `<rect x="3" y="7" width="3" height="13" rx="1" fill="#a0693f"/><rect x="3" y="13" width="18" height="5" rx="1.5" fill="#f6a5c0"/><rect x="6.5" y="10" width="5" height="3" rx="1.2" fill="#fff"/><path d="M21 18v2" stroke-width="1.8"/>`,
  // signal bars: how tough the bots are
  'level-easy': `<rect x="4" y="16" width="4" height="4" rx="1" fill="#5bd16a"/><rect x="10" y="11" width="4" height="9" rx="1" fill="none"/><rect x="16" y="6" width="4" height="14" rx="1" fill="none"/>`,
  'level-normal': `<rect x="4" y="16" width="4" height="4" rx="1" fill="#f7c331"/><rect x="10" y="11" width="4" height="9" rx="1" fill="#f7c331"/><rect x="16" y="6" width="4" height="14" rx="1" fill="none"/>`,
  'level-hard': `<rect x="4" y="16" width="4" height="4" rx="1" fill="#e2574c"/><rect x="10" y="11" width="4" height="9" rx="1" fill="#e2574c"/><rect x="16" y="6" width="4" height="14" rx="1" fill="#e2574c"/>`,
  // a four-point sparkle: a part you haven't collected yet
  sparkle: `<path d="M12 2.5c.8 4.8 2.7 6.7 7.5 7.5-4.8.8-6.7 2.7-7.5 7.5-.8-4.8-2.7-6.7-7.5-7.5 4.8-.8 6.7-2.7 7.5-7.5Z" fill="#ffd23a"/><path d="M19 15.5c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" fill="#ffd23a" stroke-width="1.4"/>`,
  // two plushies side by side: team mode
  team: `<circle cx="8" cy="9" r="3.2" fill="#5d9cf5"/><path d="M2.5 19.5a5.5 5.5 0 0 1 11 0Z" fill="#5d9cf5"/><circle cx="16" cy="9" r="3.2" fill="#5d9cf5"/><path d="M10.5 19.5a5.5 5.5 0 0 1 11 0Z" fill="#5d9cf5"/>`,
  trophy: `<path d="M8 4h8v5a4 4 0 0 1-8 0Z" fill="#f7c331"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7l-.8-3h-5.4Z"/>`,
  knockout: `<path d="M12 3l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2Z" fill="#fdfbf7"/>`,
  timer: `<circle cx="12" cy="13" r="7.5" fill="#fff"/><path d="M12 9v4l2.5 2M10 3h4"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="#fff"/><circle cx="12" cy="12" r="3" fill="${INK}" stroke="none"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  arrow: `<path d="M4 12h15M14 7l5 5-5 5"/>`,
  // an upright phone, an arrow curving round, the phone lying sideways
  rotate: `<rect x="2.5" y="2.5" width="7" height="11" rx="1.6" fill="#fff"/><path d="M5 11h2" stroke-width="1.5"/><rect x="9.5" y="14" width="12" height="7" rx="1.6" fill="#fff"/><path d="M19 16v3" stroke-width="1.5"/><path d="M13.5 4.5a6 6 0 0 1 5.5 6"/><path d="M17 9.5l2 2 2-2"/>`,
  key: `<rect x="3" y="5" width="18" height="14" rx="3" fill="#fff"/>`,
  mouse: `<rect x="6" y="3" width="12" height="18" rx="6" fill="#fff"/><path d="M12 3v6"/>`,
  // a house key: the recovery code
  code: `<circle cx="8" cy="12" r="4.5" fill="#f7c331"/><circle cx="8" cy="12" r="1.5" fill="#fff"/><path d="M12.5 12H21M18 12v3M21 12v2.5"/>`,
  // a 2x2 grid of little frames: the animal gallery
  gallery: `<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" fill="#ffd36a"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" fill="#ff9cbf"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" fill="#7be07b"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6" fill="#6bc6ff"/>`,
  // a clothes hanger: the Wardrobe
  hanger: `<path d="M12 8.5V7.2a2.2 2.2 0 1 0-2.2-2.2"/><path d="M12 8.5 3.5 15.5a1.2 1.2 0 0 0 .8 2h15.4a1.2 1.2 0 0 0 .8-2Z" fill="#fff"/>`,
  // a little sack with a drawstring: the part stash
  stash: `<path d="M8 8h8l3 5.5a6 6 0 0 1-5.4 7.5h-3.2A6 6 0 0 1 5 13.5Z" fill="#d9a066"/><path d="M8 8l-1-3.5h10L16 8"/><path d="M9.5 8.5h5"/>`,
};

/** Slot shapes for skin parts, drawn in the animal's colors (main `M`, belly `B`). */
const PART_SHAPES: Record<PartSlot, string> = {
  head: `<circle cx="12" cy="13" r="7.5" fill="M"/><ellipse cx="12" cy="15.5" rx="3.2" ry="2.4" fill="B"/><circle cx="9" cy="11.5" r="1.1" fill="${INK}" stroke="none"/><circle cx="15" cy="11.5" r="1.1" fill="${INK}" stroke="none"/>`,
  body: `<ellipse cx="12" cy="12.5" rx="7.5" ry="8.5" fill="M"/><ellipse cx="12" cy="14" rx="4" ry="4.8" fill="B"/>`,
  legs: `<rect x="6.5" y="3.5" width="4" height="12" rx="2" fill="M"/><rect x="13.5" y="3.5" width="4" height="12" rx="2" fill="M"/><ellipse cx="7.5" cy="18.5" rx="3.5" ry="2" fill="B"/><ellipse cx="16.5" cy="18.5" rx="3.5" ry="2" fill="B"/>`,
  tail: `<path d="M5 19c0-8 5-14 14-14-1.5 3-1.2 6 .5 8.5C14 13 9 15 5 19Z" fill="M"/><path d="M15.5 6.5c2 .2 3.5-.6 3.5-1.5" stroke-width="1.5"/>`,
  accessory: `<path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7Z" fill="M"/><circle cx="12" cy="12" r="2" fill="B"/>`,
};

/** What tells the heads apart, drawn behind the head shape. */
const HEAD_EXTRAS: Record<Animal, string> = {
  bear: `<circle cx="6.5" cy="7" r="3" fill="M"/><circle cx="17.5" cy="7" r="3" fill="M"/>`,
  frog: `<circle cx="8" cy="7" r="3.2" fill="M"/><circle cx="16" cy="7" r="3.2" fill="M"/>`,
  shark: `<path d="M12 1.5l3 5h-6Z" fill="M"/>`,
  chicken: `<circle cx="9.5" cy="5.5" r="2" fill="#e2574c"/><circle cx="12.5" cy="4.5" r="2.4" fill="#e2574c"/><circle cx="15.5" cy="5.8" r="1.8" fill="#e2574c"/>`,
  dino: `<path d="M9 6l1.5-3.5L12 6M12 5.5l1.5-3.5L15 5.5" fill="#f0a93b"/>`,
  owl: `<path d="M5.5 8L5 2.5l4 3.5M18.5 8l.5-5.5-4 3.5" fill="M"/>`,
  axolotl: `<path d="M4.5 10l-3-2.5M4.5 13H1M4.5 16l-3 2.5M19.5 10l3-2.5M19.5 13H23M19.5 16l3 2.5" stroke="#ff5f97" stroke-width="2.2"/>`,
  penguin: ``,
  bunny: `<rect x="7" y="0.5" width="3.6" height="9" rx="1.8" fill="M"/><rect x="13.4" y="0.5" width="3.6" height="9" rx="1.8" fill="M"/>`,
  unicorn: `<path d="M12 0.5l1.8 6h-3.6Z" fill="#f7c331"/><circle cx="19" cy="9" r="2.4" fill="#ff6b8a"/><circle cx="20" cy="13" r="2.2" fill="#6bc6ff"/>`,
  cat: `<path d="M4.5 9l1-6.5 5 3.5M19.5 9l-1-6.5-5 3.5" fill="M"/>`,
  fox: `<path d="M4.5 9.5l.5-7.5 5.5 4M19.5 9.5l-.5-7.5-5.5 4" fill="M"/>`,
  panda: `<circle cx="6.5" cy="7" r="3" fill="#2f2d38"/><circle cx="17.5" cy="7" r="3" fill="#2f2d38"/>`,
  pig: `<path d="M5 9l1-5 4 3M19 9l-1-5-4 3" fill="M"/>`,
  lion: `<circle cx="12" cy="13" r="10.5" fill="#c0652a"/>`,
  elephant: `<ellipse cx="4.5" cy="12" rx="4" ry="5.5" fill="M"/><ellipse cx="19.5" cy="12" rx="4" ry="5.5" fill="M"/>`,
  turtle: ``,
  hedgehog: `<path d="M3 13l1-4 2 2 1-5 2 3 3-6 3 6 2-3 1 5 2-2 1 4" fill="#6b4630"/>`,
  koala: `<circle cx="5" cy="9" r="4.2" fill="M"/><circle cx="19" cy="9" r="4.2" fill="M"/>`,
  octopus: `<path d="M5 18c-1 2-2 3-3 3M9 19c0 2-1 3-2 3M15 19c0 2 1 3 2 3M19 18c1 2 2 3 3 3" stroke="M" stroke-width="2.2"/>`,
  mouse: `<circle cx="5.5" cy="7" r="4" fill="M"/><circle cx="18.5" cy="7" r="4" fill="M"/>`,
  sheep: `<circle cx="7" cy="5.5" r="3" fill="M"/><circle cx="12" cy="4" r="3.2" fill="M"/><circle cx="17" cy="5.5" r="3" fill="M"/>`,
  raccoon: `<path d="M4.5 9.5l1-6.5 5 3.5M19.5 9.5l-1-6.5-5 3.5" fill="M"/>`,
  bee: `<path d="M9.5 6L7 1.5M14.5 6L17 1.5" stroke-width="1.6"/><circle cx="7" cy="1.8" r="1.4" fill="#2a1f2d"/><circle cx="17" cy="1.8" r="1.4" fill="#2a1f2d"/>`,
  flamingo: ``,
  giraffe: `<path d="M9 6V2M15 6V2" stroke-width="2"/><circle cx="9" cy="2" r="1.6" fill="#b5793b"/><circle cx="15" cy="2" r="1.6" fill="#b5793b"/>`,
  sloth: ``,
  dragon: `<path d="M7.5 6.5L6 1.5l4 3.5M16.5 6.5L18 1.5l-4 3.5" fill="#fff3d6"/>`,
  phoenix: `<path d="M12 5.5L10 0.5l2.5 2.5L14 0.5Z" fill="#ffcf3d"/>`,
  yeti: `<path d="M4 9l1.5-3 1.5 2 1.5-3.5 2 2.5 1.5-3 1.5 3 2-2.5 1.5 3.5 1.5-2 1.5 3" fill="M"/>`,
};
/** ...and in front of it. */
const HEAD_FRONT: Partial<Record<Animal, string>> = {
  chicken: `<path d="M10.5 14.5h3L12 17.5Z" fill="#f0a93b" stroke-width="1.5"/>`,
  shark: `<path d="M8.5 16.5l1 1 1-1 1 1 1-1 1 1 1-1 1 1" stroke-width="1.3"/>`,
  owl: `<path d="M11 14h2l-1 2.5Z" fill="#f0a93b" stroke-width="1.3"/>`,
  penguin: `<path d="M10.5 14.5h3L12 17Z" fill="#f7a531" stroke-width="1.3"/>`,
  bunny: `<path d="M11 14.5h2l-1 1.2Z" fill="#ff9cbf" stroke-width="1.2"/>`,
  cat: `<path d="M11 14.5h2l-1 1.2Z" fill="#ff9cbf" stroke-width="1.2"/>`,
  fox: `<path d="M9.5 15.5l2.5 3.5 2.5-3.5" fill="#fff7ee" stroke-width="1.3"/>`,
  panda: `<ellipse cx="9" cy="11.8" rx="1.9" ry="2.4" fill="#2f2d38" stroke="none"/><ellipse cx="15" cy="11.8" rx="1.9" ry="2.4" fill="#2f2d38" stroke="none"/>`,
  pig: `<ellipse cx="12" cy="15.5" rx="3" ry="2.2" fill="#ff8fa6" stroke-width="1.3"/>`,
  elephant: `<path d="M12 14v5.5c0 1.5 2 1.5 2 0" stroke-width="2.4"/>`,
  turtle: `<path d="M9.5 16c1.5 1.5 3.5 1.5 5 0" stroke-width="1.3"/>`,
  koala: `<ellipse cx="12" cy="14.5" rx="2" ry="2.6" fill="#3a3440" stroke="none"/>`,
  mouse: `<circle cx="12" cy="14.5" r="1.2" fill="#ff7aa8" stroke="none"/>`,
  sheep: `<ellipse cx="12" cy="13.5" rx="5" ry="5.5" fill="#5a4b55" stroke="none"/>`,
  raccoon: `<path d="M5 11.5c2-2 5-2 7 0 2-2 5-2 7 0" stroke="#3a3640" stroke-width="3"/>`,
  flamingo: `<path d="M12 14c3 0 4 1.5 3 4" stroke="#fff3e6" stroke-width="2.4"/>`,
  sloth: `<path d="M7 10.5l3 2M17 10.5l-3 2" stroke="#5e4632" stroke-width="2.6"/>`,
  phoenix: `<path d="M11 14.5h2l-1 2.5Z" fill="#f7c331" stroke-width="1.3"/>`,
  yeti: `<ellipse cx="12" cy="13.5" rx="4.5" ry="4" fill="#8fb6e8" stroke="none"/>`,
};

/** A skin part as a slot shape in its animal's colors. */
export function partIcon(slot: PartSlot, animal: Animal, className = 'icon'): string {
  const picture = modelPictures.get(`part:${slot}:${animal}`);
  if (picture) return `<img class="${className} model" src="${picture}" alt="" draggable="false">`;
  const c = ANIMAL_COLORS[animal];
  const shape = slot === 'head' ? HEAD_EXTRAS[animal] + PART_SHAPES.head + (HEAD_FRONT[animal] ?? '') : PART_SHAPES[slot];
  const body = shape.replaceAll('fill="M"', `fill="${c.main}"`).replaceAll('fill="B"', `fill="${c.belly}"`);
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Pictures of the real models (weapons, items, the chest), rendered at startup. */
const modelPictures = new Map<string, string>();

export function setModelPictures(pictures: Map<string, string>): void {
  for (const [name, url] of pictures) modelPictures.set(name, url);
}

/** An icon as inline markup: the model's picture if there is one, else a drawn SVG. */
export function icon(name: keyof typeof paths | string, className = 'icon'): string {
  const picture = modelPictures.get(name);
  if (picture) return `<img class="${className} model" src="${picture}" alt="" draggable="false">`;
  // 'chest:high' falls back to the drawn 'chest'.
  const body = paths[name] ?? paths[name.split(':')[0]!] ?? paths.help!;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
