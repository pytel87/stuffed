// The wanderers, drawn: a robot vacuum (a round grey disc with a bumper and a blinking light), a red
// toy lawnmower, a red snowplow with a blade and a beacon, and a toy shark; plus each
// vehicle's switch, a push button like the air strike's.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { GameState, MapData, WandererDef } from '@stuffed/sim';
import { sparkleGlowTexture } from './loot-views.ts';
import { nextMark, outlineProp, snowTexture } from './props.ts';
import { buildStrikeButton, hazardTexture, showButtonReady } from './strike-views.ts';
import { makePlastic, toonMaterial, toonMesh } from './toon.ts';

const plastic = (c: string) => makePlastic(toonMaterial(c, { map: null }));

function vacuum(): { root: THREE.Group; light: THREE.Mesh } {
  const root = new THREE.Group();
  const body = toonMesh(new THREE.CylinderGeometry(0.75, 0.75, 0.28, 32), '#d7dbe2', { outline: 0.04, material: plastic('#d7dbe2') });
  body.position.y = 0.16;
  root.add(body);
  const top = toonMesh(new THREE.CylinderGeometry(0.55, 0.62, 0.06, 32), '#3b3f48', { outline: false, material: plastic('#3b3f48') });
  top.position.y = 0.32;
  root.add(top);
  const bumper = toonMesh(new THREE.CylinderGeometry(0.78, 0.78, 0.14, 32, 1, true, -Math.PI / 2.4, Math.PI / 1.2), '#2a2630', { outline: false, material: toonMaterial('#2a2630', { map: null, side: THREE.DoubleSide }) });
  bumper.position.y = 0.14;
  bumper.rotation.y = Math.PI / 2;
  root.add(bumper);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#39ff7a', toneMapped: false }));
  light.position.set(0.35, 0.36, 0);
  root.add(light);
  // One even outline round the whole thing (see outlineProp).
  outlineProp(root, nextMark(), 0.025);
  return { root, light };
}

/** A rounded box (a box with soft edges), for toy vehicles. */
function soft(width: number, height: number, d: number, r: number, color: string, material?: THREE.Material): THREE.Mesh {
  // The bevel grows the outline by `b` all round: draw it that much smaller, so the box comes out
  // exactly width x height x d.
  const b = r * 0.6;
  const w = width - 2 * b;
  const h = height - 2 * b;
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(d - 2 * b) / 2);
  return toonMesh(geo, color, { outline: 0.03, material: material ?? plastic(color) });
}

/** A chunky toy wheel: a black tyre with a coloured hub. */
function wheel(r: number, wide: number, hub: string): THREE.Group {
  const g = new THREE.Group();
  const tyre = toonMesh(new THREE.TorusGeometry(r * 0.7, r * 0.32, 10, 20), '#2a2630', { outline: 0.06 });
  tyre.scale.z = wide / (r * 0.64);
  g.add(tyre);
  const cap = toonMesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, wide * 1.02, 16), hub, { outline: false, material: plastic(hub) });
  cap.rotation.x = Math.PI / 2;
  g.add(cap);
  return g;
}

/**
 * A toy push mower (it drives along +x): a round red deck over its blade, a white engine with a
 * pull-cord handle on top, a push handle and chunky wheels.
 */
