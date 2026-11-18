// Code-built placeholder parts: eight animals (the second four in more-animals.ts), one part per slot each. Each part is authored
// relative to its slot's socket on the plush rig (see PlushView), exactly like the real models
// will be, so a real part replaces its placeholder without touching the rig. Rarity doesn't
// change a part's look; it shows on the ground and in the HUD.
import * as THREE from 'three';
import type { Animal, PartSlot } from '@stuffed/sim';
import { ANIMAL_COLORS } from './animal-colors.ts';
import { BODIES } from './animal-bodies.ts';
import { EVEN_MORE_PARTS } from './even-more-animals.ts';
import { mergeStatic } from './merge-static.ts';
import { MORE_PARTS } from './more-animals.ts';
import { YET_MORE_PARTS } from './yet-more-animals.ts';
import { FINAL_PARTS } from './final-animals.ts';
import { detailMaps, repeated } from './image-textures.ts';
import { feltTexture, lighten, darken, makePlastic, OUTLINE_COLOR, toonMaterial, toonMesh } from './toon.ts';

const HEAD_RADIUS = 0.42;

const COMB = '#e2574c';
const BEAK = '#f0a93b';

const sphere = (r: number, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);

/** Legs parts expose their hip pivots so the rig can swing them. */
export interface PartObject extends THREE.Object3D {
  userData: { swing?: THREE.Object3D[] };
}

/** Main color of a body part; arms are dyed to match it. */
export function bodyColor(animal: Animal): string {
  return ANIMAL_COLORS[animal]?.main ?? '#cccccc';
}

export function buildPart(slot: PartSlot, animal: Animal): PartObject {
  const builder = BUILDERS[slot][animal];
  const part = builder ? builder(OUTLINE_COLOR) : missingPart();
  // The animal's fabric instead of the plain felt.
  const felt = feltTexture();
  const kind = FABRICS[animal] ?? 'minky';
  const { map: fabric, normal: bumps } = fabricDetail(kind);
  part.traverse((o) => {
    // Button eyes, noses and stitched mouths: shiny black buttons and thread.
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.material.color.getHexString() === '2a1f2d') makePlastic(o.material);
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.material.map === felt) {
      o.material.map = fabric;
      o.material.normalMap = bumps;
      o.material.normalScale.setScalar(0.7);
    }
  });
  mergeStatic(part, part.userData.swing ?? []);
  return part;
}

type Fabric = 'minky' | 'knit' | 'corduroy';
/** Each animal's fabric (the rest are minky dot plush). */
const FABRICS: Partial<Record<Animal, Fabric>> = {
  bear: 'knit', cat: 'knit', fox: 'knit', lion: 'knit', koala: 'knit', penguin: 'knit',
  frog: 'corduroy', dino: 'corduroy', shark: 'corduroy', turtle: 'corduroy', elephant: 'corduroy',
};
const fabricMaps = new Map<Fabric, { map: THREE.Texture; normal: THREE.Texture }>();

/** A fabric's tintable detail and its weave as a normal map, repeated a few times round a part. */
function fabricDetail(kind: Fabric): { map: THREE.Texture; normal: THREE.Texture } {
  let maps = fabricMaps.get(kind);
  if (!maps) {
    const base = detailMaps(`fabric_${kind}`, feltTexture().image as HTMLCanvasElement);
    maps = { map: repeated(base.map, 3, 2), normal: repeated(base.normal, 3, 2) };
    fabricMaps.set(kind, maps);
  }
  return maps;
}

type Builder = (outline: string) => PartObject;

/** How much taller than a plain ball a head is on top (the octopus's dome): accessories worn on
 *  top of the head are lifted by this, so hats sit on it instead of sinking in. */
export const HEAD_TOP_LIFT: Partial<Record<Animal, number>> = { octopus: 0.2 };
/** Accessories worn on the face, not on top (they stay put on a taller head). */
export const FACE_ACCESSORIES: ReadonlySet<Animal> = new Set<Animal>(['owl', 'shark', 'turtle']);

