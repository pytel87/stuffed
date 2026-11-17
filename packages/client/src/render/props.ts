// Backyard props: how each kind of wall looks. The sim only knows a box and its height; here it
// becomes a brick wall, a crate, a bench, a sandcastle... All code-built, toon-shaded and outlined,
// with small canvas textures (one per kind, shared).
import * as THREE from 'three';
import type { Wall } from '@stuffed/sim';
import { darken, lighten, outlineMaterial, OUTLINE_COLOR, toonMaterial, toonMesh } from './toon.ts';

const OUTLINE = 0.045;

/** Box mesh with a constant-width outline (scaling a hull would make long walls uneven). */
export function outlinedBox(w: number, h: number, d: number, material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), outlineMaterial(OUTLINE_COLOR));
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
  return t;
}

/** Render-only randomness for textures, seeded so they look the same every time. */
function seeded(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

/** Bricks of slightly different reds and tans in light mortar, with a few speckles. */
export const brickTexture = () =>
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

/** Four planks of slightly different wood, with grain lines, knots and dark gaps. */
export const plankTexture = () =>
  canvasTexture('plank', 256, (g, s) => {
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
  });

/** Lawn felt: soft patches of lighter and darker green, short blades and fibers. */
export const lawnTexture = () =>
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
export const sandTexture = () =>
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
export const dirtTexture = () =>
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
export const stoneTexture = () =>
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

export const crateTexture = () =>
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

const stripeTexture = () =>
  canvasTexture('ballStripes', 128, (g, s) => {
    const colors = ['#ff5a5a', '#fff8ef', '#3fa9f5', '#fff8ef', '#ffd23a', '#fff8ef'];
    colors.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect((i * s) / colors.length, 0, s / colors.length + 1, s);
    });
  });

/** Rounded roof tiles, each row a slightly different red. */
export const tileTexture = () =>
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
      add(outlinedBox(b.w, H, b.h, toonMaterial('#ffffff', { map: letterTexture(color, LETTERS[index % LETTERS.length]!) })), H / 2);
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
      const barrel = toonMesh(new THREE.CylinderGeometry(r, r * 0.92, H, 20), '#7a8fa0', { outline: 0.05 });
      add(barrel, H / 2);
      for (const y of [H * 0.2, H * 0.8]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.05, 6, 24), flat('#4c5a66'));
        band.rotation.x = Math.PI / 2;
        add(band, y);
      }
      // rain water on top
      const water = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 20).rotateX(-Math.PI / 2), flat('#6fc3ec'));
      add(water, H + 0.01);
      break;
    }
    case 'trunk': {
      const r = Math.min(b.w, b.h) / 2;
      add(toonMesh(new THREE.CylinderGeometry(r * 0.85, r * 1.05, H, 16), '#7a5236', { outline: 0.03 }), H / 2);
      // a small leafy crown on top (kept small so it doesn't hide the platform)
      for (const [x, y, z, s] of [[0, 0.3, 0, 1.5], [1, 0, -0.4, 1.1], [-1, -0.1, -0.5, 1.1], [0.2, 0.2, -1.1, 1]] as const) {
        const leaf = toonMesh(new THREE.IcosahedronGeometry(s, 1), '#4ea34a', { outline: 0.04, outlineColor: '#1f3f26' });
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
      const sand = '#e8cf8f';
      add(outlinedBox(b.w, H * 0.65, b.h, toonMaterial(sand)), (H * 0.65) / 2);
      // four towers with crenellated tops
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const tower = toonMesh(new THREE.CylinderGeometry(0.42, 0.5, H, 12), sand, { outline: 0.05 });
        tower.position.set((sx * b.w) / 2 - sx * 0.4, H / 2, (sz * b.h) / 2 - sz * 0.4);
        g.add(tower);
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
      const ballMesh = toonMesh(new THREE.SphereGeometry(r, 24, 16), '#ffffff', { outline: 0.04, material: toonMaterial('#ffffff', { map: stripeTexture() }) });
      ballMesh.rotation.z = 0.5 + index;
      add(ballMesh, r);
      break;
    }
    case 'basket': {
      add(outlinedBox(b.w, H * 0.8, b.h, toonMaterial('#c08a4a', { map: tiled(crateTexture(), 2, 1) })), (H * 0.8) / 2);
      add(outlinedBox(b.w * 0.95, 0.08, b.h * 0.95, toonMaterial('#ffffff', { map: tiled(checkerTexture(), 2, 2) })), H * 0.8 + 0.04);
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
