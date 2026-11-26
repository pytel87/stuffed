// What moves you around the map, drawn: trampolines, seesaws (tipping to the end that went down
// last), slides and the sled run (straight ramps, as the ride follows), zip lines (poles and a
// sagging cable), hamster tubes (a clear arching tube between two mouths) and catapults (spring
// launchers: the spring shoots up when it throws, and is pushed back down as it gets ready again).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CATAPULT_SIZE, config, slopeAt } from '@stuffed/sim';
import type { GameState, MapData, Player, RideDef } from '@stuffed/sim';
import { glowMap } from './loot-views.ts';
import { nextMark, outlineProp, snowTexture, softBox, tiled } from './props.ts';
import { evenOutlines, fadeObject, makePlastic, outlineMaterial, OUTLINE_COLOR, toonMaterial, toonMesh } from './toon.ts';

const plastic = (c: string) => makePlastic(toonMaterial(c, { map: null }));

function trampoline(radius: number, floor = 0): THREE.Group {
  const g = new THREE.Group();
  const frame = toonMesh(new THREE.TorusGeometry(radius, 0.12, 10, 40), '#3d7ff2', { outline: 0.06, material: plastic('#3d7ff2') });
  frame.rotation.x = Math.PI / 2;
  frame.position.y = 0.45;
  g.add(frame);
  const mat = toonMesh(new THREE.CircleGeometry(radius - 0.05, 40).rotateX(-Math.PI / 2), '#2a2630', { outline: false });
  mat.position.y = 0.4;
  g.add(mat);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.35, radius * 0.45, 32).rotateX(-Math.PI / 2), toonMaterial('#ffd23a', { map: null }));
  ring.position.y = 0.41;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8), '#c9cfd8', { outline: 0.1, material: plastic('#c9cfd8') });
    leg.position.set(Math.cos(a) * radius, 0.22, Math.sin(a) * radius);
    g.add(leg);
  }
  // One even outline round the whole thing (see outlineProp), pulled round its foot on what it stands on.
  outlineProp(g, nextMark(), 0.025, undefined, false, floor);
  return g;
}

/** The seesaw plank's middle, on top of its pivot. */
const PIVOT_Y = 0.6;

/** A seesaw between `a` and `b`: the plank (tipped by the caller) on a red pivot. */
function seesaw(a: THREE.Vector3, b: THREE.Vector3): { root: THREE.Group; plank: THREE.Group } {
  const root = new THREE.Group();
  root.position.copy(a).add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b) + 1;
  root.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  const pivot = toonMesh(new THREE.ConeGeometry(0.38, 0.6, 4), '#e2433f', { outline: 0.06, material: plastic('#e2433f') });
  pivot.position.y = 0.3;
  pivot.rotation.y = Math.PI / 4;
  root.add(pivot);
  const plank = new THREE.Group();
  plank.position.y = PIVOT_Y;
  const board = toonMesh(new THREE.BoxGeometry(len, 0.12, 0.6), '#f7c331', { outline: 0.04, material: plastic('#f7c331') });
  plank.add(board);
  for (const s of [-1, 1]) {
    const handle = toonMesh(new THREE.TorusGeometry(0.16, 0.04, 8, 14, Math.PI), '#3d7ff2', { outline: 0.1, material: plastic('#3d7ff2') });
    handle.position.set(s * (len / 2 - 0.6), 0.06, 0);
    handle.rotation.y = Math.PI / 2;
    plank.add(handle);
  }
  root.add(plank);
  // One even outline round the whole thing (see outlineProp).
  outlineProp(root, nextMark(), 0.025);
  return { root, plank };
}

