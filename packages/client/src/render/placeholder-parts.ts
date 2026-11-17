// Code-built placeholder parts, one builder per slot. Each part is authored relative to its
// slot's socket on the plush rig (see PlushView), exactly like the real models will be,
// so a real part replaces its placeholder without touching the rig.
import * as THREE from 'three';
import type { PartSlot } from '@stuffed/sim';
import { lighten, darken, toonMaterial, toonMesh } from './toon.ts';

const HEAD_RADIUS = 0.42;
const BODY_RADIUS = 0.4;

const BODY_COLORS: Record<string, string> = { pink: '#e9879f', blue: '#7fa7d9', mint: '#8fd3b6', cream: '#f1dfb8' };
const HEAD_COLORS: Record<string, string> = { bear: '#b5835a', frog: '#72c25e', shark: '#7f9fbf' };

const sphere = (r: number, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);

/** Legs parts expose their hip pivots so the rig can swing them. */
export interface PartObject extends THREE.Object3D {
  userData: { swing?: THREE.Object3D[] };
}

/** Main color of a body part; arms are dyed to match it. */
export function bodyColor(id: string): string {
  return BODY_COLORS[id] ?? '#cccccc';
}

export function buildPart(slot: PartSlot, id: string, outlineColor: string): PartObject {
  const builder = BUILDERS[slot][id];
  return builder ? builder(outlineColor) : missingPart();
}

type Builder = (outline: string) => PartObject;

const BUILDERS: Record<PartSlot, Record<string, Builder>> = {
  body: Object.fromEntries(Object.entries(BODY_COLORS).map(([id, c]) => [id, (o: string) => body(c, o)])),
  head: {
    bear: (o) => bearHead(o),
    frog: (o) => frogHead(o),
    shark: (o) => sharkHead(o),
  },
  legs: {
    chicken: (o) => legs(o, 'chicken'),
    stubby: (o) => legs(o, 'stubby'),
  },
  tail: {
    fox: (o) => foxTail(o),
    bunny: (o) => bunnyTail(o),
  },
  accessory: {
    bandage: (o) => bandage(o),
    button: (o) => bigButton(o),
    crown: () => crown(),
  },
};

function missingPart(): PartObject {
  const g = new THREE.Group();
  g.add(toonMesh(sphere(0.15), '#ff00ff', { outline: false }));
  return g;
}

// ---- body ----
function body(color: string, outline: string): PartObject {
  const g = new THREE.Group();
  const ball = toonMesh(sphere(BODY_RADIUS, 32, 24), color, { outlineColor: outline });
  ball.scale.set(1, 0.95, 0.9);
  g.add(ball);
  const belly = toonMesh(sphere(0.22), lighten(color, 0.5), { outline: false });
  belly.scale.set(1, 1.05, 0.45);
  belly.position.set(0, -0.02, 0.33);
  ball.add(belly);
  // running stitch around the belly patch
  const stitchGeo = new THREE.BoxGeometry(0.05, 0.014, 0.014);
  const stitchMat = toonMaterial(darken(color, 0.25), { map: null });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * 0.25;
    const y = Math.sin(a) * 0.25 * 1.05 - 0.02;
    const st = new THREE.Mesh(stitchGeo, stitchMat);
    st.position.set(x, y, Math.sqrt(Math.max(0, BODY_RADIUS ** 2 - x * x - y * y)) + 0.006);
    st.rotation.z = a + Math.PI / 2;
    ball.add(st);
  }
  return g;
}

// ---- heads (the head part carries its own face) ----
function headBall(color: string, outline: string): THREE.Group {
  const g = new THREE.Group();
  g.add(toonMesh(sphere(HEAD_RADIUS, 32, 24), color, { outlineColor: outline }));
  return g;
}

const eyeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16);
const glintGeo = sphere(0.018, 8, 6);

