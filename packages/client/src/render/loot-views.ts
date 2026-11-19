// Toy chests and ground loot. Loot floats and spins above a glow in its rarity color so it
// reads from the top-down camera; Limited Edition and up also get a light beam.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { Animal, Chest, EntityId, GameState, GroundLoot, ItemKind, Part, PartSlot, WeaponKind } from '@stuffed/sim';
import { mergeStatic } from './merge-static.ts';
import { buildPart } from './placeholder-parts.ts';
import { crateTexture, picnicTexture, tiled, wickerTexture } from './props.ts';
import { fadeObject, makePlastic, outlineMaterial, OUTLINE_COLOR, pushedOutlineMaterial, toonMaterial, toonMesh } from './toon.ts';
import { buildWeapon } from './weapon-models.ts';

const POP_SECONDS = 0.25;
const LID_OPEN_ANGLE = -1.9;

/** Brighter takes on the rarity colors for the rings on the ground, so they pop on the lawn. */
const NEON = ['#e8f0ff', '#39ff7a', '#29c8ff', '#a45cff', '#ffd23a'] as const;

let glowTexture: THREE.CanvasTexture | null = null;
export function glowMap(): THREE.CanvasTexture {
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
export function haloMap(): THREE.CanvasTexture {
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
  root.position.set(chest.pos.x, chest.z, chest.pos.y);
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
        ? toonMaterial('#ffffff', { map: tiled(wickerTexture(), 2, 1) })
        : makePlastic(toonMaterial(look.body));
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
  // One outline around the whole box (outlining each wall would draw lines inside it), as thick
  // all round and kept behind what touches it (the lid, the trim).
  const hull = new THREE.Mesh(new THREE.BoxGeometry(w + CHEST_OUTLINE * 2, h + CHEST_OUTLINE * 2, d + CHEST_OUTLINE * 2), pushedOutlineMaterial(OUTLINE_COLOR));
  hull.name = 'outline';
  hull.position.y = h / 2;
  root.add(hull);

  if (chest.loot === 'medium' || chest.loot === 'high') {
    // Painted toy chests are lacquered: the body, lid and trim all catch the light.
    const trimMat = makePlastic(flat(look.trim));
    // Trim bands (a frame around the sides, not a slab over the top), straps and a star latch.
    for (const y of [0.06, h - 0.05]) {
      for (const [sx, sz, bx, bz] of [[w + 0.03, 0.03, 0, d / 2], [w + 0.03, 0.03, 0, -d / 2], [0.03, d + 0.03, w / 2, 0], [0.03, d + 0.03, -w / 2, 0]] as const) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.07, sz), trimMat);
        band.position.set(bx, y, bz);
        root.add(band);
      }
    }
    // Straps down the front and back only (not through the hollow inside).
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.03), trimMat);
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
    chest.loot === 'food' ? toonMaterial('#ffffff', { map: tiled(picnicTexture(), 0.5, 0.5) }) : chest.loot === 'low' ? toonMaterial('#ffffff', { map: crateTexture() }) : makePlastic(toonMaterial(look.lid));
  // A half tube along the width, curved side up, squashed a little; or a flat lid.
  const lidGeo = look.round
    ? new THREE.CylinderGeometry(d / 2 + 0.03, d / 2 + 0.03, w + 0.06, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.7, 1)
    : new THREE.BoxGeometry(w + 0.08, 0.14, d + 0.06);
  const lidMesh = toonMesh(lidGeo, look.lid, { outline: false, material: lidMat });
  // Its outline: the same shape a little bigger all round (a scaled copy was a hairline on its sides).
  const o = CHEST_OUTLINE;
  const lidHull = new THREE.Mesh(
    look.round
      ? new THREE.CylinderGeometry(d / 2 + 0.03 + o, d / 2 + 0.03 + o, w + 0.06 + o * 2, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.7, 1)
      : new THREE.BoxGeometry(w + 0.08 + o * 2, 0.14 + o * 2, d + 0.06 + o * 2),
    pushedOutlineMaterial(OUTLINE_COLOR),
  );
  lidHull.name = 'outline';
  lidMesh.add(lidHull);
  if (look.round) {
    // The dome's outline is open underneath: close it with a flat one under its rim, or the floor
    // showed through between it and the box's outline where the lid overhangs the box.
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06 + o * 2, o * 2, d + 0.06 + o * 2), pushedOutlineMaterial(OUTLINE_COLOR));
    base.name = 'outline';
    lidMesh.add(base);
  }
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
    return (['low', 'medium', 'high', 'food'] as const).map((loot) => buildChest({ id: 0, pos: { x: 0, y: 0 }, z: 0, opened: false, loot }).root);
  }

  clear(): void {
    for (const view of this.views.values()) removeAndDispose(view.root);
    this.views.clear();
  }

  /** `fade`: how see-through a chest at a spot is (one on the roof above you fades out with it). */
  update(state: GameState, dt: number, time: number, fade: (x: number, y: number, z: number) => number = () => 1): void {
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
      const f = fade(chest.pos.x, chest.pos.y, chest.z);
      fadeObject(view.root, f, view.glow);
      if (view.glow) {
        view.glow.visible = !chest.opened && f >= 1;
        (view.glow.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(time * 3 + chest.id) * 0.35;
      }
    }
  }
}

