// Walls, bushes and roofs. The sim only knows boxes and circles; the look is picked from the
// shape: square boxes are toy letter blocks, 1-thick walls are cardboard, thicker ones are books.
import * as THREE from 'three';
import type { Building, Circle, MapData, Wall } from '@stuffed/sim';
import { darken, feltTexture, lighten, outlineMaterial, OUTLINE_COLOR, toonMaterial } from './toon.ts';

const OUTLINE = 0.045;
const BLOCK_COLORS = ['#e2574c', '#4a7fd6', '#f2c14e', '#5bb46a', '#9a6bd6'];
const BOOK_COLORS = ['#c0504d', '#3f6fb5', '#4f9a5d', '#8e5bb8', '#d9822b'];
const LETTERS = 'STUFFEDTOYS';
const CARDBOARD = '#c9a27e';
const BUSH = '#3f8f4a';

/** Box mesh with a constant-width outline (scaling a hull would make long walls uneven). */
function outlinedBox(w: number, h: number, d: number, material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), outlineMaterial(OUTLINE_COLOR));
  mesh.add(hull);
  return mesh;
}

function letterTexture(color: string, letter: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
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
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wall(b: Wall, index: number): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
  const thin = Math.min(b.w, b.h);

  if (Math.abs(b.w - b.h) < 0.01) {
    const color = BLOCK_COLORS[index % BLOCK_COLORS.length]!;
    const mat = toonMaterial('#ffffff', { map: letterTexture(color, LETTERS[index % LETTERS.length]!) });
    const block = outlinedBox(b.w, b.height, b.h, mat);
    block.position.y = b.height / 2;
    g.add(block);
  } else if (thin <= 1.01) {
    const height = b.height;
    const box = outlinedBox(b.w, height, b.h, toonMaterial(CARDBOARD));
    box.position.y = height / 2;
    g.add(box);
    // packing tape along the top
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(b.w > b.h ? b.w : 0.35, 0.02, b.w > b.h ? 0.35 : b.h),
      toonMaterial('#e8d9b5', { map: null }),
    );
    tape.position.y = height + 0.011;
    g.add(tape);
  } else {
    const height = b.height;
    const cover = BOOK_COLORS[index % BOOK_COLORS.length]!;
    const book = outlinedBox(b.w, height, b.h, toonMaterial(cover));
    book.position.y = height / 2;
    g.add(book);
    // cream page block, inset from the cover
    const long = b.w > b.h;
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(long ? b.w - 0.25 : b.w + 0.02, height - 0.3, long ? b.h + 0.02 : b.h - 0.25),
      toonMaterial('#f4ead2', { map: null }),
    );
    pages.position.y = height / 2;
    g.add(pages);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.03, 0.12, b.h + 0.03), toonMaterial(darken(cover, 0.25), { map: null }));
    spine.position.y = height * 0.75;
    g.add(spine);
  }
  return g;
}

export interface BushView {
  circle: Circle;
  material: THREE.MeshToonMaterial;
}

function bush(circle: Circle): { object: THREE.Object3D; view: BushView } {
  const g = new THREE.Group();
  g.position.set(circle.center.x, 0, circle.center.y);
  const material = toonMaterial(BUSH);
  const hull = outlineMaterial('#1f3f26');
  const r = circle.radius;
  const balls: [number, number, number, number][] = [[0, 0, 1.15, r * 0.55]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    balls.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 0.75 + (i % 2) * 0.2, r * (0.42 + (i % 3) * 0.04)]);
  }
  for (const [x, z, y, size] of balls) {
    const geo = new THREE.IcosahedronGeometry(size, 2);
    const ball = new THREE.Mesh(geo, material);
    ball.position.set(x, y, z);
    ball.castShadow = true;
    ball.receiveShadow = true;
    const outline = new THREE.Mesh(geo, hull);
    outline.scale.setScalar(1.06);
    ball.add(outline);
    g.add(ball);
  }
  return { object: g, view: { circle, material } };
}