/** A sewn-on button eye at (x, y) on the head's front surface (or at an explicit z). */
function buttonEye(g: THREE.Object3D, x: number, y: number, z?: number): void {
  const surfaceZ = z ?? Math.sqrt(Math.max(0, HEAD_RADIUS ** 2 - x * x - y * y)) + 0.005;
  const eye = toonMesh(eyeGeo, '#2a1f2d', { outline: false });
  eye.rotation.x = Math.PI / 2;
  eye.position.set(x, y, surfaceZ);
  g.add(eye);
  const glint = toonMesh(glintGeo, '#ffffff', { outline: false, castShadow: false });
  glint.position.set(x + 0.02, y + 0.025, surfaceZ + 0.025);
  g.add(glint);
}

function bearHead(outline: string): PartObject {
  const c = HEAD_COLORS.bear!;
  const g = headBall(c, outline);
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.14), c, { outlineColor: outline });
    ear.scale.set(1, 1, 0.6);
    ear.position.set(0.28 * s, 0.3, -0.02);
    g.add(ear);
    const inner = toonMesh(sphere(0.08), lighten(c, 0.4), { outline: false });
    inner.scale.set(1, 1, 0.4);
    inner.position.set(0.28 * s, 0.3, 0.05);
    g.add(inner);
  }
  const snout = toonMesh(sphere(0.16), lighten(c, 0.45), { outline: 0.05, outlineColor: outline });
  snout.scale.set(1.1, 0.8, 0.7);
  snout.position.set(0, -0.08, 0.34);
  g.add(snout);
  const nose = toonMesh(sphere(0.055), '#2a1f2d', { outline: false });
  nose.scale.set(1.3, 0.9, 0.8);
  nose.position.set(0, -0.03, 0.45);
  g.add(nose);
  buttonEye(g, -0.16, 0.08);
  buttonEye(g, 0.16, 0.08);
  return g;
}

function frogHead(outline: string): PartObject {
  const c = HEAD_COLORS.frog!;
  const g = headBall(c, outline);
  for (const s of [-1, 1]) {
    const bump = toonMesh(sphere(0.16), c, { outlineColor: outline });
    bump.position.set(0.2 * s, 0.32, 0.14);
    g.add(bump);
    buttonEye(g, 0.2 * s, 0.34, 0.3);
  }
  const mouth = toonMesh(new THREE.TorusGeometry(0.2, 0.018, 6, 24, Math.PI), '#2a1f2d', { outline: false });
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.04, 0.36);
  g.add(mouth);
  return g;
}

function sharkHead(outline: string): PartObject {
  const c = HEAD_COLORS.shark!;
  const g = headBall(c, outline);
  const fin = toonMesh(new THREE.ConeGeometry(0.2, 0.42, 16), c, { outlineColor: outline });
  fin.scale.set(0.35, 1, 1);
  fin.position.set(0, 0.48, -0.06);
  fin.rotation.x = -0.4;
  g.add(fin);
  const belly = toonMesh(sphere(0.3), lighten(c, 0.55), { outline: false });
  belly.scale.set(1, 0.55, 0.5);
  belly.position.set(0, -0.16, 0.22);
  g.add(belly);
  const toothGeo = new THREE.ConeGeometry(0.03, 0.07, 6);
  for (let t = 0; t < 5; t++) {
    const x = -0.14 + t * 0.07;
    const tooth = toonMesh(toothGeo, '#ffffff', { outline: false });
    tooth.rotation.x = Math.PI;
    tooth.position.set(x, -0.13, Math.sqrt(HEAD_RADIUS ** 2 - x * x - 0.017) + 0.005);
    g.add(tooth);
  }
  buttonEye(g, -0.17, 0.1);
  buttonEye(g, 0.17, 0.1);
  return g;
}

