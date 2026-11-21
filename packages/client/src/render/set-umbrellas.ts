// A full set's parasol for the Toss (and catapult glides): the canopy in its animal's colors and
// pattern, so everyone can tell who's coming down. The plain one has a rainbow of panels.
import * as THREE from 'three';
import type { Animal } from '@stuffed/sim';

type Pattern = 'plain' | 'spots' | 'stripes' | 'scales' | 'fluff' | 'hearts';

/** Two panel colors that alternate round the canopy, and the pattern printed on them. */
const LOOKS: Record<Animal, { a: string; b: string; ink: string; pattern: Pattern }> = {
  bear: { a: '#b5835a', b: '#ecd2ac', ink: '#8a5c3a', pattern: 'plain' },
  frog: { a: '#72c25e', b: '#a8de8a', ink: '#3f8a36', pattern: 'spots' },
  shark: { a: '#7f9fbf', b: '#d8e4f0', ink: '#5d7d9e', pattern: 'scales' },
  chicken: { a: '#fbf6ef', b: '#ffd166', ink: '#e2574c', pattern: 'plain' },
  dino: { a: '#45b39d', b: '#9fe0c9', ink: '#2e8a74', pattern: 'scales' },
  owl: { a: '#7a5437', b: '#f3dfb6', ink: '#5a3a22', pattern: 'scales' },
  axolotl: { a: '#ffa98a', b: '#ffe6d8', ink: '#ff7aa8', pattern: 'hearts' },
  penguin: { a: '#34405a', b: '#fbfbfb', ink: '#ffa53b', pattern: 'plain' },
  bunny: { a: '#c7b6ea', b: '#f6f0ff', ink: '#ff9cbf', pattern: 'hearts' },
  unicorn: { a: '#ff9fd2', b: '#b9a2ff', ink: '#fff3a8', pattern: 'hearts' },
  cat: { a: '#f2b85e', b: '#fff3dc', ink: '#c9873a', pattern: 'stripes' },
  fox: { a: '#e8743b', b: '#fff7ee', ink: '#b8521f', pattern: 'plain' },
  panda: { a: '#2f2d38', b: '#f7f5ef', ink: '#5bd16a', pattern: 'plain' },
  pig: { a: '#f7a8b8', b: '#ffd3dc', ink: '#e07a92', pattern: 'hearts' },
  lion: { a: '#e9b24f', b: '#c0652a', ink: '#8e4a1c', pattern: 'plain' },
  elephant: { a: '#a3b3c9', b: '#d8e1ee', ink: '#ff9cbf', pattern: 'spots' },
  turtle: { a: '#6dbf6a', b: '#f2e6a8', ink: '#3f8a36', pattern: 'scales' },
  hedgehog: { a: '#a9774f', b: '#f1d9b8', ink: '#6e4a2c', pattern: 'fluff' },
  koala: { a: '#9aa3ad', b: '#eef0f3', ink: '#6f7885', pattern: 'fluff' },
  octopus: { a: '#b07be0', b: '#f0d9ff', ink: '#8a52c4', pattern: 'spots' },
  mouse: { a: '#c9b19a', b: '#f7ece2', ink: '#ff9cbf', pattern: 'spots' },
  sheep: { a: '#fbf7ef', b: '#d9cbb8', ink: '#b8a68e', pattern: 'fluff' },
  raccoon: { a: '#8e8f9c', b: '#c9c6d2', ink: '#3e3f4a', pattern: 'stripes' },
  bee: { a: '#ffd23f', b: '#ffe680', ink: '#2f2d38', pattern: 'stripes' },
  flamingo: { a: '#ff6fa8', b: '#ffd0e2', ink: '#ff3d86', pattern: 'hearts' },
  giraffe: { a: '#f2c46d', b: '#fff0cf', ink: '#b8742f', pattern: 'spots' },
  sloth: { a: '#9c9a70', b: '#ece6c8', ink: '#6e6c4c', pattern: 'fluff' },
  dragon: { a: '#d64545', b: '#ffd166', ink: '#9e2a2a', pattern: 'scales' },
  phoenix: { a: '#ff7a3d', b: '#ffd166', ink: '#e2352a', pattern: 'scales' },
  yeti: { a: '#f4f8ff', b: '#bfe0ff', ink: '#8fc3ff', pattern: 'fluff' },
  otter: { a: '#9a6a45', b: '#f2dcc0', ink: '#ff8a3d', pattern: 'stripes' },
  mermaid: { a: '#3fc9b8', b: '#ffb3d1', ink: '#2aa596', pattern: 'scales' },
};

/** A panel's fabric: its color with the pattern printed on (white where untouched, so it tints). */
function patternTexture(pattern: Pattern, ink: string): THREE.CanvasTexture | null {
  if (pattern === 'plain') return null;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  g.fillStyle = ink;
  g.strokeStyle = ink;
  // (Nothing near the canopy's top: the panels narrow to a point there and smear what's printed.)
  g.save();
  g.translate(0, S * 0.3);
  g.scale(1, 0.7);
  if (pattern === 'spots') {
    for (const [x, y, r] of [[30, 34, 13], [88, 26, 9], [64, 74, 15], [22, 98, 9], [104, 92, 11]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  } else if (pattern === 'stripes') {
    // Rings round the canopy (the texture's v runs from the top down).
    for (let y = 10; y < S; y += 36) g.fillRect(0, y, S, 16);
  } else if (pattern === 'scales') {
    g.lineWidth = 6;
    for (let row = 0; row < 5; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * 32 + (row % 2) * 16;
        g.beginPath();
        g.arc(x + 16, row * 28 + 6, 15, 0, Math.PI);
        g.stroke();
      }
    }
  } else if (pattern === 'fluff') {
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc((i * 37) % S, (i * 53) % S, 6 + (i % 3) * 2, 0, Math.PI * 2);
      g.fill();
    }
  } else if (pattern === 'hearts') {
    for (const [x, y] of [[32, 32], [92, 40], [60, 90], [20, 100], [108, 104]] as const) {
      g.beginPath();
      g.moveTo(x, y + 10);
      g.bezierCurveTo(x - 16, y - 2, x - 6, y - 14, x, y - 4);
      g.bezierCurveTo(x + 6, y - 14, x + 16, y - 2, x, y + 10);
      g.fill();
    }
  }
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const textures = new Map<Animal, THREE.CanvasTexture | null>();

/** The color and printed pattern of each of a set's `panels` canopy panels, in order. */
export function setUmbrellaPanels(animal: Animal, panels: number): { color: string; map: THREE.Texture | null }[] {
  const look = LOOKS[animal];
  if (!textures.has(animal)) textures.set(animal, patternTexture(look.pattern, look.ink));
  const map = textures.get(animal)!;
  return Array.from({ length: panels }, (_, i) => ({ color: i % 2 ? look.b : look.a, map }));
}
