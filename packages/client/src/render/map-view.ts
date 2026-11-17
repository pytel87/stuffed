// Static map visuals: felt lawn (no fence: it carries on past the edges), ground patches (sand, dirt, a picnic blanket,
// stepping stones), pools, and decorative grass. Built once per match.
import * as THREE from 'three';
import type { Circle, Decor, Ground, MapData } from '@stuffed/sim';
import { checkerTexture, dirtTexture, lawnTexture, plankTexture, rugTexture, sandTexture, stoneTexture, tiled } from './props.ts';
import { mergeStatic } from './merge-static.ts';
import { toonMaterial, toonMesh } from './toon.ts';

/** How far the lawn (and its patches and grass) carries on past the map's edges. */
const LAWN_BEYOND = 64;
/** Patches and grass stop a little earlier; it's all underwater past there anyway. */
const DECOR_BEYOND = 24;

export function buildMapView(map: MapData): THREE.Group {
  const g = new THREE.Group();
  const { width: w, height: h } = map;

  // No fence around the yard: the lawn just goes on (the Rinse is the edge of play).
  const lw = w + 2 * LAWN_BEYOND;
  const lh = h + 2 * LAWN_BEYOND;
  // The Bedroom: wooden floorboards instead of the lawn.
  const indoors = map.theme === 'bedroom';
  const lawnMat = indoors
    ? toonMaterial('#f3d9b6', { map: tiled(plankTexture(), lw / 2.4, lh / 9) })
    : toonMaterial('#ffffff', { map: tiled(lawnTexture(), lw / 8, lh / 8) });
  // Split into tiles: two huge triangles reaching far past the screen get their depth wrong on
  // some GPUs (seen with wide phone screens), and the lawn then covers everything on it.
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh, Math.ceil(lw / 8), Math.ceil(lh / 8)), lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(w / 2, 0, h / 2);
  lawn.receiveShadow = true;
  g.add(lawn);

  for (const ground of map.grounds ?? []) g.add(groundPatch(ground, map));
  for (const pool of map.pools ?? []) g.add(poolView(pool));
  if (!indoors) g.add(grassTufts(map));
  for (const d of map.decor ?? []) g.add(decorItem(d, mapRandom(map, Math.round(d.x * 13 + d.y * 7))));
  return g;
}

/** Grass tufts stay off sand, dirt, the blanket and water. */
function onBareLawn(map: MapData, x: number, z: number, margin = 0.5): boolean {
  for (const ground of map.grounds ?? []) {
    if (ground.kind === 'stones' || !ground.box) continue;
    const b = ground.box;
    if (x > b.x - margin && x < b.x + b.w + margin && z > b.y - margin && z < b.y + b.h + margin) return false;
  }
  for (const pool of map.pools ?? []) {
    if (Math.hypot(x - pool.center.x, z - pool.center.y) < pool.radius + 1 + margin) return false;
  }
  return true;
}

function groundPatch(ground: Ground, map: MapData): THREE.Object3D {
  const box = ground.box ?? { x: 0, y: 0, w: 0, h: 0 };
  const cx = box.x + box.w / 2;
  const cz = box.y + box.h / 2;
  if (ground.kind === 'stones') {
    // Round stepping stones along the box's long side.
    const g = new THREE.Group();
    const rand = mapRandom(map, Math.round(cx * 7 + cz));
    const long = box.w > box.h;
    const length = Math.max(box.w, box.h);
    const n = Math.max(1, Math.round(length / 1.8));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const r = 0.55 + rand() * 0.25;
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.08, 14), toonMaterial('#ffffff', { map: stoneTexture() }));
      stone.position.set(cx + (long ? t * length : (rand() - 0.5) * 0.6), 0.04, cz + (long ? (rand() - 0.5) * 0.6 : t * length));
      stone.receiveShadow = true;
      g.add(stone);
    }
    return g;
  }
  if (ground.kind === 'rug') {
    // A round braided rug, an oval filling the box.
    const rug = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48).rotateX(-Math.PI / 2), toonMaterial('#ffffff', { map: rugTexture() }));
    rug.scale.set(box.w, 1, box.h);
    rug.position.set(cx, 0.015, cz);
    rug.receiveShadow = true;
    return rug;
  }
  const geometry = new THREE.PlaneGeometry(box.w, box.h, Math.ceil(box.w / 8), Math.ceil(box.h / 8)).rotateX(-Math.PI / 2);
  const material =
    ground.kind === 'blanket'
      ? toonMaterial('#ffffff', { map: tiled(checkerTexture('#e25b5b', '#fff6ec'), box.w / 3, box.h / 3) })
      : ground.kind === 'floor'
        ? toonMaterial('#f0dcc0', { map: tiled(plankTexture(), box.w / 1.6, box.h / 6) })
        : toonMaterial('#ffffff', { map: tiled(ground.kind === 'sand' ? sandTexture() : dirtTexture(), box.w / 8, box.h / 8) });
  const patch = new THREE.Mesh(geometry, material);
  patch.position.set(cx, 0.012, cz);
  patch.receiveShadow = true;
  return patch;
}

