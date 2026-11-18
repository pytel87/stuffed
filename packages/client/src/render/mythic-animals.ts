// Parts for the sixth set of animals: Mouse, Sheep, Raccoon, Bee, Flamingo, Giraffe, Sloth,
// Dragon, Phoenix and Yeti (heads, legs, tails and accessories; bodies are in animal-bodies.ts).
// Same sockets and scale as the others.
import * as THREE from 'three';
import type { PartSlot } from '@stuffed/sim';
import { ANIMAL_COLORS } from './animal-colors.ts';
import { darken, makePlastic, toonMaterial, toonMesh } from './toon.ts';

interface PartObject extends THREE.Object3D {
  userData: { swing?: THREE.Object3D[] };
}
type Builder = (outline: string) => PartObject;

const HEAD_RADIUS = 0.42;
const INK = '#2a1f2d';
const PINK = '#ff9cbf';
const GOLD = '#f7c331';
const sphere = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const onSurface = (x: number, y: number) => Math.sqrt(Math.max(0, HEAD_RADIUS ** 2 - x * x - y * y));
const flat = (c: string) => toonMaterial(c, { map: null });

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

/** A sleepy eye: a curved line, closed. */
function sleepyEye(g: THREE.Object3D, x: number, y: number): void {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 6, 12, Math.PI), flat(INK));
  arc.rotation.z = Math.PI;
  arc.position.set(x, y, onSurface(x, y) + 0.02);
  g.add(arc);
}

function cheeks(g: THREE.Object3D, y = -0.06, x = 0.24): void {
  for (const s of [-1, 1]) {
    const blush = toonMesh(sphere(0.05, 10, 8), PINK, { outline: false });
    blush.scale.set(1.3, 0.8, 0.3);
    blush.position.set(s * x, y, onSurface(x, y) - 0.01);
    g.add(blush);
  }
}

function smile(g: THREE.Object3D, y: number, width = 0.08, z?: number): void {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(width, 0.012, 6, 16, Math.PI), flat(INK));
  arc.rotation.z = Math.PI;
  arc.position.set(0, y, z ?? onSurface(0, y) + 0.005);
  g.add(arc);
}

/** A patch of a different color hugging the front of the head (a face), `open` radians wide. */
function facePatch(color: string, open: number, squash = 1): THREE.Mesh {
  const geo = new THREE.SphereGeometry(HEAD_RADIUS + 0.008, 32, 12, 0, Math.PI * 2, 0, open).rotateX(Math.PI / 2).scale(1, squash, 1);
  return toonMesh(geo, color, { outline: false });
}

/** A group on the head surface at `dir`, facing out. */
function onHead(dir: THREE.Vector3, lift = 0): THREE.Group {
  const n = dir.clone().normalize();
  const g = new THREE.Group();
  g.position.copy(n.clone().multiplyScalar(HEAD_RADIUS + lift));
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return g;
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

/** A tube along `points` (a tail, an antenna, a horn). */
function tube(points: [number, number, number][], radius: number, color: string, outline: string, o: number | false = 0.12): { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3 } {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const mesh = toonMesh(new THREE.TubeGeometry(curve, 20, radius, 8), color, o === false ? { outline: false } : { outline: o, outlineColor: outline });
  return { mesh, curve };
}

/** Simple stubby legs ending in a rounded foot (`foot` colors it). */
function stubLegs(main: string, foot: string, outline: string, footScale: [number, number, number] = [1, 0.55, 1.25]): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.085, 0.09, 0.22, 12), main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.11, 14, 10), foot, { outlineColor: outline });
    paw.scale.set(...footScale);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
  });
}

// ---------- Mouse ----------
const MOU = ANIMAL_COLORS.mouse;

function mouseHead(outline: string): PartObject {
  const g = headBall(MOU.main, outline);
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.21, 18, 12), MOU.main, { outlineColor: outline });
    ear.scale.set(1, 1, 0.35);
    ear.position.set(s * 0.3, 0.33, -0.04);
    ear.rotation.z = -s * 0.25;
    g.add(ear);
    const inner = toonMesh(sphere(0.14, 14, 10), PINK, { outline: false });
    inner.scale.set(1, 1, 0.3);
    inner.position.set(s * 0.3, 0.33, 0.01);
    inner.rotation.z = -s * 0.25;
    g.add(inner);
    // Whiskers.
    for (const t of [-0.12, 0.12]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.008, 0.008), flat(INK));
      w.position.set(s * 0.3, -0.06 + t * 0.3, 0.33);
      w.rotation.z = s * t;
      g.add(w);
    }
  }
  const snout = toonMesh(sphere(0.13), MOU.belly, { outline: 0.06, outlineColor: outline });
  snout.scale.set(1.2, 0.85, 0.9);
  snout.position.set(0, -0.08, 0.34);
  g.add(snout);
  const nose = toonMesh(sphere(0.045, 10, 8), '#ff7aa8', { outline: false });
  nose.position.set(0, -0.04, 0.46);
  g.add(nose);
  eye(g, -0.15, 0.08);
  eye(g, 0.15, 0.08);
  cheeks(g, -0.06, 0.27);
  return g;
}

function mouseLegs(outline: string): PartObject {
  return stubLegs(MOU.main, PINK, outline, [0.9, 0.45, 1.4]);
}

/** A long, thin pink tail with a curl at the end. */
function mouseTail(outline: string): PartObject {
  const g = new THREE.Group();
  g.add(tube([[0, -0.12, -0.05], [0.05, -0.2, -0.3], [0.2, -0.12, -0.5], [0.3, 0.05, -0.45], [0.22, 0.12, -0.36]], 0.025, '#ffb3cf', outline).mesh);
  return g;
}

