// The map's piñata: a paper donkey hanging from a wooden frame, or a big wrapped present. It
// jiggles when hit and is gone once it bursts (the donkey's frame and rope stay).
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { GameState, PinataKind } from '@stuffed/sim';
import { sparkleGlowTexture, sparkleTexture } from './loot-views.ts';
import { foliage } from './props.ts';
import { makePlastic, makeTriplanar, toonMaterial, toonMesh } from './toon.ts';

const FRINGE = ['#ff6fa8', '#ffd23a', '#5dc8f5', '#7ad66b', '#ff9f43', '#b86bff'];

/** Rings of paper fringe along a stick (the donkey's body, legs, neck), in rotating colors. */
function fringe(radius: number, length: number, rings: number, offset = 0): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < rings; i++) {
    const c = FRINGE[(i + offset) % FRINGE.length]!;
    const ring = toonMesh(new THREE.CylinderGeometry(radius, radius * 1.04, length / rings, 16), c, { outline: 0.04 });
    ring.position.y = -length / 2 + (i + 0.5) * (length / rings);
    g.add(ring);
  }
  return g;
}

/** The paper donkey, its middle at its origin, facing +x. */
function donkey(): THREE.Group {
  const g = new THREE.Group();
  const body = fringe(0.34, 1.1, 6);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  for (const [x, z] of [[-0.35, -0.18], [-0.35, 0.18], [0.35, -0.18], [0.35, 0.18]] as const) {
    const leg = fringe(0.09, 0.45, 3, x > 0 ? 2 : 4);
    leg.position.set(x, -0.5, z);
    g.add(leg);
  }
  const neck = fringe(0.15, 0.5, 3, 1);
  neck.position.set(0.55, 0.32, 0);
  neck.rotation.z = -0.5;
  g.add(neck);
  const head = fringe(0.17, 0.42, 3, 3);
  head.rotation.z = Math.PI / 2;
  head.position.set(0.8, 0.6, 0);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.ConeGeometry(0.07, 0.3, 8), '#ff6fa8', { outline: 0.08 });
    ear.position.set(0.72, 0.85, s * 0.09);
    ear.rotation.x = s * 0.25;
    g.add(ear);
    const eye = toonMesh(new THREE.SphereGeometry(0.035, 8, 6), '#2a1f2d', { outline: false });
    eye.position.set(0.9, 0.66, s * 0.13);
    g.add(eye);
  }
  // A tassel tail.
  const tail = fringe(0.05, 0.35, 2, 5);
  tail.position.set(-0.62, 0.05, 0);
  tail.rotation.z = -0.9;
  g.add(tail);
  return g;
}

/** A big pink present with a gold ribbon cross and a bow, its middle at its origin. */
function present(): THREE.Group {
  const g = new THREE.Group();
  const box = toonMesh(new THREE.BoxGeometry(1.3, 1, 1.3), '#ff7ac8', { outline: 0.04, material: makePlastic(toonMaterial('#ff7ac8', { map: null })) });
  g.add(box);
  const ribbon = makePlastic(toonMaterial('#ffd23a', { map: null }));
  for (const [w, d] of [[1.32, 0.22], [0.22, 1.32]] as const) {
    g.add(toonMesh(new THREE.BoxGeometry(w, 1.02, d), '#ffd23a', { outline: false, material: ribbon }));
  }
  for (const s of [-1, 1]) {
    const loop = toonMesh(new THREE.TorusGeometry(0.2, 0.07, 8, 16), '#ffd23a', { outline: 0.1, material: ribbon });
    loop.position.set(s * 0.2, 0.66, 0);
    loop.rotation.set(0, Math.PI / 2, s * 0.6);
    g.add(loop);
  }
  const knot = toonMesh(new THREE.SphereGeometry(0.09, 10, 8), '#ffd23a', { outline: 0.1, material: ribbon });
  knot.position.y = 0.55;
  g.add(knot);
  return g;
}

/** A tapered piece of branch from `a` (radius `ra`) to `b` (radius `rb`). */
function limb(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, bark: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = toonMesh(new THREE.CylinderGeometry(rb, ra, len, 10), '#7a5236', { outline: 0.04, material: bark });
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/**
 * A branch growing out of the trunk at `from` (inside the tree's crown) over to the piñata's rope
 * at `to` (both relative to the piñata's spot): thick at the trunk, tapering, bending a little,
 * with a leafy twig on the way and leaves at its tip; and the rope hanging from it.
 */
function branch(from: THREE.Vector3, to: THREE.Vector3): { branch: THREE.Group; rope: THREE.Mesh } {
  const g = new THREE.Group();
  const bark = toonMaterial('#7a5236', { map: null });
  const out = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
  const tip = to.clone().addScaledVector(out, 0.8);
  tip.y += 0.15;
  // A gentle bend: up a little from the trunk, then out and slightly down to the tip.
  const mid = from.clone().lerp(tip, 0.45);
  mid.y += 0.35;
  g.add(limb(from, mid, 0.32, 0.2, bark), limb(mid, tip, 0.2, 0.09, bark));
  const twigEnd = mid.clone().addScaledVector(new THREE.Vector3(-out.z, 0, out.x), 1.1).add(new THREE.Vector3(0, 0.5, 0));
  g.add(limb(mid, twigEnd, 0.1, 0.05, bark));
  const leaves = makeTriplanar(toonMaterial('#4ea34a', { map: foliage(1).map }), 0.9);
  const clump = (at: THREE.Vector3, r: number) => {
    const c = toonMesh(new THREE.IcosahedronGeometry(r, 2), '#4ea34a', { outline: 0.05, outlineColor: '#1f3f26', material: leaves });
    c.position.copy(at);
    g.add(c);
  };
  clump(tip.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.65);
  clump(tip.clone().addScaledVector(out, 0.4).add(new THREE.Vector3(0, 0.05, 0.35)), 0.45);
  clump(twigEnd, 0.5);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6).translate(0, -0.5, 0), toonMaterial('#efe2c2', { map: null }));
  return { branch: g, rope };
}

