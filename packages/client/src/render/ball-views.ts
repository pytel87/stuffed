// Beach balls, drawn where the match says they are: they roll (turning with the distance
// covered) and squash and wobble for a moment when a plush bounces off one.
import * as THREE from 'three';
import type { Ball, GameState } from '@stuffed/sim';
import { stripeTexture } from './props.ts';
import { toonMaterial, toonMesh } from './toon.ts';

interface BallView {
  /** Moves over the ground. */
  root: THREE.Group;
  /** Squashes (kept upright). */
  squash: THREE.Group;
  /** Rolls. */
  ball: THREE.Mesh;
  radius: number;
  wobble: number;
}

export class BallViews {
  private readonly views = new Map<number, BallView>();
  private readonly axis = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    for (const v of this.views.values()) v.root.removeFromParent();
    this.views.clear();
  }

  /** A plush bounced off this ball. */
  bounce(id: number): void {
    const v = this.views.get(id);
    if (v) v.wobble = 1;
  }

  update(prev: GameState, curr: GameState, alpha: number, dt: number): void {
    const before = new Map(prev.balls.map((b) => [b.id, b]));
    for (const b of curr.balls) {
      const v = this.views.get(b.id) ?? this.create(b);
      const p = before.get(b.id) ?? b;
      const x = p.pos.x + (b.pos.x - p.pos.x) * alpha;
      const z = p.pos.y + (b.pos.y - p.pos.y) * alpha;
      // Roll by the ground covered since last frame, about the axis across the motion.
      const dx = x - v.root.position.x;
      const dz = z - v.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-4 && dist < 3) {
        this.axis.set(dz, 0, -dx).normalize();
        this.turn.setFromAxisAngle(this.axis, dist / v.radius);
        v.ball.quaternion.premultiply(this.turn);
      }
      v.root.position.set(x, 0, z);
      if (v.wobble > 0) {
        v.wobble = Math.max(0, v.wobble - dt * 1.6);
        // A squash that springs back and wobbles out, staying on the ground.
        const k = 0.28 * v.wobble * Math.cos((1 - v.wobble) * 22);
        v.squash.scale.set(1 + k * 0.6, 1 - k, 1 + k * 0.6);
        v.squash.position.y = v.radius * (1 - k);
      }
    }
  }

  private create(b: Ball): BallView {
    const root = new THREE.Group();
    root.position.set(b.pos.x, 0, b.pos.y);
    const squash = new THREE.Group();
    squash.position.y = b.radius;
    const ball = toonMesh(new THREE.SphereGeometry(b.radius, 24, 16), '#ffffff', { outline: 0.04, material: toonMaterial('#ffffff', { map: stripeTexture() }) });
    ball.rotation.z = 0.5 + b.id;
    squash.add(ball);
    root.add(squash);
    this.scene.add(root);
    const view = { root, squash, ball, radius: b.radius, wobble: 0 };
    this.views.set(b.id, view);
    return view;
  }
}