/** A wedge of cheese with holes, balanced on top. */
function cheese(outline: string): PartObject {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.34, 0);
  shape.lineTo(0, 0.22);
  shape.closePath();
  const wedge = toonMesh(new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }).center(), '#ffd34d', { outline: 0.06, outlineColor: outline });
  wedge.position.set(0.04, 0.5, 0);
  wedge.rotation.set(-Math.PI / 2, 0, 0.5);
  g.add(wedge);
  for (const [x, z, r] of [[-0.03, 0.02, 0.03], [0.07, -0.04, 0.022], [0.0, -0.06, 0.018]] as const) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 10), flat('#e0a92a'));
    hole.position.set(0.04 + x, 0.605, z);
    g.add(hole);
  }
  return g;
}

// ---------- Sheep ----------
const SHE = ANIMAL_COLORS.sheep;
const SHEEP_FACE = '#5a4b55';

function sheepHead(outline: string): PartObject {
  const g = headBall(SHE.main, outline);
  // A curly wool top: a ring of puffs.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const puff = toonMesh(sphere(0.13, 12, 10), SHE.main, { outline: 0.07, outlineColor: outline });
    puff.position.set(Math.cos(a) * 0.24, 0.34, Math.sin(a) * 0.2 - 0.02);
    g.add(puff);
  }
  // The dark face on the front.
  const face = toonMesh(sphere(0.28, 20, 14), SHEEP_FACE, { outline: false });
  face.scale.set(0.95, 1.05, 0.6);
  face.position.set(0, -0.05, 0.2);
  g.add(face);
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.1, 12, 8), SHEEP_FACE, { outlineColor: outline });
    ear.scale.set(1.6, 0.6, 0.6);
    ear.position.set(s * 0.42, 0.06, 0.02);
    ear.rotation.z = -s * 0.4;
    g.add(ear);
  }
  eye(g, -0.12, 0.02, 0.06, 0.37);
  eye(g, 0.12, 0.02, 0.06, 0.37);
  const nose = toonMesh(sphere(0.035, 10, 8), '#ff9cbf', { outline: false });
  nose.position.set(0, -0.12, 0.38);
  g.add(nose);
  return g;
}

function sheepLegs(outline: string): PartObject {
  return pairOfLegs(0.15, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.06, 0.065, 0.24, 10), SHEEP_FACE, { outlineColor: outline });
    leg.position.y = -0.14;
    hip.add(leg);
    const hoof = toonMesh(new THREE.CylinderGeometry(0.075, 0.085, 0.08, 12), '#3a2f36', { outlineColor: outline });
    hoof.position.y = -0.27;
    hip.add(hoof);
    const cuff = toonMesh(sphere(0.1, 12, 10), SHE.main, { outline: 0.08, outlineColor: outline });
    cuff.scale.set(1, 0.6, 1);
    cuff.position.y = -0.03;
    hip.add(cuff);
  });
}

function sheepTail(outline: string): PartObject {
  const g = new THREE.Group();
  for (const [x, y, z, r] of [[0, -0.05, -0.08, 0.1], [0.06, 0.02, -0.12, 0.08], [-0.05, 0.03, -0.13, 0.07]] as const) {
    const puff = toonMesh(sphere(r, 12, 10), SHE.main, { outline: 0.08, outlineColor: outline });
    puff.position.set(x, y, z);
    g.add(puff);
  }
  return g;
}

/** A red collar with a gold cow bell under the chin. */
function cowBell(outline: string): PartObject {
  const g = new THREE.Group();
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 28), flat('#e2433f'));
  collar.rotation.x = Math.PI / 2 - 0.2;
  collar.position.set(0, -0.36, 0.04);
  g.add(collar);
  const bell = toonMesh(new THREE.CylinderGeometry(0.05, 0.1, 0.13, 16), GOLD, { outline: 0.08, outlineColor: outline, material: makePlastic(toonMaterial(GOLD, { map: null })) });
  bell.position.set(0, -0.48, 0.3);
  g.add(bell);
  const clapper = toonMesh(sphere(0.025, 8, 6), '#8a6a2a', { outline: false });
  clapper.position.set(0, -0.56, 0.3);
  g.add(clapper);
  return g;
}

// ---------- Raccoon ----------
const RAC = ANIMAL_COLORS.raccoon;
const RAC_DARK = '#3a3640';

function raccoonHead(outline: string): PartObject {
  const g = headBall(RAC.main, outline);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.ConeGeometry(0.11, 0.2, 10), RAC.main, { outlineColor: outline });
    ear.position.set(s * 0.25, 0.38, -0.02);
    ear.rotation.z = -s * 0.35;
    g.add(ear);
    const tip = toonMesh(new THREE.ConeGeometry(0.06, 0.1, 8), RAC.belly, { outline: false });
    tip.position.set(s * 0.25, 0.37, 0.05);
    tip.rotation.z = -s * 0.35;
    g.add(tip);
    // The bandit mask round each eye.
    const patch = toonMesh(sphere(0.12, 14, 10), RAC_DARK, { outline: false });
    patch.scale.set(1.35, 0.8, 0.35);
    patch.position.set(s * 0.15, 0.07, onSurface(s * 0.15, 0.07) - 0.03);
    patch.rotation.z = s * 0.25;
    g.add(patch);
    eye(g, s * 0.15, 0.08, 0.055, onSurface(s * 0.15, 0.08) + 0.02);
  }
  const muzzle = toonMesh(sphere(0.15), RAC.belly, { outline: 0.05, outlineColor: outline });
  muzzle.scale.set(1.15, 0.8, 0.75);
  muzzle.position.set(0, -0.11, 0.33);
  g.add(muzzle);
  const nose = toonMesh(sphere(0.045, 10, 8), INK, { outline: false });
  nose.scale.set(1.3, 0.9, 0.8);
  nose.position.set(0, -0.07, 0.45);
  g.add(nose);
  return g;
}