// ---- legs ----
function legs(outline: string, kind: 'chicken' | 'stubby'): PartObject {
  const g: PartObject = new THREE.Group();
  const swing: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    if (kind === 'chicken') {
      hip.position.set(0.15 * side, 0.36, 0);
      const leg = toonMesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), '#f0a93b', { outline: 0.12, outlineColor: outline });
      leg.position.y = -0.17;
      hip.add(leg);
      const foot = toonMesh(sphere(0.1, 14, 10), '#f0a93b', { outlineColor: outline });
      foot.scale.set(1, 0.45, 1.5);
      foot.position.set(0, -0.33, 0.05);
      hip.add(foot);
    } else {
      hip.position.set(0.18 * side, 0.3, 0);
      const stump = toonMesh(new THREE.CylinderGeometry(0.11, 0.12, 0.22, 16), '#c9a27e', { outlineColor: outline });
      stump.position.y = -0.14;
      hip.add(stump);
      const paw = toonMesh(sphere(0.13, 16, 10), lighten('#c9a27e', 0.3), { outlineColor: outline });
      paw.scale.set(1, 0.5, 1.25);
      paw.position.set(0, -0.26, 0.03);
      hip.add(paw);
    }
    g.add(hip);
    swing.push(hip);
  }
  g.userData.swing = swing;
  return g;
}

// ---- tails ----
function foxTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(sphere(0.15), '#e8743b', { outlineColor: outline });
  tail.scale.set(1, 1, 2.2);
  tail.position.set(0, 0, -0.16);
  tail.rotation.x = 0.55;
  g.add(tail);
  // The tip is a child of the stretched tail, so its offset and scale are in that stretched space.
  const tip = toonMesh(sphere(0.12), '#fff7ee', { outlineColor: outline });
  tip.scale.set(1, 1, 1 / 2.2);
  tip.position.set(0, 0, -0.17);
  tail.add(tip);
  return g;
}

function bunnyTail(outline: string): PartObject {
  const g = new THREE.Group();
  const puff = toonMesh(sphere(0.17), '#fbf6ef', { outlineColor: outline });
  puff.position.set(0, -0.05, -0.04);
  g.add(puff);
  return g;
}

// ---- accessories (socket = head center) ----
/** Group placed on the head surface, facing outward along `dir`. */
function onHead(dir: THREE.Vector3): THREE.Group {
  const n = dir.clone().normalize();
  const g = new THREE.Group();
  g.position.copy(n.clone().multiplyScalar(HEAD_RADIUS));
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return g;
}

function bandage(outline: string): PartObject {
  const g = new THREE.Group();
  const patch = onHead(new THREE.Vector3(-0.22, 0.22, 0.3));
  for (const r of [0.7, -0.7]) {
    const strip = toonMesh(new THREE.BoxGeometry(0.2, 0.06, 0.02), '#fbf3e6', { outline: 0.15, outlineColor: outline });
    strip.rotation.z = r;
    patch.add(strip);
  }
  g.add(patch);
  return g;
}

function bigButton(outline: string): PartObject {
  const g = new THREE.Group();
  const spot = onHead(new THREE.Vector3(0.35, 0.2, 0.1));
  const button = toonMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20), '#e2574c', { outline: 0.1, outlineColor: outline });
  button.rotation.x = Math.PI / 2;
  spot.add(button);
  const holeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.05, 8);
  for (const [x, y] of [[-0.035, -0.035], [0.035, -0.035], [-0.035, 0.035], [0.035, 0.035]] as const) {
    const hole = toonMesh(holeGeo, '#2a1f2d', { outline: false });
    hole.rotation.x = Math.PI / 2;
    hole.position.set(x, y, 0.005);
    spot.add(hole);
  }
  g.add(spot);
  return g;
}

function crown(): PartObject {
  const g = new THREE.Group();
  const mat = toonMaterial('#f7c331', { side: THREE.DoubleSide });
  const band = toonMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 20, 1, true), '#f7c331', { outline: false, material: mat });
  band.position.y = 0.4;
  g.add(band);
  const spikeGeo = new THREE.ConeGeometry(0.05, 0.12, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = toonMesh(spikeGeo, '#f7c331', { outline: false, material: mat });
    spike.position.set(Math.cos(a) * 0.19, 0.51, Math.sin(a) * 0.19);
    g.add(spike);
  }
  return g;
}