// ---------- loot ----------

/** A round sewing button of radius `r`, with its four holes. */
/** A sewing button like the HUD's: a disc with a darker ring set in from its rim, and four holes. */
function sewingButton(r: number, color: string): THREE.Group {
  const button = new THREE.Group();
  const h = Math.max(0.03, r * 0.3);
  button.add(toonMesh(new THREE.CylinderGeometry(r, r, h, 18), color, { outline: 0.08 }));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.56, r * 0.74, 24).rotateX(-Math.PI / 2),
    toonMaterial(new THREE.Color(color).multiplyScalar(0.55), { map: null }),
  );
  ring.position.y = h / 2 + 0.003;
  button.add(ring);
  const off = r * 0.3;
  const holeMat = toonMaterial(OUTLINE_COLOR, { map: null });
  for (const [hx, hz] of [[-off, -off], [off, -off], [-off, off], [off, off]] as const) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.12, Math.max(0.035, r * 0.32), 6), holeMat);
    hole.position.set(hx, 0.002, hz);
    button.add(hole);
  }
  return button;
}

export function buildItem(kind: ItemKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'cotton_puff': {
      // A sticking plaster: a skin-tone strip with rounded ends, little air holes, and a white
      // pad with a red heart (a little heal).
      const W = 0.62;
      const D = 0.2;
      const tone = '#ffc7a8';
      const strip = toonMesh(new THREE.BoxGeometry(W - D, 0.035, D), tone, { outline: 0.06 });
      strip.position.y = 0.02;
      g.add(strip);
      for (const side of [-1, 1]) {
        const end = toonMesh(new THREE.CylinderGeometry(D / 2, D / 2, 0.035, 20, 1, false, side > 0 ? 0 : Math.PI, Math.PI), tone, { outline: 0.06 });
        end.position.set((side * (W - D)) / 2, 0.02, 0);
        g.add(end);
      }
      const pad = toonMesh(new THREE.BoxGeometry(W * 0.36, 0.045, D * 0.8), '#fff3f6', { outline: 0.08 });
      pad.position.y = 0.03;
      g.add(pad);
      const heart = new THREE.Shape();
      const hs = D * 0.22;
      heart.moveTo(0, -hs);
      heart.bezierCurveTo(-1.6 * hs, 0.15 * hs, -1.1 * hs, 1.4 * hs, 0, 0.7 * hs);
      heart.bezierCurveTo(1.1 * hs, 1.4 * hs, 1.6 * hs, 0.15 * hs, 0, -hs);
      const h = new THREE.Mesh(new THREE.ShapeGeometry(heart), toonMaterial('#e2433f', { map: null }));
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.055, 0.004);
      g.add(h);
      const holeMat = toonMaterial('#d99a80', { map: null });
      for (const x of [-0.36, -0.26, 0.26, 0.36]) {
        for (const z of [-0.2, 0.2]) {
          const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 5), holeMat);
          dot.position.set(x * W, 0.022, z * D);
          g.add(dot);
        }
      }
      g.rotation.y = 0.4;
      break;
    }
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
      // A few buttons scattered on the ground (the same size as the Button Pile's).
      for (const [x, z, c, tilt, turn] of [[-0.13, -0.06, '#e2574c', 0.1, 0.3], [0.12, -0.09, '#3d7ff2', -0.15, 1.4], [0.01, 0.12, '#f7c331', 0.2, 2.2], [0.17, 0.13, '#5bd16a', 0.05, 0.9]] as const) {
        const button = sewingButton(0.11, c);
        button.position.set(x, 0.03 + Math.abs(tilt) * 0.1, z);
        button.rotation.set(tilt, turn, tilt * 0.5);
        g.add(button);
      }
      break;
    case 'big_stuffing_bag': {
      // An open first-aid box overflowing with stuffing; its lid flipped up behind, with a red
      // cross on it (a big heal).
      const W = 0.5;
      const H = 0.3;
      const D = 0.36;
      const box = toonMesh(new THREE.BoxGeometry(W, H, D), '#fdfbf7', { outline: 0.05 });
      box.position.y = H / 2;
      g.add(box);
      // A red cross on the front too, so it reads from any side.
      for (const r of [0, Math.PI / 2]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(r ? 0.05 : 0.16, r ? 0.16 : 0.05, 0.012), toonMaterial('#e2433f', { map: null }));
        bar.position.set(0, H * 0.5, D / 2 + 0.004);
        g.add(bar);
      }
      // The lid, hinged at the back and tipped open, cross facing up.
      const lid = new THREE.Group();
      lid.position.set(0, H, -D / 2);
      lid.rotation.x = -1.15;
      const panel = toonMesh(new THREE.BoxGeometry(W, 0.04, D), '#fdfbf7', { outline: 0.06 });
      panel.position.set(0, 0.02, D / 2);
      lid.add(panel);
      for (const r of [0, Math.PI / 2]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(r ? 0.07 : 0.22, 0.012, r ? 0.22 : 0.07), toonMaterial('#e2433f', { map: null }));
        bar.position.set(0, 0.046, D / 2);
        lid.add(bar);
      }
      g.add(lid);
      // Stuffing heaped up out of the top.
      for (const [x, y, z, r] of [[0, H + 0.06, 0.02, 0.13], [0.12, H + 0.04, 0.06, 0.09], [-0.12, H + 0.05, -0.02, 0.1], [0.04, H + 0.14, 0, 0.08], [-0.05, H + 0.03, 0.1, 0.07]] as const) {
        const tuft = toonMesh(new THREE.IcosahedronGeometry(r, 1), '#ffffff', { outline: 0.08 });
        tuft.position.set(x, y, z);
        g.add(tuft);
      }
      break;
    }
    case 'juice_box': {
      // A sky-blue juice box with a big orange on the front (it stands out on blue) and a bendy
      // pink straw.
      const box = toonMesh(new THREE.BoxGeometry(0.26, 0.38, 0.18), '#6ec3f0', { outline: 0.06 });
      g.add(box);
      // A darker band round the bottom and an orange top, like the fruit.
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.262, 0.07, 0.182), toonMaterial('#3d9bd6', { map: null }));
      band.position.y = -0.15;
      g.add(band);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.262, 0.03, 0.182), toonMaterial('#ff8a1c', { map: null }));
      lid.position.y = 0.19;
      g.add(lid);
      // The orange: a round, outlined fruit with a leaf on a cream label, on both big faces
      // (so it stands out from the carton).
      const face = (mesh: THREE.Mesh, x: number, y: number, z: number, side: number) => {
        mesh.position.set(x, y, side * z);
        if (side < 0) mesh.rotation.y = Math.PI;
        g.add(mesh);
      };
      for (const side of [1, -1]) {
        face(new THREE.Mesh(new THREE.CircleGeometry(0.112, 24), toonMaterial('#fff7ea', { map: null })), 0, 0.02, 0.091, side);
        face(new THREE.Mesh(new THREE.CircleGeometry(0.084, 20), toonMaterial(OUTLINE_COLOR, { map: null })), 0, 0.01, 0.093, side);
        face(new THREE.Mesh(new THREE.CircleGeometry(0.072, 20), toonMaterial('#ff8a1c', { map: null })), 0, 0.01, 0.095, side);
        face(new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), toonMaterial('#ffd9a3', { map: null })), -0.026, 0.036, 0.097, side);
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.032, 8), toonMaterial('#4fae3f', { map: null }));
        leaf.scale.set(1.6, 0.8, 1);
        leaf.rotation.z = side * 0.5;
        face(leaf, side * 0.035, 0.09, 0.097, side);
      }
      // A bendy straw: up from the top corner, then bent over.
      const straw = toonMesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.06, 0.18, 0), new THREE.Vector3(0.06, 0.36, 0), new THREE.Vector3(0.1, 0.42, 0), new THREE.Vector3(0.18, 0.43, 0)]), 16, 0.022, 8),
        '#ff5a8a',
        { outline: false },
      );
      g.add(straw);
      for (const y of [0.3, 0.33]) {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.006, 4, 10), toonMaterial('#ffffff', { map: null }));
        stripe.rotation.x = Math.PI / 2;
        stripe.position.set(0.06, y, 0);
        g.add(stripe);
      }
      break;
    }
    case 'button_pile': {
      // A big heap of colorful buttons: many more of the Button Pack's.
      const colors = ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a', '#ff9cbf', '#9b7bd8'];
      // [x, y, z, radius, tilt] from the bottom layer up to a big one on top.
      const heap: [number, number, number, number, number][] = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        heap.push([Math.cos(a) * 0.24, 0.03, Math.sin(a) * 0.24, 0.1, 0.25]);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        heap.push([Math.cos(a) * 0.13, 0.1, Math.sin(a) * 0.13, 0.11, 0.4]);
      }
      heap.push([0, 0.17, 0, 0.12, 0.15], [0.05, 0.22, -0.03, 0.11, 0.5]);
      heap.forEach(([x, y, z, r, tilt], i) => {
        const button = sewingButton(r, colors[i % colors.length]!);
        button.position.set(x, y, z);
        button.rotation.set(Math.sin(i * 1.7) * tilt, i * 0.9, Math.cos(i * 1.3) * tilt);
        g.add(button);
      });
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
  /** Parts only: a glowing gold sparkle shown while the part would be new to you. */
  sparkle: { root: THREE.Group; star: THREE.Sprite; glow: THREE.Sprite; twinkles: THREE.Sprite[] } | null;
  glow: THREE.Mesh;
  halo: THREE.Mesh;
  beam: THREE.Mesh | null;
  age: number;
  phase: number;
}

