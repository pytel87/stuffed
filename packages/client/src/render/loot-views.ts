// Toy chests and ground loot. Loot floats and spins above a glow in its rarity color so it
// reads from the top-down camera; Limited Edition and up also get a light beam.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { Animal, Chest, EntityId, GameState, GroundLoot, ItemKind, Part, PartSlot, WeaponKind } from '@stuffed/sim';
import { mergeStatic } from './merge-static.ts';
import { buildPart } from './placeholder-parts.ts';
import { checkerTexture, crateTexture, tiled } from './props.ts';
import { OUTLINE_COLOR, toonMaterial, toonMesh } from './toon.ts';
import { buildWeapon } from './weapon-models.ts';

const POP_SECONDS = 0.25;
const LID_OPEN_ANGLE = -1.9;

/** Brighter takes on the rarity colors for the rings on the ground, so they pop on the lawn. */
const NEON = ['#e8f0ff', '#39ff7a', '#29c8ff', '#d070ff', '#ffd23a'] as const;

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

let haloTexture: THREE.CanvasTexture | null = null;
/** A soft band of light around the ring: clear at the center, brightest at the ring, fading out. */
function haloMap(): THREE.CanvasTexture {
  if (!haloTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(0.72, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.86, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    haloTexture = new THREE.CanvasTexture(c);
  }
  return haloTexture;
}

// ---------- chests ----------

interface ChestView {
  root: THREE.Group;
  lid: THREE.Group;
  lidAngle: number;
  /** Light leaking from under the lid of an unopened chest (null for plain ones). */
  glow: THREE.Mesh | null;
}

/** Each loot level has its own chest: a plain wooden one, the red toy chest, a royal one, a picnic basket. */
const CHEST_LOOKS = {
  low: { body: '#b98a5a', trim: '#8e6036', lid: '#c99a66', glow: null, round: false },
  medium: { body: '#d9534f', trim: '#f2c14e', lid: '#f2c14e', glow: '#ffe7a3', round: true },
  high: { body: '#3657c9', trim: '#f7c331', lid: '#f7c331', glow: '#fff1a8', round: true },
  food: { body: '#d2a05c', trim: '#9c6a38', lid: '#ffffff', glow: null, round: false },
} as const;

function starShape(r: number): THREE.Shape {
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = (i % 2 ? 0.45 : 1) * r;
    if (i === 0) star.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr);
    else star.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr);
  }
  return star;
}

