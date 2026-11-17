// Toy chests and ground loot. Loot floats and spins above a glow in its rarity color so it
// reads from the top-down camera; Limited Edition and up also get a light beam.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { Chest, EntityId, GameState, GroundLoot, ItemKind } from '@stuffed/sim';
import { OUTLINE_COLOR, toonMesh } from './toon.ts';
import { buildWeapon } from './weapon-models.ts';

const POP_SECONDS = 0.25;
const LID_OPEN_ANGLE = -1.9;

let glowTexture: THREE.CanvasTexture | null = null;
function glowMap(): THREE.CanvasTexture {
  if (!glowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowTexture = new THREE.CanvasTexture(c);
  }
  return glowTexture;
}

// ---------- chests ----------

interface ChestView {
  root: THREE.Group;
  lid: THREE.Group;
  lidAngle: number;
}

function buildChest(chest: Chest): ChestView {
  const root = new THREE.Group();
  root.position.set(chest.pos.x, 0, chest.pos.y);
  root.rotation.y = (chest.id * 1.37) % (Math.PI * 2);
  const w = 1.15;
  const d = 0.8;
  const h = 0.6;
  const base = toonMesh(new THREE.BoxGeometry(w, h, d), '#d9534f', { outline: 0.04 });
  base.position.y = h / 2;
  root.add(base);
  const trim = toonMesh(new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02), '#f2c14e', { outline: false });
  trim.position.y = h * 0.25;
  root.add(trim);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = (i % 2 ? 0.45 : 1) * 0.14;
    if (i === 0) star.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, -Math.sin(a) * r);
  }
  const starMesh = toonMesh(new THREE.ShapeGeometry(star), '#f7d046', { outline: false, castShadow: false });
  starMesh.position.set(0, h * 0.55, d / 2 + 0.005);
  root.add(starMesh);

  // The lid hinges on the back edge.
  const lid = new THREE.Group();
  lid.position.set(0, h, -d / 2);
  const lidMesh = toonMesh(new THREE.BoxGeometry(w + 0.08, 0.16, d + 0.06), '#f2c14e', { outline: 0.05 });
  lidMesh.position.set(0, 0.08, d / 2);
  lid.add(lidMesh);
  root.add(lid);
  return { root, lid, lidAngle: chest.opened ? LID_OPEN_ANGLE : 0 };
}

export class ChestViews {
  private readonly views = new Map<EntityId, ChestView>();

  constructor(private readonly scene: THREE.Scene) {}

  /** One open chest, for shader warm-up. */
  samples(): THREE.Object3D[] {
    return [buildChest({ id: 0, pos: { x: 0, y: 0 }, opened: true }).root];
  }

  clear(): void {
    for (const view of this.views.values()) removeAndDispose(view.root);
    this.views.clear();
  }

  update(state: GameState, dt: number, time: number): void {
    const opening = new Set<EntityId>();
    for (const p of state.players) if (p.alive && p.action?.kind === 'openChest') opening.add(p.action.chestId);

    for (const chest of state.chests) {
      let view = this.views.get(chest.id);
      if (!view) {
        view = buildChest(chest);
        this.views.set(chest.id, view);
        this.scene.add(view.root);
      }
      const target = chest.opened ? LID_OPEN_ANGLE : 0;
      view.lidAngle += (target - view.lidAngle) * (1 - Math.exp(-14 * dt));
      // A chest being opened rattles its lid.
      const rattle = opening.has(chest.id) ? Math.sin(time * 40) * 0.06 : 0;
      view.lid.rotation.x = view.lidAngle + rattle;
    }
  }
}

// ---------- loot ----------

function buildItem(kind: ItemKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'cotton_puff':
      for (const [x, y, z, r] of [[0, 0, 0, 0.2], [0.16, 0.05, 0.05, 0.15], [-0.14, 0.04, -0.04, 0.14], [0.02, 0.15, -0.05, 0.13]] as const) {
        const puff = toonMesh(new THREE.IcosahedronGeometry(r, 1), '#fdfbf7', { outline: 0.08 });
        puff.position.set(x, y, z);
        g.add(puff);
      }
      break;
    case 'sewing_kit': {
      const tin = toonMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 24), '#e2577c', { outline: 0.05 });
      g.add(tin);
      const spool = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 14), '#4a7fd6', { outline: 0.08 });
      spool.position.set(0.08, 0.15, 0);
      g.add(spool);
      const needle = toonMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6), '#d9dde3', { outline: 0.2 });
      needle.rotation.z = 0.9;
      needle.position.set(-0.08, 0.14, 0.04);
      g.add(needle);
      break;
    }
    case 'button_pack':
      ['#e2574c', '#3d7ff2', '#f7c331'].forEach((c, i) => {
        const button = toonMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), c, { outline: 0.06 });
        button.position.set((i - 1) * 0.05, i * 0.08, (i % 2) * 0.04);
        g.add(button);
        for (const [hx, hz] of [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]] as const) {
          const hole = toonMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), OUTLINE_COLOR, { outline: false, castShadow: false });
          hole.position.set(button.position.x + hx, button.position.y + 0.002, button.position.z + hz);
          g.add(hole);
        }
      });
      break;
  }
  return g;
}

