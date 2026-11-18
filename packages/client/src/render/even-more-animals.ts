// Parts for the third set of animals: Bunny, Unicorn, Cat and Fox (heads, legs, tails and
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

function headBall(color: string, outline: string): THREE.Group {
  const g = new THREE.Group();
  g.add(toonMesh(sphere(HEAD_RADIUS, 32, 24), color, { outlineColor: outline }));
  return g;
}

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

/** A little blush on each cheek. */
function cheeks(g: THREE.Object3D, y = -0.06, x = 0.24): void {
  for (const s of [-1, 1]) {
    const blush = toonMesh(sphere(0.05, 10, 8), PINK, { outline: false });
    blush.scale.set(1.3, 0.8, 0.3);
    blush.position.set(s * x, y, Math.sqrt(HEAD_RADIUS ** 2 - x * x - y * y) - 0.01);
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

function onHead(dir: THREE.Vector3): THREE.Group {
  const n = dir.clone().normalize();
  const g = new THREE.Group();
  g.position.copy(n.clone().multiplyScalar(HEAD_RADIUS));
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return g;
}

// ---------- Bunny ----------
const BUN = ANIMAL_COLORS.bunny;

function bunnyHead(outline: string): PartObject {
  const g = headBall(BUN.main, outline);
  // Long ears with pink insides, leaning back a little (one flops).
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.15, 0.36, -0.04);
    // Leaning outward; the right one flops further.
    ear.rotation.set(-0.2, 0, -s * (s > 0 ? 0.7 : 0.18));
    const outer = toonMesh(new THREE.CapsuleGeometry(0.08, 0.36, 6, 12), BUN.main, { outlineColor: outline });
    outer.scale.z = 0.55;
    outer.position.y = 0.22;
    ear.add(outer);
    const inner = toonMesh(new THREE.CapsuleGeometry(0.045, 0.28, 4, 10), PINK, { outline: false });
    inner.scale.z = 0.4;
    inner.position.set(0, 0.22, 0.035);
    ear.add(inner);
    g.add(ear);
  }
  const nose = toonMesh(sphere(0.045, 10, 8), PINK, { outline: 0.1, outlineColor: outline });
  nose.scale.set(1.3, 0.9, 0.8);
  nose.position.set(0, -0.02, 0.42);
  g.add(nose);
  for (const s of [-1, 1]) {
    const tooth = toonMesh(new THREE.BoxGeometry(0.05, 0.07, 0.02), '#ffffff', { outline: 0.15, outlineColor: outline });
    tooth.position.set(s * 0.028, -0.14, 0.4);
    g.add(tooth);
  }
  cheeks(g);
  eye(g, -0.16, 0.08);
  eye(g, 0.16, 0.08);
  return g;
}

function bunnyLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 12), BUN.main, { outlineColor: outline });
    leg.position.y = -0.12;
    hip.add(leg);
    // Big long bunny feet.
    const foot = toonMesh(sphere(0.12, 14, 10), BUN.belly, { outlineColor: outline });
    foot.scale.set(0.9, 0.45, 2);
    foot.position.set(0, -0.25, 0.1);
    hip.add(foot);
  });
}

function bunnyTail(outline: string): PartObject {
  const g = new THREE.Group();
  for (const [x, y, z, r] of [[0, -0.1, -0.06, 0.15], [0.07, -0.04, -0.1, 0.1], [-0.07, -0.05, -0.1, 0.1], [0, 0.02, -0.08, 0.09]] as const) {
    const puff = toonMesh(new THREE.IcosahedronGeometry(r, 1), '#ffffff', { outline: 0.08, outlineColor: outline });
    puff.position.set(x, y, z);
    g.add(puff);
  }
  return g;
}

/** A carrot tucked behind one ear. */
function carrot(outline: string): PartObject {
  const g = new THREE.Group();
  const spot = onHead(new THREE.Vector3(-0.35, 0.3, 0.1));
  const root = toonMesh(new THREE.ConeGeometry(0.06, 0.3, 10), '#f28a2c', { outline: 0.1, outlineColor: outline });
  root.rotation.z = -1.2;
  root.position.set(0.02, 0, 0.06);
  spot.add(root);
  for (const a of [-0.4, 0, 0.4]) {
    const leaf = toonMesh(new THREE.ConeGeometry(0.025, 0.14, 6), '#5fb34f', { outline: 0.15, outlineColor: outline });
    leaf.position.set(-0.16, 0.06 + Math.abs(a) * 0.03, 0.06);
    leaf.rotation.z = 1.2 + a;
    spot.add(leaf);
  }
  g.add(spot);
  return g;
}