function raccoonLegs(outline: string): PartObject {
  return stubLegs(RAC_DARK, RAC_DARK, outline);
}

/** A big fluffy tail with dark rings. */
function raccoonTail(outline: string): PartObject {
  const g = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(0.05, -0.02, -0.12);
  holder.rotation.set(-0.9, 0.35, 0);
  for (let i = 0; i < 5; i++) {
    const seg = toonMesh(sphere(0.13 - i * 0.012, 14, 10), i % 2 ? RAC_DARK : RAC.main, { outline: 0.06, outlineColor: outline });
    seg.scale.set(1, 1.3, 1);
    seg.position.y = i * 0.13;
    holder.add(seg);
  }
  g.add(holder);
  return g;
}

/** A dented tin lid worn as a hat, handle and all. */
function tinLid(outline: string): PartObject {
  const g = new THREE.Group();
  // A shallow dome sitting over the top of the head, overhanging it like a lid.
  const lid = new THREE.Group();
  lid.position.set(-0.03, 0.18, -0.02);
  lid.rotation.z = 0.2;
  const tin = makePlastic(toonMaterial('#c9cfd8', { map: null, side: THREE.DoubleSide }));
  lid.add(toonMesh(new THREE.SphereGeometry(0.4, 28, 10, 0, Math.PI * 2, 0, 0.85).scale(1, 0.75, 1), '#c9cfd8', { outline: 0.05, outlineColor: outline, material: tin }));
  const rimR = 0.4 * Math.sin(0.85);
  const rimY = 0.4 * Math.cos(0.85) * 0.75;
  const rim = toonMesh(new THREE.TorusGeometry(rimR, 0.022, 6, 32), '#aab2bd', { outline: false, material: makePlastic(toonMaterial('#aab2bd', { map: null })) });
  rim.rotation.x = Math.PI / 2;
  rim.position.y = rimY;
  lid.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), tin);
  handle.position.y = 0.3;
  lid.add(handle);
  g.add(lid);
  return g;
}

// ---------- Bee ----------
const BEE = ANIMAL_COLORS.bee;

function beeHead(outline: string): PartObject {
  const g = headBall(BEE.main, outline);
  for (const s of [-1, 1]) {
    const { mesh, curve } = tube([[s * 0.1, 0.36, 0.08], [s * 0.15, 0.5, 0.1], [s * 0.24, 0.6, 0.06]], 0.016, INK, outline, false);
    g.add(mesh);
    const ball = toonMesh(sphere(0.045, 10, 8), INK, { outline: false });
    ball.position.copy(curve.getPoint(1));
    g.add(ball);
  }
  eye(g, -0.15, 0.06, 0.085);
  eye(g, 0.15, 0.06, 0.085);
  smile(g, -0.12, 0.07);
  cheeks(g, -0.07, 0.27);
  return g;
}

function beeLegs(outline: string): PartObject {
  return pairOfLegs(0.14, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), INK, { outline: 0.1, outlineColor: outline });
    leg.position.y = -0.15;
    hip.add(leg);
    const foot = toonMesh(sphere(0.08, 12, 8), BEE.main, { outlineColor: outline });
    foot.scale.set(1, 0.55, 1.3);
    foot.position.set(0, -0.27, 0.03);
    hip.add(foot);
  });
}

/** Two pairs of see-through wings and a little stinger. */
function beeWings(outline: string): PartObject {
  const g = new THREE.Group();
  const film = new THREE.MeshToonMaterial({ color: '#e6f6ff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    for (const [y, len, tilt] of [[0.12, 0.34, 0.5], [-0.02, 0.24, 0.9]] as const) {
      const wing = new THREE.Mesh(sphere(0.5, 16, 10), film);
      wing.scale.set(len, 0.18, 0.04);
      wing.position.set(s * (len * 0.45), y + 0.08, -0.06);
      wing.rotation.z = s * tilt;
      g.add(wing);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 4, 24), flat(INK));
      rim.scale.set(len, 0.18, 1);
      rim.position.copy(wing.position);
      rim.rotation.z = s * tilt;
      g.add(rim);
    }
  }
  const sting = toonMesh(new THREE.ConeGeometry(0.04, 0.12, 8), INK, { outline: false });
  sting.rotation.x = -Math.PI / 2;
  sting.position.set(0, -0.2, -0.12);
  g.add(sting);
  void outline;
  return g;
}

/** A little honey pot on top, honey dripping down its side. */
function honeyPot(outline: string): PartObject {
  const g = new THREE.Group();
  const pot = toonMesh(sphere(0.14, 18, 12), '#d9822b', { outline: 0.07, outlineColor: outline });
  pot.scale.set(1, 0.85, 1);
  pot.position.set(0.05, 0.52, 0);
  g.add(pot);
  const lid = toonMesh(new THREE.CylinderGeometry(0.1, 0.11, 0.05, 16), '#b5651d', { outline: 0.08, outlineColor: outline });
  lid.position.set(0.05, 0.64, 0);
  g.add(lid);
  const honey = toonMesh(sphere(0.04, 10, 8), '#ffb21a', { outline: false });
  honey.scale.set(1, 1.6, 1);
  honey.position.set(0.11, 0.56, 0.11);
  g.add(honey);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.06, 18, 1, true), flat('#fff3b0'));
  label.position.set(0.05, 0.5, 0);
  g.add(label);
  return g;
}

// ---------- Flamingo ----------
const FLA = ANIMAL_COLORS.flamingo;

