// Parts for the sea folk: the Otter (a diver: mask and snorkel, flippers, a paddle tail) and the
// Mermaid (long sea-green hair, a fish tail she hops on, a shimmering fin, a crown of shells).
// Heads, legs, tails and accessories; their bodies are in animal-bodies.ts. Same sockets and scale
// as the others.
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

/** A tube along `points`. */
function tube(points: [number, number, number][], radius: number, color: string, outline: string, o: number | false = 0.12): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return toonMesh(new THREE.TubeGeometry(curve, 20, radius, 8), color, o === false ? { outline: false } : { outline: o, outlineColor: outline });
}

// ---------- Otter (the diver) ----------
const OTT = ANIMAL_COLORS.otter;
const OTTER_MUZZLE = '#f2dcc0';
/** The diving gear's colors: a sunny yellow frame and tank, an orange snorkel and flippers. */
const GEAR = '#ffcc33';
const FLIPPER = '#ff8a3d';

function otterHead(outline: string): PartObject {
  const g = headBall(OTT.main, outline);
  // Little round ears low on the sides.
  for (const s of [-1, 1]) {
    const ear = toonMesh(sphere(0.085, 12, 10), OTT.main, { outline: 0.08, outlineColor: outline });
    ear.scale.set(1, 0.85, 0.55);
    ear.position.set(s * 0.33, 0.24, 0.02);
    g.add(ear);
    const inner = toonMesh(sphere(0.05, 10, 8), darken(OTT.main, 0.25).getStyle(), { outline: false });
    inner.scale.set(1, 0.85, 0.4);
    inner.position.set(s * 0.335, 0.235, 0.05);
    g.add(inner);
  }
  // A pale, puffy muzzle with a big dark nose and whiskers.
  const muzzle = toonMesh(sphere(0.16, 18, 12), OTTER_MUZZLE, { outline: false });
  muzzle.scale.set(1.25, 0.8, 0.7);
  muzzle.position.set(0, -0.11, onSurface(0, -0.11) - 0.05);
  g.add(muzzle);
  const nose = toonMesh(sphere(0.055, 12, 8), '#3a2a24', { outline: false });
  nose.scale.set(1.35, 0.85, 0.8);
  nose.position.set(0, -0.05, onSurface(0, -0.05) + 0.06);
  g.add(nose);
  for (const s of [-1, 1]) {
    for (const dy of [-0.02, 0.025]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 4), flat('#ffffff'));
      w.rotation.z = Math.PI / 2 + s * dy * 4;
      w.position.set(s * 0.19, -0.11 + dy, onSurface(0.19, -0.11) + 0.04);
      g.add(w);
    }
  }
  eye(g, -0.13, 0.06, 0.06);
  eye(g, 0.13, 0.06, 0.06);
  smile(g, -0.18, 0.05, onSurface(0, -0.18) + 0.03);
  return g;
}

/** Short legs ending in big bright flippers. */
function otterLegs(outline: string): PartObject {
  return pairOfLegs(0.16, 0.3, (hip, side) => {
    const leg = toonMesh(new THREE.CylinderGeometry(0.08, 0.085, 0.22, 12), OTT.main, { outlineColor: outline });
    leg.position.y = -0.13;
    hip.add(leg);
    // A flipper: a long flat paddle splaying out a little, ribbed.
    const shape = new THREE.Shape();
    shape.moveTo(-0.08, 0);
    shape.quadraticCurveTo(-0.15, 0.22, -0.12, 0.36);
    shape.quadraticCurveTo(0, 0.42, 0.12, 0.36);
    shape.quadraticCurveTo(0.15, 0.22, 0.08, 0);
    shape.closePath();
    const paddle = toonMesh(new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), FLIPPER, {
      outline: 0.06,
      outlineColor: outline,
      material: makePlastic(toonMaterial(FLIPPER, { map: null })),
    });
    paddle.rotation.x = Math.PI / 2;
    paddle.rotation.z = side * -0.15;
    paddle.position.set(0, -0.255, -0.05);
    hip.add(paddle);
    for (const x of [-0.05, 0, 0.05]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.22), flat(darken(FLIPPER, 0.2).getStyle()));
      rib.position.set(x, -0.215, 0.17);
      hip.add(rib);
    }
  });
}

