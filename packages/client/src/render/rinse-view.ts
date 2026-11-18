// The Rinse: soapy water outside the safe circle (wobbling foam edge, ripples, bubbles).
// One shader on a big plane; plushies wade in it.
import * as THREE from 'three';
import type { MapData, Vec2, Zone } from '@stuffed/sim';

/** Roughly how far from the camera's focus the screen reaches (world units, plus margin) at the
 *  usual camera distance; farther out (the Toss) it reaches proportionally farther. */
const VIEW_REACH = 32;

const WATER_HEIGHT = 0.12;

const vertexShader = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uTime;
  varying vec2 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec4 col = vec4(0.0);

    vec2 d = vWorld - uCenter;
    float dist = length(d);
    float ang = atan(d.y, d.x);
    float wobble = sin(ang * 18.0 + uTime * 1.7) * 0.18 + sin(ang * 7.0 - uTime * 1.1) * 0.12;
    float edge = dist - (uRadius + wobble);
    if (edge > 0.0) {
      // Clear-ish water: gentle light ripples (bright caustic lines) drifting about...
      vec2 w = vWorld;
      float c = abs(sin(w.x * 1.1 + uTime * 0.9) + sin(w.y * 0.9 - uTime * 0.7) + sin((w.x + w.y) * 0.6 + uTime * 0.5));
      float caustic = 1.0 - smoothstep(0.0, 0.22, c);
      vec3 water = mix(vec3(0.45, 0.76, 0.92), vec3(0.62, 0.87, 0.98), sin(dist * 0.8 - uTime * 0.8) * 0.5 + 0.5);
      water = mix(water, vec3(0.92, 0.98, 1.0), caustic * 0.55);
      // ...and at the edge, a shoreline: a white wave line hugging it and a second one lapping in
      // and out a little further out.
      float lap = 0.55 + 0.25 * sin(uTime * 1.6 + ang * 3.0);
      float line1 = 1.0 - smoothstep(0.08, 0.2, abs(edge - 0.12));
      float line2 = (1.0 - smoothstep(0.04, 0.13, abs(edge - lap))) * 0.8;
      water = mix(water, vec3(1.0), max(line1, line2));
      // The shallow water right at the edge is lighter and clearer.
      float shallow = 1.0 - smoothstep(0.0, 1.2, edge);
      water = mix(water, vec3(0.75, 0.93, 1.0), shallow * 0.35);
      col = vec4(water, mix(0.62, 0.8, smoothstep(0.0, 2.0, edge)));
    }

    if (col.a < 0.01) discard;
    gl_FragColor = col;
  }
`;

export class RinseView {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uCenter: { value: new THREE.Vector2() },
    uRadius: { value: 0 },
    uTime: { value: 0 },
  };

  constructor(map: MapData) {
    const size = Math.max(map.width, map.height) * 3;
    this.mesh = new THREE.Mesh(
      // Tiled, like the lawn: huge triangles get their depth wrong on some GPUs.
      new THREE.PlaneGeometry(size, size, 24, 24).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: this.uniforms, transparent: true, depthWrite: false }),
    );
    this.mesh.position.set(map.width / 2, WATER_HEIGHT, map.height / 2);
    this.mesh.renderOrder = 2;
  }

  /**
   * `view` is where the camera looks and `zoom` how far out it is (1 = usual); the full-screen
   * water shader is skipped when no water is in view.
   */
  update(zone: Zone, time: number, view: Vec2, zoom = 1): void {
    const c = zone.current;
    this.mesh.visible = Math.hypot(view.x - c.center.x, view.y - c.center.y) + VIEW_REACH * zoom > c.radius;
    if (!this.mesh.visible) return;
    const u = this.uniforms;
    u.uCenter.value.set(zone.current.center.x, zone.current.center.y);
    u.uRadius.value = zone.current.radius;
    u.uTime.value = time;
  }
}

/** The Rinse drains the color out of everything in it; `?rinse=water` draws the old water instead. */
export const RINSE_BW = typeof location === 'undefined' || new URLSearchParams(location.search).get('rinse') !== 'water';

// The grey Rinse costs no extra pass: every material that takes fog turns grey past the edge as
// it's drawn. Three.js's fog chunks are replaced with the Rinse's look, and the scene's "fog"
// (RinseFog below) feeds them the circle each frame (center and radius in the fog color, the
// time in fogNear).
if (RINSE_BW) {
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n  varying vec3 vRinseWorld;\n#endif';
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vRinseWorld = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vRinseWorld;
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `#ifdef USE_FOG
  {
    float uTime = fogNear;
    vec2 d = vRinseWorld.xz - fogColor.xy;
    float ang = atan(d.y, d.x);
    float wobble = sin(ang * 18.0 + uTime * 1.7) * 0.18 + sin(ang * 7.0 - uTime * 1.1) * 0.12;
    float edge = length(d) - (fogColor.z + wobble);
    // Grey (a washed-out, slightly cool grey) past the edge, with a soft step over it.
    float out_ = smoothstep(-0.15, 0.25, edge);
    vec3 rgb = gl_FragColor.rgb;
    float grey = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(rgb, mix(vec3(grey), vec3(0.9, 0.93, 0.97), 0.18), out_);
    // The edge shines: a bright core line with a soft glow, a soap-bubble sheen running along it,
    // glints sliding round, and sparkles twinkling just outside.
    float a = abs(edge - 0.05);
    if (a < 1.5) {
      float core = 1.0 - smoothstep(0.02, 0.07, a);
      float glow = (1.0 - smoothstep(0.0, 0.45, a)) * 0.45;
      vec3 sheen = 0.5 + 0.5 * cos(6.2831 * (ang * 1.5 + uTime * 0.15 + vec3(0.0, 0.33, 0.67)));
      float glint = pow(0.5 + 0.5 * sin(ang * 26.0 - uTime * 2.4), 12.0);
      vec2 cell = floor(vRinseWorld.xz * 2.2);
      float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float twinkle = pow(max(0.0, sin(uTime * (2.0 + h * 3.0) + h * 40.0)), 8.0);
      vec2 f = fract(vRinseWorld.xz * 2.2) - 0.5;
      float sparkle = step(0.82, h) * twinkle * (1.0 - smoothstep(0.0, 0.12, length(f))) * (1.0 - smoothstep(0.0, 1.4, edge)) * step(0.0, edge);
      vec3 shine = mix(vec3(1.0), mix(vec3(1.0), sheen, 0.35), glow / 0.45);
      rgb = mix(rgb, shine, clamp(glow + core * (0.75 + 0.25 * glint), 0.0, 1.0));
      rgb += vec3(sparkle + glint * core * 0.4);
    }
    gl_FragColor.rgb = rgb;
  }
#endif`;
}

/**
 * The scene's fog, standing in for the Rinse: its "color" carries the circle (x, z, radius) and
 * `near` the time, read by the fog chunks above. (A plain object: three.js's Color would convert
 * the numbers between color spaces.)
 */
export class RinseFog {
  readonly isFog = true;
  readonly name = 'rinse';
  near = 0;
  far = 1;
  private cx = 0;
  private cz = 0;
  private r = 1e6;
  readonly color = {
    getRGB: (target: { r: number; g: number; b: number }) => {
      target.r = this.cx;
      target.g = this.cz;
      target.b = this.r;
      return target;
    },
  };

  set(zone: Zone, time: number): void {
    this.cx = zone.current.center.x;
    this.cz = zone.current.center.y;
    this.r = zone.current.radius;
    this.near = time;
  }

  clone(): RinseFog {
    return this;
  }

  toJSON(): object {
    return {};
  }
}
