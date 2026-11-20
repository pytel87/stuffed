// Holographic parts (a try-out of shiny variants): the fabric turns pearly with rainbow bands that
// slide across it as the plush turns, keeping the animal's own color underneath. Eyes, noses and
// other dark details stay as they are.
import * as THREE from 'three';

/** How much the rainbow takes over (the animal still reads at a glance). */
const RAINBOW = 0.5;

/** Seconds, shared by every holographic material: the rainbow bands flow slowly even when still. */
export const HOLO_TIME = { value: 0 };
/** How far the fabric is lightened toward pearl first. */
const PEARL = 0.2;

/** Dark details (eyes, noses, a panda's patches) keep their color. */
export function isDark(m: THREE.MeshToonMaterial): boolean {
  const hsl = { h: 0, s: 0, l: 0 };
  m.color.getHSL(hsl);
  return hsl.l < 0.18;
}

/** A holographic copy of a part's material. */
export function holoMaterial(base: THREE.MeshToonMaterial): THREE.MeshToonMaterial {
  const m = base.clone();
  m.color.lerp(new THREE.Color('#ffffff'), PEARL);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.holoTime = HOLO_TIME;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float holoTime;')
      .replace(
        '#include <opaque_fragment>',
        `{
        vec3 n = normalize(normal);
        vec3 viewDir = normalize(vViewPosition);
        float ndv = clamp(dot(n, viewDir), 0.0, 1.0);
        // Rainbow bands by the angle the surface is seen at (they slide as it turns), flowing slowly.
        float t = fract((1.0 - ndv) * 1.3 + n.x * 0.35 + n.y * 0.25 + holoTime * 0.12);
        vec3 rainbow = 0.5 + 0.5 * cos(6.2832 * (t + vec3(0.0, 0.33, 0.67)));
        float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        vec3 pearl = mix(outgoingLight, vec3(lum), 0.35);
        outgoingLight = mix(pearl, pearl * 0.45 + rainbow * (0.6 + lum * 0.55), ${RAINBOW.toFixed(2)});
        // A bright sheen toward the edges, tinted by the rainbow.
        outgoingLight += pow(1.0 - ndv, 2.5) * (0.3 + rainbow * 0.3);
        // And a glossy highlight where the sun catches it.
        #if NUM_DIR_LIGHTS > 0
          vec3 halfDir = normalize(directionalLights[0].direction + viewDir);
          float spec = pow(max(dot(n, halfDir), 0.0), 30.0);
          outgoingLight += vec3(smoothstep(0.3, 0.6, spec) * 0.7);
        #endif
      }
      #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'holo';
  return m;
}

/** Gives a freshly built model the holographic finish (after merging its meshes, so none mix). */
export function makeHolo(model: THREE.Object3D): void {
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && !isDark(o.material)) o.material = holoMaterial(o.material);
  });
}
