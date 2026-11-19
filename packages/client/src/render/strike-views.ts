// The air strike: the big toy button on the map, the circles marked where each drop will land,
// and the drops themselves (water balloons, toy blocks or snowballs) falling the last moment.
import * as THREE from 'three';
import { config, groundHeight } from '@stuffed/sim';
import type { EntityId, GameState, Strike, StrikeKind, World } from '@stuffed/sim';
import { makePlastic, toonMaterial, toonMesh } from './toon.ts';

const RADIUS = config.strike.radius;
/** Ticks a drop takes to fall from the sky onto its circle. */
const FALL_TICKS = 18;
const FALL_HEIGHT = 14;
const WARN = '#ff3b5c';
/** Little lights round the button, lit one by one as it recharges. */
const DOTS = 12;

const BALLOON_COLORS = ['#ff5a7a', '#5d9cf5', '#ffd23a', '#5bd16a', '#b86bff'];
const BLOCK_COLORS = ['#e2433f', '#3d7ff2', '#f7c331', '#5bd16a'];

/** A water balloon's outline, bottom to top: a heavy round belly narrowing to a tied neck. */
const BALLOON_PROFILE = [
  [0, -0.4], [0.2, -0.36], [0.32, -0.24], [0.38, -0.06], [0.36, 0.1], [0.28, 0.23], [0.16, 0.33], [0.07, 0.4], [0.05, 0.44],
].map(([x, y]) => new THREE.Vector2(x, y));

/** One drop: a water balloon (knot up), a toy block or a snowball. */
export function buildDrop(kind: StrikeKind, n = 0): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === 'balloons') {
    const color = BALLOON_COLORS[n % BALLOON_COLORS.length]!;
    const m = makePlastic(toonMaterial(color, { map: null }));
    g.add(toonMesh(new THREE.LatheGeometry(BALLOON_PROFILE, 18), color, { outline: 0.06, material: m }));
    // The tied knot and its little lip.
    const knot = toonMesh(new THREE.SphereGeometry(0.075, 10, 8), color, { outline: 0.15, material: m });
    knot.scale.set(1, 0.8, 1);
    knot.position.y = 0.5;
    g.add(knot);
    const lip = toonMesh(new THREE.TorusGeometry(0.06, 0.025, 6, 14), color, { outline: false, material: m });
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.56;
    g.add(lip);
  } else if (kind === 'blocks') {
    const color = BLOCK_COLORS[n % BLOCK_COLORS.length]!;
    g.add(toonMesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), color, { outline: 0.06, material: makePlastic(toonMaterial(color, { map: null })) }));
  } else {
    g.add(toonMesh(new THREE.IcosahedronGeometry(0.45, 2), '#ffffff', { outline: 0.06, outlineColor: '#8aa4bd' }));
  }
  return g;
}

/** Black and yellow hazard stripes with a black border, for the button's top plate. */
let hazard: THREE.CanvasTexture | null = null;
export function hazardTexture(): THREE.CanvasTexture {
  if (hazard) return hazard;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f7c331';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#231f26';
  for (let x = -256; x < 512; x += 56) {
    g.beginPath();
    g.moveTo(x, 256);
    g.lineTo(x + 26, 256);
    g.lineTo(x + 26 + 256, 0);
    g.lineTo(x + 256, 0);
    g.fill();
  }
  g.lineWidth = 16;
  g.strokeStyle = '#231f26';
  g.strokeRect(8, 8, 240, 240);
  hazard = new THREE.CanvasTexture(c);
  hazard.colorSpace = THREE.SRGBColorSpace;
  hazard.anisotropy = 4;
  return hazard;
}

/**
 * The big toy button: a black box with a yellow hazard-striped top, a grey collar and a chunky
 * orange-red button; lights round its collar come on as it recharges.
 */
export function buildStrikeButton(): { root: THREE.Group; cap: THREE.Mesh; dots: THREE.Mesh[]; glow: THREE.Mesh } {
  const root = new THREE.Group();
  const base = toonMesh(new THREE.BoxGeometry(1.05, 0.42, 1.05), '#2b2730', { outline: 0.04 });
  base.position.y = 0.21;
  root.add(base);
  const yellow = makePlastic(toonMaterial('#f7c331', { map: null }));
  const plate = toonMesh(new THREE.BoxGeometry(1.18, 0.1, 1.18), '#f7c331', { outline: 0.03, material: yellow });
  // The hazard stripes on its top face (a separate sheet just above it flickered against it).
  const stripes = makePlastic(toonMaterial('#ffffff', { map: hazardTexture() }), true);
  plate.material = [yellow, yellow, stripes, yellow, yellow, yellow];
  plate.position.y = 0.47;
  root.add(plate);
  const collar = toonMesh(new THREE.CylinderGeometry(0.44, 0.46, 0.05, 32).translate(0, 0.025, 0), '#b9bdc6', {
    outline: 0.04,
    material: makePlastic(toonMaterial('#b9bdc6', { map: null })),
  });
  // A hair above the striped plate, so their edges never fight.
  collar.position.y = 0.53;
  root.add(collar);
  // Built from its bottom up, so pressing it down (scaling) keeps it on the collar.
  const cap = toonMesh(new THREE.CylinderGeometry(0.31, 0.31, 0.2, 32).translate(0, 0.1, 0), WARN, {
    outline: 0.05,
    material: makePlastic(toonMaterial('#ff4a1c', { map: null })),
  });
  cap.position.y = 0.58;
  root.add(cap);
  // What it calls, floating over it.
  // Recharge lights round the collar.
  const dotMat = toonMaterial('#fff6d0', { map: null });
  const dots: THREE.Mesh[] = [];
  for (let i = 0; i < DOTS; i++) {
    const a = (i / DOTS) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dotMat);
    dot.position.set(Math.sin(a) * 0.385, 0.585, -Math.cos(a) * 0.385);
    root.add(dot);
    dots.push(dot);
  }
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.2, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }),
  );
  glow.position.y = 0.03;
  root.add(glow);
  return { root, cap, dots, glow };
}

