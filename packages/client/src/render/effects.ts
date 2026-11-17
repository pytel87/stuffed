// Short-lived particles: cotton puffs (stuffing hits, knockouts), button bits (armor hits),
// water droplets (Super Soaker) and muzzle pops. Particles shrink out instead of fading,
// which avoids transparency sorting.
import * as THREE from 'three';
import { toonMaterial } from './toon.ts';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
}

const GROUND = 0.05;

class ParticlePool {
  private readonly active: Particle[] = [];
  private readonly free: THREE.Mesh[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly geometry: THREE.BufferGeometry,
    private readonly material: THREE.Material,
  ) {}

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, size: number, life: number, gravity: number): void {
    const mesh = this.free.pop() ?? this.create();
    mesh.visible = true;
    mesh.position.copy(pos);
    mesh.scale.setScalar(size);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    this.active.push({ mesh, vel: vel.clone(), life, maxLife: life, size, gravity });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.free.push(p.mesh);
        this.active.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.exp(-2.5 * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < GROUND) {
        p.mesh.position.y = GROUND;
        p.vel.set(p.vel.x * 0.5, 0, p.vel.z * 0.5);
      }
      const k = p.life / p.maxLife;
      p.mesh.scale.setScalar(p.size * Math.min(1, k * 2.5));
    }
  }

  private create(): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.castShadow = false;
    this.scene.add(mesh);
    return mesh;
  }
}

export class Effects {
  private readonly cotton: ParticlePool;
  private readonly buttons: ParticlePool[];
  private readonly water: ParticlePool;
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpVel = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const puff = new THREE.IcosahedronGeometry(1, 1);
    this.cotton = new ParticlePool(scene, puff, toonMaterial('#fdfbf7', { map: null }));
    const disc = new THREE.CylinderGeometry(1, 1, 0.35, 12);
    this.buttons = ['#e2574c', '#3d7ff2', '#f7c331'].map((c) => new ParticlePool(scene, disc, toonMaterial(c, { map: null })));
    this.water = new ParticlePool(scene, new THREE.SphereGeometry(1, 8, 6), toonMaterial('#7fd0f7', { map: null }));
  }

  /** Spawns one of every particle far off the map so their shaders compile at startup. */
  warmUp(): void {
    this.knockout(-500, -500);
    this.armorHit(-500, -500, 0, 0, 5);
    this.splash(-500, -500);
  }

  /** Stuffing knocked out of a plush, sprayed away from the hit direction. */
  stuffingHit(x: number, z: number, dirX: number, dirZ: number, amount: number): void {
    const n = Math.min(10, 2 + Math.round(amount / 4));
    this.burst(this.cotton, x, 0.8, z, dirX, dirZ, n, 3, 0.07 + amount * 0.003, 0.7, 4);
  }

  armorHit(x: number, z: number, dirX: number, dirZ: number, amount: number): void {
    const n = Math.min(8, 1 + Math.round(amount / 5));
    for (let i = 0; i < n; i++) {
      const pool = this.buttons[i % this.buttons.length]!;
      this.burst(pool, x, 0.8, z, dirX, dirZ, 1, 3.5, 0.06, 0.8, 12);
    }
  }

  splash(x: number, z: number): void {
    this.burst(this.water, x, 0.7, z, 0, 0, 5, 2.5, 0.05, 0.4, 10);
  }

  muzzle(x: number, z: number, dirX: number, dirZ: number, water: boolean): void {
    this.burst(water ? this.water : this.cotton, x, 0.65, z, dirX, dirZ, water ? 4 : 2, 2, 0.05, 0.25, 0);
  }

  /** A projectile stopping against a wall: a splash for water, a puff of fluff for the rest. */
  impact(x: number, z: number, water: boolean): void {
    if (water) this.burst(this.water, x, 0.6, z, 0, 0, 4, 2, 0.05, 0.35, 10);
    else this.burst(this.cotton, x, 0.6, z, 0, 0, 3, 1.5, 0.06, 0.35, 3);
  }

  /** A toy box pops open: confetti buttons and a puff of fluff. */
  chestPop(x: number, z: number): void {
    for (const pool of this.buttons) this.burst(pool, x, 0.8, z, 0, 0, 4, 3, 0.06, 0.9, 9);
    this.burst(this.cotton, x, 0.7, z, 0, 0, 6, 2, 0.08, 0.6, 2);
  }

  /** Something picked up: a small puff where it was. */
  pickup(x: number, z: number): void {
    this.burst(this.cotton, x, 0.6, z, 0, 0, 4, 1.5, 0.05, 0.35, 0);
  }

  /** Item finished: fluff for healing, buttons for armor, swirling up around the plush. */
  itemUsed(x: number, z: number, armor: boolean): void {
    if (armor) for (const pool of this.buttons) this.burst(pool, x, 0.5, z, 0, 0, 3, 1.5, 0.06, 0.7, -2);
    else this.burst(this.cotton, x, 0.4, z, 0, 0, 10, 1.5, 0.07, 0.8, -3);
  }

  /** Dust puff where a plush lands. */
  landing(x: number, y: number, z: number): void {
    this.burst(this.cotton, x, y + 0.08, z, 0, 0, 5, 1.8, 0.06, 0.35, 0);
  }

  /** A soggy plush drips water. */
  drip(x: number, z: number): void {
    this.burst(this.water, x, 1.1, z, 0, 0, 2, 0.6, 0.04, 0.45, 9);
  }

  /** A plush bursts into a pile of fluff when Unstitched. */
  knockout(x: number, z: number): void {
    this.burst(this.cotton, x, 0.7, z, 0, 0, 36, 5, 0.14, 1.4, 6);
  }

  update(dt: number): void {
    this.cotton.update(dt);
    for (const pool of this.buttons) pool.update(dt);
    this.water.update(dt);
  }

  private burst(
    pool: ParticlePool,
    x: number, y: number, z: number,
    dirX: number, dirZ: number,
    count: number, speed: number, size: number, life: number, gravity: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.tmpVel.set(Math.cos(a) * s * 0.6 + dirX * s, 1 + Math.random() * 2.5, Math.sin(a) * s * 0.6 + dirZ * s);
      this.tmpPos.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3);
      pool.spawn(this.tmpPos, this.tmpVel, size * (0.7 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.6), gravity);
    }
  }
}
