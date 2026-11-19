// Fewer draw calls per plush: a part is built from many small meshes (eyes, glints, stitches,
// outlines), each its own draw call, twice with shadows. This bakes the pieces that never move
// on their own into one mesh per look (same material settings), leaving pivots that animate
// (leg hips) as their own merged groups.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Mat = THREE.MeshToonMaterial | THREE.MeshBasicMaterial;

/** Pieces drawn the same way can share a mesh. */
function lookKey(mesh: THREE.Mesh, m: THREE.Material): string | null {
  if (!(m instanceof THREE.MeshToonMaterial || m instanceof THREE.MeshBasicMaterial)) return null;
  return [
    m.type,
    m.color.getHexString(),
    m.map?.uuid ?? '-',
    m.side,
    m.transparent ? m.opacity : 1,
    m.blending,
    m.depthWrite,
    m.toneMapped,
    mesh.castShadow,
    mesh.receiveShadow,
    mesh.renderOrder,
    m.customProgramCacheKey(),
    // Stencil settings (outlines drawn only round a model): pieces that differ can't share a mesh.
    m.stencilWrite ? `${m.stencilRef}/${m.stencilFunc}/${m.stencilZPass}` : '-',
  ].join('|');
}

/** A mesh's pieces: one per material (a multi-material box has one per face group). */
function piecesOf(mesh: THREE.Mesh): { material: Mat; geometry: THREE.BufferGeometry }[] | null {
  const mats = mesh.material;
  if (!Array.isArray(mats)) return [{ material: mats as Mat, geometry: mesh.geometry }];
  const g = mesh.geometry;
  if (!g.index || g.groups.length === 0) return null;
  return g.groups.map((group) => {
    const part = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) part.setAttribute(name, attr);
    part.setIndex(Array.from(g.index!.array.slice(group.start, group.start + group.count)));
    return { material: mats[group.materialIndex ?? 0] as Mat, geometry: part };
  });
}

/** A copy with only position, normal and uv, unindexed, in `matrix` space (winding kept). */
function baked(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', src.getAttribute('position').clone());
  const normal = src.getAttribute('normal');
  out.setAttribute('normal', normal ? normal.clone() : new THREE.Float32BufferAttribute(src.getAttribute('position').count * 3, 3));
  const uv = src.getAttribute('uv');
  out.setAttribute('uv', uv ? uv.clone() : new THREE.Float32BufferAttribute(src.getAttribute('position').count * 2, 2));
  out.applyMatrix4(matrix);
  // A mirrored transform turns triangles inside out; swap two corners back.
  if (matrix.determinant() < 0) {
    for (const name of ['position', 'normal', 'uv']) {
      const a = out.getAttribute(name) as THREE.BufferAttribute;
      const n = a.itemSize;
      for (let t = 0; t < a.count; t += 3) {
        for (let k = 0; k < n; k++) {
          const i1 = (t + 1) * n + k;
          const i2 = (t + 2) * n + k;
          const tmp = a.array[i1]!;
          a.array[i1] = a.array[i2]!;
          a.array[i2] = tmp;
        }
      }
    }
  }
  return out;
}

/** Merges the meshes under `container` (not under any of `pivots`) into one mesh per look. */
function mergeUnder(container: THREE.Object3D, pivots: Set<THREE.Object3D>): void {
  const toLocal = new THREE.Matrix4().copy(container.matrixWorld).invert();
  const groups = new Map<string, { first: THREE.Mesh; material: Mat; pieces: THREE.BufferGeometry[]; meshes: Set<THREE.Mesh> }>();
  const visit = (o: THREE.Object3D) => {
    for (const child of o.children) {
      if (pivots.has(child) || !child.visible) continue;
      if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh) && !(child instanceof THREE.SkinnedMesh)) {
        // Tiny bits cast no shadow (as PlushView trims them); decide before they merge into a big mesh.
        if (child.castShadow) {
          if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
          if (child.geometry.boundingSphere!.radius < 0.12) child.castShadow = false;
        }
        const pieces = piecesOf(child);
        const keys = pieces?.map((p) => lookKey(child, p.material));
        if (pieces && keys && keys.every((k) => k !== null)) {
          const matrix = new THREE.Matrix4().multiplyMatrices(toLocal, child.matrixWorld);
          pieces.forEach((piece, i) => {
            let g = groups.get(keys[i]!);
            if (!g) groups.set(keys[i]!, (g = { first: child, material: piece.material, pieces: [], meshes: new Set() }));
            g.pieces.push(baked(piece.geometry, matrix));
            g.meshes.add(child);
          });
        }
      }
      visit(child);
    }
  };
  visit(container);
  // Every look becomes one mesh (a look with one piece still costs just one draw call).
  const built: THREE.Mesh[] = [];
  for (const g of groups.values()) {
    const geometry = mergeGeometries(g.pieces);
    if (!geometry) return; // Mismatched pieces (shouldn't happen): leave this part as it was.
    const mesh = new THREE.Mesh(geometry, g.material);
    mesh.castShadow = g.first.castShadow;
    mesh.receiveShadow = g.first.receiveShadow;
    mesh.renderOrder = g.first.renderOrder;
    if (g.first.name === 'outline') mesh.name = 'outline';
    built.push(mesh);
  }
  const merged = new Set<THREE.Object3D>();
  for (const g of groups.values()) for (const m of g.meshes) merged.add(m);
  for (const mesh of built) container.add(mesh);
  // Drop the merged originals; anything else they held (unmerged pieces, pivots) moves up.
  for (const m of merged) {
    for (const child of [...m.children]) {
      if (merged.has(child)) continue;
      let home = m.parent;
      while (home && merged.has(home)) home = home.parent;
      home?.attach(child);
    }
  }
  for (const m of merged) m.removeFromParent();
}

/** Bakes a freshly built part; `pivots` (e.g. swinging hips) keep moving, merged inside. */
export function mergeStatic(part: THREE.Object3D, pivots: readonly THREE.Object3D[] = []): void {
  part.updateMatrixWorld(true);
  const set = new Set(pivots);
  mergeUnder(part, set);
  for (const p of pivots) mergeUnder(p, set);
}