function mower(): THREE.Group {
  const g = new THREE.Group();
  const deck = toonMesh(new THREE.CylinderGeometry(0.85, 0.9, 0.35, 28), '#e2433f', { outline: 0.04, material: plastic('#e2433f') });
  deck.position.y = 0.42;
  g.add(deck);
  const skirt = toonMesh(new THREE.CylinderGeometry(0.92, 0.92, 0.1, 28), '#3b3f48', { outline: false });
  skirt.position.y = 0.26;
  g.add(skirt);
  const engine = toonMesh(new THREE.CylinderGeometry(0.38, 0.42, 0.42, 20), '#f4f4f0', { outline: 0.05, material: plastic('#f4f4f0') });
  engine.position.set(0.05, 0.8, 0);
  g.add(engine);
  const cap = toonMesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#3b3f48', { outline: 0.06, material: plastic('#3b3f48') });
  cap.position.set(0.05, 1.0, 0);
  g.add(cap);
  const pull = toonMesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), '#f7c331', { outline: 0.1, material: plastic('#f7c331') });
  pull.position.set(0.05, 1.32, 0);
  g.add(pull);
  // The push handle: two bars rising from the deck's back, joined by a grip.
  const metal = plastic('#c9cfd8');
  for (const z of [-0.45, 0.45]) {
    const bar = toonMesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), '#c9cfd8', { outline: 0.12, material: metal });
    bar.rotation.z = 0.95;
    bar.position.set(-1.0, 1.05, z);
    g.add(bar);
  }
  const grip = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), '#2a2630', { outline: 0.1 });
  grip.rotation.x = Math.PI / 2;
  grip.position.set(-1.6, 1.48, 0);
  g.add(grip);
  for (const [x, z] of [[0.55, 0.85], [0.55, -0.85], [-0.55, 0.85], [-0.55, -0.85]] as const) {
    const w = wheel(0.28, 0.22, '#f7c331');
    w.position.set(x, 0.28, z);
    g.add(w);
  }
  // One even outline round the whole thing (see outlineProp).
  outlineProp(g, nextMark(), 0.025);
  return g;
}

/**
 * A toy snowplow (it drives along +x): a rounded red body and cab with a windscreen, a big
 * hazard-striped blade out front with snow heaped against it, chunky wheels, an exhaust pipe and a
 * beacon on the roof.
 */
function plow(): { root: THREE.Group; light: THREE.Mesh } {
  const root = new THREE.Group();
  const red = plastic('#d63a2f');
  const body = soft(1.6, 0.6, 1.3, 0.15, '#d63a2f', red);
  body.position.set(-0.1, 0.62, 0);
  root.add(body);
  const cab = soft(0.85, 0.75, 1.15, 0.15, '#d63a2f', red);
  cab.position.set(-0.35, 1.3, 0);
  root.add(cab);
  // A windscreen on the cab's front (it drives along +x).
  const windscreen = toonMesh(new THREE.BoxGeometry(0.04, 0.34, 0.8), '#7fc8f0', { outline: 0.06, material: plastic('#7fc8f0') });
  windscreen.position.set(0.085, 1.4, 0);
  root.add(windscreen);
  // The blade: hazard stripes on its face, a grey frame.
  const stripes = hazardTexture().clone();
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  stripes.repeat.set(2.5, 0.6);
  stripes.needsUpdate = true;
  const blade = toonMesh(new THREE.BoxGeometry(0.14, 0.7, 2.2), '#ffffff', { outline: 0.04, material: toonMaterial('#ffffff', { map: stripes }) });
  blade.position.set(1.0, 0.38, 0);
  blade.rotation.z = -0.2;
  root.add(blade);
  const arm = toonMesh(new THREE.BoxGeometry(0.4, 0.12, 0.6), '#3b3f48', { outline: 0.06 });
  arm.position.set(0.78, 0.45, 0);
  root.add(arm);
  // Snow heaped against the blade.
  const heap = toonMesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { outline: 0.04, material: toonMaterial('#ffffff', { map: snowTexture() }) });
  heap.scale.set(0.6, 0.6, 1.7);
  heap.position.set(1.32, 0, 0);
  root.add(heap);
  for (const [x, z] of [[0.35, 0.68], [0.35, -0.68], [-0.6, 0.68], [-0.6, -0.68]] as const) {
    const w = wheel(0.32, 0.26, '#f7c331');
    w.position.set(x, 0.32, z);
    root.add(w);
  }
  const pipe = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), '#3b3f48', { outline: 0.1 });
  pipe.position.set(-0.85, 1.25, 0.45);
  root.add(pipe);
  // The beacon on the roof, on a little base: dull while parked; while it drives, lit and glowing.
  const base = toonMesh(new THREE.CylinderGeometry(0.14, 0.16, 0.1, 14), '#3b3f48', { outline: 0.08 });
  base.position.set(-0.35, 1.82, 0);
  root.add(base);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8a5a2a', toneMapped: false }));
  light.scale.y = 1.3;
  light.position.set(-0.35, 1.87, 0);
  root.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleGlowTexture(), color: '#ffa53a', transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.4);
  glow.position.copy(light.position).add(new THREE.Vector3(0, 0.1, 0));
  // Drawn over the cab (it's light, not a thing), so the roof never cuts it off.
  (glow.material as THREE.SpriteMaterial).depthTest = false;
  glow.renderOrder = 5;
  glow.visible = false;
  glow.name = 'beacon';
  root.add(glow);
  // One even outline round the whole thing (see outlineProp).
  outlineProp(root, nextMark(), 0.025);
  return { root, light };
}

