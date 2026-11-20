// Pictures of the real 3D models for the HUD: every weapon, item, skin part and the toy chest is
// drawn once onto a small offscreen canvas with the game's toon lighting and outlines. The
// resulting images replace the drawn SVG icons wherever one exists. Weapons, items and chests are
// drawn at startup (the HUD needs them first); the hundred skin parts follow a few at a time in
// idle moments, so the menu shows sooner.
import * as THREE from 'three';
import { ANIMALS, config, PART_SLOTS } from '@stuffed/sim';
import type { ItemKind, PartLoadout, PartSlot, WeaponKind } from '@stuffed/sim';
import { buildChest, buildItem } from './loot-views.ts';
import { buildPart } from './placeholder-parts.ts';
import { PlushView } from './plush-view.ts';
import { OUTLINE_COLOR } from './toon.ts';
import { buildWeapon } from './weapon-models.ts';
import { buildStrikeButton } from './strike-views.ts';
import { buildDrill, buildJack, buildTap } from './toy-views.ts';
import { buildSpade } from './minigame-views.ts';
import { buildLever } from './wanderer-views.ts';

const SIZE = 160;

/** Parts drawn per idle moment. */
const PARTS_PER_SLICE = 6;

/**
 * Renders the pictures and hands them to `deliver` (name → data URL): weapons, items and chests
 * at once, then the skin parts in small batches. Nothing if WebGL isn't available.
 */
export function renderModelIcons(deliver: (pictures: Map<string, string>) => void): void {
  let urls = new Map<string, string>();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, stencil: true });
  } catch {
    return;
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

  /** `minHalf`: frame at least this much (world units), so small models aren't blown up. */
  const shoot = (name: string, model: THREE.Object3D, turn: THREE.Euler, minHalf = 0) => {
    const holder = new THREE.Group();
    holder.add(model);
    holder.rotation.copy(turn);
    scene.add(holder);
    // Frame it: center the bounds and fit the larger side, with a little padding.
    const box = new THREE.Box3().setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const half = Math.max(minHalf, (Math.max(size.x, size.y) / 2) * 1.12);
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
    // Items share a minimum frame, so they keep their sizes relative to each other (the Button
    // Pack's buttons look as big as the Button Pile's).
    shoot(kind, buildItem(kind), new THREE.Euler(0.5, -0.5, 0, 'YXZ'), 0.36);
  }
  // Each kind of chest (by loot level), for the open prompt.
  for (const loot of ['low', 'medium', 'high', 'food'] as const) {
    shoot(`chest:${loot}`, buildChest({ id: 0, pos: { x: 0, y: 0 }, z: 0, opened: false, loot }).root, new THREE.Euler(0.45, -0.5, 0, 'YXZ'));
  }
  // The air strike button of each kind, for its prompt.
  for (const kind of ['balloons', 'blocks', 'snowballs', 'cannonballs'] as const) {
    // Without its glow ring and lights, which would only make the button smaller in the picture.
    const button = buildStrikeButton();
    button.glow.removeFromParent();
    for (const dot of button.dots) dot.removeFromParent();
    shoot(`strike:${kind}`, button.root, new THREE.Euler(0.4, -0.5, 0, 'YXZ'));
  }
  // A spade, for digging up buried treasure.
  shoot('dig', buildSpade(), new THREE.Euler(0.3, -0.5, 0.3, 'YXZ'));
  // The mower's and plow's switches.
  shoot('switch', buildLever(), new THREE.Euler(0.4, -0.5, 0, 'YXZ'));
  // The map toys, for their prompts: the jack-in-the-box, the garden tap, the ice drill.
  shoot('toy:jack', buildJack().root, new THREE.Euler(0.4, -0.5, 0, 'YXZ'));
  shoot('toy:sprinkler', buildTap().root, new THREE.Euler(0.3, -0.4, 0, 'YXZ'));
  shoot('toy:icedrill', buildDrill(), new THREE.Euler(0.3, -0.4, 0, 'YXZ'));
  // Every skin part, turned to show its best side (tails from behind).
  const partTurn: Record<PartSlot, THREE.Euler> = {
    head: new THREE.Euler(0.15, 0.45, 0, 'YXZ'),
    body: new THREE.Euler(0.15, 0.45, 0, 'YXZ'),
    legs: new THREE.Euler(0.2, 0.5, 0, 'YXZ'),
    tail: new THREE.Euler(0.2, Math.PI - 0.7, 0, 'YXZ'),
    accessory: new THREE.Euler(0.3, 0.6, 0, 'YXZ'),
  };
  deliver(urls);

  const jobs: [PartSlot, (typeof ANIMALS)[number]][] = [];
  for (const slot of PART_SLOTS) for (const animal of ANIMALS) jobs.push([slot, animal]);
  const idle = (fn: () => void) =>
    'requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 16);
  const slice = () => {
    urls = new Map();
    for (const [slot, animal] of jobs.splice(0, PARTS_PER_SLICE)) shoot(`part:${slot}:${animal}`, buildPart(slot, animal), partTurn[slot]);
    deliver(urls);
    if (jobs.length > 0) idle(slice);
    else {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
  idle(slice);
}

let plushPictures: Map<string, string> | null = null;

/**
 * Pictures of every animal wearing its full set (for the Wardrobe's gallery). Drawn the first
 * time they're asked for, then kept.
 */
export function renderPlushPictures(): Map<string, string> {
  if (plushPictures) return plushPictures;
  const urls = new Map<string, string>();
  const size = 220;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, stencil: true });
  } catch {
    return urls;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#9a8aa8', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4);
  sun.position.set(-2, 5, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.3, 4.6);
  camera.lookAt(0, 0.98, 0);
  for (const animal of ANIMALS) {
    const parts = Object.fromEntries(PART_SLOTS.map((s) => [s, { animal, rarity: 0, found: false }])) as PartLoadout;
    const plush = new PlushView(parts);
    // Turned a little so tails and backs show; no set glow in the picture.
    plush.update({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0.45, y: 0.9 }, 0, 0, 0.016, 0);
    plush.root.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.material as THREE.Material).blending === THREE.AdditiveBlending) o.visible = false;
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) o.material.emissive.setScalar(0);
    });
    scene.add(plush.root);
    renderer.render(scene, camera);
    urls.set(animal, canvas.toDataURL('image/png'));
    scene.remove(plush.root);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  plushPictures = urls;
  return urls;
}
