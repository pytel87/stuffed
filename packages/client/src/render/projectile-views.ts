// Projectiles: bright, oversized, with a short fading trail. Pooled per weapon kind because the
// SMG alone spawns 10 per second per shooter.
import * as THREE from 'three';
import { DT } from '@stuffed/sim';
import type { EntityId, GameState, Projectile, WeaponKind } from '@stuffed/sim';
import { toonMaterial, toonMesh } from './toon.ts';

const TRAIL_MATS = [0.55, 0.32, 0.15].map(
  (opacity) => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity, depthWrite: false }),
);
const trailGeo = new THREE.SphereGeometry(0.07, 8, 6);

function buildProjectile(kind: WeaponKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'cork_popper': {
      const cork = toonMesh(new THREE.CylinderGeometry(0.13, 0.16, 0.3, 14), '#d9a066', { outline: 0.1 });
      cork.rotation.x = Math.PI / 2;
      g.add(cork);
      break;
    }
    case 'foam_dart_smg': {
      const shaft = toonMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 10), '#3d7ff2', { outline: 0.12 });
      shaft.rotation.x = Math.PI / 2;
      g.add(shaft);
      const tip = toonMesh(new THREE.SphereGeometry(0.09, 12, 8), '#f2873d', { outline: 0.1 });
      tip.position.z = 0.2;
      g.add(tip);
      break;
    }
    case 'super_soaker': {
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 14, 10),
        toonMaterial('#7fd0f7', { map: null, transparent: true, opacity: 0.85 }),
      );
      blob.scale.set(0.9, 0.9, 1.3);
      g.add(blob);
      break;
    }
  }
  TRAIL_MATS.forEach((mat, i) => {
    const ghost = new THREE.Mesh(trailGeo, mat);
    ghost.position.z = -0.25 - i * 0.18;
    ghost.scale.setScalar(1 - i * 0.2);
    g.add(ghost);
  });
  return g;
}

export class ProjectileViews {
  private readonly live = new Map<EntityId, { kind: WeaponKind; obj: THREE.Group }>();
  private readonly free = new Map<WeaponKind, THREE.Group[]>();

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    for (const entry of this.live.values()) {
      entry.obj.visible = false;
      this.free.get(entry.kind)?.push(entry.obj);
    }
    this.live.clear();
  }

  update(prev: GameState, curr: GameState, alpha: number): void {
    const prevById = new Map<EntityId, Projectile>(prev.projectiles.map((p) => [p.id, p]));
    const seen = new Set<EntityId>();

    for (const p of curr.projectiles) {
      seen.add(p.id);
      let entry = this.live.get(p.id);
      if (!entry) {
        entry = { kind: p.weapon, obj: this.take(p.weapon) };
        this.live.set(p.id, entry);
      }
      const before = prevById.get(p.id);
      // A projectile born this tick has no previous position: extrapolate back to the muzzle.
      const x = before ? before.pos.x + (p.pos.x - before.pos.x) * alpha : p.pos.x - p.vel.x * DT * (1 - alpha);
      const y = before ? before.pos.y + (p.pos.y - before.pos.y) * alpha : p.pos.y - p.vel.y * DT * (1 - alpha);
      const z = before ? before.z + (p.z - before.z) * alpha : p.z;
      entry.obj.position.set(x, z, y);
      entry.obj.rotation.y = Math.atan2(p.vel.x, p.vel.y);
    }

    for (const [id, entry] of this.live) {
      if (seen.has(id)) continue;
      entry.obj.visible = false;
      this.free.get(entry.kind)!.push(entry.obj);
      this.live.delete(id);
    }
  }

  private take(kind: WeaponKind): THREE.Group {
    let pool = this.free.get(kind);
    if (!pool) this.free.set(kind, (pool = []));
    const obj = pool.pop() ?? buildProjectile(kind);
    if (!obj.parent) this.scene.add(obj);
    obj.visible = true;
    return obj;
  }
}
