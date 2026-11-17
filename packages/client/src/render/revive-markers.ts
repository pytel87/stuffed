// Team mode: where a teammate was knocked out, a floating stitched heart over a pink ring that
// shrinks as the time to re-stitch them runs out. Only their teammates see it.
import * as THREE from 'three';
import { config, revivable } from '@stuffed/sim';
import type { EntityId, GameState, Player } from '@stuffed/sim';
import { toonMaterial, toonMesh } from './toon.ts';

interface Marker {
  root: THREE.Group;
  ring: THREE.Mesh;
  heart: THREE.Object3D;
}

function heartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.28);
  s.bezierCurveTo(-0.42, 0.02, -0.26, 0.36, 0, 0.18);
  s.bezierCurveTo(0.26, 0.36, 0.42, 0.02, 0, -0.28);
  return s;
}

export class ReviveMarkers {
  private readonly markers = new Map<EntityId, Marker>();
  private readonly heartGeo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }).translate(0, 0, -0.06);
  private readonly ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);

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
      const s = 0.45 + 0.75 * Math.max(0, left);
      m.ring.scale.set(s, 1, s);
      m.heart.position.y = 1.1 + Math.sin(time * 3) * 0.12;
      m.heart.rotation.y = time * 1.8;
      // Hurry: the heart pulses faster as time runs out.
      const pulse = 1 + Math.sin(time * (4 + (1 - left) * 10)) * 0.08;
      m.heart.scale.setScalar(pulse);
    }
    for (const [id, m] of this.markers) {
      if (seen.has(id)) continue;
      m.root.removeFromParent();
      this.markers.delete(id);
    }
  }

  private create(id: EntityId): Marker {
    const root = new THREE.Group();
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#ff7aa8', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    root.add(ring);
    const heart = toonMesh(this.heartGeo, '#ff7aa8', { outline: 0.08, material: toonMaterial('#ff7aa8', { map: null }) });
    root.add(heart);
    this.scene.add(root);
    const m = { root, ring, heart };
    this.markers.set(id, m);
    return m;
  }
}
