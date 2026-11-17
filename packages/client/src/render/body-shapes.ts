// Plush bodies with a silhouette of their own: each animal's body is turned on a lathe from a
// side profile (radius at each height). Every shape keeps the same fit points so any body works
// with any head, legs and arms: bottom near y = -0.37 (where the legs hang), about 0.36-0.42
// wide at shoulder height (y = 0.14, where the arms attach), and a top near y = 0.4 (under the
// head). Bodies are a little flatter front to back (DEPTH).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { darken, toonMaterial, toonMesh } from './toon.ts';

export type BodyShape = 'round' | 'pear' | 'tapered' | 'egg' | 'chunky' | 'barrel' | 'plump' | 'pin' | 'broad' | 'bell';

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
};

/** Bodies are this much flatter front to back. */
export const DEPTH = 0.9;

export interface ShapedBody {
  group: THREE.Group;
  /** Radius of the body at height `y`. */
  radiusAt(y: number): number;
  /** The front (or back, with `back`) surface point at (x, y), nudged out by `out`. */
  surface(x: number, y: number, out?: number, back?: boolean): THREE.Vector3;
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
}

export function shapedBody(o: BodyOptions): ShapedBody {
  const profile = PROFILES[o.shape];
  const radiusAt = (y: number): number => {
    for (let i = 1; i < profile.length; i++) {
      const [r1, y1] = profile[i]!;
      const [r0, y0] = profile[i - 1]!;
      if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
    }
    return 0;
  };
  const surface = (x: number, y: number, out = 0.006, back = false): THREE.Vector3 => {
    const r = radiusAt(y);
    const z = DEPTH * Math.sqrt(Math.max(0, r * r - x * x)) + out;
    return new THREE.Vector3(x, y, back ? -z : z);
  };

  // Smooth the profile, then turn it.
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  const points = curve.getPoints(24).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const geo = new THREE.LatheGeometry(points, 32);
  const g = new THREE.Group();
  const shell = toonMesh(geo, o.main, { outlineColor: o.outline });
  shell.scale.z = DEPTH;
  g.add(shell);

  // Belly patch and a running stitch around it (merged: one draw call).
  const bw = o.bellyW ?? 0.22;
  const bh = o.bellyH ?? 0.23;
  const by = o.bellyY ?? -0.03;
  const patch = toonMesh(new THREE.SphereGeometry(1, 24, 16), o.belly, { outline: false });
  patch.scale.set(bw, bh, 0.1);
  patch.position.copy(surface(0, by, -0.07));
  g.add(patch);
  const pieces: THREE.BufferGeometry[] = [];
  const place = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * (bw + 0.03);
    const y = by + Math.sin(a) * (bh + 0.03);
    turn.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2);
    pieces.push(new THREE.BoxGeometry(0.05, 0.014, 0.014).applyMatrix4(place.compose(surface(x, y), turn, new THREE.Vector3(1, 1, 1))));
  }
  g.add(new THREE.Mesh(mergeGeometries(pieces), toonMaterial(o.stitch ?? darken(o.main, 0.25), { map: null })));
  return { group: g, radiusAt, surface };
}