/** The mower's or plow's switch: the same hazard-striped push button as the air strike's. */
function pushButton(): ReturnType<typeof buildStrikeButton> {
  return buildStrikeButton();
}

interface View {
  def: WandererDef;
  root: THREE.Group;
  light?: THREE.Mesh;
  lever?: ReturnType<typeof pushButton>;
  /** A shark: its body (lunges up out of the water to bite), its open mouth, its dark shape under
   *  the water, how far into a lunge it is, and when it last bit (its rest starting is the sign). */
  shark?: { body: THREE.Group; mouth: THREE.Object3D; jaw: THREE.Object3D; shadow: THREE.Object3D; foam: THREE.Group; splash: ReturnType<typeof biteSplash>; lunge: number; ready: number };
}

/**
 * The water thrown up as a shark bursts out to bite (`set(lunge)`: 1 as it starts, 0 when done): a
 * ring of foam round where it breaks the surface, spreading, and drops flying up and falling back.
 */
function biteSplash(): { root: THREE.Group; set: (lunge: number) => void } {
  const root = new THREE.Group();
  root.position.set(0.5, 0.03, 0);
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  const ring: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2 + (i % 3) * 0.06, 10, 6), white);
    b.userData.a = a;
    root.add(b);
    ring.push(b);
  }
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 3) * 0.03, 8, 6), white);
    d.userData.a = (i / 10) * Math.PI * 2 + 0.3;
    d.userData.v = 2.4 + (i % 4) * 0.5;
    root.add(d);
    drops.push(d);
  }
  root.visible = false;
  const set = (lunge: number) => {
    root.visible = lunge > 0;
    if (!root.visible) return;
    const t = 1 - lunge;
    white.opacity = Math.min(1, lunge * 2.5);
    for (const b of ring) {
      const r = 0.8 + t * 0.9;
      b.position.set(Math.cos(b.userData.a) * r * 1.3, 0, Math.sin(b.userData.a) * r * 0.8);
      b.scale.set(1, 0.4, 1);
    }
    for (const d of drops) {
      const r = 0.5 + t * 1.6;
      d.position.set(Math.cos(d.userData.a) * r, Math.max(0, d.userData.v * t - 4 * t * t), Math.sin(d.userData.a) * r * 0.8);
    }
  };
  return { root, set };
}

/**
 * The water round a shark's fin as it cuts along (facing +x): a collar of foam bubbles bobbing round
 * the fin's foot, and two thin curved lines of foam trailing off behind it, spreading and fading.
 */
