// Each animal's body: its own silhouette (see body-shapes.ts) plus a detail or two. They all fit
// any head, legs and arms.
import * as THREE from 'three';
import type { Animal } from '@stuffed/sim';
import { ANIMAL_COLORS } from './animal-colors.ts';
import { DEPTH, shapedBody } from './body-shapes.ts';
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
  // Big back plates down the spine, standing out of the back.
  for (const [y, size] of [[0.26, 0.17], [0.08, 0.2], [-0.1, 0.18], [-0.26, 0.14]] as const) {
    const plate = toonMesh(new THREE.ConeGeometry(size, size * 1.8, 4), '#f0a93b', { outline: 0.1, outlineColor: outline });
    plate.scale.set(0.35, 1, 1);
    plate.position.copy(b.surface(0, y, 0.05, true));
    // Pointing back and a little up (out of the curve of the back).
    plate.rotation.x = -1.15 - y * 0.6;
    b.group.add(plate);
  }
  return b.group;
}

function owlBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.owl;
  const b = shapedBody({ shape: 'barrel', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.27, bellyY: -0.04 });
  // Feather marks on the belly and wing shapes folded on the sides.
  for (const [x, y] of [[-0.1, 0.1], [0.1, 0.1], [0, 0.0], [-0.1, -0.1], [0.1, -0.1], [0, -0.2]] as const) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 4, 10, Math.PI), flat(darken(c.belly, 0.38).getStyle()));
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

function bunnyBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.bunny;
  const b = shapedBody({ shape: 'plump', main: c.main, belly: c.belly, outline, bellyW: 0.25, bellyH: 0.26, bellyY: -0.06 });
  // A stitched-on carrot patch.
  const patch = toonMesh(new THREE.ConeGeometry(0.04, 0.13, 8), '#f28a2c', { outline: false });
  patch.position.copy(b.surface(0.2, 0.2, 0.015));
  patch.rotation.z = 2.4;
  b.group.add(patch);
  return b.group;
}

function unicornBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.unicorn;
  const b = shapedBody({ shape: 'barrel', main: c.main, belly: c.belly, outline, stitch: '#f2b8d6' });
  // A rainbow arc across the chest.
  ['#ff6b8a', '#ffe36b', '#6bc6ff'].forEach((col, i) => {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.14 - i * 0.03, 0.014, 6, 20, Math.PI), flat(col));
    arc.position.copy(b.surface(0, 0.12, 0.02));
    b.group.add(arc);
  });
  return b.group;
}

function catBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.cat;
  const b = shapedBody({ shape: 'pear', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.24, bellyY: -0.08 });
  // Tabby stripes: bands hugging the curve of the back.
  for (const y of [0.22, 0.04, -0.14]) {
    // Mostly sunk into the body, and tall: a painted-on stripe, not a belt.
    const r = b.radiusAt(y) - 0.008;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.02, 6, 24, 1.6).rotateX(Math.PI / 2).rotateY(Math.PI / 2 + 0.8),
      flat(darken(c.main, 0.22).getStyle()),
    );
    band.scale.set(1, 2.2, DEPTH);
    band.position.y = y;
    b.group.add(band);
  }
  return b.group;
}

function foxBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.fox;
  // A big white chest bib.
  const b = shapedBody({ shape: 'tapered', main: c.main, belly: c.belly, outline, bellyW: 0.25, bellyH: 0.32, bellyY: 0.0, stitch: '#c45a26' });
  return b.group;
}

function pandaBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.panda;
  const b = shapedBody({ shape: 'round', main: c.main, belly: c.belly, outline, bellyW: 0.22, bellyH: 0.2, bellyY: -0.1, stitch: '#c9c6bf' });
  // The black band over the shoulders.
  const y = 0.2;
  const band = toonMesh(new THREE.TorusGeometry(b.radiusAt(y) - 0.02, 0.085, 10, 32), '#2f2d38', { outline: 0.06, outlineColor: outline });
  band.rotation.x = Math.PI / 2;
  band.scale.set(1, 0.9, 1);
  band.position.y = y;
  b.group.add(band);
  return b.group;
}

function pigBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.pig;
  const b = shapedBody({ shape: 'plump', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.24, bellyY: -0.08, stitch: '#e07f96' });
  // A piggy-bank coin slot on the back, and a couple of spots.
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), flat('#7a3a4e'));
  slot.position.copy(b.surface(0, 0.24, -0.01, true));
  slot.rotation.x = 0.5;
  b.group.add(slot);
  for (const [x, y, r] of [[-0.26, 0.12, 0.06], [0.28, -0.12, 0.07]] as const) {
    const spot = toonMesh(new THREE.SphereGeometry(r, 10, 8), darken(c.main, 0.12).getStyle(), { outline: false });
    spot.scale.z = 0.3;
    spot.position.copy(b.surface(x, y, -0.005));
    b.group.add(spot);
  }
  return b.group;
}

function lionBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.lion;
  const b = shapedBody({ shape: 'broad', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.24, bellyY: -0.06 });
  // A fluffy cream chest tuft.
  for (const [x, y] of [[-0.09, 0.27], [0.09, 0.27], [0, 0.24], [0, 0.31]] as const) {
    const tuft = toonMesh(new THREE.SphereGeometry(0.075, 10, 8), c.belly, { outline: 0.1, outlineColor: outline });
    tuft.scale.set(0.9, 1.1, 0.55);
    tuft.position.copy(b.surface(x, y, 0.01));
    b.group.add(tuft);
  }
  return b.group;
}

function elephantBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.elephant;
  const b = shapedBody({ shape: 'bell', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.22, bellyY: -0.1 });
  // A circus blanket on the back with gold trim.
  const blanket = toonMesh(new THREE.SphereGeometry(1, 20, 14), '#e2433f', { outline: false });
  blanket.scale.set(0.28, 0.24, 0.1);
  blanket.position.copy(b.surface(0, 0.0, -0.07, true));
  b.group.add(blanket);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const dot = toonMesh(new THREE.SphereGeometry(0.022, 8, 6), '#f7c331', { outline: false });
    const p = b.surface(Math.cos(a) * 0.3, Math.sin(a) * 0.26, 0.005, true);
    dot.position.copy(p);
    b.group.add(dot);
  }
  return b.group;
}

function turtleBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.turtle;
  const b = shapedBody({ shape: 'round', main: c.main, belly: c.belly, outline, bellyW: 0.25, bellyH: 0.26, bellyY: -0.04, stitch: '#c9b56a' });
  // A domed shell on the back with hexagon plates.
  const shell = toonMesh(new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), '#8a5a3c', { outlineColor: outline });
  // Sticking well out of the back: base inside the body, dome behind it.
  const SHELL_Z = -0.22;
  const SHELL_DEPTH = 0.75;
  shell.rotation.x = -Math.PI / 2;
  shell.scale.set(1.05, SHELL_DEPTH, 1.05);
  shell.position.set(0, -0.02, SHELL_Z);
  b.group.add(shell);
  for (const [x, y] of [[0, 0], [-0.2, 0.15], [0.2, 0.15], [-0.2, -0.17], [0.2, -0.17], [0, 0.3], [0, -0.3]] as const) {
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6), flat('#b07a4a'));
    const k = Math.max(0, 1 - (x * x + y * y) / (0.44 * 0.44));
    plate.position.set(x, y - 0.02, SHELL_Z - SHELL_DEPTH * 0.42 * Math.sqrt(k) - 0.012);
    // Facing out of the dome.
    plate.lookAt(plate.position.clone().add(new THREE.Vector3(x * 1.5, y * 1.5, -1)));
    b.group.add(plate);
  }
  return b.group;
}

function hedgehogBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.hedgehog;
  const b = shapedBody({ shape: 'pear', main: c.main, belly: c.belly, outline, bellyW: 0.26, bellyH: 0.26, bellyY: -0.06 });
  // Spikes all over the back.
  for (let row = 0; row < 5; row++) {
    const y = 0.28 - row * 0.15;
    const r = b.radiusAt(y);
    for (let i = 0; i < 6; i++) {
      // Round the back (-z), from one side to the other.
      const a = Math.PI * (1.12 + (i / 5) * 0.76) + (row % 2) * 0.12;
      const n = new THREE.Vector3(Math.cos(a), 0.15, Math.sin(a) * DEPTH).normalize();
      const spike = toonMesh(new THREE.ConeGeometry(0.06, 0.2, 6), '#6b4630', { outline: 0.12, outlineColor: outline });
      spike.position.set(Math.cos(a) * r, y, Math.sin(a) * r * DEPTH);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      b.group.add(spike);
    }
  }
  return b.group;
}

function koalaBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.koala;
  const b = shapedBody({ shape: 'plump', main: c.main, belly: c.belly, outline, bellyW: 0.27, bellyH: 0.28, bellyY: -0.04, stitch: '#c3c9d1' });
  // A eucalyptus leaf badge.
  const leaf = toonMesh(new THREE.SphereGeometry(0.06, 10, 8), '#6fae7b', { outline: 0.1, outlineColor: outline });
  leaf.scale.set(0.6, 1.5, 0.3);
  leaf.rotation.z = 0.6;
  leaf.position.copy(b.surface(0.22, 0.2, 0.015));
  b.group.add(leaf);
  return b.group;
}

function octopusBody(outline: string): THREE.Object3D {
  const c = ANIMAL_COLORS.octopus;
  const b = shapedBody({ shape: 'egg', main: c.main, belly: c.belly, outline, bellyW: 0.24, bellyH: 0.25, bellyY: -0.05 });
  // Spots, and a little anchor on the chest.
  for (const [x, y, r] of [[-0.28, 0.1, 0.05], [0.3, -0.05, 0.06], [-0.2, -0.22, 0.045], [0.18, 0.26, 0.04]] as const) {
    const spot = toonMesh(new THREE.SphereGeometry(r, 10, 8), darken(c.main, 0.15).getStyle(), { outline: false });
    spot.scale.z = 0.3;
    spot.position.copy(b.surface(x, y, -0.005));
    b.group.add(spot);
  }
  // A big anchor: a ring on top, a cross bar, the shaft and curved arms with points.
  const blue = flat('#3d7ff2');
  const arms = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 18, Math.PI), blue);
  arms.rotation.z = Math.PI;
  arms.position.copy(b.surface(0, -0.04, 0.03));
  b.group.add(arms);
  for (const s of [-1, 1]) {
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.05, 4), blue);
    point.position.copy(b.surface(s * 0.085, -0.03, 0.03));
    b.group.add(point);
  }
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.19, 0.02), blue);
  shaft.position.copy(b.surface(0, -0.02, 0.03));
  b.group.add(shaft);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.02), blue);
  bar.position.copy(b.surface(0, 0.04, 0.03));
  b.group.add(bar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.01, 6, 14), blue);
  ring.position.copy(b.surface(0, 0.095, 0.03));
  b.group.add(ring);
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
  bunny: bunnyBody,
  unicorn: unicornBody,
  cat: catBody,
  fox: foxBody,
  panda: pandaBody,
  pig: pigBody,
  lion: lionBody,
  elephant: elephantBody,
  turtle: turtleBody,
  hedgehog: hedgehogBody,
  koala: koalaBody,
  octopus: octopusBody,
};
