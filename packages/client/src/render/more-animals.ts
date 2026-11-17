// Parts for the second set of animals: Dino, Owl, Axolotl and Penguin. Same sockets and scale
// as the first four (see placeholder-parts.ts): heads are 0.42 balls around the head socket,
// bodies 0.4 balls, legs hang from hip pivots the rig swings, tails stick out behind (-z),
// accessories sit on the head.
import * as THREE from 'three';
import type { PartSlot } from '@stuffed/sim';
import { ANIMAL_COLORS } from './animal-colors.ts';
import { darken, lighten, toonMaterial, toonMesh } from './toon.ts';

export interface PartObject extends THREE.Object3D {
  userData: { swing?: THREE.Object3D[] };
}

type Builder = (outline: string) => PartObject;

const HEAD_RADIUS = 0.42;
const INK = '#2a1f2d';
const sphere = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const flat = (c: string) => toonMaterial(c, { map: null });

function headBall(color: string, outline: string): THREE.Group {
  const g = new THREE.Group();
  g.add(toonMesh(sphere(HEAD_RADIUS, 32, 24), color, { outlineColor: outline }));
  return g;
}

/** A sewn-on button eye on the head's front (or at an explicit z). */
function eye(g: THREE.Object3D, x: number, y: number, size = 0.07, z?: number): void {
  const surfaceZ = z ?? Math.sqrt(Math.max(0, HEAD_RADIUS ** 2 - x * x - y * y)) + 0.005;
  const e = toonMesh(new THREE.CylinderGeometry(size, size, 0.04, 16), INK, { outline: false });
  e.rotation.x = Math.PI / 2;
  e.position.set(x, y, surfaceZ);
  g.add(e);
  const glint = toonMesh(sphere(size * 0.26, 8, 6), '#ffffff', { outline: false, castShadow: false });
  glint.position.set(x + size * 0.3, y + size * 0.35, surfaceZ + 0.025);
  g.add(glint);
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

/** A body ball with a belly patch (the rig dyes the arms in the main color). */
function body(main: string, belly: string, outline: string, extra?: (ball: THREE.Mesh) => void): PartObject {
  const g = new THREE.Group();
  const ball = toonMesh(sphere(0.4, 32, 24), main, { outlineColor: outline });
  ball.scale.set(1, 0.95, 0.9);
  g.add(ball);
  const patch = toonMesh(sphere(0.24), belly, { outline: false });
  patch.scale.set(1, 1.1, 0.45);
  patch.position.set(0, -0.03, 0.31);
  ball.add(patch);
  extra?.(ball);
  return g;
}

/** Placed on the head's surface, facing outward along `dir` (for accessories). */
function onHead(dir: THREE.Vector3): THREE.Group {
  const n = dir.clone().normalize();
  const g = new THREE.Group();
  g.position.copy(n.clone().multiplyScalar(HEAD_RADIUS));
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return g;
}

// ---------- Dino ----------
const DINO = ANIMAL_COLORS.dino;

function dinoHead(outline: string): PartObject {
  const g = headBall(DINO.main, outline);
  // A long rounded snout with nostrils and a toothy grin.
  const snout = toonMesh(sphere(0.24), DINO.main, { outlineColor: outline });
  snout.scale.set(1.15, 0.8, 1.2);
  snout.position.set(0, -0.08, 0.36);
  g.add(snout);
  for (const s of [-1, 1]) {
    const nostril = toonMesh(sphere(0.03, 8, 6), INK, { outline: false });
    nostril.position.set(s * 0.08, -0.02, 0.63);
    g.add(nostril);
  }
  for (let t = 0; t < 4; t++) {
    const tooth = toonMesh(new THREE.ConeGeometry(0.025, 0.06, 5), '#ffffff', { outline: false });
    tooth.rotation.x = Math.PI;
    tooth.position.set(-0.11 + t * 0.075, -0.2, 0.55);
    g.add(tooth);
  }
  eye(g, -0.18, 0.12);
  eye(g, 0.18, 0.12);
  return g;
}

/** Back plates along the spine, in the belly color. */
function dinoPlates(parent: THREE.Object3D, count: number, startZ: number, y: number, size: number, outline: string): void {
  for (let i = 0; i < count; i++) {
    const plate = toonMesh(new THREE.ConeGeometry(size, size * 1.6, 4), '#f0a93b', { outline: 0.1, outlineColor: outline });
    plate.scale.set(0.35, 1, 1);
    plate.position.set(0, y + Math.sin((i / count) * Math.PI) * 0.06, startZ - i * size * 1.3);
    parent.add(plate);
  }
}

function dinoBody(outline: string): PartObject {
  return body(DINO.main, DINO.belly, outline, (ball) => {
    const back = new THREE.Group();
    back.rotation.x = -0.9;
    dinoPlates(back, 3, 0.0, 0.42, 0.09, outline);
    ball.add(back);
  });
}

function dinoLegs(outline: string): PartObject {
  return pairOfLegs(0.19, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 14), DINO.main, { outlineColor: outline });
    leg.position.y = -0.14;
    hip.add(leg);
    const foot = toonMesh(sphere(0.14, 14, 10), DINO.main, { outlineColor: outline });
    foot.scale.set(1, 0.5, 1.3);
    foot.position.set(0, -0.27, 0.04);
    hip.add(foot);
    for (const x of [-0.07, 0, 0.07]) {
      const claw = toonMesh(new THREE.ConeGeometry(0.03, 0.07, 5), '#fbf6ef', { outline: false });
      claw.rotation.x = Math.PI / 2;
      claw.position.set(x, -0.28, 0.22);
      hip.add(claw);
    }
  });
}

function dinoTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(new THREE.ConeGeometry(0.17, 0.75, 14), DINO.main, { outlineColor: outline });
  tail.rotation.x = -Math.PI / 2 - 0.35;
  tail.position.set(0, -0.12, -0.32);
  g.add(tail);
  const spikes = new THREE.Group();
  spikes.position.set(0, -0.12, -0.32);
  spikes.rotation.x = -0.35;
  dinoPlates(spikes, 3, 0.15, 0.12, 0.06, outline);
  g.add(spikes);
  return g;
}

/** A crest of three plates over the top of the head. */
function dinoCrest(outline: string): PartObject {
  const g = new THREE.Group();
  [0.22, 0.0, -0.22].forEach((z, i) => {
    const plate = toonMesh(new THREE.ConeGeometry(0.11 - Math.abs(i - 1) * 0.02, 0.22, 4), '#f0a93b', { outline: 0.1, outlineColor: outline });
    plate.scale.set(0.35, 1, 1);
    plate.position.set(0, 0.46 - Math.abs(z) * 0.25, z);
    g.add(plate);
  });
  return g;
}

// ---------- Owl ----------
const OWL = ANIMAL_COLORS.owl;

function owlHead(outline: string): PartObject {
  const g = headBall(OWL.main, outline);
  // Big pale eye discs with large button eyes, a little beak, and ear tufts.
  for (const s of [-1, 1]) {
    const disc = toonMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), OWL.belly, { outline: 0.08, outlineColor: outline });
    disc.rotation.x = Math.PI / 2;
    disc.position.set(s * 0.15, 0.06, 0.38);
    g.add(disc);
    eye(g, s * 0.15, 0.06, 0.08, 0.41);
    const tuft = toonMesh(new THREE.ConeGeometry(0.08, 0.24, 8), OWL.main, { outlineColor: outline });
    tuft.position.set(s * 0.24, 0.42, 0.02);
    tuft.rotation.z = -s * 0.35;
    g.add(tuft);
  }
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.13, 8), '#f0a93b', { outline: 0.12, outlineColor: outline });
  beak.rotation.x = Math.PI / 2 + 0.6;
  beak.position.set(0, -0.08, 0.43);
  g.add(beak);
  return g;
}

function owlBody(outline: string): PartObject {
  return body(OWL.main, OWL.belly, outline, (ball) => {
    // Little V marks on the belly, like feathers.
    for (const [x, y] of [[-0.08, 0.05], [0.08, 0.05], [0, -0.07], [-0.08, -0.19], [0.08, -0.19]] as const) {
      const v = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 4, 8, Math.PI), flat(lighten(OWL.main, 0.1).getStyle()));
      v.rotation.z = Math.PI;
      v.position.set(x, y, 0.4);
      ball.add(v);
    }
  });
}