let sparkleTex: THREE.CanvasTexture | null = null;
/** A four-point gold star with a soft glow. */
export function sparkleTexture(): THREE.CanvasTexture {
  if (sparkleTex) return sparkleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  glow.addColorStop(0, 'rgba(255, 248, 190, 1)');
  glow.addColorStop(1, 'rgba(255, 244, 170, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  // Vivid lemon yellow, lighter in the middle.
  const fill = g.createRadialGradient(32, 32, 0, 32, 32, 26);
  fill.addColorStop(0, '#fffbb0');
  fill.addColorStop(0.4, '#fff04a');
  fill.addColorStop(1, '#ffd21a');
  g.fillStyle = fill;
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

let sparkleGlowTex: THREE.CanvasTexture | null = null;
/** A soft round glow (drawn additively behind the sparkle). */
export function sparkleGlowTexture(): THREE.CanvasTexture {
  if (sparkleGlowTex) return sparkleGlowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255, 252, 210, 1)');
  glow.addColorStop(0.35, 'rgba(255, 232, 110, 0.75)');
  glow.addColorStop(1, 'rgba(255, 220, 80, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  sparkleGlowTex = new THREE.CanvasTexture(c);
  sparkleGlowTex.colorSpace = THREE.SRGBColorSpace;
  return sparkleGlowTex;
}

/**
 * The circle under loot: a soft disc of light and a halo on the floor, and on them a raised glossy
 * plastic hoop in the rarity's color with a dark outline (readable even green-on-grass; a little
 * self-lit, so it stays neon in shade). Its hoop is `radius` across (0.72 under loot; the tube stays
 * as thick for bigger ones). Pulse `glow` (opacity 0.6..1) and `halo` (0.3..0.5) to make it breathe.
 */
export function groundRing(color: THREE.ColorRepresentation, radius = 0.72): { glow: THREE.Mesh; halo: THREE.Mesh } {
  const k = radius / 0.72;
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(k, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, map: glowMap(), transparent: true, depthWrite: false, opacity: 1, toneMapped: false }),
  );
  // (Under the hoop: drawn over it, the added light washed its color out to pastel.)
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.05 * k, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, map: haloMap(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
  );
  halo.position.y = 0.004;
  glow.add(halo);
  // After roofs (see-through, so sorted with these): loot up on one was painted over by it.
  glow.renderOrder = halo.renderOrder = 2;
  const ring = hoop(radius, HOOP_TUBE, neonPlastic(color));
  glow.add(ring);
  return { glow, halo };
}