interface LootView {
  root: THREE.Group;
  model: THREE.Group;
  glow: THREE.Mesh;
  beam: THREE.Mesh | null;
  age: number;
  phase: number;
}

function buildLoot(loot: GroundLoot): LootView {
  const root = new THREE.Group();
  root.position.set(loot.pos.x, 0, loot.pos.y);
  const color = config.rarity[loot.rarity].color;

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, map: glowMap(), transparent: true, depthWrite: false, opacity: 1 }),
  );
  glow.position.y = 0.025;
  root.add(glow);
  // A solid ring with a dark edge keeps the rarity readable even green-on-grass.
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(0.66, 0.8, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  edge.position.y = 0.027;
  glow.add(edge);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.76, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, depthWrite: false, transparent: true }),
  );
  ring.position.y = 0.029;
  glow.add(ring);

  let beam: THREE.Mesh | null = null;
  if (loot.rarity >= 3) {
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.32, 3, 16, 1, true).translate(0, 1.5, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    );
    root.add(beam);
  }

  const model = new THREE.Group();
  model.add(loot.content.type === 'weapon' ? buildWeapon(loot.content.weapon.kind, loot.content.weapon.rarity, OUTLINE_COLOR) : buildItem(loot.content.item.kind));
  // Weapon models are built around their grip; center them over the glow.
  if (loot.content.type === 'weapon') model.children[0]!.position.z = -0.3;
  root.add(model);
  return { root, model, glow, beam, age: 0, phase: (loot.id * 0.77) % (Math.PI * 2) };
}

export class LootViews {
  private readonly views = new Map<EntityId, LootView>();

  constructor(private readonly scene: THREE.Scene) {}

  /** One of every loot look (each weapon with a beam, each item), for shader warm-up. */
  samples(): THREE.Object3D[] {
    const weapons = (['cork_popper', 'foam_dart_smg', 'super_soaker'] as const).map((kind) =>
      buildLoot({ id: 0, pos: { x: 0, y: 0 }, rarity: 4, content: { type: 'weapon', weapon: { kind, rarity: 4, ammo: 0, nextFireTick: 0, reloadEndTick: null } } }),
    );
    const items = (['cotton_puff', 'sewing_kit', 'button_pack'] as const).map((kind) =>
      buildLoot({ id: 0, pos: { x: 0, y: 0 }, rarity: 0, content: { type: 'item', item: { kind, count: 1 } } }),
    );
    return [...weapons, ...items].map((v) => v.root);
  }

  clear(): void {
    for (const view of this.views.values()) removeAndDispose(view.root);
    this.views.clear();
  }

  update(state: GameState, dt: number, time: number): void {
    const seen = new Set<EntityId>();
    for (const loot of state.loot) {
      seen.add(loot.id);
      let view = this.views.get(loot.id);
      if (!view) {
        view = buildLoot(loot);
        this.views.set(loot.id, view);
        this.scene.add(view.root);
      }
      view.age += dt;
      const pop = Math.min(1, view.age / POP_SECONDS);
      const overshoot = pop < 1 ? Math.sin(pop * Math.PI) * 0.25 : 0;
      view.model.scale.setScalar(pop + overshoot);
      view.model.position.y = 0.55 + Math.sin(time * 2.2 + view.phase) * 0.08;
      view.model.rotation.y = time * 1.3 + view.phase;
      const pulse = 0.8 + Math.sin(time * 3 + view.phase) * 0.2;
      (view.glow.material as THREE.MeshBasicMaterial).opacity = pulse * pop;
      view.glow.scale.setScalar(pop);
      if (view.beam) view.beam.scale.set(1, pop, 1);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      removeAndDispose(view.root);
      this.views.delete(id);
    }
  }
}

function removeAndDispose(root: THREE.Object3D): void {
  root.removeFromParent();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
