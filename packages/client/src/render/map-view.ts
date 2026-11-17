// Static map visuals: felt lawn (no fence: it carries on past the edges), ground patches (sand, dirt, a picnic blanket,
// stepping stones), pools, and decorative grass. Built once per match.
import * as THREE from 'three';
import type { Circle, Ground, MapData } from '@stuffed/sim';
import { checkerTexture, dirtTexture, lawnTexture, plankTexture, sandTexture, stoneTexture, tiled } from './props.ts';
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
  const lawnTex = tiled(lawnTexture(), lw / 8, lh / 8);
  // Split into tiles: two huge triangles reaching far past the screen get their depth wrong on
  // some GPUs (seen with wide phone screens), and the lawn then covers everything on it.
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh, Math.ceil(lw / 8), Math.ceil(lh / 8)), toonMaterial('#ffffff', { map: lawnTex }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(w / 2, 0, h / 2);
  lawn.receiveShadow = true;
  g.add(lawn);

  for (const ground of map.grounds ?? []) g.add(groundPatch(ground, map));
  for (const pool of map.pools ?? []) g.add(poolView(pool));
  g.add(grassTufts(map));
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