export function buildChest(chest: Chest): ChestView {
  const look = CHEST_LOOKS[chest.loot] ?? CHEST_LOOKS.medium;
  const root = new THREE.Group();
  root.position.set(chest.pos.x, 0, chest.pos.y);
  root.rotation.y = (chest.id * 1.37) % (Math.PI * 2);
  const w = 1.15;
  const d = 0.8;
  const h = 0.56;
  const flat = (color: string) => toonMaterial(color, { map: null });

  // Body: wood for the plain chest, woven wicker for the basket, painted toy chests otherwise.
  const bodyMat =
    chest.loot === 'low'
      ? toonMaterial('#ffffff', { map: tiled(crateTexture(), 1.5, 1) })
      : chest.loot === 'food'
        ? toonMaterial(look.body, { map: tiled(checkerTexture('#a87440', '#d8aa6a'), 6, 3) })
        : toonMaterial(look.body);
  // A hollow box: a floor and four walls, so an open chest is empty inside.
  const t = 0.08;
  const inner = flat(chest.loot === 'high' ? '#2a1f4d' : '#4a2f22');
  const floor = toonMesh(new THREE.BoxGeometry(w - 2 * t, 0.12, d - 2 * t), look.body, { outline: false, material: inner });
  floor.position.y = 0.06;
  root.add(floor);
  // Box faces are +x, -x, +y, -y, +z, -z; each wall's face toward the middle is the dark inside.
  const walls = [
    [w, t, 0, (d - t) / 2, 5],
    [w, t, 0, -(d - t) / 2, 4],
    [t, d - 2 * t, (w - t) / 2, 0, 1],
    [t, d - 2 * t, -(w - t) / 2, 0, 0],
  ] as const;
  for (const [sx, sz, x, z, insideFace] of walls) {
    const faces = Array.from({ length: 6 }, (_, i) => (i === insideFace ? inner : bodyMat));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), faces);
    wall.position.set(x, h / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);
  }
  // One outline around the whole box (outlining each wall would draw lines inside it).
  const hull = new THREE.Mesh(new THREE.BoxGeometry(w + 0.07, h + 0.05, d + 0.07), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }));
  hull.position.y = h / 2;
  root.add(hull);

  if (chest.loot === 'medium' || chest.loot === 'high') {
    // Trim bands (a frame around the sides, not a slab over the top), straps and a star latch.
    for (const y of [0.06, h - 0.05]) {
      for (const [sx, sz, bx, bz] of [[w + 0.03, 0.03, 0, d / 2], [w + 0.03, 0.03, 0, -d / 2], [0.03, d + 0.03, w / 2, 0], [0.03, d + 0.03, -w / 2, 0]] as const) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.07, sz), flat(look.trim));
        band.position.set(bx, y, bz);
        root.add(band);
      }
    }
    // Straps down the front and back only (not through the hollow inside).
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.03), flat(look.trim));
        strap.position.set(sx * (w / 2 - 0.18), h / 2, sz * (d / 2 + 0.005));
        root.add(strap);
      }
    }
    const plate = toonMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20), look.trim, { outline: 0.1, castShadow: false });
    plate.rotation.x = Math.PI / 2;
    plate.position.set(0, h * 0.62, d / 2 + 0.02);
    root.add(plate);
    const star = toonMesh(new THREE.ShapeGeometry(starShape(0.12)), chest.loot === 'high' ? '#ffffff' : '#e2574c', { outline: false, castShadow: false });
    star.position.set(0, h * 0.62, d / 2 + 0.045);
    root.add(star);
  } else if (chest.loot === 'low') {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.03), flat('#6d6d6d'));
    plate.position.set(0, h * 0.7, d / 2 + 0.015);
    root.add(plate);
  } else {
    // (The basket's handle sits on its lid, added below, so it lifts away when opened.)
  }

  // The lid hinges on the back edge: rounded on toy chests, flat on the others.
  const lid = new THREE.Group();
  lid.position.set(0, h, -d / 2);
  const lidMat =
    chest.loot === 'food' ? toonMaterial('#ffffff', { map: tiled(checkerTexture(), 2, 2) }) : chest.loot === 'low' ? toonMaterial('#ffffff', { map: crateTexture() }) : toonMaterial(look.lid);
  // A half tube along the width, curved side up, squashed a little; or a flat lid.
  const lidGeo = look.round
    ? new THREE.CylinderGeometry(d / 2 + 0.03, d / 2 + 0.03, w + 0.06, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.7, 1)
    : new THREE.BoxGeometry(w + 0.08, 0.14, d + 0.06);
  const lidMesh = toonMesh(lidGeo, look.lid, { outline: 0.04, material: lidMat });
  lidMesh.position.set(0, look.round ? 0 : 0.07, d / 2);
  lid.add(lidMesh);
  if (chest.loot === 'food') {
    const handle = toonMesh(new THREE.TorusGeometry(0.38, 0.04, 8, 20, Math.PI), '#8e6036', { outline: 0.1 });
    handle.position.set(0, 0.14, d / 2);
    lid.add(handle);
  }
  if (look.round) {
    // Close the half tube's flat underside, and band the dome in the trim color.
    const under = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.02, d + 0.06), flat(look.trim));
    under.position.set(0, 0.01, d / 2);
    lid.add(under);
    for (const sx of [-1, 1]) {
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(d / 2 + 0.045, d / 2 + 0.045, 0.1, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.7, 1),
        flat(chest.loot === 'high' ? '#ffffff' : look.body),
      );
      strap.position.set(sx * (w / 2 - 0.18), 0, d / 2);
      lid.add(strap);
    }
  }
  root.add(lid);

  // Light leaking out of the gap under the lid while the chest is closed.
  let glow: THREE.Mesh | null = null;
  if (look.glow) {
    glow = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.06, 0.06, d + 0.06),
      new THREE.MeshBasicMaterial({ color: look.glow, transparent: true, opacity: 0.9, toneMapped: false }),
    );
    glow.position.y = h + 0.005;
    root.add(glow);
  }
  // Dozens of boards, bands and straps, drawn as a few meshes (the lid and glow still move).
  mergeStatic(root, glow ? [lid, glow] : [lid]);
  return { root, lid, lidAngle: chest.opened ? LID_OPEN_ANGLE : 0, glow };
}

export class ChestViews {
  private readonly views = new Map<EntityId, ChestView>();

