// Static map visuals: felt lawn, boundary hedge and decorative grass. Built once per match.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapData } from '@stuffed/sim';
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

  g.add(feltPatches(map));
  g.add(grassTufts(map));
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
    for (const dx of [-0.07, 0, 0.07]) {
      euler.set(0, 0, dx * 4);
      q.setFromEuler(euler);
      s.setScalar(scale);
      p.set(x + dx, 0, z);
      mesh.setMatrixAt(i++, m.compose(p, q, s));
    }
  }
  mesh.receiveShadow = true;
  return mesh;
}