const BUILDERS: Record<PartSlot, Record<Animal, Builder>> = {
  head: {
    bear: (o) => bearHead(o),
    frog: (o) => frogHead(o),
    shark: (o) => sharkHead(o),
    chicken: (o) => chickenHead(o),

    ...MORE_PARTS.head,
    ...EVEN_MORE_PARTS.head,
    ...YET_MORE_PARTS.head,
    ...FINAL_PARTS.head,
  },
  // Each animal's body has its own shape (animal-bodies.ts); all fit any head, legs and arms.
  body: BODIES,
  legs: {
    bear: (o) => stubbyLegs(o),
    frog: (o) => flipperLegs(o),
    shark: (o) => finLegs(o),
    chicken: (o) => chickenLegs(o),

    ...MORE_PARTS.legs,
    ...EVEN_MORE_PARTS.legs,
    ...YET_MORE_PARTS.legs,
    ...FINAL_PARTS.legs,
  },
  tail: {
    bear: (o) => pomTail(o),
    frog: (o) => lilyPad(o),
    shark: (o) => sharkTail(o),
    chicken: (o) => featherFan(o),

    ...MORE_PARTS.tail,
    ...EVEN_MORE_PARTS.tail,
    ...YET_MORE_PARTS.tail,
    ...FINAL_PARTS.tail,
  },
  accessory: {
    bear: (o) => bow(o),
    frog: () => crown(),
    shark: (o) => bandage(o),
    chicken: (o) => eggShell(o),

    ...MORE_PARTS.accessory,
    ...EVEN_MORE_PARTS.accessory,
    ...YET_MORE_PARTS.accessory,
    ...FINAL_PARTS.accessory,
  },
};

function missingPart(): PartObject {
  const g = new THREE.Group();
  g.add(toonMesh(sphere(0.15), '#ff00ff', { outline: false }));
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
  const c = ANIMAL_COLORS.bear.main;
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
  const snout = toonMesh(sphere(0.16), ANIMAL_COLORS.bear.belly, { outline: 0.05, outlineColor: outline });
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
  const c = ANIMAL_COLORS.frog.main;
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
  const c = ANIMAL_COLORS.shark.main;
  const g = headBall(c, outline);
  const fin = toonMesh(new THREE.ConeGeometry(0.2, 0.42, 16), c, { outlineColor: outline });
  fin.scale.set(0.35, 1, 1);
  fin.position.set(0, 0.48, -0.06);
  fin.rotation.x = -0.4;
  g.add(fin);
  const belly = toonMesh(sphere(0.3), ANIMAL_COLORS.shark.belly, { outline: false });
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

function chickenHead(outline: string): PartObject {
  const c = ANIMAL_COLORS.chicken.main;
  const g = headBall(c, outline);
  // comb: three red bumps along the top
  [-0.12, 0, 0.12].forEach((z, i) => {
    const bump = toonMesh(sphere(i === 1 ? 0.12 : 0.1), COMB, { outlineColor: outline });
    bump.scale.set(0.6, 1, 1);
    bump.position.set(0, 0.43 + (i === 1 ? 0.05 : 0), z);
    g.add(bump);
  });
  const beak = toonMesh(new THREE.ConeGeometry(0.09, 0.2, 12), BEAK, { outlineColor: outline });
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.02, 0.48);
  g.add(beak);
  const wattle = toonMesh(sphere(0.06), COMB, { outline: 0.1, outlineColor: outline });
  wattle.scale.set(0.8, 1.3, 0.8);
  wattle.position.set(0, -0.15, 0.38);
  g.add(wattle);
  buttonEye(g, -0.17, 0.1);
  buttonEye(g, 0.17, 0.1);
  return g;
}

// ---- legs (each hip is a pivot the rig swings) ----
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

function chickenLegs(outline: string): PartObject {
  return pairOfLegs(0.15, 0.36, (hip) => {
    const leg = toonMesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), BEAK, { outline: 0.12, outlineColor: outline });
    leg.position.y = -0.17;
    hip.add(leg);
    const foot = toonMesh(sphere(0.1, 14, 10), BEAK, { outlineColor: outline });
    foot.scale.set(1, 0.45, 1.5);
    foot.position.set(0, -0.33, 0.05);
    hip.add(foot);
  });
}

function stubbyLegs(outline: string): PartObject {
  const c = ANIMAL_COLORS.bear.main;
  return pairOfLegs(0.18, 0.3, (hip) => {
    const stump = toonMesh(new THREE.CylinderGeometry(0.11, 0.12, 0.22, 16), c, { outlineColor: outline });
    stump.position.y = -0.14;
    hip.add(stump);
    const paw = toonMesh(sphere(0.13, 16, 10), ANIMAL_COLORS.bear.belly, { outlineColor: outline });
    paw.scale.set(1, 0.5, 1.25);
    paw.position.set(0, -0.26, 0.03);
    hip.add(paw);
  });
}