function finFoam(): THREE.Group {
  const g = new THREE.Group();
  g.position.y = 0.03;
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
  // The collar: little flat blobs round the fin's foot, more at its front (the bow wave).
  const blobs: [number, number, number][] = [[0.5, 0, 0.16], [0.38, 0.14, 0.13], [0.38, -0.14, 0.13], [0.2, 0.2, 0.11], [0.2, -0.2, 0.11], [-0.05, 0.19, 0.1], [-0.05, -0.19, 0.1], [-0.35, 0.14, 0.08], [-0.35, -0.14, 0.08]];
  blobs.forEach(([x, z, r], i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), white);
    b.scale.y = 0.35;
    b.position.set(x, 0, z);
    b.onBeforeRender = () => {
      const t = performance.now() / 1000;
      b.scale.set(1 + Math.sin(t * 7 + i * 1.7) * 0.15, 0.35, 1 + Math.sin(t * 6 + i) * 0.15);
    };
    g.add(b);
  });
  // The trailing lines: thin ribbons curving out and back, white fading to nothing.
  for (const side of [-1, 1]) {
    const n = 14;
    const pos = new Float32Array((n + 1) * 2 * 3);
    const col: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k <= n; k++) {
      const a = (1 - k / n) * 0.9;
      col.push(1, 1, 1, a, 1, 1, 1, a);
      if (k > 0) idx.push((k - 1) * 2, (k - 1) * 2 + 1, k * 2, (k - 1) * 2 + 1, k * 2 + 1, k * 2);
    }
    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute('position', attr);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.setIndex(idx);
    const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    line.frustumCulled = false;
    line.onBeforeRender = () => {
      const time = performance.now() / 1000;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = 0.3 - t * 2.6;
        // Out from the fin's sides, curving away behind, rippling a little.
        const z = side * (0.22 + 0.75 * Math.sqrt(t) + Math.sin(time * 5 - t * 9) * 0.04 * t);
        const w = 0.06 * (1 - t * 0.6);
        attr.setXYZ(k * 2, x, 0, z - w);
        attr.setXYZ(k * 2 + 1, x, 0, z + w);
      }
      attr.needsUpdate = true;
    };
    g.add(line);
  }
  return g;
}

/** The shark's body: its half-length, half-height and half-width. */
const SHARK = { l: 1.5, h: 0.48, w: 0.55 };

/** Across the shark's body at `x` along it (see sharkBody): how far out its side is, and how low
 *  its underside. */
function snoutAt(x: number): { half: number; bottom: number } {
  // The sphere's point whose stretched x is `x` (the stretch only grows along it).
  let lo = -1;
  let hi = 1;
  const stretched = (u: number) => u * SHARK.l * (1 + 0.18 * Math.max(0, (u - 0.15) / 0.85));
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (stretched(mid) < x) lo = mid;
    else hi = mid;
  }
  const u = (lo + hi) / 2;
  const t = Math.max(0, (u - 0.15) / 0.85);
  const k = 1 - 0.7 * t ** 1.4;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return { half: SHARK.w * r * k, bottom: -SHARK.h * r * k };
}

