// Parts for the fifth set of animals: Turtle, Hedgehog, Koala and Octopus (heads, legs, tails and
// accessories; bodies are in animal-bodies.ts). Same sockets and scale as the others.
import * as THREE from 'three';
import type { PartSlot } from '@stuffed/sim';
import { ANIMAL_COLORS } from './animal-colors.ts';
import { darken, toonMaterial, toonMesh } from './toon.ts';

interface PartObject extends THREE.Object3D {
  userData: { swing?: THREE.Object3D[] };
}
type Builder = (outline: string) => PartObject;

const HEAD_RADIUS = 0.42;
const INK = '#2a1f2d';
const PINK = '#ff9cbf';
const sphere = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const onSurface = (x: number, y: number) => Math.sqrt(Math.max(0, HEAD_RADIUS ** 2 - x * x - y * y));

function headBall(color: string, outline: string): THREE.Group {
  const g = new THREE.Group();
  g.add(toonMesh(sphere(HEAD_RADIUS, 32, 24), color, { outlineColor: outline }));
  return g;
}

function eye(g: THREE.Object3D, x: number, y: number, size = 0.07, z?: number): void {
  const surfaceZ = z ?? onSurface(x, y) + 0.005;
  const e = toonMesh(new THREE.CylinderGeometry(size, size, 0.04, 16), INK, { outline: false });
  e.rotation.x = Math.PI / 2;
  e.position.set(x, y, surfaceZ);
  g.add(e);
  const glint = toonMesh(sphere(size * 0.26, 8, 6), '#ffffff', { outline: false, castShadow: false });
  glint.position.set(x + size * 0.3, y + size * 0.35, surfaceZ + 0.025);
  g.add(glint);
}

function cheeks(g: THREE.Object3D, y = -0.06, x = 0.24): void {
  for (const s of [-1, 1]) {
    const blush = toonMesh(sphere(0.05, 10, 8), PINK, { outline: false });
    blush.scale.set(1.3, 0.8, 0.3);
    blush.position.set(s * x, y, onSurface(x, y) - 0.01);
    g.add(blush);
  }
}

/** A curved smile drawn on the face. */
function smile(g: THREE.Object3D, y: number, width = 0.08): void {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(width, 0.012, 6, 16, Math.PI), toonMaterial(INK, { map: null }));
  arc.rotation.z = Math.PI;
  arc.position.set(0, y, onSurface(0, y) + 0.005);
  g.add(arc);
}

function pairOfLegs(hipX: number, hipY: number, build: (hip: THREE.Group, side: number) => void): PartObject {
  const g: PartObject = new THREE.Group();
  const swing: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(hipX * side, hipY, 0);
    build(hip, side);
    g.add(hip);
    swing.push(hip);
  }
  g.userData.swing = swing;
  return g;
}

// ---------- Turtle ----------
const TUR = ANIMAL_COLORS.turtle;

function turtleHead(outline: string): PartObject {
  const g = headBall(TUR.main, outline);
  // A slightly long, friendly face with big eyes and a wide smile.
  const snout = toonMesh(sphere(0.2), TUR.belly, { outline: false });
  snout.scale.set(1.3, 0.75, 0.6);
  snout.position.set(0, -0.12, 0.3);
  g.add(snout);
  for (const s of [-1, 1]) {
    const nostril = toonMesh(sphere(0.018, 6, 6), INK, { outline: false });
    nostril.position.set(s * 0.04, -0.06, 0.42);
    g.add(nostril);
  }
  smile(g, -0.17, 0.11);
  cheeks(g, -0.08, 0.27);
  eye(g, -0.16, 0.1, 0.075);
  eye(g, 0.16, 0.1, 0.075);
  return g;
}

function turtleLegs(outline: string): PartObject {
  return pairOfLegs(0.17, 0.3, (hip) => {
    // Stubby round legs with three toenails.
    const leg = toonMesh(new THREE.CylinderGeometry(0.11, 0.12, 0.24, 12), TUR.main, { outlineColor: outline });
    leg.position.y = -0.14;
    hip.add(leg);
    const foot = toonMesh(sphere(0.13, 14, 10), TUR.main, { outlineColor: outline });
    foot.scale.set(1, 0.5, 1.15);
    foot.position.set(0, -0.26, 0.03);
    hip.add(foot);
    for (const x of [-0.06, 0, 0.06]) {
      const nail = toonMesh(sphere(0.025, 8, 6), TUR.belly, { outline: false });
      nail.position.set(x, -0.26, 0.17);
      hip.add(nail);
    }
  });
}

