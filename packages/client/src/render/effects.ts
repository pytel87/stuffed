// Short-lived particles: cotton puffs (stuffing hits, knockouts), button bits (armor hits),
// water droplets (Super Soaker) and muzzle pops. Particles shrink out instead of fading,
// which avoids transparency sorting.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANIMALS } from '@stuffed/sim';
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
    /** Lies flat on the ground (paw prints) instead of tumbling. */
    private readonly flat = false,
  ) {}

  /** `yaw`: for flat particles, which way they face (radians); random otherwise. */
  spawn(pos: THREE.Vector3, vel: THREE.Vector3, size: number, life: number, gravity: number, yaw?: number): void {
    const mesh = this.free.pop() ?? this.create();
    mesh.visible = true;
    mesh.position.copy(pos);
    mesh.scale.setScalar(size);
    if (this.flat) mesh.rotation.set(0, yaw ?? Math.random() * Math.PI * 2, 0);
    else mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
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

/** An expanding ring on the ground (a marble or glitter burst), fading out. */
interface Shockwave {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  radius: number;
}

/** Keeps sprinkling glitter over an area for a while (the cloud a Glitter Bomb leaves). */
interface Emitter {
  x: number;
  y: number;
  z: number;
  radius: number;
  left: number;
  acc: number;
}

export class Effects {
  private readonly cotton: ParticlePool;
  private readonly buttons: ParticlePool[];
  private readonly water: ParticlePool;
  /** Glitter in a few bright colors; also marble shards and bonk stars. */
  private readonly glitter: ParticlePool[];
  private readonly glass: ParticlePool[];
  private readonly stars: ParticlePool;
  private readonly soap: ParticlePool;
  private readonly cardboardBits: ParticlePool;
  /** Set trails: paw prints, frog splashes, shark ripples, chicken feathers. */
  private readonly paws: ParticlePool;
  private readonly frogDrops: ParticlePool;
  private readonly feathers: ParticlePool;
  private readonly juiceDrops: ParticlePool;
  private readonly leaves: ParticlePool;
  private readonly mud: ParticlePool;
  private readonly mudDrops: ParticlePool;
  private readonly waves: Shockwave[] = [];
  private readonly emitters: Emitter[] = [];
  private readonly ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpVel = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const puff = new THREE.IcosahedronGeometry(1, 1);
    this.cotton = new ParticlePool(scene, puff, toonMaterial('#fdfbf7', { map: null }));
    const disc = new THREE.CylinderGeometry(1, 1, 0.35, 12);
    this.buttons = ['#e2574c', '#3d7ff2', '#f7c331'].map((c) => new ParticlePool(scene, disc, toonMaterial(c, { map: null })));
    this.water = new ParticlePool(scene, new THREE.SphereGeometry(1, 8, 6), toonMaterial('#7fd0f7', { map: null }));
    const flake = new THREE.OctahedronGeometry(1, 0);
    this.glitter = ['#ff7ac8', '#fff27a', '#7af0ff', '#ffffff', '#c58bff'].map(
      (c) => new ParticlePool(scene, flake, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })),
    );
    this.glass = ['#ff5a5a', '#3fa9f5', '#5bd16a', '#9fd9ff'].map((c) => new ParticlePool(scene, new THREE.IcosahedronGeometry(1, 0), toonMaterial(c, { map: null })));
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.45 : 1;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.stars = new ParticlePool(scene, new THREE.ExtrudeGeometry(star, { depth: 0.3, bevelEnabled: false }), toonMaterial('#ffd23a', { map: null }));
    this.soap = new ParticlePool(scene, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#d4f4ff', transparent: true, opacity: 0.6 }));
    // A paw print: a pad and three toes, flat on the ground.
    const paw = mergeGeometries([
      new THREE.CylinderGeometry(1, 1.1, 0.1, 14).scale(1, 1, 0.85),
      ...[-0.75, 0, 0.75].map((x) => new THREE.CylinderGeometry(0.38, 0.4, 0.1, 10).translate(x, 0, -1.2 + Math.abs(x) * 0.35)),
    ]);
    this.paws = new ParticlePool(scene, paw, toonMaterial('#6b4630', { map: null }), true);
    this.frogDrops = new ParticlePool(scene, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#c8ff9e', toneMapped: false }));
    const feather = new THREE.SphereGeometry(1, 8, 6).scale(0.5, 0.15, 1.6);
    this.feathers = new ParticlePool(scene, feather, toonMaterial('#fdfbf7', { map: null }));
    this.cardboardBits = new ParticlePool(scene, new THREE.BoxGeometry(1, 0.25, 1), toonMaterial('#c9a27e', { map: null }));
    this.juiceDrops = new ParticlePool(scene, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }));
    this.leaves = new ParticlePool(scene, feather, toonMaterial('#7cc95a', { map: null }));
    this.mud = new ParticlePool(scene, new THREE.CylinderGeometry(1, 1, 0.1, 10).scale(1, 1, 0.75), toonMaterial('#8a5a3c', { map: null }), true);
    this.mudDrops = new ParticlePool(scene, new THREE.SphereGeometry(1, 8, 6), toonMaterial('#8a5a3c', { map: null }));
    this.scene = scene;
  }

  /** A Cardboard Wall going up (small puff) or getting shot down / folding away (bits fly). */
  cardboard(x: number, z: number, broke: boolean): void {
    if (broke) this.burst(this.cardboardBits, x, 0.8, z, 0, 0, 14, 4, 0.18, 0.9, 12);
    else this.burst(this.cotton, x, 0.2, z, 0, 0, 6, 2, 0.08, 0.4, 0);
  }

  /**
   * A plush wearing a set (3+ parts of one animal) leaves a trail as it walks: paw prints, frog
   * splashes, shark ripples or chicken feathers.
   */
  setTrail(animal: string, x: number, y: number, z: number, step: number, dirX = 0, dirZ = 1): void {
    switch (animal) {
      case 'dino':
        // Big stomps: a ring of dust every step.
        this.shockwave(x, y + 0.04, z, 0.9, '#f0a93b');
        this.burst(this.cotton, x, y + 0.1, z, 0, 0, 3, 1.2, 0.07, 0.4, 2);
        break;
      case 'owl':
        this.burst(this.feathers, x, y + 0.9, z, 0, 0, 1, 0.5, 0.08, 1.1, 0.5);
        break;
      case 'axolotl':
        this.burst(this.soap, x, y + 0.4, z, 0, 0, 2, 0.6, 0.06, 0.8, -1.5);
        break;
      case 'bunny':
        // Hop puffs.
        if (step % 2 === 0) this.burst(this.cotton, x, y + 0.1, z, 0, 0, 3, 0.8, 0.06, 0.4, 1);
        break;
      case 'unicorn': {
        const pool = this.glitter[step % this.glitter.length]!;
        this.burst(pool, x, y + 0.3, z, 0, 0, 3, 0.8, 0.06, 0.8, -0.5);
        break;
      }
      case 'cat': {
        const side = step % 2 ? 0.14 : -0.14;
        this.tmpPos.set(x - dirZ * side, y + 0.06, z + dirX * side);
        this.tmpVel.set(0, 0, 0);
        this.paws.spawn(this.tmpPos, this.tmpVel, 0.09, 1.3, 0, Math.atan2(-dirX, -dirZ));
        break;
      }
      case 'fox':
        this.burst(this.feathers, x, y + 0.5, z, 0, 0, 1, 0.5, 0.07, 1.0, 0.8);
        break;
      case 'panda':
        // Bamboo leaves drifting down.
        if (step % 2 === 0) this.burst(this.leaves, x, y + 0.7, z, 0, 0, 1, 0.5, 0.08, 1.2, 0.4);
        break;
      case 'pig':
        // Muddy splats.
        if (step % 2 === 0) {
          this.tmpPos.set(x, y + 0.05, z);
          this.tmpVel.set(0, 0, 0);
          this.mud.spawn(this.tmpPos, this.tmpVel, 0.1 + Math.random() * 0.05, 1.4, 0);
        }
        break;
      case 'lion':
        if (step % 2 === 0) this.burst(this.glitter[1]!, x, y + 0.3, z, 0, 0, 2, 0.7, 0.06, 0.7, -0.5);
        break;
      case 'turtle':
        // Slow little ripples.
        if (step % 2 === 0) this.shockwave(x, y + 0.04, z, 0.6, '#8fe07a');
        break;
      case 'hedgehog':
        if (step % 2 === 0) this.burst(this.leaves, x, y + 0.3, z, 0, 0, 1, 0.5, 0.06, 0.8, 1);
        break;
      case 'koala':
        if (step % 3 === 0) this.burst(this.leaves, x, y + 0.9, z, 0, 0, 1, 0.4, 0.07, 1.2, 0.4);
        break;
      case 'octopus':
        this.burst(this.soap, x, y + 0.3, z, 0, 0, 2, 0.6, 0.05, 0.8, -1.5);
        break;
      case 'elephant':
        // A spray from the trunk now and then.
        if (step % 3 === 0) this.burst(this.water, x + dirX * 0.4, y + 1.1, z + dirZ * 0.4, dirX * 0.4, dirZ * 0.4, 4, 1, 0.05, 0.6, 6);
        break;
      case 'penguin':
        // Little snowflakes swirling up behind.
        this.burst(this.glitter[3]!, x, y + 0.2, z, -dirX * 0.5, -dirZ * 0.5, 3, 1, 0.05, 0.7, 0.5);
        break;
      case 'bear': {
        // Prints point the way the bear walks, alternating left and right of its path.
        const side = step % 2 ? 0.18 : -0.18;
        this.tmpPos.set(x - dirZ * side, y + 0.06, z + dirX * side);
        this.tmpVel.set(0, 0, 0);
        // The print's toes are on its -z side.
        this.paws.spawn(this.tmpPos, this.tmpVel, 0.13, 1.6, 0, Math.atan2(-dirX, -dirZ));
        break;
      }
      case 'frog':
        this.burst(this.frogDrops, x, y + 0.1, z, 0, 0, 4, 1.4, 0.08, 0.45, 9);
        break;
      case 'shark':
        this.shockwave(x, y + 0.04, z, 0.7, '#4fd2ff');
        break;
      case 'chicken':
        this.burst(this.feathers, x, y + 0.8, z, 0, 0, 1, 0.6, 0.09, 1.1, 0.6);
        break;
      case 'mouse': {
        // Tiny paw prints.
        const side = step % 2 ? 0.1 : -0.1;
        this.tmpPos.set(x - dirZ * side, y + 0.06, z + dirX * side);
        this.tmpVel.set(0, 0, 0);
        this.paws.spawn(this.tmpPos, this.tmpVel, 0.06, 1.1, 0, Math.atan2(-dirX, -dirZ));
        break;
      }
      case 'sheep':
        // Wisps of wool.
        if (step % 2 === 0) this.burst(this.cotton, x, y + 0.5, z, 0, 0, 2, 0.5, 0.06, 0.9, -0.3);
        break;
      case 'raccoon': {
        const side = step % 2 ? 0.16 : -0.16;
        this.tmpPos.set(x - dirZ * side, y + 0.06, z + dirX * side);
        this.tmpVel.set(0, 0, 0);
        this.paws.spawn(this.tmpPos, this.tmpVel, 0.1, 1.4, 0, Math.atan2(-dirX, -dirZ));
        break;
      }
      case 'bee':
        // A buzz of yellow sparkles.
        this.burst(this.glitter[1]!, x, y + 0.6, z, 0, 0, 2, 0.8, 0.05, 0.6, -0.3);
        break;
      case 'flamingo':
        if (step % 2 === 0) this.shockwave(x, y + 0.04, z, 0.6, '#ff7ab8');
        this.burst(this.glitter[0]!, x, y + 0.5, z, 0, 0, 1, 0.5, 0.05, 0.7, 0.4);
        break;
      case 'giraffe':
        if (step % 2 === 0) this.burst(this.leaves, x, y + 1.0, z, 0, 0, 1, 0.5, 0.08, 1.2, 0.4);
        break;
      case 'sloth':
        if (step % 3 === 0) this.burst(this.leaves, x, y + 0.8, z, 0, 0, 1, 0.3, 0.08, 1.6, 0.25);
        break;
      case 'dragon':
        // Little embers drifting up, and a stomp now and then.
        this.burst(this.juiceDrops, x, y + 0.5, z, 0, 0, 2, 0.7, 0.05, 0.6, -1.5);
        if (step % 3 === 0) this.shockwave(x, y + 0.04, z, 0.8, '#ff6a4a');
        break;
      case 'phoenix': {
        const pool = this.glitter[step % 2 ? 1 : 0]!;
        this.burst(pool, x, y + 0.4, z, -dirX * 0.4, -dirZ * 0.4, 3, 0.9, 0.06, 0.8, -1);
        this.burst(this.juiceDrops, x, y + 0.6, z, 0, 0, 1, 0.5, 0.05, 0.5, -1.5);
        break;
      }
      case 'yeti':
        // Snow kicked up.
        this.burst(this.glitter[3]!, x, y + 0.15, z, -dirX * 0.4, -dirZ * 0.4, 4, 1.1, 0.06, 0.7, 2);
        if (step % 2 === 0) this.shockwave(x, y + 0.04, z, 0.7, '#a8e4ff');
        break;
      case 'otter':
        // Bubbles trailing behind, the diver's.
        this.burst(this.water, x, y + 0.4, z, -dirX * 0.3, -dirZ * 0.3, 3, 0.6, 0.06, 0.7, -1.2);
        break;
      case 'mermaid': {
        // A splash of glittering water.
        this.burst(this.water, x, y + 0.2, z, -dirX * 0.4, -dirZ * 0.4, 3, 1, 0.06, 0.6, 3);
        this.burst(this.glitter[step % 2 ? 2 : 0]!, x, y + 0.4, z, -dirX * 0.3, -dirZ * 0.3, 2, 0.8, 0.05, 0.8, -0.8);
        break;
      }
    }
  }

  /** A set-wearing plush bursts in its animal's style when knocked out. */
  setKnockout(animal: string, x: number, z: number): void {
    switch (animal) {
      case 'dino':
        this.shockwave(x, 0.05, z, 3, '#f0a93b');
        this.burst(this.cotton, x, 0.8, z, 0, 0, 16, 4, 0.12, 1, 6);
        break;
      case 'owl':
        this.burst(this.feathers, x, 1, z, 0, 0, 18, 4, 0.12, 1.6, 1.5);
        break;
      case 'axolotl':
        this.burst(this.soap, x, 0.8, z, 0, 0, 24, 4, 0.09, 1.1, -1);
        break;
      case 'penguin':
        this.burst(this.glitter[3]!, x, 1, z, 0, 0, 30, 4, 0.07, 1.4, 1);
        break;
      case 'bunny':
        this.burst(this.cotton, x, 0.8, z, 0, 0, 24, 4, 0.1, 1.2, 4);
        break;
      case 'unicorn':
        for (const pool of this.glitter) this.burst(pool, x, 1, z, 0, 0, 8, 4, 0.08, 1.4, 1);
        break;
      case 'cat':
        this.burst(this.paws, x, 0.8, z, 0, 0, 10, 4, 0.1, 1.2, 9);
        break;
      case 'fox':
        this.burst(this.feathers, x, 1, z, 0, 0, 16, 4, 0.12, 1.5, 1.5);
        break;
      case 'panda':
        this.burst(this.leaves, x, 1, z, 0, 0, 18, 4, 0.12, 1.6, 1.5);
        break;
      case 'pig':
        this.burst(this.mudDrops, x, 0.8, z, 0, 0, 20, 4, 0.08, 1, 8);
        break;
      case 'lion':
        this.burst(this.stars, x, 1.2, z, 0, 0, 8, 3, 0.12, 1, 4);
        this.burst(this.glitter[1]!, x, 1, z, 0, 0, 14, 4, 0.07, 1.2, 1);
        break;
      case 'turtle':
        this.shockwave(x, 0.05, z, 1.8, '#8fe07a');
        this.burst(this.cotton, x, 0.8, z, 0, 0, 18, 4, 0.1, 1.2, 5);
        break;
      case 'hedgehog':
        this.burst(this.leaves, x, 1, z, 0, 0, 18, 4, 0.1, 1.4, 1.5);
        break;
      case 'koala':
        this.burst(this.leaves, x, 1, z, 0, 0, 16, 3, 0.11, 1.6, 1);
        this.burst(this.cotton, x, 0.8, z, 0, 0, 12, 3, 0.1, 1.2, 4);
        break;
      case 'octopus':
        this.burst(this.soap, x, 0.8, z, 0, 0, 26, 4, 0.09, 1.1, -1);
        this.burst(this.mudDrops, x, 0.8, z, 0, 0, 10, 4, 0.07, 1, 8);
        break;
      case 'elephant':
        this.burst(this.water, x, 1, z, 0, 0, 26, 4, 0.08, 1, 8);
        this.shockwave(x, 0.05, z, 1.6, '#9ccfff');
        break;
      case 'bear':
        this.burst(this.paws, x, 0.8, z, 0, 0, 10, 4, 0.12, 1.2, 9);
        break;
      case 'frog':
        this.burst(this.frogDrops, x, 0.8, z, 0, 0, 24, 5, 0.08, 1, 8);
        break;
      case 'shark':
        this.shockwave(x, 0.05, z, 3, '#4fd2ff');
        this.burst(this.soap, x, 0.8, z, 0, 0, 20, 4, 0.08, 1, 6);
        break;
      case 'chicken':
        this.burst(this.feathers, x, 1, z, 0, 0, 18, 4, 0.12, 1.6, 1.5);
        break;
      case 'mouse':
        this.burst(this.paws, x, 0.8, z, 0, 0, 10, 4, 0.07, 1.2, 9);
        this.burst(this.glitter[1]!, x, 1, z, 0, 0, 12, 3, 0.07, 1, 1);
        break;
      case 'sheep':
        this.burst(this.cotton, x, 0.8, z, 0, 0, 30, 4, 0.11, 1.4, 3);
        break;
      case 'raccoon':
        this.burst(this.paws, x, 0.8, z, 0, 0, 10, 4, 0.1, 1.2, 9);
        this.burst(this.stars, x, 1.2, z, 0, 0, 5, 3, 0.1, 1, 4);
        break;
      case 'bee':
        this.burst(this.glitter[1]!, x, 1, z, 0, 0, 26, 4, 0.07, 1.2, 0.5);
        this.burst(this.stars, x, 1.2, z, 0, 0, 5, 3, 0.1, 1, 4);
        break;
      case 'flamingo':
        this.burst(this.feathers, x, 1, z, 0, 0, 14, 4, 0.12, 1.5, 1.5);
        this.burst(this.glitter[0]!, x, 1, z, 0, 0, 18, 4, 0.07, 1.2, 1);
        break;
      case 'giraffe':
        this.burst(this.leaves, x, 1.2, z, 0, 0, 20, 4, 0.11, 1.5, 1.5);
        break;
      case 'sloth':
        this.burst(this.leaves, x, 1, z, 0, 0, 14, 2.5, 0.12, 2, 0.6);
        this.burst(this.cotton, x, 0.8, z, 0, 0, 10, 2.5, 0.1, 1.4, 2);
        break;
      case 'dragon':
        this.shockwave(x, 0.05, z, 2.6, '#ff6a4a');
        this.burst(this.juiceDrops, x, 0.8, z, 0, 0, 24, 4, 0.08, 1, -0.5);
        this.burst(this.stars, x, 1.2, z, 0, 0, 6, 3, 0.12, 1, 4);
        break;
      case 'phoenix':
        for (const pool of this.glitter.slice(0, 2)) this.burst(pool, x, 1, z, 0, 0, 16, 4.5, 0.08, 1.4, -0.5);
        this.burst(this.juiceDrops, x, 0.8, z, 0, 0, 24, 4, 0.08, 1.2, -1);
        this.shockwave(x, 0.05, z, 2.4, '#ff9a3a');
        break;
      case 'yeti':
        this.burst(this.glitter[3]!, x, 1, z, 0, 0, 36, 4.5, 0.08, 1.4, 1.5);
        this.shockwave(x, 0.05, z, 2, '#a8e4ff');
        break;
      case 'otter':
        this.burst(this.water, x, 0.8, z, 0, 0, 36, 3.5, 0.09, 1.2, -1);
        this.shockwave(x, 0.05, z, 2.2, '#ffcc33');
        break;
      case 'mermaid':
        this.burst(this.water, x, 0.8, z, 0, 0, 30, 4.5, 0.08, 1.1, 4);
        for (const pool of this.glitter.slice(0, 3)) this.burst(pool, x, 1, z, 0, 0, 10, 4, 0.08, 1.3, -0.5);
        this.shockwave(x, 0.05, z, 2.4, '#7ff0e0');
        break;
    }
  }

  /** Gliding down from the Toss: little cotton puffs and sparkles streaming behind. */
  glideTrail(x: number, y: number, z: number): void {
    this.tmpPos.set(x + (Math.random() - 0.5) * 0.4, y + 0.6, z + (Math.random() - 0.5) * 0.4);
    this.tmpVel.set(0, 0.3, 0);
    this.cotton.spawn(this.tmpPos, this.tmpVel, 0.12, 0.9, 0);
    const pool = this.glitter[Math.floor(Math.random() * this.glitter.length)]!;
    this.tmpPos.set(x + (Math.random() - 0.5) * 1.2, y + 1.6 + Math.random() * 0.8, z + (Math.random() - 0.5) * 1.2);
    this.tmpVel.set(0, 0.6, 0);
    pool.spawn(this.tmpPos, this.tmpVel, 0.06, 0.8, 0);
  }

  /** Juice Box at work: an orange droplet rising off the plush now and then. */
  juice(x: number, y: number, z: number): void {
    this.burst(this.juiceDrops, x, y + 0.9, z, 0, 0, 1, 0.6, 0.05, 0.6, -2);
  }

  private readonly scene: THREE.Scene;

  /** Spawns one of every particle far off the map so their shaders compile at startup. */
  warmUp(): void {
    this.knockout(-500, -500);
    this.armorHit(-500, -500, 0, 0, 5);
    this.splash(-500, -500);
    this.marbleBurst(-500, 0.5, -500, 2);
    this.glitterBurst(-500, 0.5, -500, 2, 0.1);
    this.bonk(-500, -500);
    this.bubblePop(-500, 0.8, -500);
    this.cardboard(-500, -500, true);
    this.juice(-500, 0, -500);
    for (const a of ANIMALS) this.setKnockout(a, -500, -500);
  }

  /** A plush re-stitched by a teammate: a puff of stuffing and a pink sparkle. */
  revive(x: number, z: number): void {
    this.burst(this.cotton, x, 0.6, z, 0, 0, 14, 3, 0.1, 0.8, 2);
    this.burst(this.glitter[0]!, x, 1, z, 0, 0, 16, 3, 0.07, 1.2, -0.5);
    this.shockwave(x, 0.06, z, 1.6, '#ff7aa8');
  }

  /** A marble bursts: a ring rolling out over the ground and glass bits flying. */
  marbleBurst(x: number, y: number, z: number, radius: number): void {
    this.shockwave(x, y + 0.05, z, radius, '#ffffff');
    for (const pool of this.glass) this.burst(pool, x, y + 0.3, z, 0, 0, 4, radius * 2.2, 0.08, 0.6, 12);
    this.burst(this.cotton, x, y + 0.3, z, 0, 0, 6, radius * 1.2, 0.12, 0.5, 2);
  }

  /** A glitter bomb bursts and leaves a sparkling cloud for `seconds`. */
  glitterBurst(x: number, y: number, z: number, radius: number, seconds: number): void {
    this.shockwave(x, y + 0.05, z, radius, '#ff7ac8');
    for (const pool of this.glitter) this.burst(pool, x, y + 0.6, z, 0, 0, 10, radius * 1.6, 0.06, 1.2, 1.5);
    this.emitters.push({ x, y, z, radius, left: seconds, acc: 0 });
  }

  /** A flake or two of glitter falling off a glittered plush. */
  glitterShed(x: number, y: number, z: number): void {
    const pool = this.glitter[Math.floor(Math.random() * this.glitter.length)]!;
    this.burst(pool, x, y + 1.2, z, 0, 0, 1, 0.8, 0.05, 0.9, 6);
  }

  /** Someone got bonked by a Pillow Hammer: stars and a puff of fluff. */
  bonk(x: number, z: number): void {
    this.burst(this.stars, x, 1.4, z, 0, 0, 5, 2.5, 0.16, 0.7, 4);
    this.burst(this.cotton, x, 1.0, z, 0, 0, 5, 2, 0.08, 0.5, 2);
  }

  /** A trap bubble pops: soap droplets. */
  bubblePop(x: number, y: number, z: number): void {
    this.burst(this.soap, x, y, z, 0, 0, 12, 3, 0.06, 0.45, 6);
  }

  /** A marble bounced off a wall. */
  bounce(x: number, z: number): void {
    this.burst(this.stars, x, 0.6, z, 0, 0, 2, 1.5, 0.08, 0.3, 0);
  }

  private shockwave(x: number, y: number, z: number, radius: number, color: string): void {
    // Adds light (rather than covering the ground) so it reads bright on grass.
    const mesh = new THREE.Mesh(
      this.ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.waves.push({ mesh, life: 0.4, maxLife: 0.4, radius });
  }

  /** Stuffing knocked out of a plush, sprayed away from the hit direction. */
  stuffingHit(x: number, z: number, dirX: number, dirZ: number, amount: number): void {
    const n = Math.min(10, 2 + Math.round(amount / 4));
    this.burst(this.cotton, x, 0.8, z, dirX, dirZ, n, 3, 0.07 + amount * 0.003, 0.7, 4);
    // A harder hit knocks a couple of stars loose too.
    if (amount >= 12) this.burst(this.stars, x, 1.1, z, dirX, dirZ, amount >= 25 ? 3 : 2, 2.6, 0.09, 0.6, 5);
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
  /** A puff of steam from the toy train's chimney. */
  steam(x: number, y: number, z: number): void {
    this.burst(this.cotton, x, y, z, 0, 0, 1, 0.3, 0.14, 1.1, -1.2);
  }

  /** A goal! Confetti in every color and a ring on the ground. */
  goal(x: number, z: number): void {
    for (const pool of this.glitter) this.burst(pool, x, 1.2, z, 0, 0, 14, 5, 0.1, 1.6, 2);
    for (const pool of this.buttons) this.burst(pool, x, 1, z, 0, 0, 5, 4, 0.08, 1.2, 8);
    this.shockwave(x, 0.06, z, 2.6, '#ffd23a');
  }

  chestPop(x: number, z: number, base = 0): void {
    for (const pool of this.buttons) this.burst(pool, x, base + 0.8, z, 0, 0, 4, 3, 0.06, 0.9, 9);
    this.burst(this.cotton, x, base + 0.7, z, 0, 0, 6, 2, 0.08, 0.6, 2);
  }

  /** Stepping in lava: a puff of smoke and a few sparks. */
  burn(x: number, y: number, z: number): void {
    this.burst(this.cotton, x, y + 0.2, z, 0, 0, 6, 1.6, 0.09, 0.6, 3);
    this.burst(this.stars, x, y + 0.3, z, 0, 0, 4, 2.5, 0.07, 0.4, 6);
  }

  /** An air strike drop landing: a big splash, a clatter of dust, a burst of snow, or a cannonball's plume. */
  strikeLand(kind: 'balloons' | 'blocks' | 'snowballs' | 'cannonballs', x: number, y: number, z: number): void {
    if (kind === 'balloons') this.burst(this.water, x, y + 0.3, z, 0, 0, 16, 4, 0.08, 0.6, 10);
    else if (kind === 'cannonballs') {
      // A plume of water (or sand) thrown up, and a puff of smoke.
      this.burst(this.water, x, y + 0.3, z, 0, 0, 14, 5, 0.09, 0.7, 12);
      this.burst(this.cotton, x, y + 0.3, z, 0, 0, 8, 2.5, 0.1, 0.6, 1);
    }
    else if (kind === 'blocks') {
      this.burst(this.cotton, x, y + 0.2, z, 0, 0, 8, 3, 0.09, 0.45, 0);
      this.burst(this.stars, x, y + 0.6, z, 0, 0, 4, 2, 0.1, 0.5, 4);
    } else this.burst(this.cotton, x, y + 0.3, z, 0, 0, 16, 4.5, 0.1, 0.6, 6);
  }

  /** The piñata hit: a few bits of confetti. Burst: a big shower of confetti and candy. */
  pinata(x: number, y: number, z: number, burst: boolean): void {
    for (const pool of this.glitter) this.burst(pool, x, y, z, 0, 0, burst ? 10 : 2, burst ? 5 : 2.5, burst ? 0.09 : 0.06, burst ? 1.4 : 0.8, 5);
    if (burst) for (const pool of this.buttons) this.burst(pool, x, y, z, 0, 0, 5, 4, 0.07, 1.2, 9);
  }

  /** A few drops of the sprinkler's spray, flying out along (dx, dz). */
  spray(x: number, y: number, z: number, dx: number, dz: number): void {
    // Fast enough to reach the far edge of where it pushes (about 7 units out).
    this.burst(this.water, x, y + 0.3, z, dx, dz, 2, 11, 0.07, 0.9, 10);
  }

  /** The pond's ice breaking: a big splash of water and ice chips. */
  iceBreak(x: number, z: number): void {
    this.burst(this.water, x, 0.3, z, 0, 0, 30, 6, 0.1, 0.9, 10);
    this.burst(this.cotton, x, 0.3, z, 0, 0, 20, 7, 0.1, 0.8, 8);
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
  /** A step through water (the pool, the Rinse): droplets kicked up and a little ripple. */
  waterStep(x: number, y: number, z: number, dirX: number, dirZ: number): void {
    // White spray reads on the blue water; a couple of drops and a ripple.
    this.burst(this.cotton, x, y + 0.15, z, -dirX * 0.4, -dirZ * 0.4, 6, 1.9, 0.07, 0.45, 9);
    this.burst(this.water, x, y + 0.15, z, -dirX * 0.4, -dirZ * 0.4, 2, 1.6, 0.045, 0.35, 9);
    this.shockwave(x, y + 0.14, z, 0.7, '#9fdcf5');
  }

  drip(x: number, z: number): void {
    this.burst(this.water, x, 1.1, z, 0, 0, 2, 0.6, 0.04, 0.45, 9);
  }

  /** A plush bursts into a pile of fluff when Unstitched. */
  knockout(x: number, z: number): void {
    // Fewer puffs scattering wider and settling sooner: a burst, not a cloud hiding whoever's near.
    this.burst(this.cotton, x, 0.7, z, 0, 0, 22, 7, 0.12, 0.9, 9);
  }

  update(dt: number): void {
    this.cotton.update(dt);
    for (const pool of this.buttons) pool.update(dt);
    this.water.update(dt);
    for (const pool of this.glitter) pool.update(dt);
    for (const pool of this.glass) pool.update(dt);
    this.stars.update(dt);
    this.soap.update(dt);
    this.cardboardBits.update(dt);
    this.paws.update(dt);
    this.frogDrops.update(dt);
    this.feathers.update(dt);
    this.juiceDrops.update(dt);

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.life -= dt;
      const t = 1 - w.life / w.maxLife;
      w.mesh.scale.setScalar(Math.max(0.01, w.radius * (0.2 + 0.8 * Math.sqrt(t))));
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      if (w.life <= 0) {
        w.mesh.removeFromParent();
        (w.mesh.material as THREE.Material).dispose();
        this.waves.splice(i, 1);
      }
    }

    // Glitter clouds keep sparkling over their area, slowly falling.
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i]!;
      e.left -= dt;
      e.acc += dt * 40;
      while (e.acc >= 1) {
        e.acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * e.radius;
        this.tmpPos.set(e.x + Math.cos(a) * r, e.y + 0.3 + Math.random() * 1.6, e.z + Math.sin(a) * r);
        this.tmpVel.set((Math.random() - 0.5) * 0.4, -0.3, (Math.random() - 0.5) * 0.4);
        this.glitter[Math.floor(Math.random() * this.glitter.length)]!.spawn(this.tmpPos, this.tmpVel, 0.05, 0.9, 0.5);
      }
      if (e.left <= 0) this.emitters.splice(i, 1);
    }
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