/** A straight sloped ramp from `r.from` to `r.to`: a slide (with rails) or a snowy sled run. */
function ramp(r: RideDef): THREE.Group {
  const g = new THREE.Group();
  const a = new THREE.Vector3(r.from.x, r.from.z, r.from.y);
  const b = new THREE.Vector3(r.to.x, r.to.z, r.to.y);
  const sled = r.kind === 'sled';
  const len = a.distanceTo(b);
  const width = sled ? 2.2 : 1.1;
  const body = new THREE.Group();
  // Its top face along the slope plushies walk on (the board is 0.12 thick).
  body.position.copy(a).add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.06, 0));
  // Turned to face down the ramp, then tilted down its slope (its width stays level).
  const horiz = Math.hypot(b.x - a.x, b.z - a.z);
  body.rotation.order = 'YZX';
  body.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  body.rotation.z = Math.atan2(b.y - a.y, horiz);
  // Matte (a glossy slide glared white on its lower half).
  // Rounded, with snug outlines: scaled-up copies stuck out past their long ends as dark blocks.
  const bed = softBox(len, 0.12, width, 0.05, toonMaterial(sled ? '#ffffff' : '#e2433f', { map: sled ? tiled(snowTexture(), len / 3, width / 3) : null }));
  body.add(bed);
  if (!sled) {
    for (const s of [-1, 1]) {
      const rail = softBox(len, 0.3, 0.12, 0.059, toonMaterial('#ffd23a', { map: null }));
      rail.position.set(0, 0.18, s * (width / 2));
      body.add(rail);
    }
  }
  g.add(body);
  // No shadow: a long thin slope casts a soft grey band over the lawn that reads as a smudge.
  body.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  if (sled) {
    // A little kicker at the bottom.
    const kick = toonMesh(new THREE.BoxGeometry(1, 0.5, width), '#f4f9ff', { outline: 0.04, material: toonMaterial('#f4f9ff', { map: null }) });
    kick.position.copy(b).add(new THREE.Vector3(0, 0.12, 0));
    kick.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    kick.rotation.z = 0.35;
    g.add(kick);
  }
  return g;
}

/** The ready glow's color (the toys' too). */
const GLOW = new THREE.Color('#ffd23a');

/**
 * The lighthouse's door (a lookout's way in), lit up like a toy that's ready: the door itself
 * glowing gold, breathing, and a soft gold light on the sand in front. On the tower's face (round
 * `to`, facing `from`), over the painted door, in its shape.
 */
function lookoutDoor(r: RideDef): { root: THREE.Group; door: THREE.MeshToonMaterial; light: THREE.MeshBasicMaterial; track: THREE.Mesh; fill: THREE.Mesh; radius: number; step: number } {
  const root = new THREE.Group();
  // (On what its foot stands on: the lighthouse's on the sand, a crow's nest's on the deck.)
  root.position.set(r.to.x, r.from.z, r.to.y);
  root.rotation.y = Math.atan2(r.from.x - r.to.x, r.from.y - r.to.y);
  // The door: 0.66 wide, 1.18 tall, its foot 0.6 up (on the stone foot), on the tower's face.
  const w = 0.66;
  const h = 1.18;
  const arch = new THREE.Shape();
  arch.moveTo(-w / 2, 0);
  arch.lineTo(w / 2, 0);
  arch.lineTo(w / 2, h - w / 2);
  arch.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  arch.lineTo(-w / 2, 0);
  const door = toonMaterial('#6b4128', { map: null });
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(arch, 12), door);
  // Just over the painted door (the tower's face is ~1.39 out there).
  panel.position.set(0, 0.6, 1.425);
  // (A crow's nest has no door: you climb its mast's ladder.)
  if (!r.nest) root.add(panel);
  const light = new THREE.MeshBasicMaterial({ color: GLOW, map: glowMap(), transparent: true, depthWrite: false, toneMapped: false });
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32).rotateX(-Math.PI / 2), light);
  spot.position.set(0, 0.03, Math.hypot(r.from.x - r.to.x, r.from.y - r.to.y) - 0.1);
  root.add(spot);
  // The ring round its foot while you have to wait (as round a recharging toy): a dark track, a gold
  // arc filling it from the top round clockwise (as seen from the camera).
  const radius = Math.hypot(r.from.x - r.to.x, r.from.y - r.to.y) + 0.1;
  const ring = new THREE.Group();
  ring.rotation.y = -root.rotation.y;
  ring.position.y = 0.025;
  const track = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.08, radius + 0.08, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  track.renderOrder = 1;
  track.visible = false;
  const fill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffd23a', depthWrite: false, transparent: true, toneMapped: false }));
  fill.position.y = 0.004;
  fill.renderOrder = 2;
  fill.visible = false;
  ring.add(track, fill);
  root.add(ring);
  return { root, door, light, track, fill, radius, step: -1 };
}

