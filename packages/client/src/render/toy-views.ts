// The map's big toy: a jack-in-the-box (its crank turns and it shakes to a tune, then the clown
// pops out on its spring), a garden tap with a hose to a sprinkler (spraying a turning arc), or an
// ice drill on the pond (cracks spread over the ice, then it opens into water with floating floes
// until it freezes over again).
import * as THREE from 'three';
import { config, DT } from '@stuffed/sim';
import type { Circle, GameState, MapData, ToyKind, ToyState } from '@stuffed/sim';
import { groundRing } from './loot-views.ts';
import { tiled, waterTexture } from './props.ts';
import { makePlastic, OUTLINE_COLOR, toonMaterial, toonMesh } from './toon.ts';

const WARN = '#ff3b5c';
const plastic = (c: string) => makePlastic(toonMaterial(c, { map: null }));

// ---------- jack-in-the-box ----------

/** The striped box (crank on its side), its lid, and the clown on a spring inside. */
export function buildJack(): { root: THREE.Group; box: THREE.Group; lid: THREE.Group; crank: THREE.Group; clown: THREE.Group } {
  const root = new THREE.Group();
  const box = new THREE.Group();
  root.add(box);
  const S = 1.1;
  const faces = ['#e2433f', '#3d7ff2', '#f7c331', '#f7c331', '#5bd16a', '#b86bff'].map((c) => plastic(c));
  const body = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), faces);
  body.position.y = S / 2;
  body.castShadow = true;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(S * 1.06, S * 1.06, S * 1.06), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }));
  body.add(hull);
  box.add(body);
  // Gold trim round the top and bottom edges.
  for (const y of [0.04, S - 0.04]) {
    const trim = toonMesh(new THREE.BoxGeometry(S + 0.04, 0.08, S + 0.04), '#ffd23a', { outline: false, material: plastic('#ffd23a') });
    trim.position.y = y;
    box.add(trim);
  }
  // The lid, hinged at the back edge.
  const lid = new THREE.Group();
  lid.position.set(0, S, -S / 2);
  const lidBoard = toonMesh(new THREE.BoxGeometry(S + 0.06, 0.1, S + 0.06), '#e2433f', { outline: 0.04, material: plastic('#e2433f') });
  lidBoard.position.set(0, 0.05, S / 2);
  lid.add(lidBoard);
  box.add(lid);
  // The crank on the right side: an axle, an arm and a knob.
  const crank = new THREE.Group();
  crank.position.set(S / 2 + 0.06, S * 0.55, 0);
  const axle = toonMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), '#ffd23a', { outline: false, material: plastic('#ffd23a') });
  axle.rotation.z = Math.PI / 2;
  crank.add(axle);
  const arm = toonMesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), '#ffd23a', { outline: 0.1, material: plastic('#ffd23a') });
  arm.position.set(0.1, 0.18, 0);
  crank.add(arm);
  const knob = toonMesh(new THREE.SphereGeometry(0.08, 10, 8), '#e2433f', { outline: 0.1, material: plastic('#e2433f') });
  knob.position.set(0.18, 0.36, 0);
  crank.add(knob);
  box.add(crank);
  // The clown: a spring, a ruff, a white head with a red nose and a pointy hat.
  const clown = new THREE.Group();
  const coil = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => new THREE.Vector3(Math.cos(i * 0.9) * 0.18, i * 0.025, Math.sin(i * 0.9) * 0.18)));
  const spring = toonMesh(new THREE.TubeGeometry(coil, 80, 0.035, 6), '#c9cfd8', { outline: false, material: plastic('#c9cfd8') });
  clown.add(spring);
  const ruff = toonMesh(new THREE.TorusGeometry(0.26, 0.08, 8, 16), '#ffffff', { outline: 0.06 });
  ruff.rotation.x = Math.PI / 2;
  ruff.position.y = 1.02;
  clown.add(ruff);
  const head = toonMesh(new THREE.SphereGeometry(0.3, 18, 14), '#fff3e6', { outline: 0.05 });
  head.position.y = 1.3;
  clown.add(head);
  const nose = toonMesh(new THREE.SphereGeometry(0.08, 10, 8), '#e2433f', { outline: 0.1, material: plastic('#e2433f') });
  nose.position.set(0, 1.28, 0.3);
  clown.add(nose);
  for (const s of [-1, 1]) {
    const eye = toonMesh(new THREE.SphereGeometry(0.04, 8, 6), '#2a1f2d', { outline: false });
    eye.position.set(s * 0.1, 1.38, 0.26);
    clown.add(eye);
    const tuft = toonMesh(new THREE.SphereGeometry(0.12, 10, 8), '#ff7a2f', { outline: 0.06 });
    tuft.position.set(s * 0.28, 1.36, -0.02);
    clown.add(tuft);
  }
  const hat = toonMesh(new THREE.ConeGeometry(0.2, 0.45, 14), '#3d7ff2', { outline: 0.06, material: plastic('#3d7ff2') });
  hat.position.y = 1.72;
  hat.rotation.z = 0.2;
  clown.add(hat);
  const pom = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), '#ffd23a', { outline: 0.1 });
  pom.position.set(-0.09, 1.95, 0);
  clown.add(pom);
  clown.position.y = S * 0.3;
  root.add(clown);
  return { root, box, lid, crank, clown };
}

