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
    hull.scale.setScalar(1 + outline);
    hull.name = 'outline';
    mesh.add(hull);
  }
  return mesh;
}

export function lighten(color: string, amount: number): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color('#ffffff'), amount);
}

export function darken(color: string, amount: number): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color('#000000'), amount);
}
