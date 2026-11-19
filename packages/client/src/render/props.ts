// Backyard props: how each kind of wall looks. The sim only knows a box and its height; here it
// becomes a brick wall, a crate, a bench, a sandcastle... All code-built, toon-shaded and outlined,
// with small canvas textures (one per kind, shared).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Wall } from '@stuffed/sim';
import { detailMaps, noteClone, repeated, upgradeTexture } from './image-textures.ts';
import type { ImageOptions } from './image-textures.ts';
import { darken, feltTexture, lighten, makePlastic, makeTriplanar, outlineMaterial, OUTLINE_COLOR, pushedOutlineMaterial, toonMaterial, toonMesh } from './toon.ts';

const OUTLINE = 0.03;

/** Box mesh with a constant-width outline (scaling a hull would make long walls uneven), kept
 *  behind any box it touches (see pushedOutlineMaterial). */
export function outlinedBox(w: number, h: number, d: number, material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), pushedOutlineMaterial(OUTLINE_COLOR));
  mesh.add(hull);
  return mesh;
}

/** A rounded box (a pillow, a slide's rail) with a snug outline as wide all round (see outlinedBox). */
export function softBox(w: number, h: number, d: number, radius: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
  mesh.receiveShadow = true;
  const hull = new THREE.Mesh(new RoundedBoxGeometry(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2, 3, radius + OUTLINE), pushedOutlineMaterial(OUTLINE_COLOR));
  // (Named so a faded ramp hides it, like toonMesh's.)
  hull.name = 'outline';
  mesh.add(hull);
  return mesh;
}

// ---------- textures ----------

const textures = new Map<string, THREE.CanvasTexture>();

/** A small repeating canvas texture, drawn once per name. */
function canvasTexture(name: string, size: number, draw: (g: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  let tex = textures.get(name);
  if (!tex) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d')!, size);
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(name, tex);
  }
  return tex;
}

/** The shared texture, repeated `rx` x `ry` times (a clone shares the image). */
export function tiled(tex: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  noteClone(tex, t);
  return t;
}

/** Render-only randomness for textures, seeded so they look the same every time. */
function seeded(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

/** Bricks of slightly different reds and tans in light mortar, with a few speckles. */
/** The generated image (wall_brick), drawn until it loads. */
export const brickTexture = () => upgradeTexture(drawnBrickTexture(), 'wall_brick', { soften: 0.25, periodic: true });

const drawnBrickTexture = () =>
  canvasTexture('brick', 256, (g, s) => {
    const rand = seeded(11);
    g.fillStyle = '#efdcc4';
    g.fillRect(0, 0, s, s);
    const rows = 8;
    const h = s / rows;
    const tones = ['#d99a78', '#d38d6c', '#dfa583', '#cf8a68', '#e2ad8c'];
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? s / 8 : 0;
      for (let c = -1; c < 5; c++) {
        g.fillStyle = tones[Math.floor(rand() * tones.length)]!;
        const x = c * (s / 4) + off + 3;
        g.beginPath();
        g.roundRect(x, r * h + 3, s / 4 - 6, h - 6, 3);
        g.fill();
      }
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(120,60,40,0.25)' : 'rgba(255,240,220,0.3)';
      g.fillRect(rand() * s, rand() * s, 2, 2);
    }
  });

/** Felt leaves for bushes and tree crowns: tintable detail and its normal map, repeated `r` times. */
export function foliage(r = 1.5): { map: THREE.Texture; normal: THREE.Texture } {
  const base = detailMaps('foliage_felt', feltTexture().image as HTMLCanvasElement, 0.14);
  return { map: repeated(base.map, r, r), normal: repeated(base.normal, r, r) };
}

/** Woven wicker for the picnic basket (light wood until the image loads). */
export const wickerTexture = () => upgradeTexture(canvasTexture('wicker', 16, (g, s) => {
  g.fillStyle = '#d8aa6a';
  g.fillRect(0, 0, s, s);
}), 'wicker', { soften: 0.15 });

/** Soft felt snow (white until the image loads). */
export const snowTexture = () => upgradeTexture(canvasTexture('snow', 16, (g, s) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
}), 'ground_snow', { seamless: true });

/** Frozen pond ice (pale blue until the image loads). */
export const iceTexture = () => upgradeTexture(canvasTexture('ice', 16, (g, s) => {
  g.fillStyle = '#d8f1ff';
  g.fillRect(0, 0, s, s);
}), 'ice_pond', { seamless: true });

/** A wall of stacked logs (warm wood until the image loads). */
export const logWallTexture = () => upgradeTexture(canvasTexture('logWall', 16, (g, s) => {
  g.fillStyle = '#a8703f';
  g.fillRect(0, 0, s, s);
}), 'wood_logs', { periodic: true, soften: 0.15 });

/** Gift wrap: a soft pattern as grey detail, tinted by each gift's color. */
export const giftWrapTexture = () => upgradeTexture(canvasTexture('giftWrap', 16, (g, s) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
}), 'gift_wrap', { fabric: true, seamless: true, contrast: 0.12 });

/** Pool water with soft ripples (plain until the image loads). */
export const waterTexture = () => upgradeTexture(canvasTexture('water', 16, (g, s) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
}), 'water_pool', { seamless: true });

/** The generated image `name`, plain `color` until it loads. */
const plainUntilLoaded = (name: string, color: string, opts: ImageOptions) =>
  upgradeTexture(canvasTexture(name, 16, (g, s) => {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
  }), name, opts);