// ---------- Unicorn ----------
const UNI = ANIMAL_COLORS.unicorn;
const RAINBOW = ['#ff6b8a', '#ffb347', '#ffe36b', '#7be07b', '#6bc6ff', '#b58bff'];

function unicornHead(outline: string): PartObject {
  const g = headBall(UNI.main, outline);
  // A golden spiral horn.
  const horn = toonMesh(new THREE.ConeGeometry(0.08, 0.36, 14), '#f7c331', { outline: 0.08, outlineColor: outline });
  horn.position.set(0, 0.52, 0.12);
  horn.rotation.x = 0.3;
  g.add(horn);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.07 - i * 0.018, 0.012, 6, 16), toonMaterial('#d99a18', { map: null }));
    band.position.set(0, 0.42 + i * 0.08, 0.09 + i * 0.024);
    band.rotation.x = Math.PI / 2 + 0.3;
    g.add(band);
  }
  // Small ears and a rainbow mane down the back of the head.
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.ConeGeometry(0.07, 0.16, 8), UNI.main, { outlineColor: outline });
    ear.position.set(s * 0.22, 0.38, -0.06);
    ear.rotation.z = -s * 0.3;
    g.add(ear);
  }
  RAINBOW.forEach((c, i) => {
    const tuft = toonMesh(sphere(0.1, 12, 8), c, { outline: 0.08, outlineColor: outline });
    const a = 0.3 + i * 0.32;
    tuft.position.set(0, Math.cos(a) * 0.42, -Math.sin(a) * 0.42);
    g.add(tuft);
  });
  // A soft pony muzzle with two nostrils and a little smile.
  const muzzle = toonMesh(sphere(0.17, 20, 14), UNI.belly, { outline: 0.05, outlineColor: outline });
  muzzle.scale.set(1.15, 0.78, 0.62);
  muzzle.position.set(0, -0.13, 0.33);
  g.add(muzzle);
  for (const s of [-1, 1]) {
    const nostril = toonMesh(sphere(0.024, 8, 6), '#c77a9a', { outline: false });
    nostril.scale.set(1, 1.3, 0.5);
    nostril.position.set(s * 0.07, -0.1, 0.435);
    g.add(nostril);
  }
  const mouth = toonMesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI), INK, { outline: false });
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.17, 0.425);
  g.add(mouth);
  cheeks(g, -0.04, 0.27);
  eye(g, -0.16, 0.08);
  eye(g, 0.16, 0.08);
  return g;
}

function unicornLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.32, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.08, 0.085, 0.2, 12), UNI.main, { outlineColor: outline });
    leg.position.y = -0.12;
    hip.add(leg);
    const hoof = toonMesh(new THREE.CylinderGeometry(0.095, 0.11, 0.1, 14), '#b58bff', { outlineColor: outline });
    hoof.position.y = -0.27;
    hip.add(hoof);
  });
}

/** A flowing rainbow tail. */
function unicornTail(outline: string): PartObject {
  const g = new THREE.Group();
  RAINBOW.forEach((c, i) => {
    const t = i / (RAINBOW.length - 1);
    const lock = toonMesh(sphere(0.1 - t * 0.03, 12, 8), c, { outline: 0.08, outlineColor: outline });
    lock.scale.set(1, 0.8, 1.3);
    lock.position.set(Math.sin(t * 3) * 0.05, -0.05 - t * 0.3, -0.12 - t * 0.2);
    g.add(lock);
  });
  return g;
}

/** A crown of little flowers. */
function flowerCrown(outline: string): PartObject {
  const g = new THREE.Group();
  const colors = ['#ff9cbf', '#ffe36b', '#b58bff', '#ff9cbf', '#6bc6ff'];
  colors.forEach((c, i) => {
    const a = -1.2 + (i / (colors.length - 1)) * 2.4;
    const spot = onHead(new THREE.Vector3(Math.sin(a) * 0.9, 0.55, Math.cos(a) * 0.5));
    const flower = toonMesh(sphere(0.06, 10, 8), c, { outline: 0.1, outlineColor: outline });
    flower.scale.z = 0.6;
    spot.add(flower);
    const middle = toonMesh(sphere(0.025, 8, 6), '#ffffff', { outline: false });
    middle.position.z = 0.035;
    spot.add(middle);
    g.add(spot);
  });
  return g;
}