/** A short pointy tail. */
function turtleTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(new THREE.ConeGeometry(0.08, 0.26, 10), TUR.main, { outline: 0.1, outlineColor: outline });
  tail.rotation.x = -Math.PI / 2 - 0.4;
  tail.position.set(0, -0.2, -0.16);
  g.add(tail);
  return g;
}

/** A red bandana tied round the head, the knot at the back. */
function bandana(outline: string): PartObject {
  const g = new THREE.Group();
  const band = toonMesh(new THREE.TorusGeometry(HEAD_RADIUS * 0.93, 0.05, 8, 32), '#e2433f', { outline: 0.06, outlineColor: outline });
  band.rotation.x = Math.PI / 2 - 0.25;
  band.position.y = 0.17;
  g.add(band);
  for (const s of [-1, 1]) {
    const tie = toonMesh(new THREE.ConeGeometry(0.06, 0.2, 6), '#e2433f', { outline: 0.1, outlineColor: outline });
    tie.position.set(s * 0.07, 0.12, -0.45);
    tie.rotation.set(-0.6, 0, s * 0.9);
    g.add(tie);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dot = toonMesh(sphere(0.015, 6, 6), '#ffffff', { outline: false });
    dot.position.set(Math.sin(a) * HEAD_RADIUS * 0.98, 0.17 + Math.cos(a) * 0.1, Math.cos(a) * HEAD_RADIUS * 0.98);
    g.add(dot);
  }
  return g;
}

// ---------- Hedgehog ----------
const HED = ANIMAL_COLORS.hedgehog;
const SPIKES = '#6b4630';

/** Spikes all over the top and back of a ball. */
function spikes(g: THREE.Object3D, radius: number, count: number, outline: string, front = 0.2): void {
  for (let i = 0; i < count; i++) {
    // Spread on the back half and over the top (a golden-angle spiral).
    const t = (i + 0.5) / count;
    const y = 1 - t * 1.4;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    const n = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    if (n.z > front) continue;
    const spike = toonMesh(new THREE.ConeGeometry(0.06, 0.2, 6), SPIKES, { outline: 0.12, outlineColor: outline });
    spike.position.copy(n.clone().multiplyScalar(radius + 0.05));
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g.add(spike);
  }
}

function hedgehogHead(outline: string): PartObject {
  const g = headBall(HED.belly, outline);
  spikes(g, HEAD_RADIUS, 48, outline, 0.15);
  // A pointy snout with a little black nose, and round ears.
  const snout = toonMesh(new THREE.ConeGeometry(0.13, 0.26, 14), HED.belly, { outlineColor: outline });
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.08, 0.46);
  g.add(snout);
  const nose = toonMesh(sphere(0.045, 10, 8), INK, { outline: false });
  nose.position.set(0, -0.08, 0.6);
  g.add(nose);
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.07, 10, 8), HED.main, { outlineColor: outline });
    ear.scale.z = 0.5;
    ear.position.set(s * 0.26, 0.24, 0.18);
    g.add(ear);
  }
  cheeks(g, -0.08, 0.25);
  eye(g, -0.14, 0.08, 0.06);
  eye(g, 0.14, 0.08, 0.06);
  return g;
}

function hedgehogLegs(outline: string): PartObject {
  return pairOfLegs(0.15, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 10), HED.main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.1, 12, 10), HED.belly, { outlineColor: outline });
    paw.scale.set(1, 0.5, 1.3);
    paw.position.set(0, -0.26, 0.04);
    hip.add(paw);
  });
}

/** A tiny tail half hidden in spikes. */
function hedgehogTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(sphere(0.07, 10, 8), HED.main, { outlineColor: outline });
  tail.position.set(0, -0.18, -0.08);
  g.add(tail);
  for (const [x, y] of [[-0.08, -0.08], [0.08, -0.08], [0, -0.02]] as const) {
    const spike = toonMesh(new THREE.ConeGeometry(0.05, 0.18, 6), SPIKES, { outline: 0.12, outlineColor: outline });
    spike.position.set(x, y, -0.12);
    spike.rotation.x = -1.9;
    g.add(spike);
  }
  return g;
}

