// Static map visuals: felt lawn, boundary hedge, ground patches (sand, dirt, a picnic blanket,
// stepping stones), pools, and decorative grass. Built once per match.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Circle, Ground, MapData } from '@stuffed/sim';
import { checkerTexture, plankTexture, tiled } from './props.ts';
import { feltTexture, toonMaterial, toonMesh } from './toon.ts';

const LAWN = '#7cc46a';
const OUTSIDE = '#5d9e55';
const HEDGE = '#3f8f4a';

export function buildMapView(map: MapData): THREE.Group {
  const g = new THREE.Group();
  const { width: w, height: h } = map;

  const lawnTex = feltTexture().clone();
  lawnTex.repeat.set(w / 4, h / 4);
  lawnTex.needsUpdate = true;
  // Split into tiles: two huge triangles reaching far past the screen get their depth wrong on
  // some GPUs (seen with wide phone screens), and the lawn then covers everything on it.
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w, h, Math.ceil(w / 8), Math.ceil(h / 8)), toonMaterial(LAWN, { map: lawnTex }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(w / 2, 0, h / 2);
  lawn.receiveShadow = true;
  g.add(lawn);

  const outsideTex = feltTexture().clone();
  outsideTex.repeat.set((w * 3) / 4, (h * 3) / 4);
  outsideTex.needsUpdate = true;
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(w * 3, h * 3, 12, 12), toonMaterial(OUTSIDE, { map: outsideTex }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.set(w / 2, -0.02, h / 2);
  outside.receiveShadow = true;
  g.add(outside);

  // Boundary hedge, just outside the playable area.
  const t = 0.8;
  const height = 0.9;
  const sides: [number, number, number, number][] = [
    [w / 2, -t / 2, w + 2 * t, t],
    [w / 2, h + t / 2, w + 2 * t, t],
    [-t / 2, h / 2, t, h],
    [w + t / 2, h / 2, t, h],
  ];
  for (const [cx, cz, sx, sz] of sides) {
    const hedge = toonMesh(new THREE.BoxGeometry(sx, height, sz), HEDGE, { outline: 0.02, outlineColor: '#1f3f26' });
    hedge.position.set(cx, height / 2, cz);
    g.add(hedge);
  }

  for (const ground of map.grounds ?? []) g.add(groundPatch(ground, map));
  for (const pool of map.pools ?? []) g.add(poolView(pool));
  g.add(feltPatches(map));
  g.add(grassTufts(map));
  return g;
}

/** Lawn decorations (felt patches, grass) stay off sand, dirt, the blanket and water. */
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

const GROUND_COLORS = { sand: '#edd58f', dirt: '#86603f' } as const;

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
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.08, 14), toonMaterial('#c9c3b8'));
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
        : toonMaterial(GROUND_COLORS[ground.kind], { map: tiled(feltTexture(), box.w / 4, box.h / 4) });
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

/**
 * Sewn-on felt patches in other greens, so movement reads against the ground. Merged into one
 * mesh per color plus one for all the stitch rings: a handful of draw calls instead of ~200.
 */
function feltPatches(map: MapData): THREE.Group {
  const rand = mapRandom(map, 7);
  const g = new THREE.Group();
  const colors = ['#86cc72', '#71b860', '#8fd27a', '#6fb35f'];
  const byColor = colors.map(() => [] as THREE.BufferGeometry[]);
  const rings: THREE.BufferGeometry[] = [];
  const count = Math.round((map.width * map.height) / 60);
  for (let i = 0; i < count; i++) {
    const r = 1.2 + rand() * 2.8;
    const x = rand() * map.width;
    const z = rand() * map.height;
    const c = Math.floor(rand() * colors.length);
    if (!onBareLawn(map, x, z, r)) continue;
    // A tiny height step per patch keeps overlapping patches from flickering.
    byColor[c]!.push(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2).translate(x, 0.004 + i * 1e-5, z));
    rings.push(new THREE.RingGeometry(r - 0.12, r - 0.08, 40, 1).rotateX(-Math.PI / 2).translate(x, 0.006 + i * 1e-5, z));
  }
  byColor.forEach((geos, c) => {
    if (!geos.length) return;
    const patch = new THREE.Mesh(mergeGeometries(geos), toonMaterial(colors[c]!));
    patch.receiveShadow = true;
    g.add(patch);
  });
  g.add(new THREE.Mesh(mergeGeometries(rings), new THREE.MeshBasicMaterial({ color: '#5a9a4c', transparent: true, opacity: 0.7 })));
  return g;
}

function grassTufts(map: MapData): THREE.InstancedMesh {
  const rand = mapRandom(map, 1);
  const count = Math.round(map.width * map.height * 0.25);
  const blade = new THREE.ConeGeometry(0.07, 0.45, 4).translate(0, 0.22, 0);
  const mesh = new THREE.InstancedMesh(blade, toonMaterial('#5fa552', { map: null }), count * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let i = 0;
  for (let n = 0; n < count; n++) {
    const x = rand() * map.width;
    const z = rand() * map.height;
    const scale = 0.7 + rand() * 0.6;
    if (!onBareLawn(map, x, z)) continue;
    for (const dx of [-0.07, 0, 0.07]) {
      euler.set(0, 0, dx * 4);
      q.setFromEuler(euler);
      s.setScalar(scale);
      p.set(x + dx, 0, z);
      mesh.setMatrixAt(i++, m.compose(p, q, s));
    }
  }
  mesh.count = i;
  mesh.receiveShadow = true;
  return mesh;
}
