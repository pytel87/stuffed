// Shared toon look: 3-step light ramp, a felt texture, and inverted-hull outlines.
import * as THREE from 'three';

export const OUTLINE_COLOR = '#2a1f2d';

let gradient: THREE.DataTexture | null = null;
let felt: THREE.CanvasTexture | null = null;
const outlineMaterials = new Map<string, THREE.MeshBasicMaterial>();

/** Three flat light tones (shadow, mid, lit); NearestFilter keeps the bands hard. */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([95, 180, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function feltTexture(): THREE.CanvasTexture {
  if (!felt) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, size, size);
    let seed = 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i++) {
      const v = Math.round(205 + rand() * 50);
      g.strokeStyle = `rgb(${v},${v},${v})`;
      g.lineWidth = 0.6 + rand();
      const x = rand() * size;
      const y = rand() * size;
      const a = rand() * Math.PI * 2;
      const len = 1 + rand() * 4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    felt = new THREE.CanvasTexture(canvas);
    felt.wrapS = felt.wrapT = THREE.RepeatWrapping;
    felt.colorSpace = THREE.SRGBColorSpace;
  }
  return felt;
}

export interface ToonMaterialOptions {
  map?: THREE.Texture | null;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

export function toonMaterial(color: THREE.ColorRepresentation, opts: ToonMaterialOptions = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    map: opts.map === undefined ? feltTexture() : opts.map,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

/** Glossy toy plastic: no felt, a hard white glint where the light catches it and a soft rim of
 *  light round the edge, both in the toon style. */
export function makePlastic(m: THREE.MeshToonMaterial, keepMap = false): THREE.MeshToonMaterial {
  if (!keepMap) m.map = null;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#if NUM_DIR_LIGHTS > 0
      {
        vec3 viewDir = normalize( vViewPosition );
        vec3 halfDir = normalize( directionalLights[ 0 ].direction + viewDir );
        float spec = pow( max( dot( normal, halfDir ), 0.0 ), 40.0 );
        outgoingLight += vec3( smoothstep( 0.42, 0.5, spec ) * 0.55 );
        float rim = 1.0 - max( dot( normal, viewDir ), 0.0 );
        outgoingLight += vec3( smoothstep( 0.62, 0.82, rim ) * 0.14 );
      }
      #endif
      #include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => 'plastic';
  return m;
}

/**
 * Samples the material's map from three sides in the mesh's own space instead of by UV, so a
 * pattern on a ball (felt leaves on a bush) keeps one size all over, with no stretched poles.
 * `scale`: repeats per unit.
 */
export function makeTriplanar(m: THREE.MeshToonMaterial, scale: number): THREE.MeshToonMaterial {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position;\nvTriNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
        {
          vec3 bw = pow(abs(normalize(vTriNormal)), vec3(4.0));
          bw /= dot(bw, vec3(1.0));
          vec3 p = vTriPos * ${scale.toFixed(3)};
          vec4 texelColor = texture2D(map, p.zy) * bw.x + texture2D(map, p.xz) * bw.y + texture2D(map, p.xy) * bw.z;
          diffuseColor *= texelColor;
        }
        #endif`,
      );
  };
  m.customProgramCacheKey = () => `triplanar${scale}`;
  return m;
}

export function outlineMaterial(color: string): THREE.MeshBasicMaterial {
  let mat = outlineMaterials.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    outlineMaterials.set(color, mat);
  }
  return mat;
}

const pushedOutlines = new Map<string, THREE.MeshBasicMaterial>();
/**
 * An outline hull whose depth is pushed `push` units away from the camera (where it's drawn
 * doesn't move): where a box touches another (a row of blocks, a wall's pieces) its outline stays
 * behind the neighbor's face instead of fighting it in broken steps.
 */
