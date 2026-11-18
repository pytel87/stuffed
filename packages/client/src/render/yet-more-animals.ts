// Parts for the fourth set of animals: Panda, Pig, Lion and Elephant (heads, legs, tails and
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

function pairOfLegs(hipX: number, hipY: number, build: (hip: THREE.Group) => void): PartObject {
  const g: PartObject = new THREE.Group();
  const swing: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(hipX * side, hipY, 0);
    build(hip);
    g.add(hip);
    swing.push(hip);
  }
  g.userData.swing = swing;
  return g;
}

// ---------- Panda ----------
const PANDA = ANIMAL_COLORS.panda;
const PANDA_BLACK = '#2f2d38';

function pandaHead(outline: string): PartObject {
  const g = headBall(PANDA.main, outline);
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.12, 14, 10), PANDA_BLACK, { outlineColor: outline });
    ear.scale.z = 0.6;
    ear.position.set(s * 0.27, 0.31, -0.02);
    g.add(ear);
    // Droopy black eye patches, with the eyes on them.
    const patch = toonMesh(sphere(0.1, 14, 10), PANDA_BLACK, { outline: false });
    patch.scale.set(0.85, 1.2, 0.35);
    patch.rotation.z = s * 0.55;
    patch.position.set(s * 0.15, 0.03, onSurface(0.15, 0.03) - 0.02);
    g.add(patch);
    eye(g, s * 0.15, 0.06, 0.045, onSurface(0.15, 0.06) + 0.02);
  }
  const muzzle = toonMesh(sphere(0.1), '#ffffff', { outline: false });
  muzzle.scale.set(1.3, 0.85, 0.6);
  muzzle.position.set(0, -0.12, 0.36);
  g.add(muzzle);
  const nose = toonMesh(sphere(0.04, 10, 8), PANDA_BLACK, { outline: false });
  nose.scale.set(1.4, 0.85, 0.8);
  nose.position.set(0, -0.07, 0.42);
  g.add(nose);
  cheeks(g, -0.13, 0.26);
  return g;
}

function pandaLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.1, 0.105, 0.22, 12), PANDA_BLACK, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.12, 14, 10), PANDA_BLACK, { outlineColor: outline });
    paw.scale.set(1, 0.6, 1.2);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
    const pad = toonMesh(sphere(0.045, 10, 8), '#5a5666', { outline: false });
    pad.scale.set(1, 0.6, 0.4);
    pad.position.set(0, -0.25, 0.16);
    hip.add(pad);
  });
}

/** A short round black tail. */
function pandaTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(new THREE.IcosahedronGeometry(0.11, 2), PANDA_BLACK, { outline: 0.08, outlineColor: outline });
  tail.position.set(0, -0.1, -0.06);
  g.add(tail);
  return g;
}

/** A sprig of bamboo stuck on the head. */
function bamboo(outline: string): PartObject {
  const g = new THREE.Group();
  const sprig = new THREE.Group();
  sprig.position.set(0.2, 0.42, 0.02);
  sprig.rotation.z = -0.45;
  const stalk = toonMesh(new THREE.CylinderGeometry(0.035, 0.04, 0.36, 10), '#8cc65a', { outline: 0.1, outlineColor: outline });
  stalk.position.y = 0.12;
  sprig.add(stalk);
  for (const y of [0.02, 0.14, 0.26]) {
    const node = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), toonMaterial('#5f9a3a', { map: null }));
    node.rotation.x = Math.PI / 2;
    node.position.y = y;
    sprig.add(node);
  }
  for (const [a, y] of [[0.9, 0.22], [-0.8, 0.28], [0.4, 0.32]] as const) {
    const leaf = toonMesh(sphere(0.05, 10, 8), '#6fbf4a', { outline: 0.12, outlineColor: outline });
    leaf.scale.set(0.45, 0.2, 2.2);
    leaf.position.set(Math.sin(a) * 0.08, y, Math.cos(a) * 0.08);
    leaf.rotation.y = a;
    leaf.rotation.x = -0.4;
    sprig.add(leaf);
  }
  g.add(sprig);
  return g;
}

// ---------- Pig ----------
const PIG = ANIMAL_COLORS.pig;
const SNOUT = '#ff8fa6';