/** A shark's body along +x, `l` long, `h` tall, `w` wide: round, tapering to a pointed snout. */
function sharkBody(l: number, h: number, w: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 28, 16);
  const pos = geo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // Toward the front, narrower and drawn out to a point.
    const t = Math.max(0, (x - 0.15) / 0.85);
    const k = 1 - 0.7 * t ** 1.4;
    pos.setXYZ(i, x * l * (1 + 0.18 * t), pos.getY(i) * h * k, pos.getZ(i) * w * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A toy shark, facing +x, swimming under the water with just its fin out (the sea hides what's
 * below 0; it comes up to bite): a soft
 * blue-grey body with a white belly, a tall fin and a tail fin, little eyes and a toothy grin.
 */
function shark(): { root: THREE.Group; body: THREE.Group; mouth: THREE.Object3D; jaw: THREE.Object3D; shadow: THREE.Object3D; foam: THREE.Group; splash: ReturnType<typeof biteSplash> } {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = toonMaterial('#6f93ad', { map: null });
  const torso = toonMesh(sharkBody(SHARK.l, SHARK.h, SHARK.w), '#6f93ad', { outline: 0.03, material: skin });
  body.add(torso);
  // (Shorter than the body, ending behind the mouth: it showed inside the open jaws.)
  const belly = toonMesh(sharkBody(1.05, 0.36, 0.46), '#eef3f6', { outline: false });
  belly.position.set(-0.2, -0.12, 0);
  body.add(belly);
  body.updateMatrixWorld(true);
  const fin = (points: [number, number][], depth: number) => {
    const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  };
  // The dorsal fin: tall and swept back, the bit you see cutting through the water.
  const dorsal = toonMesh(fin([[0.4, 0], [-0.5, 0], [-0.42, 1.0]], 0.11), '#6f93ad', { outline: 0.05, material: skin });
  dorsal.position.set(0, 0.38, 0);
  body.add(dorsal);
  const tail = toonMesh(fin([[0, 0], [-0.55, 0.55], [-0.4, 0], [-0.55, -0.45]], 0.08), '#6f93ad', { outline: 0.05, material: skin });
  // (Kept under the surface while it cruises: its tip poked out as a stray dot.)
  tail.position.set(-1.35, -0.12, 0);
  body.add(tail);
  for (const s of [-1, 1]) {
    const flipper = toonMesh(fin([[0.25, 0], [-0.25, 0], [-0.3, -0.5]], 0.06), '#6f93ad', { outline: 0.06, material: skin });
    flipper.rotation.x = s * 1.1;
    flipper.position.set(0.25, -0.15, s * 0.42);
    body.add(flipper);
    // A small eye painted flat on its side, a mean lid over it.
    const ray = new THREE.Raycaster(new THREE.Vector3(1.0, 0.1, s * 2), new THREE.Vector3(0, 0, -s));
    const hit = ray.intersectObject(torso, false)[0];
    if (hit) {
      const face = new THREE.Group();
      face.position.copy(hit.point);
      const n = hit.face!.normal.clone().transformDirection(torso.matrixWorld);
      face.lookAt(hit.point.clone().add(n));
      const flat = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
        m.position.set(x, y, z);
        face.add(m);
        return m;
      };
      // A small, mean eye: a dark almond with a white glint, a heavy lid slanting down over its
      // front (a shark's eye, not a cartoon's round one).
      const fwd = s;
      const eye = flat(new THREE.CircleGeometry(0.075, 16), '#1f1b24', 0, 0, 0.004);
      eye.scale.set(1.35, 0.8, 1);
      eye.rotation.z = fwd * -0.25;
      flat(new THREE.CircleGeometry(0.02, 8), '#ffffff', fwd * 0.03, 0.02, 0.006);
      const lid = flat(new THREE.PlaneGeometry(0.22, 0.045), '#3b5466', fwd * 0.01, 0.06, 0.007);
      lid.rotation.z = fwd * -0.45;
      body.add(face);
    }
  }
  // The jaws, open only for a bite, shaped to the snout (its outline from above): the roof of the
  // mouth dark red under it with the upper teeth along its edge, pointing down; a lower jaw of the
  // same pointed outline hinged under it, dropping open, red inside, its teeth pointing up.
  const mouth = new THREE.Group();
  const toothMat = toonMaterial('#ffffff', { map: null });
  const red = toonMaterial('#7a2430', { map: null, side: THREE.DoubleSide });
  const HINGE = 0.45;
  const TIP = SHARK.l * 1.18 - 0.08;
  const STEPS = 10;
  const xs = Array.from({ length: STEPS + 1 }, (_, i) => HINGE + ((TIP - HINGE) * i) / STEPS);
  // The roof of the mouth: the snout's underside, dark red, just outside its skin (across its
  // middle, out to EDGE of its width), the upper teeth hanging down from its rim on both sides.
  const EDGE = 0.72;
  const under = (x: number, f: number) => {
    const { half, bottom } = snoutAt(x);
    return { y: bottom * Math.sqrt(Math.max(0, 1 - f * f)) - 0.012, z: half * f };
  };
  const ACROSS = 8;
  const roofPos: number[] = [];
  const roofIdx: number[] = [];
  xs.forEach((x, i) => {
    for (let j = 0; j <= ACROSS; j++) {
      const p = under(x, -EDGE + (2 * EDGE * j) / ACROSS);
      roofPos.push(x, p.y, p.z);
      if (i > 0 && j > 0) {
        const a0 = (i - 1) * (ACROSS + 1) + j - 1;
        const b0 = i * (ACROSS + 1) + j - 1;
        roofIdx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
      }
    }
  });
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
  roofGeo.setIndex(roofIdx);
  roofGeo.computeVertexNormals();
  mouth.add(new THREE.Mesh(roofGeo, red));
  const teeth = (along: (x: number) => number, y: (x: number) => number, down: boolean, parent: THREE.Object3D, ox = 0, oy = 0) => {
    for (let i = 1; i < STEPS; i++) {
      const x = xs[i]!;
      for (const side of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 4), toothMat);
        if (down) t.rotation.z = Math.PI;
        t.position.set(x - ox, y(x) - oy, side * along(x));
        parent.add(t);
      }
    }
  };
  // Upper teeth along the roof's rim, pointing down.
  teeth((x) => under(x, EDGE * 0.92).z, (x) => under(x, EDGE * 0.92).y - 0.055, true, mouth);
  // The lower jaw: hinged at the back of the mouth, lying along the snout's underside when shut.
  const jaw = new THREE.Group();
  const hingeY = snoutAt(HINGE).bottom * 0.8;
  jaw.position.set(HINGE, hingeY, 0);
  const tipY = snoutAt(TIP).bottom * 0.6;
  jaw.userData.shut = Math.atan2(tipY - hingeY, TIP - HINGE);
  const outline: THREE.Vector2[] = [];
  xs.forEach((x) => outline.push(new THREE.Vector2(x - HINGE, snoutAt(x).half * 0.9)));
  for (let i = STEPS; i >= 0; i--) outline.push(new THREE.Vector2(xs[i]! - HINGE, -snoutAt(xs[i]!).half * 0.9));
  const chin = new THREE.Mesh(
    new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: 0.05, bevelEnabled: false }).rotateX(Math.PI / 2),
    // (The shark's own grey outside, red only inside: a pale edge read as a white rim.)
    skin,
  );
  jaw.add(chin);
  const inner = outline.map((v) => new THREE.Vector2(v.x * 0.94 + 0.03, v.y * 0.8));
  const tongue = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(inner)).rotateX(Math.PI / 2), red);
  tongue.position.y = 0.005;
  jaw.add(tongue);
  teeth((x) => snoutAt(x).half * 0.78, () => 0.06, false, jaw, HINGE, 0);
  mouth.add(jaw);
  mouth.visible = false;
  body.add(mouth);
  // Its shape under the surface, seen through the water: a dark shark from above (body, forked
  // tail, side fins), swaying as it swims.
  const s = new THREE.Shape();
  s.moveTo(1.55, 0);
  s.quadraticCurveTo(1.35, 0.42, 0.5, 0.52);
  s.lineTo(0.35, 0.95);
  s.lineTo(0.0, 0.5);
  s.quadraticCurveTo(-0.9, 0.38, -1.25, 0.12);
  s.lineTo(-1.95, 0.55);
  s.lineTo(-1.7, 0);
  s.lineTo(-1.95, -0.55);
  s.lineTo(-1.25, -0.12);
  s.quadraticCurveTo(-0.9, -0.38, 0.0, -0.5);
  s.lineTo(0.35, -0.95);
  s.lineTo(0.5, -0.52);
  s.quadraticCurveTo(1.35, -0.42, 1.55, 0);
  const shadow = new THREE.Mesh(
    new THREE.ShapeGeometry(s, 8).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#16465a', transparent: true, opacity: 0.42, depthWrite: false }),
  );
  shadow.position.y = 0.02;
  shadow.renderOrder = -1;
  root.add(shadow);
  const foam = finFoam();
  root.add(foam);
  const splash = biteSplash();
  root.add(splash.root);
  return { root, body, mouth, jaw, shadow, foam, splash };
}