export function pushedOutlineMaterial(color: string, push = 0.008): THREE.MeshBasicMaterial {
  const key = `${color}|${push}`;
  let mat = pushedOutlines.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 pushed = projectionMatrix * vec4( mvPosition.xy, mvPosition.z - ${push.toFixed(4)}, 1.0 );
          gl_Position.z = pushed.z / pushed.w * gl_Position.w;
        }`,
      );
    };
    mat.customProgramCacheKey = () => `pushedOutline${push}`;
    pushedOutlines.set(key, mat);
  }
  return mat;
}

const thickOutlines = new Map<string, THREE.MeshBasicMaterial>();
/**
 * An outline hull pushed out `extra` world units beyond its shape along its normals (give it
 * smoothed ones, see smoothNormals), on top of however much bigger it already is: a plush's tiny
 * parts (feet, ears, spikes) got hairline outlines from a hull only a share of their size bigger.
 */
export function thickOutlineMaterial(color: string, extra = 0.016, stencilMark = 0, pull = 0, openFoot = false): THREE.MeshBasicMaterial {
  const key = `${color}|${extra}|${stencilMark}|${pull}|${openFoot}`;
  let mat = thickOutlines.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    if (stencilMark) {
      // Drawn only off what wrote `stencilMark` (round a heap of pieces, not across them).
      mat.stencilWrite = true;
      mat.stencilRef = stencilMark;
      mat.stencilFunc = THREE.NotEqualStencilFunc;
      mat.stencilFail = mat.stencilZFail = mat.stencilZPass = THREE.KeepStencilOp;
    }
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        mvPosition.xyz += normalize( normalMatrix * normal ) * length( normal ) * ${extra.toFixed(4)};
        gl_Position = projectionMatrix * mvPosition;
        ${pull ? `{
          vec4 pulled = projectionMatrix * vec4( mvPosition.xy, mvPosition.z + ${pull.toFixed(3)}, 1.0 );
          gl_Position.z = pulled.z / pulled.w * gl_Position.w;
        }` : ''}`,
      );
    };
    // An open foot: no line where it stands (it reads as standing on the floor, not as a cut-out
    // lying on it); its sides still run down to the floor.
    if (openFoot) cutBelowFloor(mat, 0);
    // (Not the stencil mark: that's render state, not shader code, so every mark shares one
    // program. Merging keys on the stencil settings itself, see merge-static.ts.)
    mat.customProgramCacheKey = () => `thickOutline${extra}|${pull}|${openFoot}`;
    thickOutlines.set(key, mat);
  }
  return mat;
}

/**
 * A copy of `geometry` whose normals are averaged where its vertices meet (so a hull pushed out
 * along them stays closed at hard edges: a box's corner, a cylinder's rim), and lengthened there
 * so each face beside it still moves out the full width (a box corner's diagonal by √3).
 */
export function smoothNormals(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.clone();
  const pos = g.getAttribute('position');
  let normal = g.getAttribute('normal');
  if (!normal) {
    g.computeVertexNormals();
    normal = g.getAttribute('normal');
  }
  const groups = new Map<string, number[]>();
  const keyOf = (i: number) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(i);
    const list = groups.get(k);
    if (list) list.push(i);
    else groups.set(k, [i]);
  }
  const out = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  const avg = new THREE.Vector3();
  for (const list of groups.values()) {
    avg.set(0, 0, 0);
    for (const i of list) avg.add(n.set(normal.getX(i), normal.getY(i), normal.getZ(i)));
    if (avg.lengthSq() < 1e-8) avg.set(normal.getX(list[0]!), normal.getY(list[0]!), normal.getZ(list[0]!));
    avg.normalize();
    // The face it leans furthest from sets how much longer it has to be (capped for sharp tips).
    let least = 1;
    for (const i of list) least = Math.min(least, avg.dot(n.set(normal.getX(i), normal.getY(i), normal.getZ(i)).normalize()));
    avg.multiplyScalar(1 / Math.max(least, 0.5));
    for (const i of list) out.set([avg.x, avg.y, avg.z], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

/** How thick a weapon's or an item's outline is (world units). */
export const GEAR_OUTLINE = 0.018;

/**
 * Every outline hull under `model` (dark, drawn from the back) the same `width` (world units):
 * hulls made a share bigger than their shape (toonMesh's) go back to its size, and all are pushed
 * out along smoothed normals by `width`, so small bits get a line as heavy as big ones.
 */
export function evenOutlines(model: THREE.Object3D, width: number, pull = 0): void {
  const smooth = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshBasicMaterial) || o.material.side !== THREE.BackSide) return;
    let g = smooth.get(o.geometry);
    if (!g) smooth.set(o.geometry, (g = smoothNormals(o.geometry)));
    o.geometry = g;
    if (o.name === 'outline') o.scale.set(1, 1, 1);
    o.material = thickOutlineMaterial('#' + o.material.color.getHexString(), width, 0, pull);
  });
}