function flamingoHead(outline: string): PartObject {
  const g = headBall(FLA.main, outline);
  // A pale face, so the eyes and beak stand out.
  const face = facePatch(FLA.belly, 0.7, 0.9);
  face.position.y = 0.02;
  g.add(face);
  // A chunky beak bending down, pale with a black tip.
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.06, 0.38), new THREE.Vector3(0, -0.07, 0.53), new THREE.Vector3(0, -0.14, 0.6)]);
  const pale = new THREE.CatmullRomCurve3([0, 0.25, 0.5, 0.8].map((t) => curve.getPoint(t)));
  const dark = new THREE.CatmullRomCurve3([0.78, 0.9, 1].map((t) => curve.getPoint(t)));
  g.add(toonMesh(new THREE.TubeGeometry(pale, 12, 0.065, 10), '#fff3e6', { outline: 0.08, outlineColor: outline }));
  g.add(toonMesh(new THREE.TubeGeometry(dark, 6, 0.052, 10), INK, { outline: 0.08, outlineColor: outline }));
  const tip = toonMesh(sphere(0.052, 10, 8), INK, { outline: false });
  tip.position.copy(curve.getPoint(1));
  g.add(tip);
  const fz = (x: number, y: number) => onSurface(x, y) + 0.015;
  eye(g, -0.16, 0.1, 0.07, fz(-0.16, 0.1));
  eye(g, 0.16, 0.1, 0.07, fz(0.16, 0.1));
  cheeks(g, -0.04, 0.27);
  return g;
}

/** Tall, thin legs with knobby knees and webbed feet. */
function flamingoLegs(outline: string): PartObject {
  const leg = darken(FLA.main, 0.1).getStyle();
  return pairOfLegs(0.13, 0.32, (hip) => {
    const shin = toonMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), leg, { outline: 0.15, outlineColor: outline });
    shin.position.y = -0.15;
    hip.add(shin);
    const knee = toonMesh(sphere(0.05, 10, 8), leg, { outline: 0.12, outlineColor: outline });
    knee.position.y = -0.12;
    hip.add(knee);
    const foot = toonMesh(new THREE.ConeGeometry(0.11, 0.05, 3), leg, { outline: 0.1, outlineColor: outline });
    foot.rotation.set(0, Math.PI, 0);
    foot.scale.set(1, 1, 1.3);
    foot.position.set(0, -0.3, 0.05);
    hip.add(foot);
  });
}

/** A fluffy upswept plume of pink tail feathers, two of them black-tipped. */
function flamingoTail(outline: string): PartObject {
  const g = new THREE.Group();
  const deep = darken(FLA.main, 0.15).getStyle();
  [-0.55, -0.28, 0, 0.28, 0.55].forEach((a, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, -0.04, -0.1);
    pivot.rotation.set(-0.55 + Math.abs(a) * 0.4, 0, a);
    const len = 0.34 - Math.abs(a) * 0.12;
    const f = toonMesh(sphere(0.07, 12, 8), i % 2 ? deep : FLA.main, { outline: 0.1, outlineColor: outline });
    f.scale.set(0.85, len / 0.14, 0.6);
    f.position.y = len * 0.55;
    pivot.add(f);
    if (i === 1 || i === 3) {
      const tip = toonMesh(sphere(0.045, 10, 8), INK, { outline: false });
      tip.scale.set(1, 1.4, 0.8);
      tip.position.y = len * 1.02;
      pivot.add(tip);
    }
    g.add(pivot);
  });
  return g;
}

/** Heart-shaped sunglasses. */
function heartShades(outline: string): PartObject {
  const g = new THREE.Group();
  const front = onHead(new THREE.Vector3(0, 0.15, 1), 0.04);
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.07);
  heart.bezierCurveTo(-0.1, 0.0, -0.08, 0.08, 0, 0.04);
  heart.bezierCurveTo(0.08, 0.08, 0.1, 0.0, 0, -0.07);
  const lens = makePlastic(toonMaterial('#ff3d7f', { map: null }));
  for (const s of [-1, 1]) {
    const l = toonMesh(new THREE.ExtrudeGeometry(heart, { depth: 0.02, bevelEnabled: false }), '#ff3d7f', { outline: 0.12, outlineColor: outline, material: lens });
    l.scale.setScalar(1.3);
    l.position.set(s * 0.13, -0.03, 0);
    front.add(l);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), flat(INK));
  bridge.position.set(0, 0.0, 0.01);
  front.add(bridge);
  g.add(front);
  return g;
}

// ---------- Giraffe ----------
const GIR = ANIMAL_COLORS.giraffe;
const GIR_SPOT = '#b5793b';

/** Brown spots scattered over a surface: `at` gives each one's place and facing. */
function spots(g: THREE.Object3D, places: [number, number, number][], toPoint: (x: number, y: number) => THREE.Vector3, normal: (p: THREE.Vector3) => THREE.Vector3): void {
  for (const [x, y, r] of places) {
    const s = toonMesh(sphere(r, 10, 8), GIR_SPOT, { outline: false });
    s.scale.z = 0.25;
    const p = toPoint(x, y);
    s.position.copy(p);
    s.lookAt(p.clone().add(normal(p)));
    g.add(s);
  }
}