/** A thick, flat paddle of a tail, tapering to a rounded tip. */
function otterTail(outline: string): PartObject {
  const g = new THREE.Group();
  const tail = toonMesh(sphere(0.13, 18, 12), OTT.main, { outlineColor: outline });
  tail.scale.set(0.9, 0.42, 2.1);
  tail.rotation.x = 0.55;
  tail.position.set(0, -0.15, -0.22);
  g.add(tail);
  return g;
}

/** A diving mask over the eyes (yellow frame, glass, a strap round the head) and a snorkel. */
function divingMask(outline: string): PartObject {
  const g = new THREE.Group();
  const frameMat = makePlastic(toonMaterial(GEAR, { map: null }));
  const y = 0.06;
  const z = onSurface(0, y) + 0.06;
  const frame = toonMesh(new THREE.TorusGeometry(0.17, 0.035, 10, 32), GEAR, { outline: 0.07, outlineColor: outline, material: frameMat });
  frame.scale.set(1.35, 0.8, 1);
  frame.position.set(0, y, z);
  frame.userData.ownLine = true;
  g.add(frame);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.17, 32),
    new THREE.MeshBasicMaterial({ color: '#bff0ff', transparent: true, opacity: 0.45, depthWrite: false }),
  );
  glass.scale.set(1.35, 0.8, 1);
  glass.position.set(0, y, z - 0.005);
  g.add(glass);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  glint.position.set(-0.12, y + 0.03, z + 0.01);
  glint.rotation.z = -0.5;
  g.add(glint);
  // The strap round the back of the head.
  const strap = toonMesh(new THREE.TorusGeometry(HEAD_RADIUS + 0.015, 0.025, 6, 40), '#2f3640', { outline: false });
  strap.rotation.x = Math.PI / 2;
  strap.position.y = y;
  g.add(strap);
  // The snorkel up the side: an orange tube from the mouth, past the cheek, up over the ear.
  g.add(tube([[0.1, -0.18, onSurface(0.1, -0.18) + 0.03], [0.3, -0.12, 0.26], [0.42, 0.05, 0.12], [0.44, 0.35, 0.05], [0.42, 0.52, 0.04]], 0.035, FLIPPER, outline, 0.08));
  const top = toonMesh(new THREE.CylinderGeometry(0.045, 0.04, 0.06, 12), GEAR, { outline: 0.1, outlineColor: outline });
  top.position.set(0.42, 0.54, 0.04);
  g.add(top);
  return g;
}

// ---------- Mermaid ----------
const MER = ANIMAL_COLORS.mermaid;
const HAIR = '#3fc9b8';
const HAIR_DARK = '#2aa596';
const SHELL = '#ff9cbf';