  constructor(private readonly scene: THREE.Scene) {}

  /** One open chest, for shader warm-up. */
  samples(): THREE.Object3D[] {
    return (['low', 'medium', 'high', 'food'] as const).map((loot) => buildChest({ id: 0, pos: { x: 0, y: 0 }, opened: false, loot }).root);
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
      if (view.glow) {
        view.glow.visible = !chest.opened;
        (view.glow.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(time * 3 + chest.id) * 0.35;
      }
    }
  }
}

// ---------- loot ----------

export function buildItem(kind: ItemKind): THREE.Group {
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
      // A pink ball of wool with two knitting needles stuck through it, and a loose strand.
      const ball = toonMesh(new THREE.SphereGeometry(0.22, 20, 16), '#ff8fb8', { outline: 0.06 });
      ball.position.y = 0.2;
      g.add(ball);
      // Wraps of yarn round it, crossing every which way.
      const wrapMat = toonMaterial('#e5679a', { map: null });
      for (let i = 0; i < 5; i++) {
        const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.012, 4, 28), wrapMat);
        wrap.position.copy(ball.position);
        wrap.rotation.set(i * 0.9, i * 0.6, i * 0.35);
        g.add(wrap);
      }
      // Two knitting needles crossing through the ball, with round tops.
      for (const [rz, ry, top] of [[0.7, 0.3, '#3d7ff2'], [-0.6, -0.4, '#f7c331']] as const) {
        const needle = new THREE.Group();
        needle.position.copy(ball.position);
        needle.rotation.set(0, ry, rz);
        const shaft = toonMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 8), '#d9dde3', { outline: 0.15 });
        needle.add(shaft);
        const knob = toonMesh(new THREE.SphereGeometry(0.045, 10, 8), top, { outline: 0.12 });
        knob.position.y = 0.36;
        needle.add(knob);
        g.add(needle);
      }
      // A loose strand trailing off.
      const strand = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 0.06, 0.16), new THREE.Vector3(0.25, 0.02, 0.22), new THREE.Vector3(0.36, 0.02, 0.1)]), 12, 0.012, 5),
        wrapMat,
      );
      g.add(strand);
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
    case 'big_stuffing_bag': {
      // A fat white sack of stuffing, tied with red string, fluff spilling from the top.
      const sack = toonMesh(new THREE.SphereGeometry(0.3, 18, 14), '#fbf6ef', { outline: 0.06 });
      sack.scale.set(1, 1.1, 0.9);
      g.add(sack);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 8, 16), toonMaterial('#e2574c', { map: null }));
      tie.rotation.x = Math.PI / 2;
      tie.position.y = 0.3;
      g.add(tie);
      for (const [x, y, z, r] of [[0, 0.42, 0, 0.11], [0.08, 0.38, 0.05, 0.08], [-0.07, 0.4, -0.04, 0.08]] as const) {
        const puff = toonMesh(new THREE.IcosahedronGeometry(r, 1), '#ffffff', { outline: 0.1 });
        puff.position.set(x, y, z);
        g.add(puff);
      }
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), toonMaterial('#ff8fb1', { map: null }));
      patch.position.set(0, 0.02, 0.28);
      g.add(patch);
      break;
    }
    case 'juice_box': {
      // An orange juice box with a bendy straw.
      const box = toonMesh(new THREE.BoxGeometry(0.26, 0.38, 0.18), '#f7a531', { outline: 0.06 });
      g.add(box);
      const label = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), toonMaterial('#ff7a3d', { map: null }));
      label.position.set(0, 0, 0.092);
      g.add(label);
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), toonMaterial('#5fb34f', { map: null }));
      leaf.position.set(0.05, 0.07, 0.093);
      g.add(leaf);
      const straw = toonMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), '#ff5a8a', { outline: 0.15 });
      straw.position.set(0.06, 0.28, 0);
      straw.rotation.z = -0.3;
      g.add(straw);
      break;
    }
    case 'button_jar': {
      // A glass jar of colorful buttons tipped on its side, lid off, a few buttons spilled out of
      // its mouth (from above you see the buttons, not just a lid).
      const colors = ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a', '#ff9cbf'];
      const jar = new THREE.Group();
      jar.position.set(-0.06, 0.2, 0);
      jar.rotation.z = Math.PI / 2;
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.42, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: '#d4f4ff', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
      );
      jar.add(glass);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.44, 20, 1, true), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }));
      jar.add(rim);
      const bottom = toonMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), '#bfe6f5', { outline: false });
      bottom.position.y = -0.21;
      jar.add(bottom);
      // Buttons heaped inside.
      for (let i = 0; i < 10; i++) {
        const button = toonMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 12), colors[i % colors.length]!, { outline: false });
        const a = i * 2.4;
        button.position.set(-0.08 - Math.abs(Math.sin(a)) * 0.06, -0.15 + (i / 10) * 0.32, Math.cos(a) * 0.09);
        button.rotation.set(i * 0.7, 0, i * 0.4);
        jar.add(button);
      }
      g.add(jar);
      // Spilled out of the open mouth.
      for (const [x, z, c, r] of [[0.24, 0.04, 0, 0.2], [0.32, -0.1, 1, 1.1], [0.36, 0.13, 2, 2.3], [0.2, -0.18, 3, 0.7]] as const) {
        const button = toonMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14), colors[c]!, { outline: 0.1 });
        button.position.set(x, 0.02, z);
        button.rotation.y = r;
        g.add(button);
        for (const [hx, hz] of [[-0.02, -0.02], [0.02, -0.02], [-0.02, 0.02], [0.02, 0.02]] as const) {
          const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 5), toonMaterial(OUTLINE_COLOR, { map: null }));
          hole.position.set(x + hx, 0.022, z + hz);
          g.add(hole);
        }
      }
      // The red lid lying beside it.
      const lid = toonMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 20), '#e2433f', { outline: 0.06 });
      lid.position.set(-0.12, 0.03, -0.32);
      lid.rotation.x = 0.15;
      g.add(lid);
      break;
    }
    case 'cardboard_wall': {
      // A folded-up cardboard panel with tape and a "this way up" arrow.
      for (const [y, r] of [[0, 0], [0.1, 0.06]] as const) {
        const panel = toonMesh(new THREE.BoxGeometry(0.55, 0.08, 0.4), '#c9a27e', { outline: 0.06 });
        panel.position.y = y;
        panel.rotation.y = r;
        g.add(panel);
      }
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.42), toonMaterial('#e8d9b5', { map: null }));
      tape.position.y = 0.05;
      g.add(tape);
      break;
    }
  }
  return g;
}