const HOOP_TUBE = 0.055;
const HOOP_OUTLINE = 0.022;

/** Glossy toy plastic a little self-lit, so it stays bright in shade. */
function neonPlastic(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  const material = makePlastic(toonMaterial(color, { map: null }));
  material.emissive.set(color).multiplyScalar(0.45);
  material.toneMapped = false;
  return material;
}

/** A plastic tube lying on the floor round a circle `radius` across (or `arc` of it), raised to sit on it. */
function hoopGeometry(radius: number, tube: number, arc = Math.PI * 2): THREE.BufferGeometry {
  // Starting at the top of the screen (north) and going clockwise, like a clock's hand.
  return new THREE.TorusGeometry(radius, tube, 10, Math.max(8, Math.round((48 * arc) / (Math.PI * 2) * Math.max(1, radius))), arc)
    .rotateX(Math.PI / 2)
    .rotateY(Math.PI / 2);
}

/** A hoop on the floor with an outline (a fatter tube round the same circle). */
function hoop(radius: number, tube: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(hoopGeometry(radius, tube), material);
  mesh.position.y = tube;
  mesh.add(new THREE.Mesh(hoopGeometry(radius, tube + HOOP_OUTLINE), outlineMaterial(OUTLINE_COLOR)));
  return mesh;
}