function giraffeHead(outline: string): PartObject {
  const g = headBall(GIR.main, outline);
  spots(
    g,
    [[-0.25, 0.2, 0.05], [0.22, 0.25, 0.045], [0.3, -0.05, 0.04], [-0.3, -0.08, 0.045], [0.05, 0.36, 0.04]],
    (x, y) => new THREE.Vector3(x, y, onSurface(x, y) - 0.006),
    (p) => p.clone().normalize(),
  );
  for (const s of [-1, 1]) {
    const horn = toonMesh(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 8), GIR.main, { outline: 0.12, outlineColor: outline });
    horn.position.set(s * 0.12, 0.47, -0.04);
    horn.rotation.z = -s * 0.12;
    g.add(horn);
    const knob = toonMesh(sphere(0.05, 10, 8), GIR_SPOT, { outline: 0.1, outlineColor: outline });
    knob.position.set(s * 0.135, 0.57, -0.04);
    g.add(knob);
    const ear = toonMesh(sphere(0.08, 12, 8), GIR.main, { outlineColor: outline });
    ear.scale.set(1.7, 0.6, 0.6);
    ear.position.set(s * 0.42, 0.18, -0.02);
    ear.rotation.z = -s * 0.5;
    g.add(ear);
  }
  const muzzle = toonMesh(sphere(0.17), GIR.belly, { outline: 0.05, outlineColor: outline });
  muzzle.scale.set(1.2, 0.85, 0.8);
  muzzle.position.set(0, -0.12, 0.32);
  g.add(muzzle);
  for (const s of [-1, 1]) {
    const nostril = toonMesh(sphere(0.02, 6, 6), '#7a5236', { outline: false });
    nostril.position.set(s * 0.06, -0.08, 0.46);
    g.add(nostril);
  }
  eye(g, -0.15, 0.1);
  eye(g, 0.15, 0.1);
  return g;
}

function giraffeLegs(outline: string): PartObject {
  return pairOfLegs(0.15, 0.32, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.07, 0.075, 0.24, 12), GIR.main, { outlineColor: outline });
    leg.position.y = -0.14;
    hip.add(leg);
    const spot = toonMesh(sphere(0.035, 8, 6), GIR_SPOT, { outline: false });
    spot.scale.z = 0.3;
    spot.position.set(0, -0.1, 0.07);
    hip.add(spot);
    const hoof = toonMesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 12), '#6b4630', { outlineColor: outline });
    hoof.position.y = -0.28;
    hip.add(hoof);
  });
}

function giraffeTail(outline: string): PartObject {
  const g = new THREE.Group();
  const { mesh, curve } = tube([[0, -0.1, -0.05], [0, -0.2, -0.2], [0.04, -0.3, -0.3]], 0.025, GIR.main, outline);
  g.add(mesh);
  const tuft = toonMesh(new THREE.ConeGeometry(0.06, 0.14, 8), GIR_SPOT, { outline: 0.1, outlineColor: outline });
  tuft.rotation.x = Math.PI;
  tuft.position.copy(curve.getPoint(1)).add(new THREE.Vector3(0, -0.05, 0));
  g.add(tuft);
  return g;
}

/** A red polka-dot bow tie under the chin. */
function bowTie(outline: string): PartObject {
  const g = new THREE.Group();
  const tie = new THREE.Group();
  tie.position.set(0, -0.42, 0.18);
  tie.rotation.x = -0.4;
  for (const s of [-1, 1]) {
    const wing = toonMesh(new THREE.ConeGeometry(0.08, 0.15, 4), '#e2433f', { outline: 0.08, outlineColor: outline });
    wing.rotation.z = s * Math.PI / 2;
    wing.scale.set(1, 1, 0.45);
    wing.position.x = s * 0.075;
    tie.add(wing);
  }
  const knot = toonMesh(sphere(0.04, 10, 8), '#b8302b', { outline: 0.1, outlineColor: outline });
  tie.add(knot);
  for (const [x, y] of [[-0.09, 0.02], [0.08, -0.02], [-0.06, -0.03], [0.1, 0.03]] as const) {
    const dot = new THREE.Mesh(sphere(0.012, 6, 4), flat('#ffffff'));
    dot.position.set(x, y, 0.035);
    tie.add(dot);
  }
  g.add(tie);
  return g;
}

// ---------- Sloth ----------
const SLO = ANIMAL_COLORS.sloth;
const SLO_MASK = '#5e4632';

function slothHead(outline: string): PartObject {
  const g = headBall(SLO.main, outline);
  const face = toonMesh(sphere(0.3, 20, 14), SLO.belly, { outline: false });
  face.scale.set(1.05, 0.85, 0.55);
  face.position.set(0, -0.02, 0.22);
  g.add(face);
  for (const s of [-1, 1]) {
    // The long dark eye stripes that make a sloth look so sleepy.
    const stripe = toonMesh(sphere(0.1, 14, 10), SLO_MASK, { outline: false });
    stripe.scale.set(1.5, 0.6, 0.35);
    stripe.position.set(s * 0.15, 0.03, onSurface(s * 0.15, 0.03) - 0.02);
    stripe.rotation.z = -s * 0.45;
    g.add(stripe);
    sleepyEye(g, s * 0.14, 0.05);
  }
  const nose = toonMesh(sphere(0.05, 10, 8), SLO_MASK, { outline: false });
  nose.scale.set(1.3, 0.9, 0.8);
  nose.position.set(0, -0.08, 0.41);
  g.add(nose);
  smile(g, -0.17, 0.08);
  cheeks(g, -0.1, 0.25);
  return g;
}

/** Stubby legs with three long curved claws each. */
function slothLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.09, 0.095, 0.22, 12), SLO.main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.1, 12, 10), SLO.main, { outlineColor: outline });
    paw.scale.set(1, 0.55, 1.1);
    paw.position.set(0, -0.26, 0.02);
    hip.add(paw);
    for (const x of [-0.05, 0, 0.05]) {
      const claw = tube([[x, -0.24, 0.1], [x, -0.24, 0.2], [x, -0.29, 0.25]], 0.018, '#f3ead6', outline, 0.15).mesh;
      hip.add(claw);
    }
  });
}