// ---------- Cat ----------
const CAT = ANIMAL_COLORS.cat;

function catHead(outline: string): PartObject {
  const g = headBall(CAT.main, outline);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.ConeGeometry(0.12, 0.22, 4), CAT.main, { outlineColor: outline });
    ear.position.set(s * 0.24, 0.38, 0);
    ear.rotation.set(0, Math.PI / 4, -s * 0.3);
    g.add(ear);
    const inner = toonMesh(new THREE.ConeGeometry(0.06, 0.13, 4), PINK, { outline: false });
    inner.position.set(s * 0.245, 0.37, 0.05);
    inner.rotation.set(0, Math.PI / 4, -s * 0.3);
    g.add(inner);
    // Whiskers.
    for (const dy of [-0.02, 0.03]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), toonMaterial(INK, { map: null }));
      w.rotation.z = Math.PI / 2 + s * dy * 4;
      w.position.set(s * 0.3, -0.06 + dy, 0.3);
      g.add(w);
    }
  }
  // Tabby stripes on the forehead.
  for (const x of [-0.08, 0, 0.08]) {
    const stripe = toonMesh(new THREE.BoxGeometry(0.035, 0.11, 0.02), darken(CAT.main, 0.25).getStyle(), { outline: false });
    stripe.position.set(x, 0.28, Math.sqrt(HEAD_RADIUS ** 2 - x * x - 0.28 * 0.28) + 0.004);
    stripe.rotation.x = -0.75;
    g.add(stripe);
  }
  const muzzle = toonMesh(sphere(0.12), CAT.belly, { outline: false });
  muzzle.scale.set(1.3, 0.8, 0.6);
  muzzle.position.set(0, -0.08, 0.35);
  g.add(muzzle);
  const nose = toonMesh(new THREE.ConeGeometry(0.035, 0.04, 3), PINK, { outline: false });
  nose.rotation.x = Math.PI / 2 + Math.PI;
  nose.position.set(0, -0.03, 0.43);
  g.add(nose);
  eye(g, -0.15, 0.08, 0.07);
  eye(g, 0.15, 0.08, 0.07);
  return g;
}

function catLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.085, 0.09, 0.22, 12), CAT.main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    // White socks with pink toe beans.
    const paw = toonMesh(sphere(0.11, 14, 10), CAT.belly, { outlineColor: outline });
    paw.scale.set(1, 0.6, 1.2);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
    for (const x of [-0.045, 0, 0.045]) {
      const bean = toonMesh(sphere(0.02, 8, 6), PINK, { outline: false });
      bean.position.set(x, -0.25, 0.15);
      hip.add(bean);
    }
  });
}

/** A long curling striped tail. */
function catTail(outline: string): PartObject {
  const g = new THREE.Group();
  // A soft S-curve up and out to one side (so it shows from behind), with a rounded tip.
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, -0.12, -0.05),
      new THREE.Vector3(0.04, -0.14, -0.22),
      new THREE.Vector3(0.14, -0.04, -0.36),
      new THREE.Vector3(0.22, 0.14, -0.38),
      new THREE.Vector3(0.24, 0.32, -0.3),
      new THREE.Vector3(0.18, 0.44, -0.24),
    ],
    false,
    'centripetal',
  );
  const tail = toonMesh(new THREE.TubeGeometry(curve, 48, 0.07, 12), CAT.main, { outline: 0.1, outlineColor: outline });
  g.add(tail);
  const tip = toonMesh(sphere(0.07, 14, 10), CAT.main, { outline: 0.1, outlineColor: outline });
  tip.position.copy(curve.getPoint(1));
  g.add(tip);
  for (const t of [0.3, 0.52, 0.74]) {
    const p = curve.getPoint(t);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.016, 6, 16), toonMaterial(darken(CAT.main, 0.25).getStyle(), { map: null }));
    ring.position.copy(p);
    ring.lookAt(p.clone().add(curve.getTangent(t)));
    g.add(ring);
  }
  return g;
}