let beamTexture: THREE.CanvasTexture | null = null;
/** A light shaft's glow: soft across, strongest low down, fading out to nothing at the top and at its foot. */
function beamMap(): THREE.CanvasTexture {
  if (beamTexture) return beamTexture;
  const W = 64;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const up = y / (H - 1); // 0 at the top of the image (the shaft's top)
    // Fading out at the bottom too, into the glow on the floor (a hard edge showed where it met it).
    const along = Math.pow(up, 1.1) * Math.min(1, Math.pow((1 - up) * 5, 1.5));
    for (let x = 0; x < W; x++) {
      const across = (x + 0.5) / W - 0.5;
      // A bright middle with a wide soft falloff, gone by the edges.
      const a = along * (0.7 * Math.exp(-(across * across) / 0.025) + 0.5 * Math.exp(-(across * across) / 0.07)) * Math.min(1, (0.5 - Math.abs(across)) * 8);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  beamTexture = new THREE.CanvasTexture(c);
  beamTexture.colorSpace = THREE.SRGBColorSpace;
  return beamTexture;
}

/** How far a chest's outline stands out from it. */
const CHEST_OUTLINE = 0.035;

function buildLoot(loot: GroundLoot): LootView {
  const root = new THREE.Group();
  root.position.set(loot.pos.x, loot.z, loot.pos.y);
  const color = NEON[loot.rarity];

  const { glow, halo } = groundRing(color);
  glow.position.y = 0.025;
  root.add(glow);

  let beam: THREE.Mesh | null = null;
  if (loot.rarity >= 3) {
    // A soft shaft of light: a card facing the camera (it never turns), brightest at the bottom
    // and fading out upward, with feathered sides (a see-through tube read as a solid one).
    beam = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 3.2).translate(0, 1.6, 0),
      new THREE.MeshBasicMaterial({ color, map: beamMap(), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    // A brighter core, added on top (it glows even over a light floor).
    const core = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 3.2).translate(0, 1.6, 0.01),
      new THREE.MeshBasicMaterial({ color, map: beamMap(), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }),
    );
    beam.add(core);
    beam.renderOrder = core.renderOrder = 2;
    root.add(beam);
  }

  const model = new THREE.Group();
  const c = loot.content;
  model.add(c.type === 'weapon' ? buildWeapon(c.weapon.kind, c.weapon.rarity, OUTLINE_COLOR) : c.type === 'part' ? buildLoosePart(c.part) : buildItem(c.item.kind));
  // Weapon models are built around their grip; center them over the glow.
  if (loot.content.type === 'weapon') model.children[0]!.position.z = -0.3;
  mergeStatic(model);
  root.add(model);
  let sparkle: LootView['sparkle'] = null;
  if (c.type === 'part') {
    const sRoot = new THREE.Group();
    sRoot.visible = false;
    const glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: sparkleGlowTexture(), depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, transparent: true }),
    );
    glowSprite.renderOrder = 4;
    sRoot.add(glowSprite);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture(), depthWrite: false, toneMapped: false }));
    star.renderOrder = 5;
    sRoot.add(star);
    // Two tiny twinkles circling it.
    const twinkles = [0, 1].map(() => {
      const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleGlowTexture(), depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, transparent: true }));
      t.renderOrder = 4;
      sRoot.add(t);
      return t;
    });
    root.add(sRoot);
    sparkle = { root: sRoot, star, glow: glowSprite, twinkles };
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

  /** `fade`: how see-through loot at a spot is (1 = solid; 0 on the roof of the building you're in). */
  update(state: GameState, dt: number, time: number, fade: (x: number, y: number, z: number) => number = () => 1): void {
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
      // On the roof above you: fading out with the roof, its glow and beam first.
      const f = fade(loot.pos.x, loot.pos.y, loot.z);
      fadeObject(view.model, f);
      view.glow.visible = view.halo.visible = f >= 1;
      if (view.beam) view.beam.visible = f >= 1;
      if (view.sparkle && loot.content.type === 'part') {
        const part = loot.content.part;
        const sp = view.sparkle;
        sp.root.visible = f >= 1 && this.isNewPart(part.slot, part.animal);
        if (sp.root.visible) {
          sp.root.position.y = 1.35 + Math.sin(time * 3 + view.phase) * 0.12;
          (sp.star.material as THREE.SpriteMaterial).rotation = Math.sin(time * 2 + view.phase) * 0.4;
          sp.star.scale.setScalar(0.5 + Math.sin(time * 5 + view.phase) * 0.08);
          // A warm glow breathing behind it.
          const breathe = 0.5 + 0.5 * Math.sin(time * 4 + view.phase);
          sp.glow.scale.setScalar(1.1 + breathe * 0.45);
          (sp.glow.material as THREE.SpriteMaterial).opacity = 0.55 + breathe * 0.45;
          sp.twinkles.forEach((t, i) => {
            const a = time * 2.2 + view.phase + i * Math.PI;
            t.position.set(Math.cos(a) * 0.38, Math.sin(a * 1.3) * 0.1, Math.sin(a) * 0.38);
            t.scale.setScalar(0.18 + 0.1 * Math.max(0, Math.sin(time * 7 + i * 2)));
          });
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
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    // Its own faded copy of a shared material.
    if (o.userData.base) (o.material as THREE.Material).dispose();
  });
}