/** A short fluffy stub of a tail. */
function slothTail(outline: string): PartObject {
  const g = new THREE.Group();
  const stub = toonMesh(new THREE.IcosahedronGeometry(0.11, 1), SLO.main, { outline: 0.08, outlineColor: outline });
  stub.scale.set(1, 0.8, 1.2);
  stub.position.set(0, -0.1, -0.08);
  g.add(stub);
  return g;
}

/** A leaf to munch, held in the mouth. */
function munchLeaf(outline: string): PartObject {
  const g = new THREE.Group();
  const spot = onHead(new THREE.Vector3(0.12, -0.32, 1), 0.02);
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.12);
  shape.quadraticCurveTo(0.1, 0, 0, 0.12);
  shape.quadraticCurveTo(-0.1, 0, 0, -0.12);
  const leaf = toonMesh(new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false }), '#5bb04a', { outline: 0.06, outlineColor: outline });
  leaf.rotation.z = -1.1;
  leaf.position.set(0.08, 0, 0.02);
  spot.add(leaf);
  const vein = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.01), flat('#3f8a35'));
  vein.rotation.z = -1.1 + Math.PI / 2;
  vein.position.set(0.08, 0, 0.04);
  spot.add(vein);
  g.add(spot);
  return g;
}

// ---------- Dragon ----------
const DRA = ANIMAL_COLORS.dragon;
const DRA_SPIKE = '#f7c331';
const HORN = '#fff3d6';

function dragonHead(outline: string): PartObject {
  const g = headBall(DRA.main, outline);
  for (const s of [-1, 1]) {
    const horn = tube([[s * 0.16, 0.34, -0.06], [s * 0.22, 0.48, -0.14], [s * 0.2, 0.56, -0.26]], 0.04, HORN, outline, 0.1);
    g.add(horn.mesh);
    const nostril = toonMesh(sphere(0.022, 6, 6), INK, { outline: false });
    nostril.position.set(s * 0.06, -0.06, 0.5);
    g.add(nostril);
    const fin = toonMesh(new THREE.ConeGeometry(0.06, 0.16, 4), DRA_SPIKE, { outlineColor: outline });
    fin.position.set(s * 0.4, 0.12, -0.04);
    fin.rotation.z = -s * 1.2;
    fin.scale.set(1, 1, 0.4);
    g.add(fin);
  }
  const snout = toonMesh(sphere(0.18), DRA.main, { outline: 0.05, outlineColor: outline });
  snout.scale.set(1.15, 0.75, 0.9);
  snout.position.set(0, -0.1, 0.33);
  g.add(snout);
  // A row of spikes over the top.
  for (const [y, z, h] of [[0.42, 0.06, 0.12], [0.41, -0.1, 0.14], [0.34, -0.25, 0.12]] as const) {
    const spike = toonMesh(new THREE.ConeGeometry(0.05, h, 6), DRA_SPIKE, { outline: 0.1, outlineColor: outline });
    spike.position.set(0, y, z);
    spike.rotation.x = -z * 1.4;
    g.add(spike);
  }
  eye(g, -0.15, 0.1);
  eye(g, 0.15, 0.1);
  smile(g, -0.18, 0.09, 0.42);
  return g;
}

function dragonLegs(outline: string): PartObject {
  return pairOfLegs(0.17, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.1, 0.11, 0.22, 12), DRA.main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    const paw = toonMesh(sphere(0.12, 14, 10), DRA.main, { outlineColor: outline });
    paw.scale.set(1.05, 0.55, 1.25);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
    for (const x of [-0.06, 0, 0.06]) {
      const claw = toonMesh(new THREE.ConeGeometry(0.025, 0.07, 6), HORN, { outline: false });
      claw.rotation.x = Math.PI / 2;
      claw.position.set(x, -0.27, 0.18);
      hip.add(claw);
    }
  });
}

/** Bat wings on the back and a spiky tail with an arrow tip. */
function dragonTail(outline: string): PartObject {
  const g = new THREE.Group();
  const { mesh, curve } = tube([[0, -0.12, -0.05], [0, -0.18, -0.3], [0.08, -0.08, -0.52], [0.18, 0.06, -0.6]], 0.06, DRA.main, outline);
  g.add(mesh);
  for (const t of [0.3, 0.5, 0.7]) {
    const spike = toonMesh(new THREE.ConeGeometry(0.035, 0.09, 4), DRA_SPIKE, { outline: false });
    spike.position.copy(curve.getPoint(t)).add(new THREE.Vector3(0, 0.07, 0));
    g.add(spike);
  }
  const tip = toonMesh(new THREE.ConeGeometry(0.09, 0.14, 4), DRA_SPIKE, { outline: 0.08, outlineColor: outline });
  tip.position.copy(curve.getPoint(1)).add(new THREE.Vector3(0.03, 0.05, -0.03));
  tip.rotation.set(-0.5, 0, -0.6);
  g.add(tip);
  // Wings: a scalloped membrane on each side.
  const wing = new THREE.Shape();
  wing.moveTo(0, 0);
  wing.lineTo(0.42, 0.28);
  wing.quadraticCurveTo(0.36, 0.12, 0.42, 0.02);
  wing.quadraticCurveTo(0.3, 0.02, 0.28, -0.1);
  wing.quadraticCurveTo(0.16, -0.06, 0.12, -0.18);
  wing.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.03, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const w = toonMesh(wingGeo, darken(DRA.main, 0.15).getStyle(), { outline: 0.06, outlineColor: outline });
    w.scale.set(s, 1, 1);
    w.position.set(s * 0.12, 0.2, 0.0);
    w.rotation.y = s * 0.5;
    g.add(w);
  }
  return g;
}