/** Largest size of a part shown on the ground. */
const PART_SIZE = 0.8;

/** A skin part on its own, centered on its middle and scaled to a fixed size. */
function buildLoosePart(part: Part): THREE.Group {
  const model = buildPart(part.slot, part.animal);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const g = new THREE.Group();
  g.add(model);
  g.scale.setScalar(PART_SIZE / Math.max(size.x, size.y, size.z, 0.3));
  return g;
}

interface LootView {
  root: THREE.Group;
  model: THREE.Group;
  /** Parts only: a gold sparkle shown while the part would be new to you. */
  sparkle: THREE.Sprite | null;
  glow: THREE.Mesh;
  halo: THREE.Mesh;
  beam: THREE.Mesh | null;
  age: number;
  phase: number;
}

let sparkleTex: THREE.CanvasTexture | null = null;
/** A four-point gold star with a soft glow. */
function sparkleTexture(): THREE.CanvasTexture {
  if (sparkleTex) return sparkleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  glow.addColorStop(0, 'rgba(255, 236, 140, 0.9)');
  glow.addColorStop(1, 'rgba(255, 236, 140, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffd23a';
  g.strokeStyle = '#2a1f2d';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(32, 6);
  g.quadraticCurveTo(35, 29, 58, 32);
  g.quadraticCurveTo(35, 35, 32, 58);
  g.quadraticCurveTo(29, 35, 6, 32);
  g.quadraticCurveTo(29, 29, 32, 6);
  g.fill();
  g.stroke();
  sparkleTex = new THREE.CanvasTexture(c);
  sparkleTex.colorSpace = THREE.SRGBColorSpace;
  return sparkleTex;
}

function buildLoot(loot: GroundLoot): LootView {
  const root = new THREE.Group();
  root.position.set(loot.pos.x, loot.z, loot.pos.y);
  const color = NEON[loot.rarity];

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, map: glowMap(), transparent: true, depthWrite: false, opacity: 1, toneMapped: false }),
  );
  glow.position.y = 0.025;
  root.add(glow);
  // Neon glow hugging the ring, inside and out.
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, map: haloMap(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
  );
  halo.position.y = 0.031;
  glow.add(halo);
  // A solid ring with a dark edge keeps the rarity readable even green-on-grass.
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(0.66, 0.8, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  edge.position.y = 0.027;
  glow.add(edge);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.67, 0.77, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, depthWrite: false, transparent: true, toneMapped: false }),
  );
  ring.position.y = 0.029;
  glow.add(ring);

  let beam: THREE.Mesh | null = null;
  if (loot.rarity >= 3) {
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.32, 3, 16, 1, true).translate(0, 1.5, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    root.add(beam);
  }

  const model = new THREE.Group();
  const c = loot.content;
  model.add(c.type === 'weapon' ? buildWeapon(c.weapon.kind, c.weapon.rarity, OUTLINE_COLOR) : c.type === 'part' ? buildLoosePart(c.part) : buildItem(c.item.kind));
  // Weapon models are built around their grip; center them over the glow.
  if (loot.content.type === 'weapon') model.children[0]!.position.z = -0.3;
  mergeStatic(model);
  root.add(model);
  let sparkle: THREE.Sprite | null = null;
  if (c.type === 'part') {
    sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture(), depthWrite: false, toneMapped: false }));
    sparkle.scale.setScalar(0.55);
    sparkle.visible = false;
    root.add(sparkle);
  }
  return { root, model, sparkle, glow, halo, beam, age: 0, phase: (loot.id * 0.77) % (Math.PI * 2) };
}