function pigHead(outline: string): PartObject {
  const g = headBall(PIG.main, outline);
  // Floppy ears folding forward.
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.22, 0.33, 0.06);
    ear.rotation.set(0.35, 0, -s * 0.5);
    const flap = toonMesh(sphere(0.13, 14, 10), PIG.main, { outlineColor: outline });
    flap.scale.set(0.85, 1, 0.3);
    // The tip folds forward over the brow.
    flap.position.y = 0.08;
    flap.rotation.x = 0.9;
    ear.add(flap);
    const inner = toonMesh(sphere(0.08, 12, 8), SNOUT, { outline: false });
    inner.scale.set(0.8, 1, 0.25);
    inner.position.set(0, 0.06, 0.04);
    inner.rotation.x = 0.9;
    ear.add(inner);
    g.add(ear);
  }
  const snout = toonMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 20), SNOUT, { outlineColor: outline });
  snout.rotation.x = Math.PI / 2;
  snout.scale.z = 0.8;
  snout.position.set(0, -0.08, 0.41);
  g.add(snout);
  for (const s of [-1, 1]) {
    const nostril = toonMesh(sphere(0.025, 8, 6), darken(SNOUT, 0.45).getStyle(), { outline: false });
    nostril.scale.set(0.8, 1.3, 0.4);
    nostril.position.set(s * 0.045, -0.08, 0.475);
    g.add(nostril);
  }
  cheeks(g, -0.05, 0.27);
  eye(g, -0.15, 0.1, 0.06);
  eye(g, 0.15, 0.1, 0.06);
  return g;
}

function pigLegs(outline: string): PartObject {
  return pairOfLegs(0.17, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.09, 0.095, 0.2, 12), PIG.main, { outlineColor: outline });
    leg.position.y = -0.12;
    hip.add(leg);
    const hoof = toonMesh(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 14), '#b8607a', { outlineColor: outline });
    hoof.position.y = -0.26;
    hip.add(hoof);
    const split = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.1, 0.06), toonMaterial('#7a3a4e', { map: null }));
    split.position.set(0, -0.26, 0.085);
    hip.add(split);
  });
}

/** A curly corkscrew tail. */
function pigTail(outline: string): PartObject {
  const g = new THREE.Group();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = t * Math.PI * 4;
    points.push(new THREE.Vector3(Math.cos(a) * 0.06, -0.06 + Math.sin(a) * 0.06 + t * 0.06, -0.06 - t * 0.16));
  }
  const tail = toonMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.024, 8), SNOUT, { outline: 0.12, outlineColor: outline });
  g.add(tail);
  return g;
}

/** A muddy splash on the head: a splat over the top, drips down one side, and a few flecks. */
function mudSplash(outline: string): PartObject {
  const g = new THREE.Group();
  const mud = '#7a4f2c';
  const wet = '#9a6a3f';
  // A blob hugging the head at direction `dir`, flattened along the surface.
  const blob = (dir: THREE.Vector3, r: number, flat: number, color: string, outlined: boolean) => {
    const n = dir.clone().normalize();
    const m = toonMesh(sphere(r, 14, 10), color, outlined ? { outline: 0.06, outlineColor: outline } : { outline: false });
    m.scale.set(1, flat, 1);
    m.position.copy(n.clone().multiplyScalar(HEAD_RADIUS + r * flat * 0.2));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g.add(m);
    return m;
  };
  // The splat: a big puddle on top-right with lumpy edges.
  blob(new THREE.Vector3(0.25, 1, 0.05), 0.2, 0.22, mud, true);
  for (const [x, z, r] of [[0.48, 0.2, 0.08], [0.05, 0.28, 0.09], [0.42, -0.25, 0.08], [-0.05, -0.18, 0.07], [0.6, -0.02, 0.07]] as const) {
    blob(new THREE.Vector3(x, 1, z), r, 0.3, mud, true);
  }
  // A wet shine on top.
  blob(new THREE.Vector3(0.2, 1, 0.1), 0.06, 0.3, wet, false).position.multiplyScalar(1.02);
  // Drips running down the right side, each ending in a round drop.
  for (const [y, z, len] of [[0.55, 0.15, 0.16], [0.45, -0.1, 0.11]] as const) {
    const n = new THREE.Vector3(0.85, y, z).normalize();
    const drip = toonMesh(new THREE.CapsuleGeometry(0.03, len, 4, 8), mud, { outline: 0.1, outlineColor: outline });
    drip.position.copy(n.clone().multiplyScalar(HEAD_RADIUS + 0.005));
    drip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-n.y, n.x, 0).normalize());
    g.add(drip);
  }
  // A few flecks on the cheek.
  for (const [x, y, r] of [[-0.3, 0.05, 0.025], [-0.25, -0.05, 0.02], [-0.34, -0.02, 0.018]] as const) {
    blob(new THREE.Vector3(x, y, onSurface(x, y)), r, 0.35, mud, false);
  }
  return g;
}

// ---------- Lion ----------
const LION = ANIMAL_COLORS.lion;
const MANE = '#c0652a';