function owlLegs(outline: string): PartObject {
  return pairOfLegs(0.14, 0.34, (hip) => {
    const leg = toonMesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), OWL.belly, { outline: 0.12, outlineColor: outline });
    leg.position.y = -0.16;
    hip.add(leg);
    for (const a of [-0.5, 0, 0.5]) {
      const talon = toonMesh(new THREE.CapsuleGeometry(0.025, 0.12, 3, 6), '#f0a93b', { outline: 0.15, outlineColor: outline });
      talon.rotation.set(Math.PI / 2, 0, 0);
      talon.position.set(Math.sin(a) * 0.08, -0.31, 0.08 + Math.cos(a) * 0.02);
      hip.add(talon);
    }
  });
}

/** Folded wings on the back, like a little cape. */
function owlWings(outline: string): PartObject {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const wing = toonMesh(sphere(0.22), darken(OWL.main, 0.08).getStyle(), { outlineColor: outline });
    wing.scale.set(0.45, 1.2, 0.35);
    wing.position.set(s * 0.17, 0.05, 0.06);
    wing.rotation.z = s * 0.25;
    g.add(wing);
  }
  return g;
}

/** Round glasses, perched on the front of the head. */
function owlGlasses(outline: string): PartObject {
  const g = new THREE.Group();
  const front = onHead(new THREE.Vector3(0, 0.15, 1));
  for (const s of [-1, 1]) {
    const rim = toonMesh(new THREE.TorusGeometry(0.1, 0.02, 8, 24), INK, { outline: false });
    rim.position.set(s * 0.14, -0.02, 0.06);
    front.add(rim);
  }
  const bridge = toonMesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), INK, { outline: false });
  bridge.position.set(0, 0.0, 0.06);
  front.add(bridge);
  void outline;
  g.add(front);
  return g;
}

// ---------- Axolotl ----------
const AXO = ANIMAL_COLORS.axolotl;
const GILL = '#ff5f97';

function axolotlHead(outline: string): PartObject {
  const g = new THREE.Group();
  // A wide, flattish head with a smile and three frilly gills each side.
  const head = toonMesh(sphere(HEAD_RADIUS, 32, 24), AXO.main, { outlineColor: outline });
  head.scale.set(1.15, 0.9, 1);
  g.add(head);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const gill = toonMesh(new THREE.CapsuleGeometry(0.04, 0.2, 4, 8), GILL, { outline: 0.12, outlineColor: outline });
      gill.position.set(s * 0.5, 0.18 - i * 0.14, -0.05);
      gill.rotation.z = s * (-0.9 + i * 0.5);
      g.add(gill);
    }
  }
  const smile = toonMesh(new THREE.TorusGeometry(0.12, 0.016, 6, 20, Math.PI), INK, { outline: false });
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.06, 0.4);
  g.add(smile);
  eye(g, -0.2, 0.08, 0.055, 0.37);
  eye(g, 0.2, 0.08, 0.055, 0.37);
  return g;
}

function axolotlBody(outline: string): PartObject {
  return body(AXO.main, AXO.belly, outline, (ball) => {
    for (const [x, y] of [[-0.25, 0.18], [0.27, 0.05], [-0.2, -0.2]] as const) {
      const spot = toonMesh(sphere(0.05, 10, 8), darken(AXO.main, 0.15).getStyle(), { outline: false });
      spot.scale.set(1, 1, 0.3);
      spot.position.set(x, y, 0.3);
      ball.add(spot);
    }
  });
}

function axolotlLegs(outline: string): PartObject {
  return pairOfLegs(0.2, 0.28, (hip) => {
    const leg = toonMesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), AXO.main, { outline: 0.1, outlineColor: outline });
    leg.position.y = -0.12;
    hip.add(leg);
    for (const a of [-0.4, 0, 0.4]) {
      const toe = toonMesh(sphere(0.035, 8, 6), AXO.main, { outline: 0.15, outlineColor: outline });
      toe.position.set(Math.sin(a) * 0.08, -0.25, 0.06 + Math.cos(a) * 0.03);
      hip.add(toe);
    }
  });
}

/** A long, flat, finned tail. */
function axolotlTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(sphere(0.2), AXO.main, { outlineColor: outline });
  tail.scale.set(0.45, 1.1, 2.4);
  tail.position.set(0, -0.08, -0.36);
  tail.rotation.x = 0.25;
  g.add(tail);
  const fin = toonMesh(sphere(0.2), AXO.belly, { outline: 0.06, outlineColor: outline });
  fin.scale.set(0.12, 1.6, 2.2);
  fin.position.set(0, -0.04, -0.4);
  fin.rotation.x = 0.25;
  g.add(fin);
  return g;
}