// Ground patches, one look per area.
/** Wood-chip mulch (under the treehouse). */
export const mulchTexture = () => plainUntilLoaded('ground_mulch', '#9a6440', { seamless: true, soften: 0.3 });
/** Pale gravel (round the tool shed). */
export const gravelTexture = () => plainUntilLoaded('ground_gravel', '#cfc8bc', { seamless: true, soften: 0.15 });
/** Sandstone paving slabs (round the house). */
export const patioTexture = () => plainUntilLoaded('ground_patio', '#e8dcc4', { periodic: true, soften: 0.2 });
/** Clover with daisies (meadows on the lawn). */
export const cloverTexture = () => plainUntilLoaded('ground_clover', '#78c066', { seamless: true, soften: 0.15 });
/** Dusty blue shag carpet (by the bed). */
export const carpetTexture = () => plainUntilLoaded('floor_carpet', '#8fa8c8', { seamless: true, soften: 0.15 });
/** Foam puzzle tiles in bright colors (Toy Corner). */
export const playmatTexture = () => plainUntilLoaded('floor_playmat', '#f2c14e', { periodic: true, soften: 0.15 });
/** A big sheet of paper covered in crayon drawings (by the desk; one sheet, not repeated). */
export const bigDrawingTexture = () => plainUntilLoaded('paper_drawing', '#fbf8f0', {});
/** Pine needles and snow (Pine Forest). */
export const needlesTexture = () => plainUntilLoaded('ground_needles', '#a27a58', { seamless: true, soften: 0.35 });
/** Snowy cobblestones (Gift Market). */
export const cobblesTexture = () => plainUntilLoaded('ground_cobbles', '#b9c3d0', { soften: 0.15 });
/** Packed, plowed snow with tire tracks (the snowplow's lane). */
export const plowedTexture = () => plainUntilLoaded('ground_packed_snow', '#e4edf6', { seamless: true });

/** Slowly drifts a texture (water ripples) while `mesh` is drawn. */
export function drift(mesh: THREE.Mesh, tex: THREE.Texture, speed = 0.02): void {
  mesh.onBeforeRender = () => {
    const t = performance.now() / 1000;
    tex.offset.set(t * speed, Math.sin(t * 0.3) * speed * 2);
  };
}

/** Cardboard as grey detail (tinted by the material), felt until the generated image loads. */
export const cardboardTexture = () =>
  upgradeTexture(
    canvasTexture('cardboard', 128, (g, s) => g.drawImage(feltTexture().image as HTMLCanvasElement, 0, 0, s, s)),
    'cardboard',
    { seamless: true, fabric: true },
  );

/** Floorboards for the house and the Bedroom: the generated wood, drawn planks until it loads. */
export const woodFloorTexture = () => upgradeTexture(canvasTexture('woodFloor', 256, drawPlanks), 'floor_wood', { soften: 0.6 });

/** Four planks of slightly different wood, with grain lines, knots and dark gaps. */
export const plankTexture = () => upgradeTexture(canvasTexture('plank', 256, drawPlanks), 'floor_wood', { soften: 0.45 });

