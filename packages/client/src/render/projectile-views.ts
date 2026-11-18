// Projectiles: bright, oversized, with a short fading trail. Pooled per weapon kind because the
// SMG alone spawns 10 per second per shooter.
import * as THREE from 'three';
import { config, DT } from '@stuffed/sim';
import type { EntityId, GameState, Projectile, WeaponKind } from '@stuffed/sim';
import { makePlastic, toonMaterial, toonMesh } from './toon.ts';

/** A streak behind each shot, in a light tint of it: a soft outer cone and a brighter core. */
const TRAIL_TINTS: Partial<Record<WeaponKind, string>> = {
  cork_popper: '#ffe2b8',
  foam_dart_smg: '#b9d3ff',
  super_soaker: '#d4f4ff',
  rubber_band_rifle: '#ffc2cf',
  marble_launcher: '#dff3ff',
};
const trailGeo = new THREE.ConeGeometry(1, 1, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
const trailMats = new Map<string, THREE.MeshBasicMaterial[]>();
function trailMaterials(tint: string): THREE.MeshBasicMaterial[] {
  let mats = trailMats.get(tint);
  if (!mats) {
    mats = [
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.35, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }),
    ];
    trailMats.set(tint, mats);
  }
  return mats;
}

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
    case 'rubber_band_rifle': {
      // A stretched red rubber band, a long thin loop.
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 20), toonMaterial('#ff4d6d', { map: null }));
      band.rotation.x = Math.PI / 2;
      band.scale.set(0.5, 2.6, 1);
      g.add(band);
      break;
    }
    case 'marble_launcher': {
      const glass = toonMesh(new THREE.SphereGeometry(0.2, 18, 12), '#9fd9ff', { outline: 0.08 });
      g.add(glass);
      const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.04, 6, 16), toonMaterial('#ff5a5a', { map: null }));
      swirl.rotation.set(0.6, 0.3, 0);
      glass.add(swirl);
      g.userData.spin = glass;
      break;
    }
    case 'glitter_bomb': {
      const ball = toonMesh(new THREE.SphereGeometry(0.22, 16, 12), '#ff7ac8', { outline: 0.08 });
      for (const [x, y, z, c] of [[0.13, 0.12, 0.1, '#fff27a'], [-0.15, 0.05, 0.08, '#7af0ff'], [0.02, -0.12, 0.17, '#ffffff']] as const) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toonMaterial(c, { map: null }));
        dot.position.set(x, y, z);
        ball.add(dot);
      }
      g.add(ball);
      g.userData.spin = ball;
      g.userData.noTrail = true;
      break;
    }
    case 'bubble_wand': {
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 20, 14),
        new THREE.MeshBasicMaterial({ color: '#d4f4ff', transparent: true, opacity: 0.35, depthWrite: false }),
      );
      g.add(bubble);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.02, 6, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
      g.add(rim);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      shine.position.set(0.14, 0.16, 0.12);
      g.add(shine);
      g.userData.wobble = bubble;
      g.userData.billboard = rim;
      g.userData.noTrail = true;
      break;
    }
    case 'pillow_hammer':
      break;
  }
  if (g.userData.noTrail) return g;
  // Toy plastic and glass shine.
  if (kind === 'foam_dart_smg' || kind === 'marble_launcher' || kind === 'glitter_bomb') {
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) makePlastic(o.material);
    });
  }
  const [outer, core] = trailMaterials(TRAIL_TINTS[kind] ?? '#ffffff');
  const streak = new THREE.Mesh(trailGeo, outer);
  streak.scale.set(0.14, 0.14, 1.1);
  streak.position.z = -0.12;
  g.add(streak);
  const inner = new THREE.Mesh(trailGeo, core);
  inner.scale.set(0.06, 0.06, 0.7);
  inner.position.z = -0.12;
  g.add(inner);
  return g;
}

export class ProjectileViews {
  private readonly live = new Map<EntityId, { kind: WeaponKind; obj: THREE.Group }>();
  private readonly free = new Map<WeaponKind, THREE.Group[]>();

  constructor(private readonly scene: THREE.Scene) {}

  /** One of each projectile, for shader warm-up. */
  samples(): THREE.Object3D[] {
    return (Object.keys(config.weapons) as WeaponKind[]).map((kind) => buildProjectile(kind));
  }

  clear(): void {
    for (const entry of this.live.values()) {
      entry.obj.visible = false;
      this.free.get(entry.kind)?.push(entry.obj);
    }
    this.live.clear();
  }

  update(prev: GameState, curr: GameState, alpha: number, time = 0): void {
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
      // Marbles and bombs tumble; bubbles wobble.
      const spin = entry.obj.userData.spin as THREE.Object3D | undefined;
      if (spin) spin.rotation.x = time * 14;
      const wobble = entry.obj.userData.wobble as THREE.Object3D | undefined;
      if (wobble) wobble.scale.set(1 + Math.sin(time * 9) * 0.06, 1 - Math.sin(time * 9) * 0.06, 1);
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