/** A little starfish hair clip. */
function starClip(outline: string): PartObject {
  const g = new THREE.Group();
  const spot = onHead(new THREE.Vector3(0.3, 0.35, 0.15));
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.05 : 0.13;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const star = toonMesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }), '#ffb347', { outline: 0.08, outlineColor: outline });
  spot.add(star);
  g.add(spot);
  return g;
}

// ---------- Penguin ----------
const PEN = ANIMAL_COLORS.penguin;

function penguinHead(outline: string): PartObject {
  const g = headBall(PEN.main, outline);
  // A white face patch, an orange beak.
  const face = toonMesh(sphere(0.3), PEN.belly, { outline: false });
  face.scale.set(1.25, 0.95, 0.55);
  face.position.set(0, -0.02, 0.24);
  g.add(face);
  const beak = toonMesh(new THREE.ConeGeometry(0.07, 0.16, 10), '#f7a531', { outline: 0.12, outlineColor: outline });
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.06, 0.48);
  g.add(beak);
  // Eyes sit on the white face patch, not under it.
  eye(g, -0.13, 0.07, 0.065, 0.42);
  eye(g, 0.13, 0.07, 0.065, 0.42);
  return g;
}

function penguinBody(outline: string): PartObject {
  return body(PEN.main, PEN.belly, outline, (ball) => {
    // A bigger white tummy than the others.
    const tummy = toonMesh(sphere(0.32), PEN.belly, { outline: false });
    tummy.scale.set(0.95, 1.05, 0.5);
    tummy.position.set(0, -0.03, 0.2);
    ball.add(tummy);
    const bow = toonMesh(sphere(0.06, 10, 8), '#e2574c', { outline: 0.12, outlineColor: outline });
    bow.scale.set(1.8, 1, 1);
    bow.position.set(0, 0.27, 0.32);
    ball.add(bow);
  });
}

function penguinLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.34, (hip) => {
    // Short dark legs down to big orange feet.
    const leg = toonMesh(new THREE.CylinderGeometry(0.08, 0.09, 0.22, 12), PEN.main, { outlineColor: outline });
    leg.position.y = -0.14;
    hip.add(leg);
    const foot = toonMesh(sphere(0.13, 14, 10), '#f7a531', { outlineColor: outline });
    foot.scale.set(1.1, 0.35, 1.6);
    foot.position.set(0, -0.29, 0.1);
    hip.add(foot);
  });
}

/** A short stiff tail and a pair of flippers. */
function penguinTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(new THREE.ConeGeometry(0.14, 0.26, 4), PEN.main, { outlineColor: outline });
  tail.rotation.x = -Math.PI / 2 - 0.8;
  tail.position.set(0, -0.3, -0.12);
  g.add(tail);
  return g;
}

/** A knitted beanie with a pompom. */
function beanie(outline: string): PartObject {
  const g = new THREE.Group();
  const hat = toonMesh(new THREE.SphereGeometry(0.33, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#e2574c', {
    outlineColor: outline,
    material: toonMaterial('#e2574c', { side: THREE.DoubleSide }),
  });
  hat.position.y = 0.2;
  g.add(hat);
  const brim = toonMesh(new THREE.TorusGeometry(0.31, 0.06, 8, 24), '#fbfbfb', { outline: 0.06, outlineColor: outline });
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.21;
  g.add(brim);
  const pom = toonMesh(new THREE.IcosahedronGeometry(0.1, 1), '#fbfbfb', { outline: 0.08, outlineColor: outline });
  pom.position.y = 0.55;
  g.add(pom);
  return g;
}

export const MORE_PARTS: Record<PartSlot, Record<'dino' | 'owl' | 'axolotl' | 'penguin', Builder>> = {
  head: { dino: dinoHead, owl: owlHead, axolotl: axolotlHead, penguin: penguinHead },
  body: { dino: dinoBody, owl: owlBody, axolotl: axolotlBody, penguin: penguinBody },
  legs: { dino: dinoLegs, owl: owlLegs, axolotl: axolotlLegs, penguin: penguinLegs },
  tail: { dino: dinoTail, owl: owlWings, axolotl: axolotlTail, penguin: penguinTail },
  accessory: { dino: dinoCrest, owl: owlGlasses, axolotl: starClip, penguin: beanie },
};