function mermaidHead(outline: string): PartObject {
  const g = headBall(MER.main, outline);
  // Hair: a cap over the top and back of the head, curls round its edge (a short curly bob) and a
  // fringe of them across the forehead.
  const cap = toonMesh(new THREE.SphereGeometry(HEAD_RADIUS + 0.03, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), HAIR, { outlineColor: outline });
  // (Tipped back, off her forehead: down to the eyes it looked like a helmet.)
  cap.rotation.x = -0.6;
  g.add(cap);
  // Round the cap's edge, tipped back like the cap (sides and back; the fringe is in front).
  const edge = new THREE.Group();
  edge.rotation.x = -0.6;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (Math.cos(a) > 0.55) continue;
    const curl = toonMesh(sphere(0.085, 12, 10), i % 2 ? HAIR : HAIR_DARK, { outline: 0.08, outlineColor: outline });
    curl.position.set(Math.sin(a) * (HEAD_RADIUS + 0.01), 0.02, Math.cos(a) * (HEAD_RADIUS + 0.01));
    edge.add(curl);
  }
  g.add(edge);
  for (let i = 0; i < 6; i++) {
    const a = -0.75 + (i / 5) * 1.5;
    const curl = toonMesh(sphere(0.085, 12, 10), i % 2 ? HAIR : HAIR_DARK, { outline: 0.08, outlineColor: outline });
    curl.scale.set(1, 0.8, 0.7);
    curl.position.set(Math.sin(a) * 0.3, 0.25 - Math.abs(a) * 0.05, Math.cos(a) * 0.29);
    g.add(curl);
  }
  // Big bright eyes with lashes, rosy cheeks, a little smile.
  for (const s of [-1, 1]) {
    eye(g, s * 0.13, 0.0, 0.07);
    for (const k of [-1, 0, 1]) {
      const lash = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.01), flat(INK));
      lash.position.set(s * (0.13 + 0.06) + k * 0.018 * s, 0.06 + Math.abs(k) * -0.008, onSurface(0.19, 0.06) + 0.01);
      lash.rotation.z = s * (-0.6 + k * 0.25);
      g.add(lash);
    }
  }
  cheeks(g, -0.09, 0.22);
  smile(g, -0.16, 0.06);
  return g;
}

/**
 * Her fish tail, in place of legs: smooth and sea-green, down from the hips (under her, only its
 * tip curling forward) into a pink fin splayed out to the sides (she hops on it; it doesn't swing).
 */
function mermaidLegs(outline: string): PartObject {
  const g: PartObject = new THREE.Group();
  const scales = MER.belly;
  const path: [number, number, number, number][] = [
    [0, 0.33, 0, 0.21],
    [0, 0.22, 0, 0.17],
    [0, 0.13, 0.02, 0.13],
    [0, 0.07, 0.06, 0.1],
    [0, 0.05, 0.1, 0.075],
  ];
  for (const [x, y, z, r] of path) {
    const seg = toonMesh(sphere(r, 18, 12), scales, { outline: 0.05, outlineColor: outline });
    seg.scale.set(1.15, 0.9, 1);
    seg.position.set(x, y, z);
    g.add(seg);
  }
  // The fin: two pink lobes splaying out flat at the tip.
  for (const s of [-1, 1]) {
    const lobe = toonMesh(sphere(0.1, 14, 10), SHELL, { outline: 0.06, outlineColor: outline });
    lobe.scale.set(1.2, 0.3, 0.75);
    lobe.rotation.y = s * 1.1;
    lobe.position.set(s * 0.1, 0.04, 0.16);
    g.add(lobe);
  }
  g.userData.swing = [];
  return g;
}

/** A sheer, shimmering fin fanning out behind her, in soft rainbow colors. */
function mermaidFin(outline: string): PartObject {
  const g = new THREE.Group();
  const colors = ['#ffb3d1', '#ffe08a', '#a8f0c8', '#9fd8ff', '#d4b3ff'];
  colors.forEach((c, i) => {
    const a = -0.7 + (i / (colors.length - 1)) * 1.4;
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, -0.08);
    pivot.rotation.set(-0.35, 0, a);
    const ray = toonMesh(sphere(0.07, 12, 8), c, { outline: 0.08, outlineColor: outline, material: toonMaterial(c, { map: null, transparent: true, opacity: 0.85 }) });
    ray.scale.set(0.9, 3.2, 0.35);
    ray.position.y = 0.2;
    pivot.add(ray);
    g.add(pivot);
  });
  return g;
}

/**
 * A pink scallop shell standing up, its hinge at the origin (facing +z): a solid fan with a scalloped
 * top edge and darker ribs running out from the hinge.
 */
export function scallopShell(size: number, outline: string): THREE.Group {
  const g = new THREE.Group();
  g.add(toonMesh(scallopGeometry(size), SHELL, { outline: 0.05, outlineColor: outline }));
  return g;
}

/**
 * A scallop shell's solid: a fan from its hinge (the origin) out to a scalloped edge, flat behind,
 * its front domed and ridged (ribs running out from the hinge, bulging most in the middle).
 */