/** A red apple speared on the head spikes, tipped to one side, with a leaf. */
function spikedApple(outline: string): PartObject {
  const g = new THREE.Group();
  const apple = new THREE.Group();
  apple.position.set(0.1, 0.47, -0.04);
  apple.rotation.set(-0.2, 0, -0.35);
  const fruit = toonMesh(sphere(0.14, 18, 14), '#e2433f', { outlineColor: outline });
  fruit.scale.set(1.05, 0.9, 1.05);
  apple.add(fruit);
  const shine = toonMesh(sphere(0.03, 8, 6), '#ff9a8a', { outline: false });
  shine.position.set(-0.06, 0.06, 0.1);
  apple.add(shine);
  const stem = toonMesh(new THREE.CylinderGeometry(0.012, 0.015, 0.09, 6), '#7a4a26', { outline: false });
  stem.position.y = 0.14;
  apple.add(stem);
  const leaf = toonMesh(sphere(0.045, 10, 8), '#6fbf4a', { outline: 0.15, outlineColor: outline });
  leaf.scale.set(1.8, 0.3, 0.8);
  leaf.position.set(0.06, 0.16, 0);
  leaf.rotation.z = 0.4;
  apple.add(leaf);
  g.add(apple);
  return g;
}

// ---------- Koala ----------
const KOA = ANIMAL_COLORS.koala;

function koalaHead(outline: string): PartObject {
  const g = headBall(KOA.main, outline);
  // Big fluffy round ears with white fluff inside.
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.19, 16, 12), KOA.main, { outlineColor: outline });
    ear.scale.z = 0.55;
    ear.position.set(s * 0.36, 0.26, -0.02);
    g.add(ear);
    const fluff = toonMesh(sphere(0.12, 14, 10), KOA.belly, { outline: false });
    fluff.scale.z = 0.4;
    fluff.position.set(s * 0.36, 0.26, 0.07);
    g.add(fluff);
  }
  // A big dark oval nose.
  const nose = toonMesh(sphere(0.1, 14, 10), '#3a3440', { outline: false });
  nose.scale.set(0.85, 1.25, 0.6);
  nose.position.set(0, -0.04, 0.4);
  g.add(nose);
  cheeks(g, -0.1, 0.24);
  eye(g, -0.17, 0.08, 0.055);
  eye(g, 0.17, 0.08, 0.055);
  return g;
}

function koalaLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 12), KOA.main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.12, 14, 10), KOA.main, { outlineColor: outline });
    paw.scale.set(1, 0.55, 1.2);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
    for (const x of [-0.05, 0.05]) {
      const claw = toonMesh(new THREE.ConeGeometry(0.02, 0.07, 6), '#3a3440', { outline: false });
      claw.rotation.x = Math.PI / 2;
      claw.position.set(x, -0.26, 0.17);
      hip.add(claw);
    }
  });
}

/** A little fluffy stub. */
function koalaTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(new THREE.IcosahedronGeometry(0.09, 1), KOA.belly, { outline: 0.1, outlineColor: outline });
  tail.position.set(0, -0.12, -0.06);
  g.add(tail);
  return g;
}

/** A floppy striped nightcap with a pom-pom: sleepy. */
function nightcap(outline: string): PartObject {
  const g = new THREE.Group();
  const cap = new THREE.Group();
  cap.rotation.set(-0.25, 0, 0.35);
  // Out along its tilt, so its brim sits on the head all the way round (set straight up, the
  // tilted brim sank into the head on its low side).
  cap.position.set(0, 1, 0).applyEuler(cap.rotation).multiplyScalar(0.33);
  const cone = toonMesh(new THREE.ConeGeometry(0.3, 0.6, 18, 4), '#5d9cf5', { outline: 0.06, outlineColor: outline });
  cone.position.y = 0.3;
  cap.add(cone);
  for (const y of [0.12, 0.32]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3 * (1 - y / 0.6) + 0.005, 0.025, 6, 20), toonMaterial('#fffaf3', { map: null }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    cap.add(ring);
  }
  const rim = toonMesh(new THREE.TorusGeometry(0.3, 0.06, 8, 24), '#fffaf3', { outline: 0.1, outlineColor: outline });
  rim.rotation.x = Math.PI / 2;
  cap.add(rim);
  const pom = toonMesh(new THREE.IcosahedronGeometry(0.08, 1), '#fffaf3', { outline: 0.12, outlineColor: outline });
  pom.position.y = 0.62;
  cap.add(pom);
  g.add(cap);
  return g;
}

// ---------- Octopus ----------
const OCT = ANIMAL_COLORS.octopus;