function lionHead(outline: string): PartObject {
  const g = headBall(LION.main, outline);
  // A big fluffy mane all round the face.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const tuft = toonMesh(sphere(0.14, 12, 10), i % 2 ? MANE : darken(MANE, 0.12).getStyle(), { outline: 0.06, outlineColor: outline });
    tuft.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, -0.1);
    tuft.scale.z = 0.8;
    g.add(tuft);
  }
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.08, 12, 10), LION.main, { outlineColor: outline });
    ear.scale.z = 0.6;
    ear.position.set(s * 0.25, 0.33, 0.06);
    g.add(ear);
    const puff = toonMesh(sphere(0.085, 12, 10), LION.belly, { outline: false });
    puff.scale.set(1, 0.8, 0.6);
    puff.position.set(s * 0.065, -0.12, 0.37);
    g.add(puff);
  }
  const nose = toonMesh(new THREE.ConeGeometry(0.05, 0.05, 3), '#7a3e22', { outline: false });
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.y = Math.PI;
  nose.position.set(0, -0.05, 0.43);
  g.add(nose);
  eye(g, -0.15, 0.08, 0.065);
  eye(g, 0.15, 0.08, 0.065);
  return g;
}

function lionLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.09, 0.095, 0.22, 12), LION.main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.115, 14, 10), LION.belly, { outlineColor: outline });
    paw.scale.set(1.05, 0.6, 1.2);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
    for (const x of [-0.045, 0, 0.045]) {
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.04, 0.02), toonMaterial(darken(LION.belly, 0.35).getStyle(), { map: null }));
      toe.position.set(x * 0.7 + x * 0.3, -0.25, 0.165);
      hip.add(toe);
    }
  });
}

/** A long tail with a tuft on the end. */
function lionTail(outline: string): PartObject {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.12, -0.05),
    new THREE.Vector3(0, -0.2, -0.3),
    new THREE.Vector3(0.04, 0.0, -0.48),
    new THREE.Vector3(0.08, 0.22, -0.46),
  ]);
  g.add(toonMesh(new THREE.TubeGeometry(curve, 24, 0.04, 10), LION.main, { outline: 0.12, outlineColor: outline }));
  const tuft = toonMesh(new THREE.IcosahedronGeometry(0.09, 1), MANE, { outline: 0.08, outlineColor: outline });
  tuft.scale.set(1, 1.3, 1);
  tuft.position.copy(curve.getPoint(1)).add(new THREE.Vector3(0.01, 0.06, 0));
  g.add(tuft);
  return g;
}

/** A little gold crown with gems: king of the backyard. */
function crown(outline: string): PartObject {
  const g = new THREE.Group();
  const c = new THREE.Group();
  c.position.set(0, 0.44, 0.02);
  c.rotation.z = 0.12;
  const band = toonMesh(new THREE.CylinderGeometry(0.17, 0.15, 0.09, 24), '#f7c331', { outline: 0.08, outlineColor: outline });
  c.add(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const point = toonMesh(new THREE.ConeGeometry(0.045, 0.11, 6), '#f7c331', { outline: 0.1, outlineColor: outline });
    point.position.set(Math.sin(a) * 0.16, 0.095, Math.cos(a) * 0.16);
    c.add(point);
    const ball = toonMesh(sphere(0.022, 8, 6), '#ffe9a0', { outline: false });
    ball.position.set(Math.sin(a) * 0.16, 0.155, Math.cos(a) * 0.16);
    c.add(ball);
  }
  for (const [a, col] of [[0, '#e2574c'], [Math.PI / 2, '#3d7ff2'], [-Math.PI / 2, '#5bd16a']] as const) {
    const gem = toonMesh(new THREE.OctahedronGeometry(0.03, 0), col, { outline: false });
    gem.position.set(Math.sin(a) * 0.165, 0, Math.cos(a) * 0.165);
    c.add(gem);
  }
  g.add(c);
  return g;
}

// ---------- Elephant ----------
const ELE = ANIMAL_COLORS.elephant;