export interface RoofView {
  object: THREE.Group;
  materials: THREE.Material[];
  meshes: THREE.Mesh[];
  opacity: number;
}

const ROOF_THICKNESS = 0.32;
const ROOF_OVERHANG = 0.2;
const ROOF_FADE_RATE = 10;

/** A cardboard box lid over a building, taped shut; its top is the walkable roof. */
function roof(b: Building): RoofView {
  const g = new THREE.Group();
  g.position.set(b.x + b.w / 2, b.height - ROOF_THICKNESS / 2 + 0.01, b.y + b.h / 2);
  const w = b.w + ROOF_OVERHANG * 2;
  const d = b.h + ROOF_OVERHANG * 2;
  const lidTex = feltTexture().clone();
  lidTex.repeat.set(w / 3, d / 3);
  lidTex.needsUpdate = true;
  const lidMat = toonMaterial('#d8b48a', { map: lidTex, transparent: true });
  const tapeMat = toonMaterial('#efe2c2', { map: null, transparent: true });
  const hullMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide, transparent: true });

  const lid = new THREE.Mesh(new THREE.BoxGeometry(w, ROOF_THICKNESS, d), lidMat);
  lid.castShadow = true;
  lid.receiveShadow = true;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(w + OUTLINE * 2, ROOF_THICKNESS + OUTLINE * 2, d + OUTLINE * 2), hullMat);
  lid.add(hull);
  g.add(lid);
  const tapeA = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.02, 0.6), tapeMat);
  const tapeB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, d + 0.02), tapeMat);
  for (const tape of [tapeA, tapeB]) {
    tape.position.y = ROOF_THICKNESS / 2 + 0.011;
    g.add(tape);
  }
  // a fold line where the flaps meet
  const fold = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.025, 0.05), new THREE.MeshBasicMaterial({ color: '#a8845c', transparent: true }));
  fold.position.y = ROOF_THICKNESS / 2 + 0.013;
  g.add(fold);
  const materials = [lidMat, tapeMat, hullMat, fold.material];
  return { object: g, materials, meshes: [lid], opacity: 1 };
}

export function buildObstacles(map: MapData): { root: THREE.Group; bushes: BushView[]; roofs: RoofView[] } {
  const root = new THREE.Group();
  map.walls.forEach((b, i) => root.add(wall(b, i)));
  const bushes = map.bushes.map((c) => {
    const { object, view } = bush(c);
    root.add(object);
    return view;
  });
  const roofs = map.buildings.map((b) => {
    const view = roof(b);
    root.add(view.object);
    return view;
  });
  return { root, bushes, roofs };
}

/**
 * The roof over the building you are in fades out so you can see inside; the others stay.
 * In the debug view every roof is see-through.
 */
export function updateRoofs(roofs: RoofView[], localBuilding: number, debug: boolean, dt: number): void {
  roofs.forEach((r, i) => {
    const target = i === localBuilding ? 0 : debug ? 0.3 : 1;
    r.opacity += (target - r.opacity) * (1 - Math.exp(-ROOF_FADE_RATE * dt));
    if (Math.abs(r.opacity - target) < 0.01) r.opacity = target;
    r.object.visible = r.opacity > 0.01;
    for (const m of r.materials) {
      m.opacity = r.opacity;
      m.depthWrite = r.opacity > 0.99;
    }
    for (const mesh of r.meshes) mesh.castShadow = r.opacity > 0.5;
  });
}

/** Bushes you stand in turn see-through so you can see your plush. */
export function updateBushes(bushes: BushView[], localX: number, localY: number): void {
  for (const b of bushes) {
    const inside = Math.hypot(localX - b.circle.center.x, localY - b.circle.center.y) < b.circle.radius + 0.4;
    const opacity = inside ? 0.4 : 1;
    if (b.material.opacity === opacity) continue;
    b.material.opacity = opacity;
    b.material.transparent = inside;
    b.material.depthWrite = !inside;
    b.material.needsUpdate = true;
  }
}