/** A kiddie pool: shallow water inside an inflatable striped ring, and a rubber duck. */
function poolView(pool: Circle): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(pool.center.x, 0, pool.center.y);
  const water = new THREE.Mesh(new THREE.CircleGeometry(pool.radius, 48).rotateX(-Math.PI / 2), toonMaterial('#7fd3f5', { map: null }));
  water.position.y = 0.03;
  water.receiveShadow = true;
  g.add(water);
  const shine = new THREE.Mesh(new THREE.RingGeometry(pool.radius * 0.55, pool.radius * 0.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c8f0ff', transparent: true, opacity: 0.6 }));
  shine.position.y = 0.035;
  g.add(shine);
  // The inflatable rim: alternating blue and white segments.
  const segments = 16;
  for (let i = 0; i < segments; i++) {
    const arc = (Math.PI * 2) / segments;
    const seg = toonMesh(new THREE.TorusGeometry(pool.radius + 0.35, 0.4, 10, 6, arc), i % 2 ? '#fff8ef' : '#3fa9f5', { outline: 0.06 });
    seg.rotation.x = Math.PI / 2;
    seg.rotation.z = i * arc;
    seg.position.y = 0.3;
    g.add(seg);
  }
  // A rubber duck bobbing near the edge.
  const duck = new THREE.Group();
  duck.position.set(pool.radius * 0.45, 0.25, -pool.radius * 0.35);
  const body = toonMesh(new THREE.SphereGeometry(0.45, 16, 12), '#ffd23a', { outline: 0.06 });
  body.scale.set(1.2, 0.8, 1);
  duck.add(body);
  const head = toonMesh(new THREE.SphereGeometry(0.28, 14, 10), '#ffd23a', { outline: 0.07 });
  head.position.set(0.35, 0.4, 0);
  duck.add(head);
  const beak = toonMesh(new THREE.ConeGeometry(0.1, 0.22, 8), '#f08a2c', { outline: false });
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.66, 0.38, 0);
  duck.add(beak);
  g.add(duck);
  return g;
}

