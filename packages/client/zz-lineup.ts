import * as THREE from 'three';
import { ANIMALS, PART_SLOTS } from '@stuffed/sim';
import type { Animal, PartLoadout } from '@stuffed/sim';
import { PlushView } from './src/render/plush-view.ts';
const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(2);
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfe6f5');
scene.add(new THREE.HemisphereLight('#ffffff', '#9a8aa8', 1.25));
const sun = new THREE.DirectionalLight('#ffffff', 1.5);
sun.position.set(-3, 9, 7);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 8, bottom: -8 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshToonMaterial({ color: '#8fd07a' }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(26, innerWidth / innerHeight, 0.1, 100);
const mix = new URLSearchParams(location.search).has('mix');
camera.position.set(0, 2.6, 23.5);
camera.lookAt(0, 0.95, 0);
const rows: PartLoadout[] = mix
  ? // Mixed looks: every body under other animals' heads, legs, tails and hats.
    ANIMALS.map((a, i) => Object.fromEntries(PART_SLOTS.map((s, k) => [s, { animal: s === 'body' ? a : ANIMALS[(i + k * 3) % ANIMALS.length]!, rarity: 0, found: false }])) as PartLoadout)
  : ANIMALS.map((animal) => Object.fromEntries(PART_SLOTS.map((s) => [s, { animal: animal as Animal, rarity: 0, found: false }])) as PartLoadout);
rows.forEach((parts, i) => {
  const p = new PlushView(parts);
  const x = (i - (rows.length - 1) / 2) * 1.5;
  p.root.position.set(x, 0, 0);
  const turn = (i - (rows.length - 1) / 2) * -0.06 + 0.35;
  p.update({ x, y: 0 }, { x: 0, y: 0 }, { x: Math.sin(turn), y: Math.cos(turn) }, 0, 0, 0.016, 0);
  p.root.traverse((o) => { if (o instanceof THREE.Mesh && (o.material as THREE.Material).blending === THREE.AdditiveBlending) o.visible = false; });
  p.root.traverse((o) => { if (o instanceof THREE.Mesh && 'emissive' in o.material) (o.material as THREE.MeshToonMaterial).emissive.setScalar(0); });
  scene.add(p.root);
});
renderer.render(scene, camera);
