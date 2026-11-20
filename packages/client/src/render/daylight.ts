// The light over a match: daylight while the Rinse waits, easing through late afternoon and golden
// hour to a sunset as it closes in (the final circle at sunset). Only the sky's and the sun's color,
// strength and angle change, worked out from the match state, so everyone sees the same light.
// Indoors (the Bedroom) the evening is warm lamp light rather than an orange sun.
import * as THREE from 'three';
import type { GameState, MapData } from '@stuffed/sim';

interface Light {
  /** Hemisphere light: sky color, ground color, strength. */
  sky: string;
  ground: string;
  hemi: number;
  /** The sun: color, strength, and where it shines from (relative to what it lights). */
  sun: string;
  power: number;
  from: [number, number, number];
}

/** Day, late afternoon, golden hour, sunset. */
const OUTDOORS: Light[] = [
  { sky: '#ffffff', ground: '#9a8aa8', hemi: 1.25, sun: '#ffffff', power: 2.1, from: [-8, 20, 10] },
  { sky: '#fff8ec', ground: '#a090a6', hemi: 1.2, sun: '#fff0d8', power: 2.15, from: [-11, 17, 9] },
  { sky: '#fff0d6', ground: '#a68a96', hemi: 1.12, sun: '#ffd29a', power: 2.25, from: [-15, 13, 8] },
  { sky: '#ffe2cc', ground: '#8e76a2', hemi: 1.06, sun: '#ffc08e', power: 2.05, from: [-20, 8, 5] },
];
/** The snow takes on color far more than grass: an even gentler sunset there. */
const SNOW: Light[] = [
  ...OUTDOORS.slice(0, 2),
  { sky: '#fff4e6', ground: '#a690a0', hemi: 1.12, sun: '#ffe2bc', power: 2.2, from: [-15, 13, 8] },
  { sky: '#ffeee2', ground: '#9a84aa', hemi: 1.08, sun: '#ffd2b2', power: 2.05, from: [-20, 8, 5] },
];
const INDOORS: Light[] = [
  OUTDOORS[0]!,
  { sky: '#fffaf0', ground: '#a092a4', hemi: 1.22, sun: '#fff4e2', power: 2.1, from: [-10, 18, 9] },
  { sky: '#fff2dc', ground: '#a48c98', hemi: 1.16, sun: '#ffe2b4', power: 2.1, from: [-13, 15, 8] },
  { sky: '#ffe2c6', ground: '#8c7294', hemi: 1.08, sun: '#ffc890', power: 1.85, from: [-16, 11, 6] },
];

/** How long the sun's offset is (what the shadow camera's depth range is set for). */
const SUN_DISTANCE = Math.hypot(-8, 20, 10);
/** The sun's angle moves in this many steps over the match (each step shifts shadows a little;
 *  moving it every frame would make their edges crawl). */
const SUN_STEPS = 100;

/** How far into the evening the match is: 0 while the Rinse waits, 1 by the final circle. */
export function evening(state: GameState): number {
  const z = state.zone;
  if (z.stage === 'waiting') return 0;
  if (z.stage === 'closed') return 1;
  const k = (state.tick - z.startTick) / Math.max(1, z.endTick - z.startTick);
  // At sunset a little before the water closes completely: the final circle.
  const t = Math.min(1, Math.max(0, k / 0.85));
  return t * t * (3 - 2 * t);
}

const a = new THREE.Color();
const b = new THREE.Color();

export class Daylight {
  /** Where the sun shines from, relative to what it lights (its length kept the same). */
  readonly sunOffset = new THREE.Vector3(...OUTDOORS[0]!.from);

  constructor(
    private readonly hemi: THREE.HemisphereLight,
    private readonly sun: THREE.DirectionalLight,
  ) {}

  /** Sets the light for `t` (0 day .. 1 sunset) on `map`. */
  apply(map: MapData, t: number): void {
    const keys = map.theme === 'bedroom' ? INDOORS : map.theme === 'snow' ? SNOW : OUTDOORS;
    const at = Math.min(1, Math.max(0, t)) * (keys.length - 1);
    const i = Math.min(keys.length - 2, Math.floor(at));
    const k = at - i;
    const from = keys[i]!;
    const to = keys[i + 1]!;
    this.hemi.color.lerpColors(a.set(from.sky), b.set(to.sky), k);
    this.hemi.groundColor.lerpColors(a.set(from.ground), b.set(to.ground), k);
    this.hemi.intensity = from.hemi + (to.hemi - from.hemi) * k;
    this.sun.color.lerpColors(a.set(from.sun), b.set(to.sun), k);
    this.sun.intensity = from.power + (to.power - from.power) * k;
    // The angle in steps (see SUN_STEPS).
    const stepped = Math.round(t * SUN_STEPS) / SUN_STEPS;
    const at2 = stepped * (keys.length - 1);
    const j = Math.min(keys.length - 2, Math.floor(at2));
    const q = at2 - j;
    const f = keys[j]!.from;
    const g = keys[j + 1]!.from;
    this.sunOffset.set(f[0] + (g[0] - f[0]) * q, f[1] + (g[1] - f[1]) * q, f[2] + (g[2] - f[2]) * q).setLength(SUN_DISTANCE);
  }
}