/** Thin green legs on wide, flat webbed feet. */
function flipperLegs(outline: string): PartObject {
  const c = ANIMAL_COLORS.frog.main;
  return pairOfLegs(0.17, 0.32, (hip) => {
    const leg = toonMesh(new THREE.CapsuleGeometry(0.09, 0.16, 4, 10), c, { outline: 0.1, outlineColor: outline });
    leg.position.y = -0.14;
    hip.add(leg);
    // A puffy webbed foot with three round toes.
    const footColor = lighten(c, 0.15);
    const foot = toonMesh(sphere(0.12, 16, 10), footColor, { outlineColor: outline });
    foot.scale.set(1.05, 0.38, 1.25);
    foot.position.set(0, -0.3, 0.08);
    hip.add(foot);
    for (const a of [-0.55, 0, 0.55]) {
      const toe = toonMesh(sphere(0.045, 10, 8), footColor, { outline: 0.1, outlineColor: outline });
      toe.scale.set(1, 0.7, 1);
      toe.position.set(Math.sin(a) * 0.13, -0.3, 0.08 + Math.cos(a) * 0.14);
      hip.add(toe);
    }
  });
}

/** Short grey stumps ending in little flat fins. */
function finLegs(outline: string): PartObject {
  const c = ANIMAL_COLORS.shark.main;
  return pairOfLegs(0.17, 0.3, (hip) => {
    const stump = toonMesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 14), c, { outlineColor: outline });
    stump.position.y = -0.14;
    hip.add(stump);
    // A soft rounded flipper, wider at the front, with a pale underside edge.
    const fin = toonMesh(sphere(0.13, 16, 10), c, { outlineColor: outline });
    fin.scale.set(0.95, 0.38, 1.45);
    fin.position.set(0, -0.28, 0.08);
    hip.add(fin);
    const tip = toonMesh(sphere(0.07, 12, 8), ANIMAL_COLORS.shark.belly, { outline: false });
    tip.scale.set(1.2, 0.45, 1);
    tip.position.set(0, -0.31, 0.2);
    hip.add(tip);
  });
}

// ---- tails and backs ----
function pomTail(outline: string): PartObject {
  const g = new THREE.Group();
  const puff = toonMesh(sphere(0.13), ANIMAL_COLORS.bear.main, { outlineColor: outline });
  puff.position.set(0, -0.08, -0.02);
  g.add(puff);
  return g;
}

/** A lily pad worn like a little backpack, with a pink flower on it. */
function lilyPad(outline: string): PartObject {
  const g = new THREE.Group();
  // A soft, puffy pad (a squashed ball with its notch cut out) with a few veins.
  const padColor = '#4fa04a';
  const pad = toonMesh(new THREE.SphereGeometry(0.3, 28, 12, 0.35, Math.PI * 2 - 0.7), padColor, {
    outline: 0.06,
    outlineColor: outline,
    material: toonMaterial(padColor, { side: THREE.DoubleSide }),
  });
  pad.scale.set(1, 0.22, 1);
  pad.rotation.x = Math.PI / 2 - 0.25;
  pad.position.set(0, 0.12, -0.02);
  g.add(pad);
  for (const a of [1.2, 2.2, 3.1, 4.0, 5.0]) {
    // On the outer face (local -y faces away from the back once tilted).
    const vein = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.14), toonMaterial(darken(padColor, 0.25).getStyle(), { map: null }));
    vein.position.set(Math.sin(a) * 0.1, -0.27, Math.cos(a) * 0.1);
    vein.rotation.y = a;
    pad.add(vein);
  }
  const flower = new THREE.Group();
  flower.position.set(0.08, 0.2, -0.04);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = toonMesh(sphere(0.06, 10, 8), '#f49ac1', { outline: 0.1, outlineColor: outline });
    petal.scale.set(1, 0.5, 1);
    petal.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0);
    flower.add(petal);
  }
  const middle = toonMesh(sphere(0.035, 8, 6), '#f7d046', { outline: false });
  middle.position.z = -0.02;
  flower.add(middle);
  flower.rotation.x = -0.25;
  g.add(flower);
  return g;
}

/** An upright crescent fin sticking out behind. */
function sharkTail(outline: string): PartObject {
  const g = new THREE.Group();
  const c = ANIMAL_COLORS.shark.main;
  const root = toonMesh(sphere(0.13), c, { outlineColor: outline });
  root.scale.set(0.75, 0.85, 1.7);
  root.position.set(0, -0.02, -0.12);
  g.add(root);
  for (const [tilt, len] of [[0.65, 0.5], [2.35, 0.36]] as const) {
    const lobe = toonMesh(new THREE.ConeGeometry(0.12, len, 12), c, { outlineColor: outline });
    lobe.scale.set(0.5, 1, 1);
    lobe.rotation.x = -tilt;
    lobe.position.set(0, Math.cos(tilt) * len * 0.45, -0.3 - Math.sin(tilt) * len * 0.45);
    g.add(lobe);
  }
  return g;
}