/**
 * Cuts off the part of an outline hull lower than `y` (world units; measured after it's pushed
 * out, so 0 is the floor): the line along an object's foot goes, its sides still reach the floor.
 */
export function cutBelowFloor(mat: THREE.Material, y: number): void {
  const compile = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    compile.call(mat, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying float vFootY;\nvoid main() {')
      .replace('#include <logdepthbuf_vertex>', 'vFootY = ( inverse( viewMatrix ) * vec4( mvPosition.xyz, 1.0 ) ).y;\n#include <logdepthbuf_vertex>');
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `varying float vFootY;\nvoid main() {\n  if ( vFootY < ${y.toFixed(3)} ) discard;`);
  };
  const key = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${key()}|cut${y}`;
}

export interface ToonMeshOptions {
  /** Outline thickness as a fraction of the mesh size; false for none. */
  outline?: number | false;
  outlineColor?: string;
  castShadow?: boolean;
  material?: THREE.Material;
}

/**
 * A toon-shaded mesh with an inverted-hull outline: a slightly larger back-face-only copy
 * drawn in the outline color. Thin parts need a larger fraction to show the same width.
 */
export function toonMesh(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  { outline = 0.07, outlineColor = OUTLINE_COLOR, castShadow = true, material }: ToonMeshOptions = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material ?? toonMaterial(color));
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  if (outline !== false) {
    const hull = new THREE.Mesh(geometry, outlineMaterial(outlineColor));
    hull.scale.copy(outlineScale(geometry, outline));
    hull.name = 'outline';
    mesh.add(hull);
  }
  return mesh;
}

/** How much bigger an outline hull is along each axis: evenly bigger, except a long cylinder (a
 *  pole, a log). Scaled evenly, that poked out past its ends as dark caps (and hid a log's rings),
 *  so it grows past its ends only as much as it does round its sides. */
function outlineScale(geometry: THREE.BufferGeometry, outline: number): THREE.Vector3 {
  const even = new THREE.Vector3().setScalar(1 + outline);
  if (!(geometry instanceof THREE.CylinderGeometry)) return even;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  const [thin, mid, long] = [size.x, size.y, size.z].sort((a, b) => a - b) as [number, number, number];
  if (long < mid * 1.2) return even;
  // Round its sides it grows by `outline` of its radius; the same distance past each end.
  const grow = outline * thin;
  return new THREE.Vector3(1 + grow / size.x, 1 + grow / size.y, 1 + grow / size.z);
}

export function lighten(color: string, amount: number): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color('#ffffff'), amount);
}

export function darken(color: string, amount: number): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color('#000000'), amount);
}

/**
 * Fades a whole object (loot, a chest or a plush on the roof above you, out with the roof). While
 * faded its meshes draw with their own see-through copies of their materials (others may share
 * them), cast no shadow, and outlines step aside; at 0 nothing is drawn; back at 1 all returns.
 */
export function fadeObject(model: THREE.Object3D, opacity: number, skip: THREE.Object3D | null = null): void {
  if ((model.userData.fade ?? 1) === opacity) return;
  model.userData.fade = opacity;
  const solid = opacity >= 1;
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o === skip) return;
    const d = o.userData as { shown?: boolean; shadow?: boolean; base?: THREE.Material };
    if (solid) {
      if (d.shown !== undefined) o.visible = d.shown;
      if (d.shadow !== undefined) o.castShadow = d.shadow;
      if (d.base) {
        (o.material as THREE.Material).dispose();
        o.material = d.base;
      }
      delete d.shown;
      delete d.shadow;
      delete d.base;
      return;
    }
    d.shown ??= o.visible;
    d.shadow ??= o.castShadow;
    o.castShadow = false;
    o.visible = d.shown && opacity > 0 && o.name !== 'outline';
    if (o.name === 'outline') return;
    if (!d.base) {
      d.base = o.material as THREE.Material;
      const copy = d.base.clone();
      copy.transparent = true;
      copy.depthWrite = false;
      o.material = copy;
    }
    (o.material as THREE.Material).opacity = d.base.opacity * opacity;
  });
}