export class PinataView {
  private root: THREE.Group | null = null;
  private body: THREE.Group | null = null;
  /** The donkey swings from this (the rope's top); the others wobble on the spot. */
  private pivot: THREE.Group | null = null;
  private rope: THREE.Mesh | null = null;
  private kind: PinataKind | null = null;
  private glow: THREE.Mesh | null = null;
  private star: THREE.Sprite | null = null;
  private jiggle = 0;
  private side = 1;
  /** Where the donkey's rope hangs from (above its spot). */
  private hangY = 0;

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.root?.removeFromParent();
    this.root = this.body = this.pivot = this.rope = this.glow = this.star = null;
    this.kind = null;
  }

  /** Took a hit: a swing or a wobble that dies down. */
  hit(): void {
    this.jiggle = 1;
    this.side = -this.side;
  }

  /** `branch`: where the donkey's branch leaves the tree (the map says). */
  update(state: GameState, branch: { x: number; y: number; z: number } | undefined, dt: number, time: number): void {
    const p = state.pinata;
    if (!p) return this.clear();
    if (!this.root || this.kind !== p.kind) this.build(p.kind, p.pos.x, p.z, p.pos.y, branch);
    this.body!.visible = this.glow!.visible = this.star!.visible = !p.broken;
    (this.glow!.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(time * 2.5) * 0.2;
    this.star!.scale.setScalar(0.45 + Math.sin(time * 4) * 0.08);
    (this.star!.material as THREE.SpriteMaterial).rotation = Math.sin(time * 1.7) * 0.4;
    if (this.rope) this.rope.scale.y = p.broken ? 0.35 : this.hangY - (config.pinata.lift.donkey + 0.45);
    this.jiggle = Math.max(0, this.jiggle - dt * 1.6);
    const wave = Math.sin(time * 14) * this.jiggle * this.side;
    if (p.kind === 'donkey') {
      // Swings from the rope (a little all the time, a lot when hit).
      this.pivot!.rotation.x = wave * 0.45 + Math.sin(time * 1.3) * 0.04;
      this.body!.rotation.y = Math.sin(time * 0.7) * 0.3;
    } else {
      this.pivot!.rotation.z = wave * 0.15;
      this.pivot!.scale.set(1 + Math.abs(wave) * 0.08, 1 - Math.abs(wave) * 0.08, 1 + Math.abs(wave) * 0.08);
    }
  }

  private build(kind: PinataKind, x: number, z: number, y: number, from: { x: number; y: number; z: number } | undefined): void {
    this.clear();
    this.kind = kind;
    const root = new THREE.Group();
    root.position.set(x, z, y);
    const pivot = new THREE.Group();
    const lift = config.pinata.lift[kind];
    let body: THREE.Group;
    if (kind === 'donkey') {
      // Hanging by a rope from a branch of a tree (it swings from the branch).
      // The rope hangs from the branch a bit below where it leaves the trunk (it droops).
      this.hangY = (from?.z ?? 4.5) - z - 0.9;
      const b = branch(new THREE.Vector3((from?.x ?? x - 3) - x, (from?.z ?? 4.5) - z, (from?.y ?? y) - y), new THREE.Vector3(0, this.hangY, 0));
      root.add(b.branch);
      this.rope = b.rope;
      pivot.position.y = this.hangY;
      pivot.add(b.rope);
      body = donkey();
      body.position.y = lift - this.hangY;
    } else {
      // Wobbles from its bottom.
      body = present();
      body.position.y = lift;
    }
    pivot.add(body);
    root.add(pivot);
    // A golden glow under it and a star twinkling over it: something special, whack it.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: sparkleGlowTexture(), color: '#ffd23a', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    );
    glow.position.y = 0.02;
    root.add(glow);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture(), depthWrite: false, toneMapped: false }));
    star.position.y = lift + (kind === 'donkey' ? 1.2 : 1.6);
    star.renderOrder = 5;
    root.add(star);
    this.glow = glow;
    this.star = star;
    this.scene.add(root);
    this.root = root;
    this.body = body;
    this.pivot = pivot;
  }
}