// ---------- sprinkler ----------

/** A brass tap with a red wheel handle (it sticks out of the wall toward +x). */
export function buildTap(): { root: THREE.Group; wheel: THREE.Mesh } {
  const root = new THREE.Group();
  const brass = plastic('#d9a441');
  const pipe = toonMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 10), '#d9a441', { outline: 0.08, material: brass });
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0.1, 0.9, 0);
  root.add(pipe);
  const spout = toonMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 10), '#d9a441', { outline: 0.08, material: brass });
  spout.position.set(0.3, 0.75, 0);
  root.add(spout);
  const wheel = toonMesh(new THREE.TorusGeometry(0.16, 0.035, 8, 18), '#e2433f', { outline: 0.1, material: plastic('#e2433f') });
  wheel.position.set(0.12, 1.1, 0);
  wheel.rotation.x = Math.PI / 2;
  root.add(wheel);
  return { root, wheel };
}

/** A green garden hose lying from the tap's spout across the lawn to the sprinkler. */
function hose(from: THREE.Vector3, to: THREE.Vector3): THREE.Mesh {
  const mid = from.clone().lerp(to, 0.5);
  const side = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize().multiplyScalar(1.2);
  const points = [
    from.clone(),
    new THREE.Vector3(from.x + 0.2, 0.05, from.z),
    from.clone().lerp(mid, 0.5).add(side).setY(0.05),
    mid.clone().sub(side.clone().multiplyScalar(0.5)).setY(0.05),
    to.clone().setY(0.05),
  ];
  return toonMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.06, 6), '#3fa34d', { outline: 0.12 });
}

/** The sprinkler on its spike: a little dome with a turning bar of nozzles. */
function buildSprinkler(): { root: THREE.Group; head: THREE.Group } {
  const root = new THREE.Group();
  const base = toonMesh(new THREE.CylinderGeometry(0.22, 0.28, 0.16, 14), '#3fa34d', { outline: 0.06, material: plastic('#3fa34d') });
  base.position.y = 0.08;
  root.add(base);
  const head = new THREE.Group();
  head.position.y = 0.3;
  const dome = toonMesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffd23a', { outline: 0.08, material: plastic('#ffd23a') });
  head.add(dome);
  const bar = toonMesh(new THREE.BoxGeometry(0.7, 0.07, 0.08), '#5d9cf5', { outline: 0.08, material: plastic('#5d9cf5') });
  bar.position.y = 0.08;
  head.add(bar);
  root.add(head);
  return { root, head };
}

// ---------- ice drill ----------

/** A toy ice drill: a red T-handle on a spiral bit, stuck in a little hole in the ice. */
export function buildDrill(): THREE.Group {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2), toonMaterial('#2c5f86', { map: null }));
  hole.position.y = 0.035;
  g.add(hole);
  const coil = new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => new THREE.Vector3(Math.cos(i * 1.1) * 0.08, i * 0.03, Math.sin(i * 1.1) * 0.08)));
  g.add(toonMesh(new THREE.TubeGeometry(coil, 60, 0.03, 6), '#c9cfd8', { outline: false, material: plastic('#c9cfd8') }));
  const shaft = toonMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), '#c9cfd8', { outline: 0.1, material: plastic('#c9cfd8') });
  shaft.position.y = 1.1;
  g.add(shaft);
  const handle = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 10), '#e2433f', { outline: 0.08, material: plastic('#e2433f') });
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 1.35;
  g.add(handle);
  return g;
}

