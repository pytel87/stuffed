// Plush bodies with a silhouette of their own: each animal's body is turned on a lathe from a
// side profile (radius at each height). Every shape keeps the same fit points so any body works
// with any head, legs and arms: bottom near y = -0.37 (where the legs hang), about 0.36-0.42
// wide at shoulder height (y = 0.14, where the arms attach), and a top near y = 0.4 (under the
// head). Bodies are a little flatter front to back (DEPTH).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { darken, toonMaterial, toonMesh } from './toon.ts';

export type BodyShape = 'round' | 'pear' | 'tapered' | 'egg' | 'chunky' | 'barrel' | 'plump' | 'pin' | 'broad' | 'bell' | 'slim';

/** [radius, height] from bottom to top. */
const PROFILES: Record<BodyShape, [number, number][]> = {
  round: [[0, -0.37], [0.24, -0.34], [0.38, -0.2], [0.41, 0], [0.37, 0.18], [0.26, 0.34], [0, 0.4]],
  pear: [[0, -0.37], [0.31, -0.34], [0.46, -0.17], [0.44, 0.0], [0.35, 0.17], [0.22, 0.32], [0, 0.37]],
  tapered: [[0, -0.36], [0.26, -0.33], [0.39, -0.16], [0.39, 0.04], [0.34, 0.2], [0.22, 0.37], [0, 0.44]],
  egg: [[0, -0.37], [0.28, -0.33], [0.41, -0.14], [0.4, 0.06], [0.33, 0.25], [0.18, 0.38], [0, 0.42]],
  chunky: [[0, -0.37], [0.35, -0.35], [0.47, -0.17], [0.47, 0.05], [0.41, 0.23], [0.29, 0.35], [0, 0.38]],
  barrel: [[0, -0.37], [0.31, -0.35], [0.41, -0.24], [0.42, 0], [0.41, 0.21], [0.31, 0.34], [0, 0.38]],
  plump: [[0, -0.36], [0.3, -0.33], [0.45, -0.13], [0.44, 0.06], [0.36, 0.24], [0.22, 0.35], [0, 0.39]],
  pin: [[0, -0.37], [0.3, -0.34], [0.43, -0.18], [0.4, 0.0], [0.33, 0.16], [0.3, 0.3], [0.2, 0.4], [0, 0.43]],
  // Wider at the chest than the hips.
  broad: [[0, -0.37], [0.24, -0.35], [0.34, -0.22], [0.39, -0.02], [0.43, 0.14], [0.36, 0.29], [0, 0.39]],
  // Flaring out wide at the bottom.
  bell: [[0, -0.37], [0.4, -0.36], [0.48, -0.27], [0.44, -0.1], [0.38, 0.1], [0.3, 0.29], [0, 0.4]],
  // Narrow all the way up, a little in at the waist (still wide enough at the shoulders for arms).
  slim: [[0, -0.37], [0.22, -0.35], [0.32, -0.22], [0.31, -0.04], [0.34, 0.14], [0.27, 0.3], [0, 0.39]],
};

/** Bodies are this much flatter front to back. */
export const DEPTH = 0.9;

export interface ShapedBody {
  group: THREE.Group;
  /** Radius of the body at height `y`. */
  radiusAt(y: number): number;
  /** The front (or back, with `back`) surface point at (x, y), nudged out by `out`. */
  surface(x: number, y: number, out?: number, back?: boolean): THREE.Vector3;
  /** An oval patch `w` by `h` at height `y` lying flush on the front (or back), in `color`. */
  patch(color: string, w: number, h: number, y: number, back?: boolean): THREE.Mesh;
}

export interface BodyOptions {
  shape: BodyShape;
  main: string;
  belly: string;
  outline: string;
  /** Belly patch size and height (defaults suit most). */
  bellyW?: number;
  bellyH?: number;
  bellyY?: number;
  /** Stitch color around the belly (defaults to a darker main). */
  stitch?: string;
  /** No belly patch (or stitch) at all: bare all over. */
  bare?: boolean;
}