/** Render-only randomness; seeded by map id so the layout is the same every match. */
function mapRandom(map: MapData, salt: number): () => number {
  let seed = salt;
  for (const ch of map.id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Grass is cut into square patches so the ones off screen aren't drawn at all. */
const GRASS_PATCH = 24;

/**
 * Decorative grass tufts (three blades each), one instanced mesh per patch of lawn. Phones get
 * fewer of them.
 */
function grassTufts(map: MapData): THREE.Group {
  const rand = mapRandom(map, 1);
  const handheld = matchMedia('(pointer: coarse)').matches;
  const span = { w: map.width + 2 * DECOR_BEYOND, h: map.height + 2 * DECOR_BEYOND };
  const count = Math.round(span.w * span.h * (handheld ? 0.14 : 0.25));
  const blade = new THREE.ConeGeometry(0.07, 0.45, 4).translate(0, 0.22, 0);
  const material = toonMaterial('#5fa552', { map: null });
  // Sort the tufts into patches first.
  const cols = Math.ceil(span.w / GRASS_PATCH);
  const rows = Math.ceil(span.h / GRASS_PATCH);
  const patches: { x: number; z: number; scale: number }[][] = Array.from({ length: cols * rows }, () => []);
  for (let n = 0; n < count; n++) {
    const x = rand() * span.w - DECOR_BEYOND;
    const z = rand() * span.h - DECOR_BEYOND;
    const scale = 0.7 + rand() * 0.6;
    if (!onBareLawn(map, x, z)) continue;
    const c = Math.min(cols - 1, Math.floor((x + DECOR_BEYOND) / GRASS_PATCH));
    const r = Math.min(rows - 1, Math.floor((z + DECOR_BEYOND) / GRASS_PATCH));
    patches[r * cols + c]!.push({ x, z, scale });
  }
  const g = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (const tufts of patches) {
    if (tufts.length === 0) continue;
    const mesh = new THREE.InstancedMesh(blade, material, tufts.length * 3);
    let i = 0;
    for (const t of tufts) {
      for (const dx of [-0.07, 0, 0.07]) {
        euler.set(0, 0, dx * 4);
        q.setFromEuler(euler);
        s.setScalar(t.scale);
        p.set(t.x + dx, 0, t.z);
        mesh.setMatrixAt(i++, m.compose(p, q, s));
      }
    }
    mesh.receiveShadow = true;
    // Bounds of this patch's blades, so the camera can skip it when it's off screen.
    mesh.computeBoundingSphere();
    g.add(mesh);
  }
  return g;
}

const CRAYONS = ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a', '#9b7bd8', '#ff9cbf', '#f28a2c'];

let drawingTex: THREE.CanvasTexture | null = null;
/** A child's drawing: a sun, a house and grass. */
function drawingTexture(): THREE.CanvasTexture {
  if (drawingTex) return drawingTex;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 96, 128);
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.fillStyle = '#f7c331';
  g.beginPath();
  g.arc(72, 24, 12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e2574c';
  g.strokeRect(22, 62, 40, 34);
  g.beginPath();
  g.moveTo(18, 64);
  g.lineTo(42, 40);
  g.lineTo(66, 64);
  g.stroke();
  g.strokeStyle = '#5bd16a';
  g.beginPath();
  for (let x = 6; x < 92; x += 8) {
    g.moveTo(x, 114);
    g.lineTo(x + 3, 104);
  }
  g.stroke();
  drawingTex = new THREE.CanvasTexture(c);
  drawingTex.colorSpace = THREE.SRGBColorSpace;
  return drawingTex;
}

/** Floor clutter: drawn only, nothing to bump into. */
function decorItem(d: Decor, rand: () => number): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.turn ?? 0;
  const flat = (color: string) => toonMaterial(color, { map: null });
  switch (d.kind) {
    case 'track': {
      // A dark felt strip under the track, red sleepers across it and two steel rails, all with
      // dark edges so the track reads clearly on the wooden floor.
      const rx = d.rx ?? 8;
      const ry = d.ry ?? 5;
      const oval = (off: number, y: number) =>
        new THREE.CatmullRomCurve3(
          Array.from({ length: 120 }, (_, i) => {
            const a = (i / 120) * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a) * (rx + off), y, Math.sin(a) * (ry + off));
          }),
          true,
        );
      // The felt strip: a flat ring between two ovals.
      const inner = oval(-1.05, 0).getSpacedPoints(240);
      const outer = oval(1.05, 0).getSpacedPoints(240);
      const pos: number[] = [];
      for (let i = 0; i < 240; i++) {
        const [a0, a1, b0, b1] = [inner[i]!, inner[i + 1]!, outer[i]!, outer[i + 1]!];
        pos.push(a0.x, 0.02, a0.z, b0.x, 0.02, b0.z, a1.x, 0.02, a1.z, a1.x, 0.02, a1.z, b0.x, 0.02, b0.z, b1.x, 0.02, b1.z);
      }
      const stripGeo = new THREE.BufferGeometry();
      stripGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      stripGeo.computeVertexNormals();
      const strip = new THREE.Mesh(stripGeo, toonMaterial('#3d4a6b', { side: THREE.DoubleSide }));
      strip.receiveShadow = true;
      g.add(strip);
      const n = Math.round((Math.PI * (rx + ry)) / 0.85);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const sleeper = toonMesh(new THREE.BoxGeometry(1.5, 0.1, 0.32), '#e2574c', { outline: 0.06 });
        sleeper.material = toonMaterial('#e2574c', { map: null });
        sleeper.position.set(Math.cos(a) * rx, 0.07, Math.sin(a) * ry);
        // Across the track: along the outward direction of the oval.
        sleeper.rotation.y = -Math.atan2(Math.sin(a) * rx, Math.cos(a) * ry);
        sleeper.receiveShadow = true;
        g.add(sleeper);
      }
      // Rails: a thin tube along each oval (scaling a ring would stretch its thickness too), with
      // a dark hull for an outline.
      for (const off of [-0.45, 0.45]) {
        const curve = oval(off, 0.16);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.085, 8, true), flat('#cfd6e2')));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.12, 8, true), new THREE.MeshBasicMaterial({ color: '#2a1f2d', side: THREE.BackSide })));
      }
      break;
    }
    case 'crayon': {
      const color = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
      const body = toonMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10), color, { outline: 0.12 });
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.11;
      g.add(body);
      const tip = toonMesh(new THREE.ConeGeometry(0.11, 0.22, 10), color, { outline: false });
      tip.rotation.z = -Math.PI / 2;
      tip.position.set(0.56, 0.11, 0);
      g.add(tip);
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.4, 10), flat('#fffaf3'));
      wrap.rotation.z = Math.PI / 2;
      wrap.position.set(-0.1, 0.11, 0);
      g.add(wrap);
      break;
    }
    case 'paper': {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2).rotateX(-Math.PI / 2), toonMaterial('#ffffff', { map: drawingTexture() }));
      sheet.position.y = 0.02;
      sheet.receiveShadow = true;
      g.add(sheet);
      break;
    }
    case 'sock': {
      const color = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
      const leg = toonMesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), color, { outline: 0.08 });
      leg.rotation.z = Math.PI / 2;
      leg.scale.y = 1;
      leg.scale.z = 0.5;
      leg.position.y = 0.12;
      g.add(leg);
      const foot = toonMesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 10), color, { outline: 0.08 });
      foot.scale.z = 0.5;
      foot.position.set(0.55, 0.12, 0.25);
      g.add(foot);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.12, 12), flat('#fffaf3'));
      stripe.rotation.z = Math.PI / 2;
      stripe.scale.z = 0.52;
      stripe.position.set(-0.35, 0.12, 0);
      g.add(stripe);
      break;
    }
    case 'puzzle': {
      for (let i = 0; i < 3; i++) {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.55), flat(CRAYONS[(i * 2 + Math.floor(rand() * 7)) % CRAYONS.length]!));
        // Each a little higher than the last, so overlapping pieces don't flicker.
        piece.position.set((rand() - 0.5) * 1.4, 0.03 + i * 0.015, (rand() - 0.5) * 1.4);
        piece.rotation.y = rand() * Math.PI;
        piece.receiveShadow = true;
        g.add(piece);
      }
      break;
    }
    case 'marbles': {
      const glass = ['#ff5a5a', '#3fa9f5', '#5bd16a', '#f7c331'];
      for (let i = 0; i < 4; i++) {
        const m = toonMesh(new THREE.SphereGeometry(0.16, 12, 10), glass[i % glass.length]!, { outline: 0.1 });
        m.position.set((rand() - 0.5) * 1.6, 0.16, (rand() - 0.5) * 1.6);
        g.add(m);
      }
      break;
    }
    case 'car': {
      const color = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
      const body = toonMesh(new THREE.BoxGeometry(1.1, 0.3, 0.6), color, { outline: 0.06 });
      body.position.y = 0.3;
      g.add(body);
      const cab = toonMesh(new THREE.BoxGeometry(0.55, 0.25, 0.5), '#d4f4ff', { outline: 0.08 });
      cab.position.set(-0.05, 0.55, 0);
      g.add(cab);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12), flat('#2a1f2d'));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx * 0.35, 0.15, sz * 0.32);
        g.add(wheel);
      }
      break;
    }
  }
  mergeStatic(g);
  return g;
}