function scallopGeometry(size: number): THREE.BufferGeometry {
  const RINGS = 7;
  const SPOKES = 42;
  const RIBS = 7;
  const bulge = size * 0.5;
  const pos: number[] = [];
  const idx: number[] = [];
  const at = (i: number, j: number, front: boolean) => {
    const r = i / RINGS;
    const a = Math.PI - (j / SPOKES) * Math.PI;
    const edge = 1 - 0.07 * Math.abs(Math.sin(a * RIBS));
    const x = Math.cos(a) * r * size * edge;
    const y = Math.sin(a) * r * size * edge * 0.95 + size * 0.05;
    const ridge = 0.5 + 0.5 * Math.cos(a * RIBS * 2);
    // (Gentle ribs: steeper ones turned half of each away from the light, in near-black stripes.)
    const z = front ? bulge * (1 - r * r) * 0.85 + bulge * 0.12 * ridge * r : 0;
    return [x, y, z];
  };
  // Front then back, each a grid of rings by spokes.
  for (const front of [true, false]) for (let i = 0; i <= RINGS; i++) for (let j = 0; j <= SPOKES; j++) pos.push(...at(i, j, front));
  const v = (i: number, j: number, front: boolean) => (front ? 0 : (RINGS + 1) * (SPOKES + 1)) + i * (SPOKES + 1) + j;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SPOKES; j++) {
      // (The spokes run clockwise seen from the front, so the front's triangles go this way round.)
      idx.push(v(i, j, true), v(i + 1, j + 1, true), v(i + 1, j, true), v(i, j, true), v(i, j + 1, true), v(i + 1, j + 1, true));
      idx.push(v(i, j, false), v(i + 1, j, false), v(i + 1, j + 1, false), v(i, j, false), v(i + 1, j + 1, false), v(i, j + 1, false));
    }
  }
  // Round its scalloped rim, and along its two straight sides down to the hinge: front to back.
  for (let j = 0; j < SPOKES; j++) idx.push(v(RINGS, j, true), v(RINGS, j + 1, false), v(RINGS, j, false), v(RINGS, j, true), v(RINGS, j + 1, true), v(RINGS, j + 1, false));
  for (let i = 0; i < RINGS; i++) {
    idx.push(v(i, 0, true), v(i + 1, 0, false), v(i, 0, false), v(i, 0, true), v(i + 1, 0, true), v(i + 1, 0, false));
    idx.push(v(i, SPOKES, true), v(i, SPOKES, false), v(i + 1, SPOKES, false), v(i, SPOKES, true), v(i + 1, SPOKES, false), v(i + 1, SPOKES, true));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A crown of pink scallop shells round a pearl, on top of her head. */
function shellCrown(outline: string): PartObject {
  const g = new THREE.Group();
  // Tipped back on top of her hair, so they face the camera looking down on her (standing up
  // straight, all it saw were their pink rims).
  for (const [x, size, turn] of [[-0.2, 0.15, 0.4], [0, 0.2, 0], [0.2, 0.15, -0.4]] as const) {
    const s = scallopShell(size, outline);
    s.position.set(x, 0.39 + (x === 0 ? 0.03 : 0), 0.06 - Math.abs(x) * 0.2);
    s.rotation.set(-0.55, -turn * 0.8, turn * 0.5);
    g.add(s);
  }
  const pearl = toonMesh(sphere(0.05, 12, 10), '#fffaf0', { outline: 0.12, outlineColor: outline, material: makePlastic(toonMaterial('#fffaf0', { map: null })) });
  pearl.position.set(0, 0.47, 0.15);
  g.add(pearl);
  return g;
}

type SeaAnimal = 'otter' | 'mermaid';

export const SEA_PARTS: Record<Exclude<PartSlot, 'body'>, Record<SeaAnimal, Builder>> = {
  head: { otter: otterHead, mermaid: mermaidHead },
  legs: { otter: otterLegs, mermaid: mermaidLegs },
  tail: { otter: otterTail, mermaid: mermaidFin },
  accessory: { otter: divingMask, mermaid: shellCrown },
};