export function shapedBody(o: BodyOptions): ShapedBody {
  const profile = PROFILES[o.shape];
  // Smooth the profile (it's turned from this, below).
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  const points = curve.getPoints(24).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  // Measured on the smoothed outline, the body as it's drawn: along the profile's straight runs,
  // things laid on it sank where it bulges past them (a bee's stripes showed yellow through).
  const radiusAt = (y: number): number => {
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1]!;
      const p1 = points[i]!;
      if (y <= p1.y) return p0.x + ((p1.x - p0.x) * (y - p0.y)) / Math.max(1e-6, p1.y - p0.y);
    }
    return 0;
  };
  const surface = (x: number, y: number, out = 0.006, back = false): THREE.Vector3 => {
    const r = radiusAt(y);
    const z = DEPTH * Math.sqrt(Math.max(0, r * r - x * x)) + out;
    return new THREE.Vector3(x, y, back ? -z : z);
  };

  const geo = new THREE.LatheGeometry(points, 32);
  const g = new THREE.Group();
  const shell = toonMesh(geo, o.main, { outlineColor: o.outline });
  shell.scale.z = DEPTH;
  g.add(shell);
  // Its outline as turned (for the seam where the head sinks into it, see neckSeam).
  g.userData.profile = points.map((p) => [p.x, p.y]);

  const bottom = points[0]!.y;
  const top = points[points.length - 1]!.y;
  const patch = (color: string, w: number, h: number, y: number, back = false) => {
    const mesh = toonMesh(flushPatch(surface, bottom, top, w, h, y, back), color, { outline: false });
    mesh.userData.flat = true;
    return mesh;
  };
  if (o.bare) return { group: g, radiusAt, surface, patch };
  // Belly patch and a running stitch around it (merged: one draw call).
  const bw = o.bellyW ?? 0.22;
  const bh = o.bellyH ?? 0.23;
  const by = o.bellyY ?? -0.03;
  // Lying flush on the body (a flattened ball pressed into it sank in places and stuck out past
  // its edge in others, as the body curved away).
  g.add(patch(o.belly, bw, bh, by));
  const pieces: THREE.BufferGeometry[] = [];
  const place = new THREE.Matrix4();
  const e = 0.004;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * (bw + 0.03);
    const y = by + Math.sin(a) * (bh + 0.03);
    // Lying along the body where it curves away (turned only in the front's plane, stitches at
    // the sides stood out past its edge in a row of little teeth).
    const n = surface(x + e, y, 0).sub(surface(x - e, y, 0)).cross(surface(x, y + e, 0).sub(surface(x, y - e, 0))).normalize();
    const t = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
    t.addScaledVector(n, -t.dot(n)).normalize();
    const b = new THREE.Vector3().crossVectors(n, t);
    place.makeBasis(t, b, n).setPosition(surface(x, y));
    pieces.push(new THREE.BoxGeometry(0.05, 0.014, 0.014).applyMatrix4(place));
  }
  const stitch = new THREE.Mesh(mergeGeometries(pieces), toonMaterial(o.stitch ?? darken(o.main, 0.25), { map: null }));
  stitch.userData.flat = true;
  g.add(stitch);
  return { group: g, radiusAt, surface, patch };
}

/**
 * Where a head ball (`radius`, centered at `center` in the body's space) sinks into a body turned
 * from `profile` (see shapedBody): round the body, the highest point on it outside the ball. Null
 * if the ball doesn't reach the body all the way round.
 */
export function neckSeam(profile: readonly (readonly [number, number])[], center: THREE.Vector3, radius: number): THREE.Vector3[] | null {
  const SAMPLES = 48;
  const at = (i: number, a: number) => new THREE.Vector3(profile[i]![0] * Math.sin(a), profile[i]![1], profile[i]![0] * Math.cos(a) * DEPTH);
  const seam: THREE.Vector3[] = [];
  for (let k = 0; k < SAMPLES; k++) {
    const a = (k / SAMPLES) * Math.PI * 2;
    // Down the body from its top, to where it leaves the ball.
    let found: THREE.Vector3 | null = null;
    for (let i = profile.length - 1; i > 0 && !found; i--) {
      const hi = at(i, a);
      const lo = at(i - 1, a);
      if (hi.distanceTo(center) > radius) {
        if (i === profile.length - 1) return null; // its top sticks out of the head
        continue;
      }
      if (lo.distanceTo(center) <= radius) continue;
      let t0 = 0;
      let t1 = 1;
      for (let n = 0; n < 12; n++) {
        const t = (t0 + t1) / 2;
        if (hi.clone().lerp(lo, t).distanceTo(center) <= radius) t0 = t;
        else t1 = t;
      }
      found = hi.clone().lerp(lo, t1);
    }
    if (!found) return null;
    seam.push(found);
  }
  return seam;
}

/** An oval patch `bw` by `bh` at height `by`, filled with rings laid on the body's front surface
 *  (between `bottom` and `top`). */
function flushPatch(surface: ShapedBody['surface'], bottom: number, top: number, bw: number, bh: number, by: number, back = false): THREE.BufferGeometry {
  const RINGS = 8;
  const SPOKES = 48;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const put = (x: number, y: number) => {
    const p = surface(x, y, 0.004, back);
    pos.push(p.x, p.y, p.z);
    // Roughly as the lathe lays its UVs out (u round it, v bottom to top), so the weave matches.
    uv.push(Math.atan2(p.x, p.z / DEPTH) / (Math.PI * 2), (y - bottom) / (top - bottom));
  };
  put(0, by);
  for (let i = 1; i <= RINGS; i++) {
    for (let j = 0; j < SPOKES; j++) {
      const a = (j / SPOKES) * Math.PI * 2;
      put((Math.cos(a) * bw * i) / RINGS, by + (Math.sin(a) * bh * i) / RINGS);
    }
  }
  const at = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * SPOKES + (j % SPOKES));
  for (let j = 0; j < SPOKES; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let i = 1; i < RINGS; i++) {
    for (let j = 0; j < SPOKES; j++) idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // (Seen from behind, the same rings wind the other way round.)
  if (back) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2]!, idx[k + 1]!];
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
