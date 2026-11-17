// The Toss blimp: a big striped toy blimp with fins, a basket and a spinning propeller, flying
// the match's line over the yard while everyone rides it, then drifting off.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { GameState } from '@stuffed/sim';
import { toonMaterial, toonMesh } from './toon.ts';

/** Seconds it keeps flying (and visible) past the end of its line. */
const LINGER = 4;

function stripes(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  const colors = ['#ff5a5a', '#fff6ec', '#3fa9f5', '#fff6ec'];
  for (let i = 0; i < 16; i++) {
    g.fillStyle = colors[i % colors.length]!;
    g.fillRect(i * 16, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBlimp(): { root: THREE.Group; propeller: THREE.Object3D } {
  const root = new THREE.Group();
  // The envelope, long along +z (its heading); stripes run around it.
  const body = toonMesh(new THREE.SphereGeometry(1, 32, 20), '#ffffff', { outline: 0.03, material: toonMaterial('#ffffff', { map: stripes() }) });
  body.scale.set(2.1, 2.1, 5.2);
  body.rotation.z = Math.PI / 2;
  root.add(body);
  // Tail fins.
  for (const [rx, rz] of [[0, 0], [0, Math.PI / 2], [0, Math.PI], [0, -Math.PI / 2]] as const) {
    const fin = toonMesh(new THREE.BoxGeometry(0.15, 1.6, 1.4), '#f7c331', { outline: 0.05 });
    const holder = new THREE.Group();
    holder.rotation.set(rx, 0, rz);
    fin.position.set(0, 1.9, -4.4);
    holder.add(fin);
    root.add(holder);
  }
  // The basket everyone rides in, hanging underneath.
  const basket = toonMesh(new THREE.BoxGeometry(1.8, 0.7, 2.6), '#b5763f', { outline: 0.05 });
  basket.position.set(0, -2.6, 0.3);
  root.add(basket);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), toonMaterial('#6d4a2a', { map: null }));
      rope.position.set(sx * 0.8, -1.95, 0.3 + sz * 1.1);
      root.add(rope);
    }
  }
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -5.4);
  for (let i = 0; i < 3; i++) {
    const blade = toonMesh(new THREE.BoxGeometry(0.25, 1.4, 0.06), '#3fa9f5', { outline: 0.06 });
    blade.position.y = 0.7;
    const arm = new THREE.Group();
    arm.rotation.z = (i / 3) * Math.PI * 2;
    arm.add(blade);
    propeller.add(arm);
  }
  root.add(propeller);
  return { root, propeller };
}

export class TossView {
  private blimp: ReturnType<typeof buildBlimp> | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.blimp?.root.removeFromParent();
    this.blimp = null;
  }

  /** `tick` may be fractional (interpolated). */
  update(state: GameState, tick: number, time: number): void {
    const toss = state.toss;
    const span = toss ? toss.endTick - toss.startTick : 0;
    const k = toss ? (tick - toss.startTick) / Math.max(1, span) : 0;
    const showing = !!toss && tick < toss.endTick + LINGER * config.tickRate;
    if (!showing) {
      if (this.blimp) this.blimp.root.visible = false;
      return;
    }
    if (!this.blimp) {
      this.blimp = buildBlimp();
      this.scene.add(this.blimp.root);
    }
    const { root, propeller } = this.blimp;
    root.visible = true;
    // Keeps going straight past the end of its line, rising a little as it leaves.
    root.position.set(
      toss.from.x + (toss.to.x - toss.from.x) * k,
      config.toss.height + 3.3 + Math.max(0, k - 1) * 6 + Math.sin(time * 1.3) * 0.15,
      toss.from.y + (toss.to.y - toss.from.y) * k,
    );
    root.rotation.y = Math.atan2(toss.to.x - toss.from.x, toss.to.y - toss.from.y);
    propeller.rotation.z = time * 12;
  }
}