/** A little pile of gold coins: a dragon's treasure. */
function treasure(outline: string): PartObject {
  const g = new THREE.Group();
  const coinMat = makePlastic(toonMaterial(GOLD, { map: null }));
  for (const [x, y, z, rx, rz] of [[0.02, 0.43, 0.02, 0, 0], [0.03, 0.47, -0.01, 0.1, 0.1], [0.0, 0.51, 0.02, -0.1, 0.05], [0.04, 0.55, 0.0, 0.15, -0.2], [-0.08, 0.45, 0.06, 0.6, 0.3]] as const) {
    const coin = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16), GOLD, { outline: 0.1, outlineColor: outline, material: coinMat });
    coin.position.set(x, y, z);
    coin.rotation.set(rx, 0, rz);
    g.add(coin);
  }
  const gem = toonMesh(new THREE.OctahedronGeometry(0.05, 0), '#e2433f', { outline: 0.1, outlineColor: outline, material: makePlastic(toonMaterial('#e2433f', { map: null })) });
  gem.position.set(0.04, 0.6, 0.0);
  g.add(gem);
  return g;
}

// ---------- Phoenix ----------
const PHO = ANIMAL_COLORS.phoenix;
const FLAME = ['#ffcf3d', '#ff8a3d', '#e2433f'];

/** A flame-feather: a teardrop tinted from `inner` to `outer`. */
function flameFeather(len: number, color: string, outline: string): THREE.Mesh {
  const f = toonMesh(sphere(0.07, 12, 8), color, { outline: 0.1, outlineColor: outline });
  f.scale.set(0.75, len / 0.14, 0.6);
  return f;
}

function phoenixHead(outline: string): PartObject {
  const g = headBall(PHO.main, outline);
  // A crest of flame feathers sweeping back.
  [-0.3, 0, 0.3].forEach((a, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.36, -0.04);
    pivot.rotation.set(-0.5, 0, a);
    const f = flameFeather(0.32 - Math.abs(a) * 0.3, FLAME[i]!, outline);
    f.position.y = 0.14;
    pivot.add(f);
    g.add(pivot);
  });
  const beak = toonMesh(new THREE.ConeGeometry(0.06, 0.14, 8), GOLD, { outline: 0.1, outlineColor: outline });
  beak.rotation.x = Math.PI / 2 + 0.5;
  beak.position.set(0, -0.06, 0.45);
  g.add(beak);
  const mask = toonMesh(sphere(0.3, 18, 12), PHO.belly, { outline: false });
  mask.scale.set(1, 0.6, 0.5);
  mask.position.set(0, 0.06, 0.2);
  g.add(mask);
  eye(g, -0.14, 0.08, 0.07, 0.38);
  eye(g, 0.14, 0.08, 0.07, 0.38);
  return g;
}

function phoenixLegs(outline: string): PartObject {
  return pairOfLegs(0.14, 0.32, (hip) => {
    const leg = toonMesh(new THREE.CapsuleGeometry(0.045, 0.18, 4, 8), GOLD, { outline: 0.12, outlineColor: outline });
    leg.position.y = -0.15;
    hip.add(leg);
    for (const a of [-0.5, 0, 0.5]) {
      const talon = toonMesh(new THREE.CapsuleGeometry(0.022, 0.1, 3, 6), GOLD, { outline: 0.15, outlineColor: outline });
      talon.rotation.set(Math.PI / 2, 0, 0);
      talon.position.set(Math.sin(a) * 0.07, -0.3, 0.07 + Math.cos(a) * 0.02);
      hip.add(talon);
    }
  });
}

/** Long flowing flame tail feathers and two small wings. */
function phoenixTail(outline: string): PartObject {
  const g = new THREE.Group();
  [-0.55, -0.25, 0, 0.25, 0.55].forEach((a, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, -0.06, -0.08);
    pivot.rotation.set(-1.15 + Math.abs(a) * 0.3, 0, a);
    const f = flameFeather(0.5 - Math.abs(a) * 0.25, FLAME[i % 3]!, outline);
    f.position.y = 0.24;
    pivot.add(f);
    const tip = toonMesh(sphere(0.045, 8, 6), '#fff3a8', { outline: false });
    tip.position.y = 0.46 - Math.abs(a) * 0.25;
    pivot.add(tip);
    g.add(pivot);
  });
  for (const s of [-1, 1]) {
    const wing = flameFeather(0.36, s < 0 ? FLAME[1]! : FLAME[1]!, outline);
    wing.position.set(s * 0.25, 0.1, 0.02);
    wing.rotation.set(0.2, 0, s * 0.9);
    g.add(wing);
  }
  return g;
}

/** A golden circlet with a sun disc on the brow. */
function sunCirclet(outline: string): PartObject {
  const g = new THREE.Group();
  const gold = makePlastic(toonMaterial(GOLD, { map: null }));
  // Level round the head, hugging it.
  const band = toonMesh(new THREE.TorusGeometry(Math.sqrt(HEAD_RADIUS ** 2 - 0.2 ** 2) + 0.01, 0.025, 8, 36), GOLD, { outline: false, material: gold });
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.2, 0);
  g.add(band);
  const sun = onHead(new THREE.Vector3(0, 0.55, 0.8), 0.03);
  sun.add(toonMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 18).rotateX(Math.PI / 2), GOLD, { outline: 0.1, outlineColor: outline, material: gold }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), gold);
    ray.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0);
    ray.rotation.z = a - Math.PI / 2;
    sun.add(ray);
  }
  g.add(sun);
  return g;
}

// ---------- Yeti ----------
const YET = ANIMAL_COLORS.yeti;
const YETI_SKIN = '#8fb6e8';
/** Shaggy fur, a touch bluer than the body so it reads. */
export const YETI_FUR = '#dfe9fb';