function drawPlanks(g: CanvasRenderingContext2D, s: number): void {
  {
    const rand = seeded(5);
    const tones = ['#c48d58', '#bb8450', '#c9955f', '#b98049'];
    const pw = s / 4;
    for (let p = 0; p < 4; p++) {
      g.fillStyle = tones[p]!;
      g.fillRect(p * pw, 0, pw, s);
      // grain: long wavy lines down the plank
      g.strokeStyle = 'rgba(110,70,35,0.35)';
      g.lineWidth = 1.5;
      for (let l = 0; l < 6; l++) {
        const x0 = p * pw + 6 + rand() * (pw - 12);
        g.beginPath();
        for (let y = 0; y <= s; y += 8) g.lineTo(x0 + Math.sin(y / 30 + l) * 3, y);
        g.stroke();
      }
      // a knot or two
      for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) {
        const kx = p * pw + 12 + rand() * (pw - 24);
        const ky = rand() * s;
        g.fillStyle = 'rgba(100,60,30,0.6)';
        g.beginPath();
        g.ellipse(kx, ky, 5, 8, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(100,60,30,0.35)';
        g.beginPath();
        g.ellipse(kx, ky, 9, 14, 0, 0, Math.PI * 2);
        g.stroke();
      }
      // gap and nail heads
      g.fillStyle = '#7a4f2a';
      g.fillRect(p * pw, 0, 3, s);
      g.fillStyle = '#6d6a66';
      for (const y of [s * 0.12, s * 0.88]) {
        g.beginPath();
        g.arc(p * pw + pw / 2, y, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

/** The lawn: the generated felt lawn, drawn felt until it loads. */
export const lawnTexture = () => upgradeTexture(drawnLawnTexture(), 'ground_grass', { seamless: true, soften: 0.15 });

/** Lawn felt: soft patches of lighter and darker green, short blades and fibers. */
const drawnLawnTexture = () =>
  canvasTexture('lawn', 256, (g, s) => {
    const rand = seeded(21);
    g.fillStyle = '#7cc46a';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const r = 20 + rand() * 50;
      const light = rand() < 0.5;
      // Draw wrapped copies so the texture tiles without seams.
      for (const dx of [-s, 0, s]) {
        for (const dy of [-s, 0, s]) {
          const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          grad.addColorStop(0, light ? 'rgba(160,220,130,0.35)' : 'rgba(80,150,70,0.3)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        }
      }
    }
    const blades = ['rgba(70,140,60,0.55)', 'rgba(150,215,120,0.55)', 'rgba(100,170,80,0.5)'];
    for (let i = 0; i < 1600; i++) {
      g.strokeStyle = blades[i % 3]!;
      g.lineWidth = 1 + rand();
      const x = rand() * s;
      const y = rand() * s;
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.2;
      const len = 3 + rand() * 6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  });

/** Sand: grains in a few tones, gentle ripples and the odd pebble. */
/** The generated image (ground_sand), drawn until it loads. */
export const sandTexture = () => upgradeTexture(drawnSandTexture(), 'ground_sand', { seamless: true });

const drawnSandTexture = () =>
  canvasTexture('sand', 256, (g, s) => {
    const rand = seeded(31);
    g.fillStyle = '#efd793';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(200,165,95,0.35)';
    g.lineWidth = 2;
    for (let r = 0; r < 7; r++) {
      const y0 = (r + 0.5) * (s / 7);
      g.beginPath();
      for (let x = 0; x <= s; x += 8) g.lineTo(x, y0 + Math.sin((x / s) * Math.PI * 4 + r) * 5);
      g.stroke();
    }
    const grains = ['rgba(190,150,80,0.5)', 'rgba(255,245,210,0.7)', 'rgba(170,130,70,0.4)'];
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = grains[i % 3]!;
      g.fillRect(rand() * s, rand() * s, 1.5, 1.5);
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = rand() < 0.5 ? '#cfc6b8' : '#fff4e4';
      g.beginPath();
      g.ellipse(rand() * s, rand() * s, 3 + rand() * 3, 2 + rand() * 2, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Garden soil: dark clods, pebbles and little roots. */
/** The generated image (ground_dirt), drawn until it loads. */
export const dirtTexture = () => upgradeTexture(drawnDirtTexture(), 'ground_dirt', { seamless: true, soften: 0.4 });

const drawnDirtTexture = () =>
  canvasTexture('dirt', 256, (g, s) => {
    const rand = seeded(41);
    g.fillStyle = '#86603f';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = rand() < 0.6 ? 'rgba(90,60,35,0.5)' : 'rgba(160,120,80,0.4)';
      g.beginPath();
      g.ellipse(rand() * s, rand() * s, 3 + rand() * 7, 2 + rand() * 5, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 30; i++) {
      g.fillStyle = rand() < 0.5 ? '#a8a29a' : '#c7c0b6';
      g.beginPath();
      g.arc(rand() * s, rand() * s, 2 + rand() * 2, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(200,170,120,0.5)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const x = rand() * s;
      const y = rand() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 8, y + rand() * 10, x + 14, y + rand() * 12 - 6);
      g.stroke();
    }
  });

/** Stepping stones: grey with darker and lighter speckles. */
/** The generated image (stone_top), drawn until it loads. */
export const stoneTexture = () => upgradeTexture(drawnStoneTexture(), 'stone_top', { soften: 0.2 });

const drawnStoneTexture = () =>
  canvasTexture('stone', 128, (g, s) => {
    const rand = seeded(51);
    g.fillStyle = '#cbc5bb';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(120,115,108,0.45)' : 'rgba(240,236,228,0.6)';
      g.fillRect(rand() * s, rand() * s, 2, 2);
    }
  });

/** Blue gingham for the picnic tablecloth (unlike the red check of the blanket below it). */
export const ginghamTexture = () =>
  canvasTexture('gingham', 64, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(74,144,226,0.45)';
    g.fillRect(0, 0, s / 2, s);
    g.fillRect(0, 0, s, s / 2);
  });

/** The generated image (wood_crate), drawn until it loads. */
export const crateTexture = () => upgradeTexture(drawnCrateTexture(), 'wood_crate', { soften: 0.3 });

const drawnCrateTexture = () =>
  canvasTexture('crate', 128, (g, s) => {
    g.fillStyle = '#d6a468';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#9c6a38';
    g.lineWidth = 14;
    g.strokeRect(7, 7, s - 14, s - 14);
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(s - 10, s - 10);
    g.stroke();
  });

/** A round braided rug: rings of soft colors. */
/** A round braided rag rug: the generated image (rug_braided), drawn rings until it loads. */
export const rugTexture = () => upgradeTexture(drawnRugTexture(), 'rug_braided', { soften: 0.1 });

const drawnRugTexture = () =>
  canvasTexture('rug', 256, (g, s) => {
    const colors = ['#f2a7a0', '#fbe3b5', '#9fc7e8', '#fbe3b5', '#c9b2e6', '#fbe3b5', '#a8d8a8'];
    g.fillStyle = '#fbe3b5';
    g.fillRect(0, 0, s, s);
    const rings = 14;
    for (let i = 0; i < rings; i++) {
      g.fillStyle = colors[i % colors.length]!;
      g.beginPath();
      g.ellipse(s / 2, s / 2, (s / 2) * (1 - i / rings), (s / 2) * (1 - i / rings), 0, 0, Math.PI * 2);
      g.fill();
    }
    // braid stitches round each ring
    g.strokeStyle = 'rgba(90, 60, 50, 0.18)';
    g.lineWidth = 1.5;
    for (let i = 0; i < rings; i++) {
      g.beginPath();
      g.ellipse(s / 2, s / 2, (s / 2) * (1 - i / rings) - 2, (s / 2) * (1 - i / rings) - 2, 0, 0, Math.PI * 2);
      g.setLineDash([4, 4]);
      g.stroke();
    }
  });

/** A patchwork quilt for the bed. */
/** The generated image (fabric_quilt), drawn until it loads. */
export const quiltTexture = () => upgradeTexture(drawnQuiltTexture(), 'fabric_quilt');

const drawnQuiltTexture = () =>
  canvasTexture('quilt', 128, (g, s) => {
    const colors = ['#f6a5c0', '#9fc7e8', '#fde39a', '#b9e3a8', '#d7c2f0', '#ffc9a3'];
    const n = 4;
    const cell = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = colors[(x * 2 + y * 3) % colors.length]!;
        g.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    g.lineWidth = 2;
    g.setLineDash([5, 4]);
    for (let i = 1; i < n; i++) {
      g.beginPath();
      g.moveTo(i * cell, 0);
      g.lineTo(i * cell, s);
      g.moveTo(0, i * cell);
      g.lineTo(s, i * cell);
      g.stroke();
    }
  });

/** A woven red-and-cream picnic check (about 10 squares across), drawn checks until it loads. */
export const picnicTexture = () => upgradeTexture(checkerTexture(), 'fabric_picnic', { periodic: true });

/** A woven blue gingham tablecloth (about 8 squares across), drawn gingham until it loads. */
export const tableclothTexture = () => upgradeTexture(ginghamTexture(), 'fabric_tablecloth', { periodic: true });

export const checkerTexture = (a = '#e25b5b', b = '#fff6ec') =>
  canvasTexture(`checker${a}${b}`, 64, (g, s) => {
    g.fillStyle = b;
    g.fillRect(0, 0, s, s);
    g.fillStyle = a;
    g.globalAlpha = 0.85;
    g.fillRect(0, 0, s / 2, s / 2);
    g.fillRect(s / 2, s / 2, s / 2, s / 2);
    g.globalAlpha = 0.35;
    g.fillRect(s / 2, 0, s / 2, s / 2);
    g.fillRect(0, s / 2, s / 2, s / 2);
  });

/** Beach ball stripes. */
export const stripeTexture = () =>
  canvasTexture('ballStripes', 128, (g, s) => {
    const colors = ['#ff5a5a', '#fff8ef', '#3fa9f5', '#fff8ef', '#ffd23a', '#fff8ef'];
    colors.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect((i * s) / colors.length, 0, s / colors.length + 1, s);
    });
  });

/** Rounded roof tiles, each row a slightly different red. */
/** The generated image (roof_tiles), drawn until it loads. */
export const tileTexture = () => upgradeTexture(drawnTileTexture(), 'roof_tiles', { soften: 0.2, periodic: true });

const drawnTileTexture = () =>
  canvasTexture('roofTiles', 256, (g, s) => {
    const rand = seeded(61);
    const rows = 8;
    const h = s / rows;
    const tones = ['#c4553e', '#bd4f39', '#cb5d45', '#b84a35'];
    for (let r = 0; r < rows; r++) {
      g.fillStyle = tones[Math.floor(rand() * tones.length)]!;
      g.fillRect(0, r * h, s, h);
      const off = r % 2 ? s / 16 : 0;
      for (let c = -1; c < 9; c++) {
        const x = c * (s / 8) + off + s / 16;
        g.fillStyle = 'rgba(255,200,170,0.18)';
        g.beginPath();
        g.ellipse(x, r * h + h * 0.35, s / 22, h * 0.25, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#8f3626';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x, r * h, s / 16, 0.15, Math.PI - 0.15);
        g.stroke();
      }
    }
  });

export const corrugatedTexture = () =>
  canvasTexture('corrugated', 64, (g, s) => {
    for (let x = 0; x < s; x++) {
      const v = Math.round(150 + Math.sin((x / s) * Math.PI * 8) * 30);
      g.fillStyle = `rgb(${v - 30},${v},${v - 20})`;
      g.fillRect(x, 0, 1, s);
    }
  });

// ---------- props ----------

const BLOCK_COLORS = ['#e2574c', '#4a7fd6', '#f2c14e', '#5bb46a', '#9a6bd6'];
const BOOK_COLORS = ['#c0504d', '#3f6fb5', '#4f9a5d', '#8e5bb8', '#d9822b'];
const LETTERS = 'STUFFEDTOYS';
const CARDBOARD = '#c9a27e';

function letterTexture(color: string, letter: string): THREE.CanvasTexture {
  return canvasTexture(`letter${color}${letter}`, 128, (g) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = `#${lighten(color, 0.5).getHexString()}`;
    g.lineWidth = 8;
    g.strokeRect(16, 16, 96, 96);
    g.fillStyle = '#ffffff';
    g.font = '900 76px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, 64, 68);
  });
}

const flat = (color: THREE.ColorRepresentation) => toonMaterial(color, { map: null });

/** A prop for one wall, positioned at the wall's center on the ground. */
export function buildWall(b: Wall, index: number): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
  const kind = b.kind ?? guessKind(b);
  const H = b.height;
  const add = (o: THREE.Object3D, y: number) => {
    o.position.y = y;
    g.add(o);
    return o;
  };

  switch (kind) {
    case 'block': {
      const color = BLOCK_COLORS[index % BLOCK_COLORS.length]!;
      add(outlinedBox(b.w, H, b.h, makePlastic(toonMaterial('#ffffff', { map: letterTexture(color, LETTERS[index % LETTERS.length]!) }), true)), H / 2);
      break;
    }
    case 'cardboard': {
      add(outlinedBox(b.w, H, b.h, toonMaterial(CARDBOARD)), H / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w > b.h ? b.w : 0.35, 0.02, b.w > b.h ? 0.35 : b.h), flat('#e8d9b5')), H + 0.011);
      break;
    }
    case 'book': {
      const cover = BOOK_COLORS[index % BOOK_COLORS.length]!;
      add(outlinedBox(b.w, H, b.h, toonMaterial(cover)), H / 2);
      const long = b.w > b.h;
      add(new THREE.Mesh(new THREE.BoxGeometry(long ? b.w - 0.25 : b.w + 0.02, H - 0.3, long ? b.h + 0.02 : b.h - 0.25), flat('#f4ead2')), H / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.03, 0.12, b.h + 0.03), flat(darken(cover, 0.25))), H * 0.75);
      // On the cover: a cream title label with two lines of "writing", a gold star, and a ribbon
      // bookmark hanging out of the pages.
      const lw = long ? Math.min(b.w * 0.5, 3) : b.w * 0.6;
      const lh = long ? b.h * 0.6 : Math.min(b.h * 0.5, 3);
      add(new THREE.Mesh(new THREE.BoxGeometry(lw, 0.03, lh), flat('#fbf3df')), H + 0.015);
      for (const k of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(long ? lw * 0.7 : lw * 0.12, 0.035, long ? lh * 0.12 : lh * 0.7), flat(darken(cover, 0.3)));
        line.position.set(long ? 0 : k * lw * 0.2, H + 0.02, long ? k * lh * 0.2 : 0);
        g.add(line);
      }
      const star = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 5), flat('#f7c331'));
      star.position.set(long ? -b.w / 2 + 0.6 : 0, H + 0.02, long ? 0 : -b.h / 2 + 0.6);
      g.add(star);
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.18 : 0.05, 0.7, long ? 0.05 : 0.18), flat('#e2433f'));
      ribbon.position.set(long ? b.w / 4 : b.w / 2 + 0.03, H - 0.4, long ? b.h / 2 + 0.03 : b.h / 4);
      g.add(ribbon);
      break;
    }
    case 'brick': {
      const long = Math.max(b.w, b.h);
      add(outlinedBox(b.w, H, b.h, toonMaterial('#ffffff', { map: tiled(brickTexture(), long / 2, H / 1) })), H / 2);
      // A painted trim along the top, kept just below the wall top: the house roof's surface sits
      // exactly at wall height, and two faces at one height flicker through each other.
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.06, 0.16, b.h + 0.06), flat('#7fb3d9')), H - 0.12);
      break;
    }
    case 'plank': {
      const long = Math.max(b.w, b.h);
      add(outlinedBox(b.w, H, b.h, toonMaterial('#ffffff', { map: tiled(plankTexture(), long / 1.6, 1) })), H / 2);
      break;
    }
    case 'crate': {
      add(outlinedBox(b.w, H, b.h, toonMaterial('#ffffff', { map: crateTexture() })), H / 2);
      break;
    }
    case 'barrel': {
      const r = Math.min(b.w, b.h) / 2;
      // A wooden rain barrel: staves bulging a little in the middle, two iron bands, water on top.
      const profile: THREE.Vector2[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        profile.push(new THREE.Vector2(r * (0.9 + Math.sin(t * Math.PI) * 0.1), t * H));
      }
      const staves = toonMaterial('#f2d2a8', { map: tiled(plankTexture(), 3, 0.6) });
      const barrel = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), staves);
      barrel.castShadow = barrel.receiveShadow = true;
      const hull = new THREE.Mesh(new THREE.LatheGeometry(profile.map((v) => new THREE.Vector2(v.x + 0.05, v.y)), 24), outlineMaterial(OUTLINE_COLOR));
      barrel.add(hull);
      add(barrel, 0);
      for (const t of [0.18, 0.82]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r * (0.9 + Math.sin(t * Math.PI) * 0.1) + 0.02, 0.06, 6, 28), flat('#5d6670'));
        band.rotation.x = Math.PI / 2;
        add(band, t * H);
      }
      const rimTop = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.06, 6, 28), flat('#a8743f'));
      rimTop.rotation.x = Math.PI / 2;
      add(rimTop, H);
      // rain water on top, with drifting ripples
      const waterTex = tiled(waterTexture(), 0.5, 0.5);
      const water = new THREE.Mesh(new THREE.CircleGeometry(r * 0.88, 24).rotateX(-Math.PI / 2), toonMaterial('#bfe9ff', { map: waterTex }));
      drift(water, waterTex, 0.015);
      add(water, H - 0.08);
      break;
    }
    case 'trunk': {
      const r = Math.min(b.w, b.h) / 2;
      add(toonMesh(new THREE.CylinderGeometry(r * 0.85, r * 1.05, H, 16), '#7a5236', { outline: 0.03 }), H / 2);
      // a small leafy crown on top (kept small so it doesn't hide the platform)
      for (const [x, y, z, s] of [[0, 0.3, 0, 1.5], [1, 0, -0.4, 1.1], [-1, -0.1, -0.5, 1.1], [0.2, 0.2, -1.1, 1]] as const) {
        const crown = makeTriplanar(toonMaterial('#4ea34a', { map: foliage(1).map }), 0.9);
        const leaf = toonMesh(new THREE.IcosahedronGeometry(s, 2), '#4ea34a', { outline: 0.04, outlineColor: '#1f3f26', material: crown });
        leaf.position.set(x, H + y, z);
        g.add(leaf);
      }
      break;
    }
    case 'bench':
    case 'table-leg': {
      const wood = kind === 'bench' ? '#b5763f' : '#9a6234';
      if (kind === 'bench' && H < 1.5) {
        // a seat board on two side panels
        const long = b.w > b.h;
        add(outlinedBox(b.w, 0.22, b.h, toonMaterial(wood)), H - 0.11);
        for (const s of [-1, 1]) {
          const panel = outlinedBox(long ? 0.25 : b.w * 0.9, H - 0.22, long ? b.h * 0.9 : 0.25, toonMaterial(darken(wood, 0.15)));
          panel.position.set(long ? (s * (b.w / 2 - 0.4)) : 0, (H - 0.22) / 2, long ? 0 : s * (b.h / 2 - 0.4));
          g.add(panel);
        }
      } else {
        add(outlinedBox(b.w, H, b.h, toonMaterial(wood)), H / 2);
      }
      break;
    }
    case 'sandcastle': {
      const sand = '#f6e3b4';
      const sandy = () => toonMaterial(sand, { map: tiled(sandTexture(), 0.4, 0.4) });
      add(outlinedBox(b.w, H * 0.65, b.h, sandy()), (H * 0.65) / 2);
      const hole = flat('#9c7a45');
      // an arched door on the front (+z) and a little window each side of it
      const door = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16, 1, false, 0, Math.PI), hole);
      door.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      door.position.set(0, 0.02, b.h / 2 + 0.01);
      door.scale.set(1, 1, 1.5);
      g.add(door);
      // four towers with crenellated tops and a window each
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const tower = toonMesh(new THREE.CylinderGeometry(0.42, 0.5, H, 12), sand, { outline: 0.05, material: sandy() });
        const tx = (sx * b.w) / 2 - sx * 0.4;
        const tz = (sz * b.h) / 2 - sz * 0.4;
        tower.position.set(tx, H / 2, tz);
        g.add(tower);
        for (let c = 0; c < 4; c++) {
          const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
          const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), sandy());
          merlon.position.set(tx + Math.cos(a) * 0.32, H + 0.1, tz + Math.sin(a) * 0.32);
          merlon.rotation.y = -a;
          g.add(merlon);
        }
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.04), hole);
        win.position.set(tx, H * 0.7, tz + sz * 0.44);
        g.add(win);
      }
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), flat('#7a5236'));
      flagPole.position.set(b.w / 2 - 0.4, H + 0.45, -b.h / 2 + 0.4);
      g.add(flagPole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.02), flat('#ff5a5a'));
      flag.position.set(b.w / 2 - 0.2, H + 0.75, -b.h / 2 + 0.4);
      g.add(flag);
      break;
    }
    case 'bucket': {
      const r = Math.min(b.w, b.h) / 2;
      add(toonMesh(new THREE.CylinderGeometry(r, r * 0.78, H, 20, 1, true), '#3f8fe0', { outline: 0.05, material: toonMaterial('#3f8fe0', { side: THREE.DoubleSide }) }), H / 2);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 28), flat('#ffd23a'));
      rim.rotation.x = Math.PI / 2;
      add(rim, H);
      const sandTop = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 20).rotateX(-Math.PI / 2), flat('#e8cf8f'));
      add(sandTop, H * 0.8);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.04, 6, 24, Math.PI), flat('#ffd23a'));
      add(handle, H);
      // a little red spade stuck in the sand, leaning out
      const spade = new THREE.Group();
      spade.position.set(r * 0.3, H * 0.8, r * 0.2);
      spade.rotation.set(0.35, 0.6, -0.3);
      const shaft = toonMesh(new THREE.CylinderGeometry(0.05, 0.05, H * 0.9, 8), '#e2433f', { outline: 0.06 });
      shaft.position.y = H * 0.45;
      spade.add(shaft);
      const grip = toonMesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), '#e2433f', { outline: 0.06 });
      grip.position.y = H * 0.9;
      spade.add(grip);
      g.add(spade);
      break;
    }
    case 'planter': {
      add(outlinedBox(b.w, H, b.h, toonMaterial('#ffffff', { map: tiled(plankTexture(), b.w / 2, 0.5) })), H / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.2, 0.04, b.h - 0.2), flat('#6b4a32')), H + 0.01);
      // sprouts and a few veggies along the row
      const long = b.w > b.h;
      const n = Math.max(2, Math.floor(Math.max(b.w, b.h) / 1.6));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const x = long ? t * b.w : 0;
        const z = long ? 0 : t * b.h;
        const veg = i % 3;
        if (veg === 0) {
          const leaf = toonMesh(new THREE.ConeGeometry(0.22, 0.6, 5), '#5fb34f', { outline: 0.08 });
          leaf.position.set(x, H + 0.3, z);
          g.add(leaf);
        } else if (veg === 1) {
          const tomato = toonMesh(new THREE.SphereGeometry(0.2, 12, 8), '#e2463a', { outline: 0.08 });
          tomato.position.set(x, H + 0.2, z);
          g.add(tomato);
        } else {
          const carrot = toonMesh(new THREE.ConeGeometry(0.16, 0.5, 6), '#5fb34f', { outline: 0.08 });
          carrot.position.set(x, H + 0.25, z);
          g.add(carrot);
          const top = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10).rotateX(-Math.PI / 2), flat('#f08a2c'));
          top.position.set(x, H + 0.03, z);
          g.add(top);
        }
      }
      break;
    }
    case 'ball': {
      const r = Math.min(b.w, b.h, H) / 2;
      const ballMesh = toonMesh(new THREE.SphereGeometry(r, 24, 16), '#ffffff', { outline: 0.04, material: makePlastic(toonMaterial('#ffffff', { map: stripeTexture() }), true) });
      ballMesh.rotation.z = 0.5 + index;
      add(ballMesh, r);
      break;
    }
    case 'snowman': {
      // Three snowballs, a carrot nose, coal eyes and buttons, a red scarf, twig arms and a top hat.
      const snow = () => toonMaterial('#ffffff', { map: tiled(snowTexture(), 0.5, 0.5) });
      const r = Math.min(b.w, b.h) / 2;
      const balls: [number, number][] = [[r * 0.95, r * 0.85], [r * 0.68, r * 0.85 * 2 + r * 0.45], [r * 0.48, r * 0.85 * 2 + r * 0.45 * 2 + r * 0.35]];
      for (const [br, y] of balls) add(toonMesh(new THREE.SphereGeometry(br, 20, 14), '#ffffff', { outline: 0.04, material: snow() }), y);
      const [, headY] = balls[2]!;
      const headR = balls[2]![0];
      const nose = toonMesh(new THREE.ConeGeometry(0.07, 0.3, 10), '#f28a2c', { outline: 0.1 });
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, headY, headR + 0.12);
      g.add(nose);
      for (const s of [-1, 1]) {
        const coal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), makePlastic(flat('#2a1f2d')));
        coal.position.set(s * 0.13, headY + 0.1, headR - 0.04);
        g.add(coal);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.9, 6), flat('#6b4630'));
        arm.position.set(s * (balls[1]![0] + 0.3), balls[1]![1] + 0.2, 0);
        arm.rotation.z = s * -1.0;
        g.add(arm);
      }
      for (const dy of [0.15, -0.05, -0.25]) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), makePlastic(flat('#2a1f2d')));
        button.position.set(0, balls[1]![1] + dy, balls[1]![0] - 0.02);
        g.add(button);
      }
      const scarf = toonMesh(new THREE.TorusGeometry(headR * 0.95, 0.07, 8, 20), '#e2433f', { outline: 0.08 });
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = headY - headR * 0.7;
      g.add(scarf);
      const tail = toonMesh(new THREE.BoxGeometry(0.14, 0.4, 0.05), '#e2433f', { outline: 0.08 });
      tail.position.set(0.18, headY - headR * 0.7 - 0.2, headR * 0.8);
      tail.rotation.z = 0.2;
      g.add(tail);
      const brim = toonMesh(new THREE.CylinderGeometry(headR * 0.85, headR * 0.85, 0.05, 18), '#2a1f2d', { outline: 0.08 });
      brim.position.y = headY + headR * 0.82;
      g.add(brim);
      const crown = toonMesh(new THREE.CylinderGeometry(headR * 0.55, headR * 0.55, 0.35, 18), '#2a1f2d', { outline: 0.06 });
      crown.position.y = headY + headR * 0.82 + 0.18;
      g.add(crown);
      break;
    }
    case 'gift': {
      // A wrapped present: colored paper, a ribbon both ways round and a bow on top.
      const colors = ['#e2433f', '#3d7ff2', '#5bd16a', '#9b7bd8', '#f7c331', '#ff7ab8'];
      const paper = colors[index % colors.length]!;
      const ribbon = ['#f7c331', '#ffffff', '#e2433f', '#f7c331', '#e2433f', '#ffffff'][index % colors.length]!;
      add(outlinedBox(b.w, H, b.h, toonMaterial(paper, { map: tiled(giftWrapTexture(), b.w / 1.5, H / 1.5) })), H / 2);
      const rib = makePlastic(flat(ribbon));
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.04, H + 0.02, 0.22), rib), H / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.22, H + 0.02, b.h + 0.04), rib), H / 2);
      for (const s of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 14), rib);
        loop.position.set(s * 0.15, H + 0.12, 0);
        loop.rotation.set(0, Math.PI / 2, s * 0.6);
        g.add(loop);
      }
      break;
    }
    case 'snowwall': {
      // Packed snow: a block with a rounded top and a few lumps.
      // Packed snow, a touch blue so it stands out from the snow on the ground.
      const snow = toonMaterial('#d6e9fb', { map: tiled(snowTexture(), Math.max(b.w, b.h) / 3, H / 3) });
      const long = b.w >= b.h;
      add(outlinedBox(b.w, H - 0.15, b.h, snow), (H - 0.15) / 2);
      add(toonMesh(new THREE.BoxGeometry(b.w, 0.3, b.h), '#ffffff', { outline: 0.04, material: snow }), H - 0.15);
      for (let i = 0; i < 3; i++) {
        const lump = toonMesh(new THREE.SphereGeometry(0.22 + (i % 2) * 0.08, 10, 8), '#ffffff', { outline: 0.06, material: snow });
        const t = (i + 0.5) / 3 - 0.5;
        lump.position.set(long ? t * b.w * 0.9 : 0, H - 0.05, long ? 0 : t * b.h * 0.9);
        lump.scale.y = 0.6;
        g.add(lump);
      }
      break;
    }
    case 'iceblock': {
      // A clear block of ice with a glint.
      const ice = makePlastic(new THREE.MeshToonMaterial({ color: '#c8ecff', transparent: true, opacity: 0.85, gradientMap: null }));
      ice.map = tiled(iceTexture(), 0.5, 0.5);
      add(outlinedBox(b.w, H, b.h, ice), H / 2);
      break;
    }
    case 'log': {
      if (H > 1.5) {
        // A log wall: stacked logs, snow along the top.
        add(outlinedBox(b.w, H, b.h, toonMaterial('#ffffff', { map: tiled(logWallTexture(), Math.max(b.w, b.h) / 3, H / 2.8) })), H / 2);
        add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.1, 0.12, b.h + 0.1), toonMaterial('#ffffff', { map: snowTexture() })), H + 0.02);
        break;
      }
      // A fallen log lying along its long side, rings on its ends and snow on top.
      const long = b.w >= b.h;
      const len = Math.max(b.w, b.h);
      const r = Math.min(H, Math.min(b.w, b.h)) / 2;
      const bark = toonMaterial('#8a5a34', { map: tiled(plankTexture(), 1, len / 2) });
      const trunk = toonMesh(new THREE.CylinderGeometry(r, r, len, 16), '#8a5a34', { outline: 0.05, material: bark });
      trunk.rotation.set(long ? 0 : Math.PI / 2, 0, long ? Math.PI / 2 : 0);
      add(trunk, r);
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 16), flat('#e8c897'));
        ring.position.set(long ? (s * len) / 2 + s * 0.01 : 0, r, long ? 0 : (s * len) / 2 + s * 0.01);
        ring.rotation.y = long ? (s * Math.PI) / 2 : s > 0 ? 0 : Math.PI;
        g.add(ring);
        const core = new THREE.Mesh(new THREE.RingGeometry(r * 0.35, r * 0.42, 16), flat('#c79a64'));
        core.position.copy(ring.position).add(new THREE.Vector3(long ? s * 0.005 : 0, 0, long ? 0 : s * 0.005));
        core.rotation.copy(ring.rotation);
        g.add(core);
      }
      const snowTop = toonMesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { outline: false, material: toonMaterial('#ffffff', { map: snowTexture() }) });
      snowTop.scale.set(long ? len * 0.45 : r * 0.9, 0.12, long ? r * 0.9 : len * 0.45);
      add(snowTop, r * 1.85);
      break;
    }
    case 'lamppost': {
      // An old park lamp: a dark green post, a glowing lantern and a little snow cap.
      const green = makePlastic(flat('#2f5d4a'));
      add(toonMesh(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 12), '#2f5d4a', { outline: 0.08, material: green }), 0.15);
      add(toonMesh(new THREE.CylinderGeometry(0.08, 0.1, H - 0.6, 10), '#2f5d4a', { outline: 0.12, material: green }), (H - 0.6) / 2 + 0.2);
      const glow = new THREE.MeshToonMaterial({ color: '#fff3b0', emissive: '#ffcf5a', emissiveIntensity: 0.9, gradientMap: null });
      add(toonMesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), '#fff3b0', { outline: 0.1, material: glow }), H - 0.3);
      add(toonMesh(new THREE.ConeGeometry(0.3, 0.22, 4), '#2f5d4a', { outline: 0.1, material: green }).rotateY(Math.PI / 4), H - 0.02);
      add(toonMesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { outline: false }), H + 0.05);
      break;
    }
    case 'train': {
      // A toy train car: a painted body on wheels; the first one is the engine with a chimney.
      const colors = ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a'];
      const color = colors[index % colors.length]!;
      const long = b.h > b.w;
      add(outlinedBox(b.w * 0.9, H * 0.6, b.h * 0.9, toonMaterial(color, { map: null })), H * 0.45);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const wheel = toonMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14), '#2a1f2d', { outline: false });
        wheel.rotation.z = long ? Math.PI / 2 : 0;
        if (!long) wheel.rotation.x = Math.PI / 2;
        wheel.position.set(long ? (sx * b.w) / 2 : (sx * b.w) / 3, 0.28, long ? (sz * b.h) / 3 : (sz * b.h) / 2);
        g.add(wheel);
      }
      if (H > 1.4) {
        const chimney = toonMesh(new THREE.CylinderGeometry(0.22, 0.3, 0.6, 12), '#2a1f2d', { outline: 0.1 });
        chimney.position.set(0, H * 0.75 + 0.3, long ? -b.h * 0.25 : 0);
        g.add(chimney);
      }
      break;
    }
    case 'goal': {
      // A side or the back of a beach ball goal: thin white tubes along its top and bottom and a
      // post at each end, so the net (goal-views.ts) shows through. The wall itself stays solid.
      const white = toonMaterial('#fdfbf7', { map: null });
      const long = b.w > b.h;
      const length = Math.max(b.w, b.h);
      for (const y of [0.06, H - 0.08]) {
        const rail = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, length, 10), '#fdfbf7', { outline: false, material: white });
        rail.rotation.set(long ? 0 : Math.PI / 2, 0, long ? Math.PI / 2 : 0);
        add(rail, y);
      }
      for (const end of [-1, 1]) {
        const post = toonMesh(new THREE.CylinderGeometry(0.1, 0.1, H, 10), '#fdfbf7', { outline: 0.06, material: white });
        post.position.set(long ? (end * (length - 0.2)) / 2 : 0, H / 2, long ? 0 : (end * (length - 0.2)) / 2);
        g.add(post);
      }
      break;
    }
    case 'basket': {
      add(outlinedBox(b.w, H * 0.8, b.h, toonMaterial('#c08a4a', { map: tiled(crateTexture(), 2, 1) })), (H * 0.8) / 2);
      add(outlinedBox(b.w * 0.95, 0.08, b.h * 0.95, toonMaterial('#ffffff', { map: tiled(picnicTexture(), b.w / 12, b.h / 12) })), H * 0.8 + 0.04);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(Math.min(b.w, b.h) * 0.4, 0.05, 6, 20, Math.PI), flat('#8e6036'));
      add(handle, H * 0.8);
      break;
    }
  }
  return g;
}

/** The look of walls without a kind (the test map): square blocks, thin cardboard, thick books. */
function guessKind(b: Wall): NonNullable<Wall['kind']> {
  if (Math.abs(b.w - b.h) < 0.01) return 'block';
  return Math.min(b.w, b.h) <= 1.01 ? 'cardboard' : 'book';
}
