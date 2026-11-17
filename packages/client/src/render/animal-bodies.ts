// Each animal's body: its own silhouette (see body-shapes.ts) plus a detail or two. They all fit
// any head, legs and arms.
import * as THREE from 'three';
import type { Animal } from '@stuffed/sim';
import { ANIMAL_COLORS } from './animal-colors.ts';
import { shapedBody } from './body-shapes.ts';
import { darken, toonMaterial, toonMesh } from './toon.ts';

const flat = (c: string) => toonMaterial(c, { map: null });

function bearBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.bear;
  const b = shapedBody({ shape: 'round', main: c.main, belly: c.belly, outline });
  // A little stitched heart over the chest.
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.05);
  heart.bezierCurveTo(-0.08, 0.0, -0.06, 0.07, 0, 0.04);
  heart.bezierCurveTo(0.06, 0.07, 0.08, 0.0, 0, -0.05);
  const h = new THREE.Mesh(new THREE.ShapeGeometry(heart), flat('#e2574c'));
  h.position.copy(b.surface(-0.17, 0.22, 0.012));
  h.lookAt(h.position.clone().add(new THREE.Vector3(-0.3, 0.3, 1)));
  b.group.add(h);
  return b.group;
}

function frogBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.frog;
  const b = shapedBody({ shape: 'pear', main: c.main, belly: c.belly, outline, bellyW: 0.26, bellyH: 0.22, bellyY: -0.08 });
  // Darker spots on the back.
  for (const [x, y, r] of [[-0.18, 0.12, 0.07], [0.15, 0.0, 0.08], [-0.05, -0.2, 0.06], [0.24, 0.2, 0.05]] as const) {
    const spot = toonMesh(new THREE.SphereGeometry(r, 10, 8), darken(c.main, 0.25).getStyle(), { outline: false });
    spot.scale.z = 0.3;
    spot.position.copy(b.surface(x, y, -0.005, true));
    b.group.add(spot);
  }
  return b.group;
}

function sharkBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.shark;
  const b = shapedBody({ shape: 'tapered', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.27, bellyY: -0.04 });
  // A dorsal fin on the back and gill slits on the sides.
  const fin = toonMesh(new THREE.ConeGeometry(0.12, 0.3, 12), c.main, { outlineColor: outline });
  fin.scale.set(0.35, 1, 1);
  fin.position.copy(b.surface(0, 0.15, 0.05, true));
  fin.rotation.x = 0.5;
  b.group.add(fin);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.02), flat(darken(c.main, 0.35).getStyle()));
      const y = 0.08 - i * 0.05;
      const r = b.radiusAt(y);
      slit.position.set(s * (r + 0.004), y, 0.08 - i * 0.015);
      b.group.add(slit);
    }
  }
  return b.group;
}

function chickenBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.chicken;
  const b = shapedBody({ shape: 'egg', main: c.main, belly: c.belly, outline, stitch: '#e0d4c2' });
  // A tuft of chest feathers and a short tail of feathers low on the back.
  for (const [x, y] of [[-0.07, 0.24], [0.07, 0.24], [0, 0.29]] as const) {
    const f = toonMesh(new THREE.SphereGeometry(0.06, 10, 8), '#fff9f0', { outline: 0.1, outlineColor: outline });
    f.scale.set(0.8, 1.3, 0.6);
    f.position.copy(b.surface(x, y, 0.01));
    b.group.add(f);
  }
  return b.group;
}

function dinoBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.dino;
  const b = shapedBody({ shape: 'chunky', main: c.main, belly: c.belly, outline, bellyW: 0.25, bellyH: 0.25, bellyY: -0.06 });
  // Big back plates down the spine.
  for (const [y, size] of [[0.3, 0.13], [0.12, 0.15], [-0.07, 0.13], [-0.23, 0.1]] as const) {
    const plate = toonMesh(new THREE.ConeGeometry(size, size * 1.6, 4), '#f0a93b', { outline: 0.1, outlineColor: outline });
    plate.scale.set(0.35, 1, 1);
    const p = b.surface(0, y, -0.02, true);
    plate.position.copy(p);
    plate.rotation.x = -1.2 + (0.3 - y);
    b.group.add(plate);
  }
  return b.group;
}

function owlBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.owl;
  const b = shapedBody({ shape: 'barrel', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.27, bellyY: -0.04 });
  // Feather marks on the belly and wing shapes folded on the sides.
  for (const [x, y] of [[-0.08, 0.06], [0.08, 0.06], [0, -0.06], [-0.08, -0.18], [0.08, -0.18]] as const) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 4, 8, Math.PI), flat(darken(c.belly, 0.2).getStyle()));
    v.rotation.z = Math.PI;
    v.position.copy(b.surface(x, y, 0.035));
    b.group.add(v);
  }
  for (const s of [-1, 1]) {
    const wing = toonMesh(new THREE.SphereGeometry(0.2, 14, 10), darken(c.main, 0.1).getStyle(), { outlineColor: outline });
    wing.scale.set(0.35, 1.05, 0.7);
    wing.position.set(s * (b.radiusAt(-0.05) - 0.03), -0.05, -0.06);
    wing.rotation.z = s * 0.15;
    b.group.add(wing);
  }
  return b.group;
}

function axolotlBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.axolotl;
  const b = shapedBody({ shape: 'plump', main: c.main, belly: c.belly, outline, bellyW: 0.26, bellyH: 0.24, bellyY: -0.06 });
  // A soft frill down the back and darker spots.
  for (let i = 0; i < 5; i++) {
    const y = 0.28 - i * 0.12;
    const bump = toonMesh(new THREE.SphereGeometry(0.06, 10, 8), '#ff8fb8', { outline: 0.1, outlineColor: outline });
    bump.scale.set(0.4, 1, 1);
    bump.position.copy(b.surface(0, y, -0.01, true));
    b.group.add(bump);
  }
  for (const [x, y] of [[-0.28, 0.14], [0.3, 0.02], [-0.25, -0.16], [0.22, -0.22]] as const) {
    const spot = toonMesh(new THREE.SphereGeometry(0.045, 10, 8), darken(c.main, 0.15).getStyle(), { outline: false });
    spot.scale.z = 0.3;
    spot.position.copy(b.surface(x, y, -0.005));
    b.group.add(spot);
  }
  return b.group;
}

function penguinBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.penguin;
  // A tall white tuxedo front and a red bow tie.
  const b = shapedBody({ shape: 'pin', main: c.main, belly: c.belly, outline, bellyW: 0.27, bellyH: 0.33, bellyY: -0.02, stitch: '#c9d2e0' });
  const bow = toonMesh(new THREE.SphereGeometry(0.06, 10, 8), '#e2574c', { outline: 0.12, outlineColor: outline });
  bow.scale.set(1.9, 1, 0.8);
  bow.position.copy(b.surface(0, 0.31, 0.02));
  b.group.add(bow);
  return b.group;
}

export const BODIES: Record<Animal, (outline: string) => THREE.Object3D> = {
  bear: bearBody,
  frog: frogBody,
  shark: sharkBody,
  chicken: chickenBody,
  dino: dinoBody,
  owl: owlBody,
  axolotl: axolotlBody,
  penguin: penguinBody,
};
