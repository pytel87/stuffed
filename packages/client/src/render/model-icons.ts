// Pictures of the real 3D models for the HUD: every weapon, item, skin part and the toy chest is
// drawn once at startup onto a small offscreen canvas with the game's toon lighting and
// outlines. The resulting images replace the drawn SVG icons wherever one exists.
import * as THREE from 'three';
import { ANIMALS, config, PART_SLOTS } from '@stuffed/sim';
import type { ItemKind, PartSlot, WeaponKind } from '@stuffed/sim';
import { buildChest, buildItem } from './loot-views.ts';
import { buildPart } from './placeholder-parts.ts';
import { OUTLINE_COLOR } from './toon.ts';
import { buildWeapon } from './weapon-models.ts';

const SIZE = 160;

/** Renders the pictures; returns name → image URL (data URL). Empty if WebGL isn't available. */
export function renderModelIcons(): Map<string, string> {
  const urls = new Map<string, string>();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return urls;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#9a8aa8', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5);
  sun.position.set(-2, 5, 4);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);

  const shoot = (name: string, model: THREE.Object3D, turn: THREE.Euler) => {
    const holder = new THREE.Group();
    holder.add(model);
    holder.rotation.copy(turn);
    scene.add(holder);
    // Frame it: center the bounds and fit the larger side, with a little padding.
    const box = new THREE.Box3().setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const half = (Math.max(size.x, size.y) / 2) * 1.12;
    camera.left = -half;
    camera.right = half;
    camera.top = half;
    camera.bottom = -half;
    camera.position.set(center.x, center.y, center.z + 10);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    urls.set(name, canvas.toDataURL('image/png'));
    scene.remove(holder);
  };

  // Weapons from their side, barrel to the right, tipped a little toward the viewer.
  for (const kind of Object.keys(config.weapons) as WeaponKind[]) {
    shoot(kind, buildWeapon(kind, 0, OUTLINE_COLOR, false), new THREE.Euler(0.35, Math.PI / 2, 0, 'YXZ'));
  }
  // Items from a little above.
  for (const kind of Object.keys(config.items) as ItemKind[]) {
    shoot(kind, buildItem(kind), new THREE.Euler(0.5, -0.5, 0, 'YXZ'));
  }
  shoot('chest', buildChest({ id: 0, pos: { x: 0, y: 0 }, opened: false, loot: 'medium' }).root, new THREE.Euler(0.45, -0.5, 0, 'YXZ'));
  // Every skin part, turned to show its best side (tails from behind).
  const partTurn: Record<PartSlot, THREE.Euler> = {
    head: new THREE.Euler(0.15, 0.45, 0, 'YXZ'),
    body: new THREE.Euler(0.15, 0.45, 0, 'YXZ'),
    legs: new THREE.Euler(0.2, 0.5, 0, 'YXZ'),
    tail: new THREE.Euler(0.2, Math.PI - 0.7, 0, 'YXZ'),
    accessory: new THREE.Euler(0.3, 0.6, 0, 'YXZ'),
  };
  for (const slot of PART_SLOTS) for (const animal of ANIMALS) shoot(`part:${slot}:${animal}`, buildPart(slot, animal), partTurn[slot]);

  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}