/** A ball of yarn balanced on the head, with a loose strand. */
function yarnBall(outline: string): PartObject {
  const g = new THREE.Group();
  const ball = toonMesh(sphere(0.13, 16, 12), '#6bc6ff', { outlineColor: outline });
  ball.position.set(0.05, 0.5, 0);
  g.add(ball);
  for (let i = 0; i < 3; i++) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.01, 4, 20), toonMaterial('#3f8fe0', { map: null }));
    loop.position.copy(ball.position);
    loop.rotation.set(i * 1.1, i * 0.7, 0);
    g.add(loop);
  }
  return g;
}

// ---------- Fox ----------
const FOX = ANIMAL_COLORS.fox;

function foxHead(outline: string): PartObject {
  const g = headBall(FOX.main, outline);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.ConeGeometry(0.12, 0.26, 4), FOX.main, { outlineColor: outline });
    ear.position.set(s * 0.22, 0.4, -0.02);
    ear.rotation.set(0, Math.PI / 4, -s * 0.25);
    g.add(ear);
    const tip = toonMesh(new THREE.ConeGeometry(0.05, 0.1, 4), '#3a2a2a', { outline: false });
    tip.position.set(s * 0.25, 0.51, -0.02);
    tip.rotation.set(0, Math.PI / 4, -s * 0.25);
    g.add(tip);
    // White cheek fluff.
    const cheek = toonMesh(sphere(0.13, 12, 10), FOX.belly, { outline: false });
    cheek.scale.set(1, 0.8, 0.5);
    cheek.position.set(s * 0.17, -0.12, 0.31);
    g.add(cheek);
  }
  // A pointy snout with a dark nose.
  const snout = toonMesh(new THREE.ConeGeometry(0.11, 0.24, 12), FOX.belly, { outlineColor: outline });
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.09, 0.47);
  g.add(snout);
  const nose = toonMesh(sphere(0.04, 10, 8), '#2a1f2d', { outline: false });
  nose.position.set(0, -0.09, 0.59);
  g.add(nose);
  eye(g, -0.15, 0.1, 0.06);
  eye(g, 0.15, 0.1, 0.06);
  return g;
}

function foxLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    // Dark socks.
    const leg = toonMesh(new THREE.CylinderGeometry(0.08, 0.085, 0.22, 12), '#3a2a2a', { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.1, 14, 10), '#3a2a2a', { outlineColor: outline });
    paw.scale.set(1, 0.55, 1.25);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
  });
}

/** A big bushy tail with a white tip. */
function foxTail(outline: string): PartObject {
  const g = new THREE.Group();
  // Big and bushy, swept up and out to one side so it shows from behind as well.
  const tail = toonMesh(sphere(0.17), FOX.main, { outlineColor: outline });
  tail.scale.set(1, 1, 2.3);
  tail.position.set(0.16, 0.06, -0.2);
  tail.rotation.set(0.8, 0.75, 0, 'YXZ');
  g.add(tail);
  const tip = toonMesh(sphere(0.13), '#fff7ee', { outlineColor: outline });
  tip.scale.set(1, 1, 1 / 2.3);
  tip.position.set(0, 0, -0.18);
  tail.add(tip);
  return g;
}

/** An autumn leaf stuck on the head. */
function leaf(outline: string): PartObject {
  const g = new THREE.Group();
  const spot = onHead(new THREE.Vector3(-0.2, 0.5, 0.2));
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.14);
  shape.quadraticCurveTo(0.12, 0, 0, 0.14);
  shape.quadraticCurveTo(-0.12, 0, 0, -0.14);
  const l = toonMesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), '#d9822b', { outline: 0.06, outlineColor: outline });
  l.rotation.z = 0.6;
  spot.add(l);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 4), toonMaterial('#8e6036', { map: null }));
  stem.position.set(0.08, -0.12, 0.01);
  stem.rotation.z = 0.6;
  spot.add(stem);
  g.add(spot);
  return g;
}

export const EVEN_MORE_PARTS: Record<Exclude<PartSlot, 'body'>, Record<'bunny' | 'unicorn' | 'cat' | 'fox', Builder>> = {
  head: { bunny: bunnyHead, unicorn: unicornHead, cat: catHead, fox: foxHead },
  legs: { bunny: bunnyLegs, unicorn: unicornLegs, cat: catLegs, fox: foxLegs },
  tail: { bunny: bunnyTail, unicorn: unicornTail, cat: catTail, fox: foxTail },
  accessory: { bunny: carrot, unicorn: flowerCrown, cat: yarnBall, fox: leaf },
};