function octopusHead(outline: string): PartObject {
  const g = headBall(OCT.main, outline);
  // A taller dome with spots, and big round eyes.
  const dome = toonMesh(sphere(0.34, 24, 16), OCT.main, { outlineColor: outline });
  dome.scale.set(1, 1.2, 1);
  dome.position.set(0, 0.22, -0.08);
  g.add(dome);
  for (const [x, y, r] of [[-0.16, 0.42, 0.05], [0.12, 0.48, 0.06], [0.22, 0.32, 0.04], [-0.04, 0.56, 0.04]] as const) {
    const spot = toonMesh(sphere(r, 10, 8), darken(OCT.main, 0.15).getStyle(), { outline: false });
    spot.scale.z = 0.4;
    // On the front of the dome (an ellipsoid: 0.34 wide, 0.41 tall, centered at 0.22 up, 0.08 back).
    const k = Math.max(0, 1 - (x / 0.34) ** 2 - ((y - 0.22) / 0.41) ** 2);
    const z = -0.08 + 0.34 * Math.sqrt(k) - 0.012;
    spot.position.set(x, y, z);
    spot.lookAt(new THREE.Vector3(x * 2, 0.22 + (y - 0.22) * 2, z + 1));
    g.add(spot);
  }
  smile(g, -0.16, 0.06);
  cheeks(g, -0.08, 0.25);
  eye(g, -0.15, 0.06, 0.08);
  eye(g, 0.15, 0.06, 0.08);
  return g;
}

/** Eight wiggly tentacles, four on each side fanned from back to front, evenly round the base
 *  (each side swings as one leg). */
function octopusLegs(outline: string): PartObject {
  return pairOfLegs(0.12, 0.3, (hip, side) => {
    for (let i = 0; i < 4; i++) {
      const a = -1.15 + i * 0.8;
      const out = new THREE.Vector3(Math.cos(a) * side, 0, Math.sin(a));
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(out.x * 0.12, -0.15, out.z * 0.12),
        new THREE.Vector3(out.x * 0.2, -0.28, out.z * 0.2),
        new THREE.Vector3(out.x * 0.32, -0.26, out.z * 0.32),
      ]);
      const tentacle = toonMesh(new THREE.TubeGeometry(curve, 12, 0.045, 8), OCT.main, { outline: 0.12, outlineColor: outline });
      hip.add(tentacle);
      const tip = toonMesh(sphere(0.045, 8, 6), OCT.main, { outline: false });
      tip.position.copy(curve.getPoint(1));
      hip.add(tip);
      const sucker = toonMesh(sphere(0.022, 6, 6), OCT.belly, { outline: false });
      sucker.position.copy(curve.getPoint(0.7)).add(new THREE.Vector3(0, -0.035, 0));
      hip.add(sucker);
    }
  });
}

/** One more tentacle curling up behind. */
function octopusTail(outline: string): PartObject {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, -0.05),
    new THREE.Vector3(0, -0.15, -0.25),
    new THREE.Vector3(0, 0.02, -0.38),
    new THREE.Vector3(0.05, 0.12, -0.3),
  ]);
  g.add(toonMesh(new THREE.TubeGeometry(curve, 16, 0.05, 8), OCT.main, { outline: 0.12, outlineColor: outline }));
  for (const t of [0.35, 0.6, 0.85]) {
    const sucker = toonMesh(sphere(0.022, 6, 6), OCT.belly, { outline: false });
    sucker.position.copy(curve.getPoint(t)).add(new THREE.Vector3(0, -0.04, 0));
    g.add(sucker);
  }
  return g;
}

/** A white sailor hat with a blue band. */
function sailorHat(outline: string): PartObject {
  const g = new THREE.Group();
  const hat = new THREE.Group();
  // On a plain head; the octopus's taller dome lifts it (see HEAD_TOP_LIFT).
  hat.position.set(0.05, 0.47, -0.02);
  hat.rotation.z = -0.25;
  const crown = toonMesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 20), '#fffaf3', { outline: 0.08, outlineColor: outline });
  hat.add(crown);
  const brim = toonMesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 24), '#fffaf3', { outline: 0.08, outlineColor: outline });
  brim.position.y = -0.07;
  hat.add(brim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.05, 20), toonMaterial('#3d7ff2', { map: null }));
  band.position.y = -0.02;
  hat.add(band);
  g.add(hat);
  return g;
}

export const FINAL_PARTS: Record<Exclude<PartSlot, 'body'>, Record<'turtle' | 'hedgehog' | 'koala' | 'octopus', Builder>> = {
  head: { turtle: turtleHead, hedgehog: hedgehogHead, koala: koalaHead, octopus: octopusHead },
  legs: { turtle: turtleLegs, hedgehog: hedgehogLegs, koala: koalaLegs, octopus: octopusLegs },
  tail: { turtle: turtleTail, hedgehog: hedgehogTail, koala: koalaTail, octopus: octopusTail },
  accessory: { turtle: bandana, hedgehog: spikedApple, koala: nightcap, octopus: sailorHat },
};
