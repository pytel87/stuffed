// What moves you around the map, drawn: trampolines, seesaws (tipping to the end that went down
// last), slides and the sled run (straight ramps, as the ride follows), zip lines (poles and a
// sagging cable) and hamster tubes (a clear arching tube between two mouths).
import * as THREE from 'three';
import type { GameState, MapData, RideDef } from '@stuffed/sim';
import { makePlastic, OUTLINE_COLOR, toonMaterial, toonMesh } from './toon.ts';

const plastic = (c: string) => makePlastic(toonMaterial(c, { map: null }));

function trampoline(radius: number): THREE.Group {
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
  const bed = toonMesh(new THREE.BoxGeometry(len, 0.12, width), sled ? '#ffffff' : '#e2433f', { outline: 0.03, material: toonMaterial(sled ? '#f4f9ff' : '#e2433f', { map: null }) });
  body.add(bed);
  if (!sled) {
    for (const s of [-1, 1]) {
      const rail = toonMesh(new THREE.BoxGeometry(len, 0.3, 0.1), '#ffd23a', { outline: 0.06, material: toonMaterial('#ffd23a', { map: null }) });
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
    // A little kicker at the bottom, and a red sled waiting at the top.
    const kick = toonMesh(new THREE.BoxGeometry(1, 0.5, width), '#f4f9ff', { outline: 0.04, material: toonMaterial('#f4f9ff', { map: null }) });
    kick.position.copy(b).add(new THREE.Vector3(0, 0.12, 0));
    kick.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    kick.rotation.z = 0.35;
    g.add(kick);
    const s = toonMesh(new THREE.BoxGeometry(1.1, 0.12, 0.6), '#e2433f', { outline: 0.06, material: plastic('#e2433f') });
    s.position.copy(a).add(new THREE.Vector3(0, 0.1, 0));
    s.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    g.add(s);
  }
  return g;
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
    pole.position.set(p.x, z + (top + 0.3) / 2, p.y);
    g.add(pole);
  }
  return g;
}

/** A hamster tube: a solid arching tube between its two mouths. */
function tube(r: RideDef): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push(new THREE.Vector3(r.from.x + (r.to.x - r.from.x) * t, 0.5 + 2.5 * 4 * t * (1 - t), r.from.y + (r.to.y - r.from.y) * t));
  }
  // Solid (you're hidden inside): a chunky orange plastic tube.
  // Built round its own middle, so its outline (a slightly bigger copy) stays around it.
  const mid = pts[Math.floor(pts.length / 2)]!.clone().setY(0);
  const local = pts.map((p) => p.clone().sub(mid));
  // No outline copy: scaled up, it stuck out past the ends as a dark block (the rims frame it).
  const shell = toonMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(local), 80, 0.55, 14, false), '#ff9f43', {
    outline: false,
    material: toonMaterial('#ff9f43', { map: null, side: THREE.DoubleSide }),
  });
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
  private tilts: number[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.root?.removeFromParent();
    this.root = null;
    this.planks = [];
    this.tilts = [];
    this.mapId = '';
  }

  update(map: MapData, state: GameState): void {
    if (this.mapId !== map.id) this.build(map);
    // Each seesaw tips toward the end that went down last.
    this.planks.forEach((plank, i) => {
      const s = state.seesaws[i];
      plank.rotation.z = s && s.tick >= 0 && s.down === 'b' ? -this.tilts[i]! : this.tilts[i]!;
    });
  }

  private build(map: MapData): void {
    this.clear();
    this.mapId = map.id;
    const root = new THREE.Group();
    for (const t of map.trampolines ?? []) {
      const v = trampoline(t.radius);
      v.position.set(t.center.x, 0, t.center.y);
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
    for (const r of map.rides ?? []) {
      if (r.kind === 'slide' || r.kind === 'sled') root.add(ramp(r));
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