/** Cracks spreading out from `from` (in the pond's own 0..1 texture space) over the ice. */
function crackTexture(cx: number, cy: number): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineCap = 'round';
  let seed = 17;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const crack = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    let px = x;
    let py = y;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.7;
      px += Math.cos(a) * (len / steps);
      py += Math.sin(a) * (len / steps);
      g.lineTo(px, py);
      if (depth > 0 && rand() < 0.25) crack(px, py, a + (rand() < 0.5 ? 0.8 : -0.8), len * 0.4, w * 0.6, depth - 1);
    }
    g.stroke();
  };
  for (let i = 0; i < 9; i++) crack(cx * size, cy * size, (i / 9) * Math.PI * 2 + rand() * 0.4, size * (0.35 + rand() * 0.25), 5, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- the view ----------

export class ToyView {
  private kind: ToyKind | null = null;
  private root: THREE.Group | null = null;
  private jack: ReturnType<typeof buildJack> | null = null;
  private wheel: THREE.Mesh | null = null;
  private head: THREE.Group | null = null;
  private ring: THREE.Mesh | null = null;
  private cracks: THREE.Mesh | null = null;
  private water: THREE.Group | null = null;
  private floes: THREE.Mesh[] = [];
  /** Round what you press: a glowing ring filling up while it recharges, pulsing when ready. */
  private fill: THREE.Mesh | null = null;
  private fillStep = -1;
  private fillRadius = 1;
  private readyGlow: THREE.Group | null = null;
  private readyParts: { glow: THREE.Mesh; halo: THREE.Mesh } | null = null;
  private track: THREE.Mesh | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly spray: (x: number, y: number, z: number, dx: number, dz: number) => void,
  ) {}

  clear(): void {
    this.root?.removeFromParent();
    this.root = this.jack = this.wheel = this.head = this.ring = this.cracks = this.water = null;
    this.floes = [];
    this.fill = null;
    this.fillStep = -1;
    this.readyGlow = null;
    this.readyParts = null;
    this.track = null;
    this.kind = null;
  }

  update(state: GameState, map: MapData, tick: number, time: number): void {
    const t = state.toy;
    if (!t) return this.clear();
    if (!this.root || this.kind !== t.kind) this.build(t, map);
    if (t.kind === 'jack') this.updateJack(t, tick, time);
    else if (t.kind === 'sprinkler') this.updateSprinkler(t, tick, time);
    else this.updateIce(t, tick, time);
    this.updateCooldown(t, tick, time);
  }

  /** How far it has recharged (0 just pressed, 1 ready), from when it was last pressed. */
  private updateCooldown(t: ToyState, tick: number, time: number): void {
    const T = config.toys;
    const rate = config.tickRate;
    const pressed =
      t.startTick < 0 ? 0 : t.kind === 'jack' ? t.startTick - T.jack.windup * rate : t.kind === 'icedrill' ? t.startTick - T.icedrill.windup * rate : t.startTick;
    const span = Math.max(1, t.readyTick - pressed);
    const ready = tick >= t.readyTick;
    const progress = ready ? 1 : Math.max(0, (tick - pressed) / span);
    // The filled part of the ring, rebuilt only when it has grown a step (64 to a full circle).
    const step = ready ? 64 : Math.floor(progress * 64);
    if (this.fill && step !== this.fillStep) {
      this.fillStep = step;
      this.fill.geometry.dispose();
      const r = this.fillRadius;
      // From the top round clockwise (as seen from the camera).
      this.fill.geometry = new THREE.RingGeometry(r - 0.06, r + 0.06, 64, 1, Math.PI / 2 - (step / 64) * Math.PI * 2, (step / 64) * Math.PI * 2).rotateX(-Math.PI / 2);
    }
    if (this.fill) this.fill.visible = !ready && step > 0;
    if (this.track) this.track.visible = !ready;
    if (this.readyGlow && this.readyParts) {
      this.readyGlow.visible = ready;
      (this.readyParts.glow.material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(time * 3) * 0.2;
      (this.readyParts.halo.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time * 3) * 0.1;
    }
  }

  /**
   * The ring round the toy, like the ones under loot: while it recharges, a plain gold arc fills a
   * dark track (no glow); once ready, the whole ring lights up with a soft glow, like loot's.
   */
  private buildCooldown(root: THREE.Group, x: number, z: number, y: number, radius: number): void {
    const g = new THREE.Group();
    g.position.set(x, z + 0.025, y);
    const flat = (inner: number, outer: number, mat: THREE.Material, y0: number) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64).rotateX(-Math.PI / 2), mat);
      m.position.y = y0;
      g.add(m);
      return m;
    };
    // While it recharges: a dark track with a plain gold arc filling it (drawn after the track,
    // or the track's shade dims the gold to brown).
    const track = flat(radius - 0.08, radius + 0.08, new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, transparent: true, opacity: 0.5, depthWrite: false }), 0);
    track.renderOrder = 1;
    const fill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffd23a', depthWrite: false, transparent: true, toneMapped: false }));
    fill.position.y = 0.004;
    fill.renderOrder = 2;
    fill.visible = false;
    g.add(fill);
    this.fill = fill;
    this.fillRadius = radius;
    this.track = track;
    // Ready: the very circle loot has, sized to the toy, breathing like it.
    const ready = new THREE.Group();
    const r = groundRing('#ffd23a');
    r.glow.scale.setScalar(radius / 0.72);
    ready.add(r.glow);
    g.add(ready);
    this.readyGlow = ready;
    this.readyParts = r;
    root.add(g);
  }

  private build(t: ToyState, map: MapData): void {
    this.clear();
    this.kind = t.kind;
    const root = new THREE.Group();
    if (t.kind === 'jack') {
      this.jack = buildJack();
      this.jack.root.position.set(t.at.x, t.z, t.at.y);
      root.add(this.jack.root);
      this.ring = warningRing(config.toys.jack.radius);
      this.ring.position.set(t.at.x, t.z + 0.03, t.at.y);
      root.add(this.ring);
    } else if (t.kind === 'sprinkler') {
      const tap = buildTap();
      tap.root.position.set(t.pos.x - 0.6, t.z, t.pos.y);
      tap.root.scale.setScalar(1.5);
      root.add(tap.root);
      this.wheel = tap.wheel;
      const s = buildSprinkler();
      s.root.position.set(t.at.x, t.z, t.at.y);
      s.root.scale.setScalar(1.6);
      root.add(s.root);
      this.head = s.head;
      root.add(hose(new THREE.Vector3(t.pos.x - 0.15, t.z + 0.6, t.pos.y), new THREE.Vector3(t.at.x, t.z, t.at.y)));
    } else {
      const drill = buildDrill();
      drill.position.set(t.pos.x, t.z, t.pos.y);
      root.add(drill);
      const pond = map.ice?.[0];
      if (pond) this.buildPond(root, pond, t);
    }
    // Round what it acts with: the box, the sprinkler out on the lawn (the tap sits against the
    // house wall), the drill.
    const at = t.kind === 'icedrill' ? t.pos : t.at;
    this.buildCooldown(root, at.x, t.z, at.y, t.kind === 'jack' ? 1.6 : 1);
    this.scene.add(root);
    this.root = root;
  }

  private buildPond(root: THREE.Group, pond: Circle, t: ToyState): void {
    const u = 0.5 + (t.pos.x - pond.center.x) / (pond.radius * 2);
    const v = 0.5 + (t.pos.y - pond.center.y) / (pond.radius * 2);
    const cracks = new THREE.Mesh(
      new THREE.CircleGeometry(pond.radius, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: crackTexture(u, v), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    );
    cracks.position.set(pond.center.x, 0.035, pond.center.y);
    cracks.visible = false;
    root.add(cracks);
    this.cracks = cracks;
    // Open water: dark and rippling, with chunks of ice bobbing in it.
    const water = new THREE.Group();
    water.position.set(pond.center.x, 0.04, pond.center.y);
    const ripples = tiled(waterTexture(), pond.radius / 4, pond.radius / 4);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(pond.radius - 0.1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#4f8fb8', map: ripples, transparent: true, opacity: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    );
    water.add(pool);
    const iceMat = makePlastic(toonMaterial('#eaf7ff', { map: null }));
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = pond.radius * (0.25 + ((i * 37) % 10) / 14);
      const floe = toonMesh(new THREE.CylinderGeometry(0.7 + (i % 3) * 0.35, 0.8 + (i % 3) * 0.35, 0.18, 6 + (i % 3)), '#eaf7ff', { outline: 0.04, material: iceMat });
      floe.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
      floe.rotation.y = i;
      water.add(floe);
      this.floes.push(floe);
    }
    water.visible = false;
    root.add(water);
    this.water = water;
  }

  private updateJack(t: ToyState, tick: number, time: number): void {
    const j = this.jack!;
    const winding = t.startTick >= 0 && tick < t.startTick;
    const out = t.startTick >= 0 && tick >= t.startTick && tick < t.endTick;
    // Winding up: the crank turns, the box shakes, the ring warns.
    if (winding) {
      const k = 1 - (t.startTick - tick) / (config.toys.jack.windup * config.tickRate);
      j.crank.rotation.x = -time * 9;
      j.box.rotation.z = Math.sin(time * 40) * 0.04 * (0.4 + k);
      j.box.position.y = Math.abs(Math.sin(time * 20)) * 0.04 * k;
    } else {
      j.box.rotation.z = 0;
      j.box.position.y = 0;
    }
    this.ring!.visible = winding;
    (this.ring!.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 12) * 0.3;
    // Popped: the lid flies open and the clown springs up, wobbling.
    const since = out ? (tick - t.startTick) / config.tickRate : 0;
    j.lid.rotation.x = out ? -2.2 : 0;
    const rise = out ? Math.min(1, since * 6) * (1 + Math.sin(since * 14) * Math.exp(-since * 3) * 0.25) : 0;
    j.clown.scale.set(1, Math.max(0.05, rise), 1);
    j.clown.visible = out;
    j.clown.position.y = out ? 1.0 : 0.3;
    j.clown.rotation.z = out ? Math.sin(since * 9) * Math.exp(-since * 2) * 0.35 : 0;
  }

  private updateSprinkler(t: ToyState, tick: number, time: number): void {
    const on = t.startTick >= 0 && tick >= t.startTick && tick < t.endTick;
    if (!on) return;
    const angle = (tick - t.startTick) * DT * config.toys.sprinkler.turnPerSecond;
    this.head!.rotation.y = -angle;
    this.wheel!.rotation.z = time * 3;
    // Water along the arc (the same direction the game pushes plushies in).
    for (let i = 0; i < 3; i++) {
      const a = angle + (Math.random() - 0.5) * ((config.toys.sprinkler.arcDegrees * Math.PI) / 180);
      this.spray(t.at.x, t.z + 0.4, t.at.y, Math.cos(a), Math.sin(a));
    }
  }

  private updateIce(t: ToyState, tick: number, time: number): void {
    const cracking = t.startTick >= 0 && tick < t.startTick;
    const open = t.startTick >= 0 && tick >= t.startTick && tick < t.endTick;
    if (this.cracks) {
      this.cracks.visible = cracking;
      const k = cracking ? 1 - (t.startTick - tick) / (config.toys.icedrill.windup * config.tickRate) : 0;
      (this.cracks.material as THREE.MeshBasicMaterial).opacity = Math.min(1, k * 1.4);
      this.cracks.scale.setScalar(0.3 + 0.7 * Math.min(1, k * 1.2));
    }
    if (this.water) {
      this.water.visible = open;
      // Freezing over at the end: the water fades back to ice.
      const left = (t.endTick - tick) / config.tickRate;
      const pool = this.water.children[0] as THREE.Mesh;
      (pool.material as THREE.MeshBasicMaterial).opacity = open ? Math.min(1, left / 3) : 0;
      this.floes.forEach((f, i) => {
        f.position.y = 0.05 + Math.sin(time * 1.5 + i) * 0.04;
        f.rotation.y = i + time * 0.1 * ((i % 2) * 2 - 1);
        f.visible = open && left > 1;
      });
    }
  }
}

function warningRing(radius: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.14, radius, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
  );
}