/** A zip line: a pole at each end and a cable sagging between them. */
function zipLine(r: RideDef): THREE.Group {
  const g = new THREE.Group();
  const top = 1.9;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push(new THREE.Vector3(r.from.x + (r.to.x - r.from.x) * t, r.from.z + (r.to.z - r.from.z) * t - 0.8 * 4 * t * (1 - t) + top, r.from.y + (r.to.y - r.from.y) * t));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.03, 6), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR })));
  for (const [p, z] of [[r.from, r.from.z], [r.to, r.to.z]] as const) {
    const pole = toonMesh(new THREE.CylinderGeometry(0.09, 0.11, top + 0.3, 8), '#a8743f', { outline: 0.06 });
    // As thick an outline as everything else (a share of a thin pole's size was a hairline).
    evenOutlines(pole, 0.025);
    pole.position.set(p.x, z + (top + 0.3) / 2, p.y);
    g.add(pole);
  }
  return g;
}

/** The spring's height squashed down (loaded, ready to throw) and sprung up (it just threw). */
const SQUASHED = 0.29;
const SPRUNG = 1.35;
/** The base's height, the platform's thickness, and how far it leans toward the throw. */
const BASE = 0.36;
/** The base stands this high on its little feet (it reads as standing, not lying flat). */
const LIFT = 0.12;
const PLATFORM = 0.14;
const LEAN = 0.18;
const RINGS = 6;

/**
 * A spring launcher throwing toward +x (turned by the caller), in bright toy colors: a rounded teal
 * base, a hot-pink slinky spring, and on top a round red platform with a sunny yellow rim, leaning
 * a little toward the throw, with a white arrow painted the way it throws. A plush is loaded in the platform's middle.
 */
function catapult(): { root: THREE.Group; rings: THREE.Mesh[]; top: THREE.Group } {
  const root = new THREE.Group();
  const size = CATAPULT_SIZE;
  const base = toonMesh(new RoundedBoxGeometry(size * 0.9, BASE, size * 0.9, 3, 0.12), '#22c3b0', { outline: 0.03, material: plastic('#22c3b0') });
  base.position.y = LIFT + BASE / 2;
  root.add(base);
  // Little round feet at the corners.
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    const foot = toonMesh(new THREE.SphereGeometry(0.16, 14, 10), '#ff4f9a', { outline: 0.08, material: plastic('#ff4f9a') });
    foot.scale.y = 0.6;
    foot.position.set(x * size * 0.36, 0.1, z * size * 0.36);
    root.add(foot);
  }
  // The spring: a stack of rings (they keep their shape however far apart it is).
  const rings: THREE.Mesh[] = [];
  const ring = new THREE.TorusGeometry(0.42, 0.075, 10, 28).rotateX(Math.PI / 2);
  for (let i = 0; i < RINGS; i++) {
    const r = toonMesh(ring, '#ff4f9a', { outline: 0.06, material: plastic('#ff4f9a') });
    root.add(r);
    rings.push(r);
  }
  // The platform: a red disc with a sunny yellow rim and a white arrow on top.
  const top = new THREE.Group();
  const lean = new THREE.Group();
  lean.rotation.z = -LEAN;
  top.add(lean);
  const disc = toonMesh(new THREE.CylinderGeometry(0.78, 0.78, PLATFORM, 32), '#ff5148', { outline: 0.03, material: plastic('#ff5148') });
  disc.position.y = PLATFORM / 2;
  lean.add(disc);
  const rim = toonMesh(new THREE.TorusGeometry(0.78, 0.075, 10, 40).rotateX(Math.PI / 2), '#ffd21f', { outline: 0.06, material: plastic('#ffd21f') });
  rim.position.y = PLATFORM / 2;
  lean.add(rim);
  const arrow = new THREE.Shape();
  arrow.moveTo(0.5, 0);
  arrow.lineTo(0.12, 0.3);
  arrow.lineTo(0.12, 0.12);
  arrow.lineTo(-0.42, 0.12);
  arrow.lineTo(-0.42, -0.12);
  arrow.lineTo(0.12, -0.12);
  arrow.lineTo(0.12, -0.3);
  arrow.closePath();
  const paint = new THREE.Mesh(new THREE.ShapeGeometry(arrow).rotateX(-Math.PI / 2), toonMaterial('#ffffff', { map: null }));
  paint.position.y = PLATFORM + 0.005;
  lean.add(paint);
  root.add(top);
  // One even outline round it, with an open foot like every standing prop (see outlineProp).
  outlineProp(root, nextMark(), 0.025);
  return { root, rings, top };
}