export class LootViews {
  private readonly views = new Map<EntityId, LootView>();
  /** Whether a part would be new to you (sparkles over it on the ground). */
  isNewPart: (slot: PartSlot, animal: Animal) => boolean = () => false;

  constructor(private readonly scene: THREE.Scene) {}

  /** One of every loot look (each weapon with a beam, each item, a part), for shader warm-up. */
  samples(): THREE.Object3D[] {
    const weapons = (Object.keys(config.weapons) as WeaponKind[]).map((kind) =>
      buildLoot({ id: 0, pos: { x: 0, y: 0 }, z: 0, rarity: 4, content: { type: 'weapon', weapon: { kind, rarity: 4, ammo: 0, nextFireTick: 0, reloadEndTick: null } } }),
    );
    const items = (Object.keys(config.items) as ItemKind[]).map((kind) =>
      buildLoot({ id: 0, pos: { x: 0, y: 0 }, z: 0, rarity: 0, content: { type: 'item', item: { kind, count: 1 } } }),
    );
    // Parts share their shaders with the plushies (warmed up there); one is enough here.
    const part = buildLoot({ id: 0, pos: { x: 0, y: 0 }, z: 0, rarity: 4, content: { type: 'part', part: { slot: 'head', animal: 'bear', rarity: 4 } } });
    return [...weapons, ...items, part].map((v) => v.root);
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
      if (view.sparkle && loot.content.type === 'part') {
        const part = loot.content.part;
        view.sparkle.visible = this.isNewPart(part.slot, part.animal);
        if (view.sparkle.visible) {
          view.sparkle.position.y = 1.35 + Math.sin(time * 3 + view.phase) * 0.12;
          (view.sparkle.material as THREE.SpriteMaterial).rotation = Math.sin(time * 2 + view.phase) * 0.4;
          view.sparkle.scale.setScalar(0.5 + Math.sin(time * 5 + view.phase) * 0.08);
        }
      }
      // Loot can move (the toy train pushes it off the rails): glide to where it is now.
      view.root.position.x += (loot.pos.x - view.root.position.x) * Math.min(1, dt * 12);
      view.root.position.z += (loot.pos.y - view.root.position.z) * Math.min(1, dt * 12);
      const pop = Math.min(1, view.age / POP_SECONDS);
      const overshoot = pop < 1 ? Math.sin(pop * Math.PI) * 0.25 : 0;
      view.model.scale.setScalar(pop + overshoot);
      view.model.position.y = 0.55 + Math.sin(time * 2.2 + view.phase) * 0.08;
      view.model.rotation.y = time * 1.3 + view.phase;
      const pulse = 0.8 + Math.sin(time * 3 + view.phase) * 0.2;
      (view.glow.material as THREE.MeshBasicMaterial).opacity = pulse * pop;
      (view.halo.material as THREE.MeshBasicMaterial).opacity = (0.4 + Math.sin(time * 3 + view.phase) * 0.1) * pop;
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