function yetiHead(outline: string): PartObject {
  const g = headBall(YET.main, outline);
  // A big blue face, framed by a shaggy fringe of drooping fur.
  const face = facePatch(YETI_SKIN, 0.78, 0.92);
  face.position.y = -0.03;
  g.add(face);
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * 0.95 + (i / 10) * Math.PI * 0.9 - Math.PI * 0.05;
    const x = Math.cos(a) * 0.3;
    const y = Math.sin(a) * 0.3 + 0.17;
    if (y < -0.2) continue;
    const tuft = toonMesh(sphere(0.07, 10, 8), YETI_FUR, { outline: 0.08, outlineColor: outline });
    tuft.scale.set(0.8, 1.5, 0.6);
    const z = onSurface(x * 0.95, y * 0.95);
    tuft.position.set(x, y, z);
    tuft.rotation.z = a + Math.PI / 2;
    g.add(tuft);
  }
  const fz = (x: number, y: number) => onSurface(x, y) + 0.02;
  eye(g, -0.12, 0.02, 0.065, fz(-0.12, 0.02));
  eye(g, 0.12, 0.02, 0.065, fz(0.12, 0.02));
  const nose = toonMesh(sphere(0.05, 10, 8), '#3d5f99', { outline: false });
  nose.scale.set(1.4, 0.9, 0.8);
  nose.position.set(0, -0.08, fz(0, -0.08));
  g.add(nose);
  smile(g, -0.15, 0.09, fz(0, -0.15) - 0.01);
  for (const sgn of [-1, 1]) {
    const fang = toonMesh(new THREE.ConeGeometry(0.03, 0.07, 8), '#ffffff', { outline: 0.15, outlineColor: outline });
    fang.rotation.x = Math.PI;
    fang.position.set(sgn * 0.05, -0.25, fz(sgn * 0.05, -0.25) - 0.01);
    g.add(fang);
  }
  return g;
}

/** Big blue feet with three toes. */
function yetiLegs(outline: string): PartObject {
  return pairOfLegs(0.17, 0.3, (hip) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.1, 0.11, 0.2, 12), YET.main, { outlineColor: outline });
    leg.position.y = -0.12;
    hip.add(leg);
    const foot = toonMesh(sphere(0.14, 14, 10), YETI_SKIN, { outlineColor: outline });
    foot.scale.set(1.05, 0.5, 1.45);
    foot.position.set(0, -0.26, 0.05);
    hip.add(foot);
    for (const x of [-0.07, 0, 0.07]) {
      const toe = toonMesh(sphere(0.04, 8, 6), YETI_SKIN, { outline: 0.12, outlineColor: outline });
      toe.position.set(x, -0.25, 0.24);
      hip.add(toe);
    }
  });
}

function yetiTail(outline: string): PartObject {
  const g = new THREE.Group();
  for (const [x, y, z, r] of [[0, -0.08, -0.1, 0.1], [0.07, -0.04, -0.14, 0.075], [-0.07, -0.03, -0.13, 0.075]] as const) {
    const tuft = toonMesh(sphere(r, 12, 10), YETI_FUR, { outline: 0.08, outlineColor: outline });
    tuft.scale.set(0.9, 1.3, 0.9);
    tuft.position.set(x, y, z);
    g.add(tuft);
  }
  return g;
}

/** Fluffy ice-blue earmuffs on a band over the top of the head. */
function earmuffs(outline: string): PartObject {
  const g = new THREE.Group();
  const band = toonMesh(new THREE.TorusGeometry(HEAD_RADIUS + 0.04, 0.035, 8, 28, Math.PI), '#5b8fd6', { outline: 0.1, outlineColor: outline, material: makePlastic(toonMaterial('#5b8fd6', { map: null })) });
  band.position.y = 0.05;
  g.add(band);
  for (const s of [-1, 1]) {
    const muff = toonMesh(new THREE.IcosahedronGeometry(0.16, 2), '#9fd8ff', { outline: 0.07, outlineColor: outline });
    muff.scale.set(0.7, 1, 1);
    muff.position.set(s * (HEAD_RADIUS + 0.06), 0.05, 0);
    g.add(muff);
  }
  return g;
}

type NewAnimal = 'mouse' | 'sheep' | 'raccoon' | 'bee' | 'flamingo' | 'giraffe' | 'sloth' | 'dragon' | 'phoenix' | 'yeti';

export const MYTHIC_PARTS: Record<Exclude<PartSlot, 'body'>, Record<NewAnimal, Builder>> = {
  head: {
    mouse: mouseHead, sheep: sheepHead, raccoon: raccoonHead, bee: beeHead, flamingo: flamingoHead,
    giraffe: giraffeHead, sloth: slothHead, dragon: dragonHead, phoenix: phoenixHead, yeti: yetiHead,
  },
  legs: {
    mouse: mouseLegs, sheep: sheepLegs, raccoon: raccoonLegs, bee: beeLegs, flamingo: flamingoLegs,
    giraffe: giraffeLegs, sloth: slothLegs, dragon: dragonLegs, phoenix: phoenixLegs, yeti: yetiLegs,
  },
  tail: {
    mouse: mouseTail, sheep: sheepTail, raccoon: raccoonTail, bee: beeWings, flamingo: flamingoTail,
    giraffe: giraffeTail, sloth: slothTail, dragon: dragonTail, phoenix: phoenixTail, yeti: yetiTail,
  },
  accessory: {
    mouse: cheese, sheep: cowBell, raccoon: tinLid, bee: honeyPot, flamingo: heartShades,
    giraffe: bowTie, sloth: munchLeaf, dragon: treasure, phoenix: sunCirclet, yeti: earmuffs,
  },
};

/** Giraffe spots, for its body (animal-bodies.ts). */
export const GIRAFFE_SPOT = GIR_SPOT;