/** Seconds the spring takes to shoot up, and to be pushed back down before it's ready. */
const SNAP = 0.12;
const WIND = 1.5;

/** The spring's height `since` seconds after it threw (with `cooldown` seconds until it's ready). */
function springHeight(since: number | null, cooldown: number): number {
  if (since === null || since >= cooldown) return SQUASHED;
  if (since < SNAP) return SQUASHED + (SPRUNG - SQUASHED) * (1 - (1 - since / SNAP) ** 2);
  const left = cooldown - since;
  if (left > WIND) {
    // A wobble as it settles, sprung up.
    const after = since - SNAP;
    return SPRUNG + 0.15 * Math.sin(after * 18) * Math.exp(-after * 4);
  }
  const k = 1 - left / WIND;
  return SPRUNG + (SQUASHED - SPRUNG) * k * k * (3 - 2 * k);
}

/** Stretches a launcher's spring to `height`, with its platform on top. */
function setSpring(v: { rings: THREE.Mesh[]; top: THREE.Group }, height: number): void {
  v.rings.forEach((r, i) => {
    r.position.y = LIFT + BASE + 0.04 + ((i + 0.5) / RINGS) * height;
  });
  v.top.position.y = LIFT + BASE + 0.04 + height;
}

/** A hamster tube: a solid arching tube between its two mouths. */
function tube(r: RideDef): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push(new THREE.Vector3(r.from.x + (r.to.x - r.from.x) * t, 0.5 + 2.5 * 4 * t * (1 - t), r.from.y + (r.to.y - r.from.y) * t));
  }
  // Solid (you're hidden inside): a chunky orange plastic tube, built round its own middle.
  const mid = pts[Math.floor(pts.length / 2)]!.clone().setY(0);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().sub(mid)));
  const shell = toonMesh(new THREE.TubeGeometry(curve, 80, 0.55, 14, false), '#ff9f43', {
    outline: false,
    material: toonMaterial('#ff9f43', { map: null, side: THREE.DoubleSide }),
  });
  // Its outline: a slightly fatter tube along the same curve (a scaled-up copy stuck out past its
  // ends as a dark block); the rims frame its open ends.
  shell.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.55 + 0.035, 14, false), outlineMaterial(OUTLINE_COLOR)));
  shell.position.copy(mid);
  g.add(shell);
  for (const p of [pts[0]!, pts[pts.length - 1]!]) {
    const rim = toonMesh(new THREE.TorusGeometry(0.58, 0.09, 8, 24), '#ff7ac8', { outline: 0.06, material: plastic('#ff7ac8') });
    rim.position.copy(p);
    rim.lookAt(p.clone().add(p === pts[0] ? pts[0]!.clone().sub(pts[1]!) : pts[pts.length - 1]!.clone().sub(pts[pts.length - 2]!)));
    g.add(rim);
  }
  return g;
}

export class RideViews {
  private root: THREE.Group | null = null;
  private mapId = '';
  private planks: THREE.Group[] = [];
  /** Each slide or sled run, and how faded it is (a plush under it shows through). */
  private ramps: { ride: RideDef; group: THREE.Group; fade: number }[] = [];
  private tilts: number[] = [];
  /** Each catapult's spring and platform, by its ride's index. */
  private launchers: { ride: number; rings: THREE.Mesh[]; top: THREE.Group }[] = [];
  /** Each lookout's glowing doorway, by its ride's index. */
  private doors: ({ ride: number } & ReturnType<typeof lookoutDoor>)[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.root?.removeFromParent();
    this.root = null;
    this.planks = [];
    this.tilts = [];
    this.ramps = [];
    this.launchers = [];
    this.doors = [];
    this.mapId = '';
  }

