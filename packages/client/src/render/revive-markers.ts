// Team mode: where a teammate was knocked out, a floating plush heart over a pink ring (like
// loot's) that runs down round the circle as the time to re-stitch them runs out, a faint track
// where it's gone. Only their teammates see it.
import * as THREE from 'three';
import { config, revivable } from '@stuffed/sim';
import type { EntityId, GameState, Player } from '@stuffed/sim';
import { groundRing, HOOP_OUTLINE, HOOP_TUBE, hoopGeometry, neonPlastic } from './loot-views.ts';
import { fabricDetail } from './placeholder-parts.ts';
import { toonMaterial, toonMesh } from './toon.ts';

interface Marker {
  root: THREE.Group;
  /** The ring on the ground, like the one under loot (a glowing plastic hoop), in pink. */
  ring: THREE.Mesh;
  halo: THREE.Mesh;
  heart: THREE.Object3D;
  /** The hoop: what's left of the time (rebuilt as it runs down, `step` of STEPS) and its outline. */
  hoop: THREE.Mesh;
  hoopLine: THREE.Mesh;
  step: number;
}

const PINK = '#ff7aa8';
/** The ring's size (a little bigger than loot's), and how finely it runs down. */
const RING = 0.95;
const STEPS = 96;

/** How big the heart is (a little bigger than it was). */
const HEART_SIZE = 1.25;

function heartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.28);
  s.bezierCurveTo(-0.42, 0.02, -0.26, 0.36, 0, 0.18);
  s.bezierCurveTo(0.26, 0.36, 0.42, 0.02, 0, -0.28);
  return s;
}

export class ReviveMarkers {
  private readonly markers = new Map<EntityId, Marker>();
  // (Its fabric as fine as on a plush: the shape's own coordinates are under a unit across.)
  private readonly heartGeo = scaleUv(new THREE.ExtrudeGeometry(heartShape(), { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }).translate(0, 0, -0.06), 2.2);

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    for (const m of this.markers.values()) m.root.removeFromParent();
    this.markers.clear();
  }

  /** `viewer`: whoever the camera follows; markers show for their teammates. */
  update(state: GameState, viewer: Player | undefined, time: number): void {
    const seen = new Set<EntityId>();
    const window = config.team.reviveWindow * config.tickRate;
    for (const p of state.players) {
      if (!viewer || viewer.team === 0 || p.team !== viewer.team || p.id === viewer.id || !revivable(state, p)) continue;
      seen.add(p.id);
      const m = this.markers.get(p.id) ?? this.create(p.id);
      const left = 1 - (state.tick - (p.eliminatedTick ?? state.tick)) / window;
      m.root.position.set(p.pos.x, p.z + 0.05, p.pos.y);
      // Breathing like loot's. (It shrank as time ran out: too big at first, too small at the end; the
      // counter tells the time.)
      (m.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(time * 3) * 0.2;
      (m.halo.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time * 3) * 0.1;
      m.heart.position.y = 1.1 + Math.sin(time * 3) * 0.12;
      m.heart.rotation.y = time * 1.8;
      const step = Math.max(1, Math.ceil(Math.max(0, Math.min(1, left)) * STEPS));
      if (step !== m.step) {
        m.step = step;
        const arc = (step / STEPS) * Math.PI * 2;
        m.hoop.geometry.dispose();
        m.hoop.geometry = hoopGeometry(RING, HOOP_TUBE, arc);
        m.hoopLine.geometry.dispose();
        m.hoopLine.geometry = hoopGeometry(RING, HOOP_TUBE + HOOP_OUTLINE, arc);
      }
    }
    for (const [id, m] of this.markers) {
      if (seen.has(id)) continue;
      m.root.removeFromParent();
      this.markers.delete(id);
    }
  }

  private create(id: EntityId): Marker {
    const root = new THREE.Group();
    const { glow: ring, halo } = groundRing(PINK, RING);
    ring.position.y = 0.06;
    root.add(ring);
    // Its full hoop is the track (faint); a second one over it, what's left of the time.
    const track = ring.children.find((c) => c !== halo) as THREE.Mesh;
    track.material = new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
    track.children.forEach((c) => (c.visible = false));
    const hoop = new THREE.Mesh(hoopGeometry(RING, HOOP_TUBE), neonPlastic(PINK));
    hoop.position.y = HOOP_TUBE + 0.002;
    // From the bottom of the circle (nearest you), not the top: the last of the time ran down
    // behind the heart there.
    hoop.rotation.y = Math.PI;
    const hoopLine = new THREE.Mesh(hoopGeometry(RING, HOOP_TUBE + HOOP_OUTLINE), new THREE.MeshBasicMaterial({ color: '#2a1f2d', side: THREE.BackSide }));
    hoop.add(hoopLine);
    ring.add(hoop);
    // Plush, like the plushies: the same minky dot fabric, its bumps too.
    const fabric = fabricDetail('minky');
    const heartMaterial = toonMaterial(PINK, { map: fabric.map });
    heartMaterial.normalMap = fabric.normal;
    heartMaterial.normalScale.setScalar(0.7);
    const heart = toonMesh(this.heartGeo, PINK, { outline: 0.08, material: heartMaterial });
    heart.scale.setScalar(HEART_SIZE);
    root.add(heart);
    this.scene.add(root);
    const m = { root, ring, halo, heart, hoop, hoopLine, step: STEPS };
    this.markers.set(id, m);
    return m;
  }
}

function scaleUv(geo: THREE.BufferGeometry, k: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  uv.needsUpdate = true;
  return geo;
}