function elephantHead(outline: string): PartObject {
  const g = headBall(ELE.main, outline);
  // Big flappy ears with pink insides.
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.36, 0.04, -0.04);
    ear.rotation.y = s * 0.55;
    const outer = toonMesh(sphere(0.27, 18, 12), ELE.main, { outlineColor: outline });
    outer.scale.set(1, 1.1, 0.22);
    outer.position.x = s * 0.14;
    ear.add(outer);
    const inner = toonMesh(sphere(0.19, 16, 10), '#f2b7c6', { outline: false });
    inner.scale.set(1, 1.1, 0.15);
    inner.position.set(s * 0.15, -0.01, 0.045);
    ear.add(inner);
    g.add(ear);
    // Little tusks.
    const tusk = toonMesh(new THREE.ConeGeometry(0.03, 0.12, 8), '#fffaf0', { outline: 0.12, outlineColor: outline });
    tusk.position.set(s * 0.11, -0.2, 0.37);
    tusk.rotation.x = 1.9;
    g.add(tusk);
  }
  // A trunk that hangs down and curls up at the end.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.04, 0.34),
    new THREE.Vector3(0, -0.12, 0.48),
    new THREE.Vector3(0, -0.28, 0.52),
    new THREE.Vector3(0, -0.36, 0.6),
    new THREE.Vector3(0, -0.3, 0.68),
  ]);
  g.add(toonMesh(new THREE.TubeGeometry(curve, 24, 0.065, 12), ELE.main, { outline: 0.1, outlineColor: outline }));
  const tip = toonMesh(sphere(0.07, 12, 10), ELE.main, { outline: 0.1, outlineColor: outline });
  tip.position.copy(curve.getPoint(1));
  g.add(tip);
  const base = toonMesh(sphere(0.07, 12, 10), ELE.main, { outline: false });
  base.position.copy(curve.getPoint(0));
  g.add(base);
  for (const t of [0.3, 0.45, 0.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.008, 4, 14), toonMaterial(darken(ELE.main, 0.2).getStyle(), { map: null }));
    const p = curve.getPoint(t);
    ring.position.copy(p);
    ring.lookAt(p.clone().add(curve.getTangent(t)));
    g.add(ring);
  }
  cheeks(g, -0.02, 0.27);
  eye(g, -0.15, 0.1, 0.055);
  eye(g, 0.15, 0.1, 0.055);
  return g;
}

function elephantLegs(outline: string): PartObject {
  return pairOfLegs(0.17, 0.32, (hip) => {
    // Thick round columns with toenails.
    const leg = toonMesh(new THREE.CylinderGeometry(0.115, 0.13, 0.32, 14), ELE.main, { outlineColor: outline });
    leg.position.y = -0.16;
    hip.add(leg);
    for (const x of [-0.06, 0, 0.06]) {
      const nail = toonMesh(sphere(0.03, 8, 6), '#fffaf0', { outline: false });
      nail.scale.set(1, 0.8, 0.5);
      nail.position.set(x, -0.28, Math.sqrt(0.13 ** 2 - x * x));
      hip.add(nail);
    }
  });
}

/** A thin tail with a dark tuft. */
function elephantTail(outline: string): PartObject {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, -0.05),
    new THREE.Vector3(0, -0.08, -0.14),
    new THREE.Vector3(0.03, -0.24, -0.18),
  ]);
  g.add(toonMesh(new THREE.TubeGeometry(curve, 12, 0.025, 8), ELE.main, { outline: 0.12, outlineColor: outline }));
  const tuft = toonMesh(new THREE.ConeGeometry(0.05, 0.1, 8), '#4a5160', { outline: 0.1, outlineColor: outline });
  tuft.rotation.x = Math.PI;
  tuft.position.copy(curve.getPoint(1)).add(new THREE.Vector3(0, -0.04, 0));
  g.add(tuft);
  return g;
}

/** A red circus fez with a gold tassel. */
function fez(outline: string): PartObject {
  const g = new THREE.Group();
  const hat = new THREE.Group();
  hat.position.set(-0.08, 0.43, 0.04);
  hat.rotation.z = 0.25;
  const body = toonMesh(new THREE.CylinderGeometry(0.1, 0.13, 0.17, 18), '#e2433f', { outline: 0.08, outlineColor: outline });
  body.position.y = 0.06;
  hat.add(body);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.015, 6, 20), toonMaterial('#f7c331', { map: null }));
  trim.rotation.x = Math.PI / 2;
  trim.position.y = -0.015;
  hat.add(trim);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), toonMaterial('#f7c331', { map: null }));
  cord.position.set(0.07, 0.11, 0);
  cord.rotation.z = -0.9;
  hat.add(cord);
  const tassel = toonMesh(new THREE.ConeGeometry(0.03, 0.08, 8), '#f7c331', { outline: 0.12, outlineColor: outline });
  tassel.position.set(0.13, 0.05, 0);
  hat.add(tassel);
  g.add(hat);
  return g;
}

export const YET_MORE_PARTS: Record<Exclude<PartSlot, 'body'>, Record<'panda' | 'pig' | 'lion' | 'elephant', Builder>> = {
  head: { panda: pandaHead, pig: pigHead, lion: lionHead, elephant: elephantHead },
  legs: { panda: pandaLegs, pig: pigLegs, lion: lionLegs, elephant: elephantLegs },
  tail: { panda: pandaTail, pig: pigTail, lion: lionTail, elephant: elephantTail },
  accessory: { panda: bamboo, pig: mudSplash, lion: crown, elephant: fez },
};
