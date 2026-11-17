// The Rinse: soapy water outside the safe circle (wobbling foam edge, ripples, bubbles) and a
// dashed ring marking the next circle. One shader on a big plane; plushies wade in it.
import * as THREE from 'three';
import type { MapData, Zone } from '@stuffed/sim';

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
  uniform vec2 uNextCenter;
  uniform float uNextRadius;
  uniform float uShowNext;
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
      vec3 water = vec3(0.55, 0.80, 0.93);
      float ripple = sin(dist * 2.2 - uTime * 1.5) * 0.5 + 0.5;
      water = mix(water, vec3(0.66, 0.88, 0.97), ripple * 0.35);
      vec2 cell = vWorld * 0.9 + vec2(uTime * 0.15, uTime * 0.1);
      float h = hash(floor(cell));
      float r = 0.08 + 0.12 * h;
      float bubble = (1.0 - smoothstep(r - 0.04, r, length(fract(cell) - 0.5))) * step(0.6, h);
      water = mix(water, vec3(1.0), bubble * 0.4 * (0.5 + h));
      float foam = 1.0 - smoothstep(0.0, 0.9, edge);
      col = vec4(mix(water, vec3(1.0), foam * 0.85), 0.84);
    }

    vec2 n = vWorld - uNextCenter;
    float ring = 1.0 - smoothstep(0.09, 0.17, abs(length(n) - uNextRadius));
    float arc = atan(n.y, n.x) * uNextRadius;
    float dash = step(0.45, fract(arc / 1.4 + uTime * 0.3));
    col = mix(col, vec4(1.0, 1.0, 1.0, 0.92), ring * dash * uShowNext);

    if (col.a < 0.01) discard;
    gl_FragColor = col;
  }
`;

export class RinseView {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uCenter: { value: new THREE.Vector2() },
    uRadius: { value: 0 },
    uNextCenter: { value: new THREE.Vector2() },
    uNextRadius: { value: 0 },
    uShowNext: { value: 1 },
    uTime: { value: 0 },
  };

  constructor(map: MapData) {
    const size = Math.max(map.width, map.height) * 3;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: this.uniforms, transparent: true, depthWrite: false }),
    );
    this.mesh.position.set(map.width / 2, WATER_HEIGHT, map.height / 2);
    this.mesh.renderOrder = 2;
  }

  update(zone: Zone, time: number): void {
    const u = this.uniforms;
    u.uCenter.value.set(zone.current.center.x, zone.current.center.y);
    u.uRadius.value = zone.current.radius;
    u.uNextCenter.value.set(zone.next.center.x, zone.next.center.y);
    u.uNextRadius.value = zone.next.radius;
    u.uShowNext.value = zone.stage === 'final' ? 0 : 1;
    u.uTime.value = time;
  }
}