  /** `viewer`: the plush we follow; a slide it stands under fades so it can be seen. */
  /** `you`: the plush we follow (a lookout shows how long until it may go up). */
  update(map: MapData, state: GameState, viewer?: { pos: { x: number; y: number }; z: number }, you?: Player): void {
    if (this.mapId !== map.id) this.build(map);
    for (const r of this.ramps) {
      const h = viewer ? slopeAt(r.ride, viewer.pos) : null;
      const above = h !== null && h > viewer!.z + 1;
      r.fade += ((above ? 0.3 : 1) - r.fade) * 0.25;
      if (Math.abs(r.fade - (above ? 0.3 : 1)) < 0.02) r.fade = above ? 0.3 : 1;
      fadeObject(r.group, r.fade);
    }
    // Each seesaw tips toward the end that went down last.
    this.planks.forEach((plank, i) => {
      const s = state.seesaws[i];
      plank.rotation.z = s && s.tick >= 0 && s.down === 'b' ? -this.tilts[i]! : this.tilts[i]!;
    });
    // A lookout's door glows like a ready toy when you may go up (breathing gold, a light on the sand
    // in front). While someone else is up there, a ring round its foot fills up till they come down,
    // like a toy's recharging.
    const t = performance.now() / 1000;
    for (const d of this.doors) {
      const up = state.players.find((p) => p.alive && p.ride?.index === d.ride);
      const wait = up?.ride && up.id !== you?.id ? ([up.ride.endTick, up.ride.endTick - up.ride.startTick] as const) : null;
      const ready = !wait && up?.id !== you?.id;
      d.door.emissive.copy(GLOW).multiplyScalar(ready ? 0.32 + Math.sin(t * 3) * 0.14 : 0);
      d.light.visible = ready;
      d.light.opacity = 0.65 + Math.sin(t * 3) * 0.2;
      const progress = wait ? Math.max(0, Math.min(1, 1 - (wait[0] - state.tick) / Math.max(1, wait[1]))) : 1;
      const step = Math.floor(progress * 64);
      d.track.visible = !!wait;
      d.fill.visible = !!wait && step > 0;
      if (wait && step !== d.step) {
        d.step = step;
        d.fill.geometry.dispose();
        d.fill.geometry = new THREE.RingGeometry(d.radius - 0.06, d.radius + 0.06, 64, 1, Math.PI / 2 - (step / 64) * Math.PI * 2, (step / 64) * Math.PI * 2).rotateX(-Math.PI / 2);
      }
    }
    for (const v of this.launchers) {
      const c = state.catapults.find((x) => x.ride === v.ride);
      const since = c && c.firedTick >= 0 ? (state.tick - c.firedTick) / config.tickRate : null;
      setSpring(v, springHeight(since, config.rides.catapultCooldown));
    }
  }

  private build(map: MapData): void {
    this.clear();
    this.mapId = map.id;
    const root = new THREE.Group();
    for (const t of map.trampolines ?? []) {
      const v = trampoline(t.radius, t.z ?? 0);
      v.position.set(t.center.x, t.z ?? 0, t.center.y);
      root.add(v);
    }
    for (const s of map.seesaws ?? []) {
      const v = seesaw(new THREE.Vector3(s.a.x, 0, s.a.y), new THREE.Vector3(s.b.x, 0, s.b.y));
      root.add(v.root);
      this.planks.push(v.plank);
      // Tipped just far enough for its low end to rest on the ground.
      const half = (Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) + 1) / 2;
      this.tilts.push(Math.asin(Math.min(1, (PIVOT_Y - 0.06) / half)));
    }
    const seen = new Set<string>();
    (map.rides ?? []).forEach((r, index) => {
      if (r.kind !== 'catapult') return;
      const v = catapult();
      // Its platform's middle over the ride's start, throwing toward its end.
      v.root.position.set(r.from.x, 0, r.from.y);
      v.root.rotation.y = -Math.atan2(r.to.y - r.from.y, r.to.x - r.from.x);
      setSpring(v, SQUASHED);
      root.add(v.root);
      this.launchers.push({ ride: index, rings: v.rings, top: v.top });
    });
    (map.rides ?? []).forEach((r, index) => {
      if (r.kind !== 'lookout') return;
      const door = lookoutDoor(r);
      root.add(door.root);
      this.doors.push({ ride: index, ...door });
    });
    for (const r of map.rides ?? []) {
      if (r.kind === 'catapult' || r.kind === 'lookout') continue;
      if (r.kind === 'slide' || r.kind === 'sled') {
        const group = ramp(r);
        root.add(group);
        this.ramps.push({ ride: r, group, fade: 1 });
      }
      else {
        // A zip line or a tube both ways is one line or tube.
        const key = [r.from.x, r.from.y, r.to.x, r.to.y].map((n) => n.toFixed(1)).sort().join();
        if (seen.has(key)) continue;
        seen.add(key);
        root.add(r.kind === 'zip' ? zipLine(r) : tube(r));
      }
    }
    this.scene.add(root);
    this.root = root;
  }
}