/** A fan of white feathers with one red one. */
function featherFan(outline: string): PartObject {
  const g = new THREE.Group();
  [-0.55, -0.2, 0.2, 0.55].forEach((a, i) => {
    const feather = toonMesh(sphere(0.07, 12, 8), i === 2 ? COMB : ANIMAL_COLORS.chicken.main, { outline: 0.1, outlineColor: outline });
    feather.scale.set(0.7, 3, 0.7);
    feather.position.y = 0.18;
    const pivot = new THREE.Group();
    pivot.position.set(0, -0.05, -0.06);
    pivot.rotation.set(-0.6, 0, a);
    pivot.add(feather);
    g.add(pivot);
  });
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


/** A chunky gold crown, a little tipped, with ball-topped points and red gems on the band. */
function crown(): PartObject {
  const g = new THREE.Group();
  const gold = '#f7c331';
  const crown = new THREE.Group();
  crown.position.set(0, 0.42, -0.04);
  crown.rotation.set(-0.12, 0, 0.12);
  // A band with thickness (a ring profile spun round), so it reads solid from any side.
  const profile = [new THREE.Vector2(0.17, -0.06), new THREE.Vector2(0.21, -0.06), new THREE.Vector2(0.21, 0.06), new THREE.Vector2(0.17, 0.06), new THREE.Vector2(0.17, -0.06)];
  crown.add(toonMesh(new THREE.LatheGeometry(profile, 24), gold, { outline: 0.06 }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const point = toonMesh(new THREE.ConeGeometry(0.055, 0.15, 8), gold, { outline: 0.1 });
    point.position.set(Math.cos(a) * 0.19, 0.13, Math.sin(a) * 0.19);
    crown.add(point);
    const ball = toonMesh(sphere(0.03, 8, 6), gold, { outline: false });
    ball.position.set(Math.cos(a) * 0.19, 0.215, Math.sin(a) * 0.19);
    crown.add(ball);
    const gem = toonMesh(sphere(0.032, 8, 6), i % 2 ? '#3d7ff2' : '#e2433f', { outline: false });
    gem.scale.set(1, 1, 0.6);
    gem.position.set(Math.cos(a + Math.PI / 5) * 0.212, 0, Math.sin(a + Math.PI / 5) * 0.212);
    gem.lookAt(gem.position.clone().multiplyScalar(2));
    crown.add(gem);
  }
  g.add(crown);
  return g;
}

/** Half an egg shell worn as a little hat tipped over one side (the comb still shows), with a
 *  zigzag rim. */
function eggShell(outline: string): PartObject {
  const g = new THREE.Group();
  const color = '#fff4dc';
  const shell = toonMesh(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), color, {
    outlineColor: outline,
    material: toonMaterial(color, { side: THREE.DoubleSide }),
  });
  shell.scale.set(1, 1.15, 1);
  shell.position.set(-0.24, 0.3, -0.02);
  shell.rotation.z = 0.75;
  g.add(shell);
  const toothGeo = new THREE.ConeGeometry(0.03, 0.07, 4);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const tooth = toonMesh(toothGeo, color, { outline: false });
    tooth.position.set(Math.cos(a) * 0.165, -0.025, Math.sin(a) * 0.165);
    shell.add(tooth);
  }
  return g;
}

/** A big felt bow on one ear (the bear's accessory). */
function bow(outline: string): PartObject {
  const g = new THREE.Group();
  const spot = onHead(new THREE.Vector3(0.3, 0.38, 0.15));
  for (const s of [-1, 1]) {
    const loop = toonMesh(new THREE.SphereGeometry(0.1, 14, 10), '#e2574c', { outline: 0.08, outlineColor: outline });
    loop.scale.set(1.2, 0.8, 0.45);
    loop.position.set(s * 0.1, 0, 0.02);
    loop.rotation.z = s * 0.3;
    spot.add(loop);
  }
  const knot = toonMesh(new THREE.SphereGeometry(0.05, 10, 8), '#c43e36', { outline: 0.1, outlineColor: outline });
  knot.position.z = 0.04;
  spot.add(knot);
  g.add(spot);
  return g;
}