export class WandererViews {
  private mapId = '';
  private root: THREE.Group | null = null;
  private views: View[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.root?.removeFromParent();
    this.root = null;
    this.views = [];
    this.mapId = '';
  }

  /** `prev`/`curr`/`alpha`: drawn between the last two states, like the plushies. */
  update(map: MapData, prev: GameState, curr: GameState, alpha: number, tick: number, time: number): void {
    if (this.mapId !== map.id) this.build(map);
    this.views.forEach((v, i) => {
      const a = prev.wanderers[i] ?? curr.wanderers[i];
      const b = curr.wanderers[i];
      if (!a || !b) return;
      v.root.position.set(a.pos.x + (b.pos.x - a.pos.x) * alpha, 0, a.pos.y + (b.pos.y - a.pos.y) * alpha);
      let turn = b.dir - a.dir;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      v.root.rotation.y = -(a.dir + turn * alpha);
      if (v.shark) {
        // A bite (it starts resting): up out of the water, jaws open, then back down.
        if (v.shark.ready >= 0 && b.readyTick !== v.shark.ready && b.readyTick > tick) v.shark.lunge = 1;
        v.shark.ready = b.readyTick;
        v.shark.lunge = Math.max(0, v.shark.lunge - 1 / 40);
        const up = Math.sin(v.shark.lunge * Math.PI);
        // (Nose well up: from above, its open jaws face the camera.)
        v.shark.body.position.y = -0.5 + up * 1.3 + Math.sin(time * 2.2 + i) * 0.04;
        v.shark.body.rotation.z = up * 0.95;
        v.shark.body.rotation.x = Math.sin(time * 3 + i) * 0.06;
        v.shark.mouth.visible = up > 0.15;
        // The jaw drops open as it comes up, snapping shut as it goes back down.
        v.shark.jaw.rotation.z = (v.shark.jaw.userData.shut as number) - Math.min(1, up * 1.6) * 0.75;
        // It sways as it swims, its fin and its shape under the water together (the shape hides
        // while it's up out of the water, mid-bite).
        const sway = Math.sin(time * 4 + i) * 0.12;
        v.shark.shadow.rotation.y = sway;
        v.shark.body.rotation.y = sway;
        v.shark.shadow.visible = up < 0.3;
        v.shark.foam.rotation.y = sway;
        v.shark.foam.visible = up < 0.3;
        v.shark.splash.set(v.shark.lunge);
      }
      if (v.def.kind === 'vacuum' && v.light) v.light.visible = Math.sin(time * 4) > -0.3;
      if (v.def.kind === 'plow' && v.light) {
        const on = b.mode === 'moving';
        const flash = 0.5 + 0.5 * Math.sin(time * 12);
        (v.light.material as THREE.MeshBasicMaterial).color.set(on ? '#ffb347' : '#8a5a2a');
        const glow = v.root.getObjectByName('beacon') as THREE.Sprite | undefined;
        if (glow) {
          glow.visible = on;
          (glow.material as THREE.SpriteMaterial).opacity = 0.5 + flash * 0.5;
          glow.scale.setScalar(1.1 + flash * 0.7);
        }
      }
      if ((v.def.kind === 'mower' || v.def.kind === 'plow') && b.mode === 'moving') v.root.position.y = Math.abs(Math.sin(time * 18)) * 0.04;
      if (v.lever) {
        const ready = b.mode === 'idle' && tick >= b.readyTick;
        // Like the air strike button: popped up and red when it works; pushed
        // in and grey while the mower or plow is out, its lights coming on as it recharges.
        const span = config.wanderers.vehicle.cooldown * config.tickRate;
        const progress = ready ? 1 : b.mode === 'moving' ? 0 : Math.max(0, 1 - (b.readyTick - tick) / span);
        v.lever.dots.forEach((d, k) => (d.visible = progress >= (k + 1) / v.lever!.dots.length));
        v.lever.glow.visible = false;
        showButtonReady(v.lever, ready);
      }
    });
  }