interface DropView {
  root: THREE.Group;
  ring: THREE.Mesh;
  /** A second ring growing from the middle: it lands when it reaches the edge. */
  grow: THREE.Mesh;
  drop: THREE.Object3D;
}

export class StrikeViews {
  private button: ReturnType<typeof buildStrikeButton> | null = null;
  private buttonKind: StrikeKind | null = null;
  private readonly drops = new Map<EntityId, DropView>();

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.button?.root.removeFromParent();
    this.button = null;
    this.buttonKind = null;
    for (const d of this.drops.values()) dispose(d.root);
    this.drops.clear();
  }

  /** `fade`: how see-through things at a spot are (0 on the roof of the building you're in). */
  update(world: World, state: GameState, tick: number, dt: number, time: number, fade: (x: number, y: number, z: number) => number): void {
    const b = state.strikeButton;
    if (!b) {
      if (this.button) this.clear();
    } else {
      if (!this.button || this.buttonKind !== b.kind) {
        this.button?.root.removeFromParent();
        this.button = buildStrikeButton();
        this.buttonKind = b.kind;
        this.scene.add(this.button.root);
      }
      const v = this.button;
      v.root.position.set(b.pos.x, b.z, b.pos.y);
      v.root.visible = fade(b.pos.x, b.pos.y, b.z) > 0.5;
      const ready = tick >= b.readyTick;
      // Recharging: the lights come on one by one; ready: all lit.
      const span = b.readyTick > config.strike.firstReady * config.tickRate ? config.strike.cooldown * config.tickRate : config.strike.firstReady * config.tickRate;
      const progress = ready ? 1 : 1 - (b.readyTick - tick) / span;
      v.dots.forEach((d, i) => (d.visible = progress >= (i + 1) / DOTS));
      // (No glowing ring: the popped-up red button and its lit dots say it's ready.)
      v.glow.visible = false;
      // Pushed in while it recharges (sunk into the box, and greyed); up and bright when ready.
      v.cap.position.y = ready ? 0.58 : 0.45;
      (v.cap.material as THREE.MeshToonMaterial).color.set(ready ? '#ff4a1c' : '#b8a9ad');
    }

    const seen = new Set<EntityId>();
    state.strikes.forEach((s, i) => {
      seen.add(s.id);
      let view = this.drops.get(s.id);
      if (!view) {
        view = this.buildDropView(world, state, s, i);
        this.drops.set(s.id, view);
      }
      const ground = view.root.position.y;
      view.root.visible = fade(s.pos.x, s.pos.y, ground) > 0.5;
      // The inner ring grows out to the edge as the drop gets closer; the edge pulses.
      const k = Math.min(1, Math.max(0, (tick - s.calledTick) / Math.max(1, s.landTick - s.calledTick)));
      view.grow.scale.setScalar(Math.max(0.01, k));
      (view.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 12) * 0.3;
      const left = s.landTick - tick;
      view.drop.visible = left < FALL_TICKS;
      view.drop.position.y = (Math.max(0, left) / FALL_TICKS) * FALL_HEIGHT + 0.4;
      // Balloons wobble down knot up; blocks and snowballs tumble.
      if (s.kind === 'balloons') view.drop.rotation.set(Math.sin(time * 6 + i) * 0.3, 0, Math.cos(time * 5 + i) * 0.3);
      else view.drop.rotation.set(time * 3 + i, time * 2, 0);
    });
    for (const [id, view] of this.drops) {
      if (seen.has(id)) continue;
      dispose(view.root);
      this.drops.delete(id);
    }
  }

  private buildDropView(world: World, state: GameState, s: Strike, i: number): DropView {
    const root = new THREE.Group();
    // On whatever it'll land on: the ground, or a roof.
    root.position.set(s.pos.x, groundHeight(world, state, s.pos, 99) + 0.04, s.pos.y);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(RADIUS - 0.14, RADIUS, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
    );
    ring.renderOrder = 3;
    // A faint pale fill (a darker one looked like mud on the lawn).
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS - 0.14, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff0f2', transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }),
    );
    fill.renderOrder = 3;
    const grow = new THREE.Mesh(
      new THREE.RingGeometry(RADIUS - 0.24, RADIUS - 0.14, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
    );
    grow.renderOrder = 3;
    grow.position.y = 0.005;
    const drop = buildDrop(s.kind, i);
    drop.visible = false;
    root.add(ring, fill, grow, drop);
    this.scene.add(root);
    return { root, ring, grow, drop };
  }
}

function dispose(root: THREE.Object3D): void {
  root.removeFromParent();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
