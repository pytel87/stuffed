// Phones and tablets draw plushies with fewer triangles and without real shadows (the soft blob
// under each plush stays). Plushies are small on a phone screen, and a crowd of them is what slows
// older iPads down. ?detail=low tries it on a computer; ?detail=high turns it off on a phone.
import * as THREE from 'three';

const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('detail');
const handheld = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export const LOW_DETAIL = param === 'low' || (handheld && param !== 'high');

/** Share of the segments kept in each direction (about 40% of the triangles). */
const KEEP = 0.62;
const fewer = (n: number, min: number) => Math.max(min, Math.round(n * KEEP));

/** The same shape with fewer segments, or null if it isn't one we rebuild. */
function rebuild(g: THREE.BufferGeometry): THREE.BufferGeometry | null {
  if (g instanceof THREE.SphereGeometry) {
    const p = g.parameters;
    if (p.widthSegments <= 12) return null;
    return new THREE.SphereGeometry(p.radius, fewer(p.widthSegments, 12), fewer(p.heightSegments, 8), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
  }
  if (g instanceof THREE.TorusGeometry) {
    const p = g.parameters;
    if (p.tubularSegments <= 12) return null;
    return new THREE.TorusGeometry(p.radius, p.tube, fewer(p.radialSegments, 4), fewer(p.tubularSegments, 12), p.arc);
  }
  if (g instanceof THREE.CylinderGeometry) {
    const p = g.parameters;
    if (p.radialSegments <= 10) return null;
    return new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, fewer(p.radialSegments, 10), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
  }
  if (g instanceof THREE.LatheGeometry) {
    const p = g.parameters;
    if (p.segments <= 14) return null;
    return new THREE.LatheGeometry(p.points, fewer(p.segments, 14), p.phiStart, p.phiLength);
  }
  return null;
}

/**
 * Whether `g` is still exactly what its parameters build (not scaled, turned or moved after),
 * so the rebuilt shape lands in the same place.
 */
function untouched(g: THREE.BufferGeometry, fresh: THREE.BufferGeometry): boolean {
  const a = g.attributes.position;
  const b = fresh.attributes.position;
  if (!a || !b || a.count !== b.count) return false;
  for (let i = 0; i < a.array.length; i++) if (Math.abs(a.array[i]! - b.array[i]!) > 1e-5) return false;
  return true;
}

/** Rebuilds a freshly built part's round shapes with fewer segments (outline hulls share them). */
export function coarsen(part: THREE.Object3D): void {
  if (!LOW_DETAIL) return;
  const done = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  part.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    let low = done.get(g);
    if (low === undefined) {
      low = g;
      const same = cloneOf(g);
      if (same && untouched(g, same)) low = rebuild(g) ?? g;
      same?.dispose();
      done.set(g, low);
    }
    o.geometry = low;
  });
}

/** A fresh build from the same parameters (to check nothing moved the original). */
function cloneOf(g: THREE.BufferGeometry): THREE.BufferGeometry | null {
  if (g instanceof THREE.SphereGeometry) {
    const p = g.parameters;
    return new THREE.SphereGeometry(p.radius, p.widthSegments, p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
  }
  if (g instanceof THREE.TorusGeometry) {
    const p = g.parameters;
    return new THREE.TorusGeometry(p.radius, p.tube, p.radialSegments, p.tubularSegments, p.arc);
  }
  if (g instanceof THREE.CylinderGeometry) {
    const p = g.parameters;
    return new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
  }
  if (g instanceof THREE.LatheGeometry) {
    const p = g.parameters;
    return new THREE.LatheGeometry(p.points, p.segments, p.phiStart, p.phiLength);
  }
  return null;
}