  private build(map: MapData): void {
    this.clear();
    this.mapId = map.id;
    const root = new THREE.Group();
    for (const d of map.wanderers ?? []) {
      const v: View = { def: d, root: new THREE.Group() };
      if (d.kind === 'shark') {
        const m = shark();
        v.root.add(m.root);
        v.shark = { body: m.body, mouth: m.mouth, jaw: m.jaw, shadow: m.shadow, foam: m.foam, splash: m.splash, lunge: 0, ready: -1 };
      } else if (d.kind === 'vacuum') {
        const m = vacuum();
        v.root.add(m.root);
        v.light = m.light;
      } else if (d.kind === 'mower') {
        v.root.add(mower());
      } else {
        const p = plow();
        v.root.add(p.root);
        v.light = p.light;
      }
      root.add(v.root);
      if (d.switch) {
        const l = pushButton();
        l.root.position.set(d.switch.x, 0, d.switch.y);
        root.add(l.root);
        v.lever = l;
      }
      this.views.push(v);
    }
    this.scene.add(root);
    this.root = root;
  }
}

/** For the switch prompt picture (without its ring and lights). */
export function buildLever(): THREE.Group {
  const b = pushButton();
  b.glow.removeFromParent();
  for (const d of b.dots) d.removeFromParent();
  return b.root;
}
