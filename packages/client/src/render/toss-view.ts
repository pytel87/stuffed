// The Toss blimp: a big patchwork toy blimp with fins, a basket and a spinning propeller, flying
// the match's line over the yard while everyone rides it, then drifting off.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { GameState } from '@stuffed/sim';
import { detailMaps, repeated } from './image-textures.ts';
import { tiled, wickerTexture } from './props.ts';
import { feltTexture, makePlastic, outlineMaterial, OUTLINE_COLOR, toonMaterial, toonMesh } from './toon.ts';

/** Seconds it keeps flying (and visible) past the end of its line. */
const LINGER = 4;

let patchwork: THREE.CanvasTexture | null = null;
/** The envelope's cloth: 12 gores round it by 8 rows nose to tail, each patch a plush color, some
 *  dotted, striped or checked, all sewn together with dashed stitches. */
function patchworkTexture(): THREE.CanvasTexture {
  if (patchwork) return patchwork;
  const W = 1024;
  const H = 512;
  const cols = 12;
  const rows = 8;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const colors = ['#ff8a80', '#ffd166', '#8fd3ff', '#b39ddb', '#a5d6a7', '#ffb3cf', '#fff3d6', '#ffab5e'];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pw = W / cols;
  const ph = H / rows;
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let col = 0; col < cols; col++) {
      // No two neighbors (left, above, and round the wrap) the same color.
      let k = 0;
      do k = Math.floor(rand() * colors.length);
      while (k === grid[r]![col - 1] || k === grid[r - 1]?.[col] || (col === cols - 1 && k === grid[r]![0]));
      grid[r]!.push(k);
      const x = col * pw;
      const y = r * ph;
      const base = colors[k]!;
      g.fillStyle = base;
      g.fillRect(x, y, pw, ph);
      const print = rand();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      if (print < 0.2) {
        for (let dy = 8; dy < ph; dy += 16) for (let dx = 8 + ((dy / 16) % 2) * 8; dx < pw; dx += 16) {
          g.beginPath();
          g.arc(x + dx, y + dy, 3.2, 0, Math.PI * 2);
          g.fill();
        }
      } else if (print < 0.35) {
        for (let dx = 0; dx < pw; dx += 14) g.fillRect(x + dx, y, 6, ph);
      } else if (print < 0.45) {
        for (let dy = 0; dy < ph; dy += 16) for (let dx = (dy / 16) % 2 ? 16 : 0; dx < pw; dx += 32) g.fillRect(x + dx, y + dy, 16, 16);
      }
    }
  }
  // Stitches along every seam (and a soft shadow line under them).
  g.strokeStyle = 'rgba(42,31,45,0.25)';
  g.lineWidth = 3;
  for (let col = 0; col <= cols; col++) {
    g.beginPath();
    g.moveTo(col * pw, 0);
    g.lineTo(col * pw, H);
    g.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    g.beginPath();
    g.moveTo(0, r * ph);
    g.lineTo(W, r * ph);
    g.stroke();
  }
  g.strokeStyle = '#fffaf0';
  g.lineWidth = 2.5;
  g.setLineDash([7, 6]);
  for (let col = 0; col <= cols; col++) {
    for (const off of [-5, 5]) {
      g.beginPath();
      g.moveTo(col * pw + off, 0);
      g.lineTo(col * pw + off, H);
      g.stroke();
    }
  }
  for (let r = 1; r < rows; r++) {
    g.beginPath();
    g.moveTo(0, r * ph + 5);
    g.lineTo(W, r * ph + 5);
    g.stroke();
  }
  patchwork = new THREE.CanvasTexture(c);
  patchwork.colorSpace = THREE.SRGBColorSpace;
  patchwork.anisotropy = 4;
  return patchwork;
}

/** A plush material: `map` (or plain felt) with the minky or corduroy weave catching the light. */
function plush(color: string, map: THREE.Texture | null, weave: 'minky' | 'corduroy', repeat: number): THREE.MeshToonMaterial {
  const m = toonMaterial(color, map ? { map } : {});
  m.normalMap = repeated(detailMaps(`fabric_${weave}`, feltTexture().image as HTMLCanvasElement).normal, repeat, repeat / 2);
  m.normalScale.setScalar(0.8);
  return m;
}

export function buildBlimp(): { root: THREE.Group; propeller: THREE.Object3D } {
  const root = new THREE.Group();
  // The envelope, long along +z (its heading): sewn patchwork gores running nose to tail.
  const shape = new THREE.SphereGeometry(1, 48, 24).rotateX(Math.PI / 2).scale(2.1, 2.1, 5.2);
  root.add(toonMesh(shape, '#ffffff', { outline: false, material: plush('#ffffff', patchworkTexture(), 'minky', 10) }));
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16).rotateX(Math.PI / 2).scale(2.16, 2.16, 5.26), outlineMaterial(OUTLINE_COLOR));
  root.add(hull);
  // Tail fins: felt, with corduroy ribs, and a stitched rim.
  // A rounded fin, swept back, puffy at the edges.
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.8, 0);
  finShape.lineTo(0.7, 0);
  finShape.quadraticCurveTo(1.15, 0.9, 0.95, 1.55);
  finShape.quadraticCurveTo(0.8, 1.75, 0.55, 1.6);
  finShape.quadraticCurveTo(0.0, 0.7, -0.8, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3 })
    .translate(0, 0, -0.05)
    .rotateY(Math.PI / 2);
  for (const rz of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const fin = toonMesh(finGeo, '#f7c331', { outline: 0.05, material: plush('#f7c331', null, 'corduroy', 2) });
    const holder = new THREE.Group();
    holder.rotation.z = rz;
    fin.position.set(0, 0.95, -4.1);
    holder.add(fin);
    root.add(holder);
  }
  // The basket everyone rides in: woven wicker with a padded red rim.
  const basket = toonMesh(new THREE.BoxGeometry(1.8, 0.7, 2.6), '#ffffff', { outline: 0.05, material: toonMaterial('#ffffff', { map: tiled(wickerTexture(), 1.5, 0.6) }) });
  basket.position.set(0, -2.6, 0.3);
  root.add(basket);
  const rim = toonMesh(new THREE.BoxGeometry(1.95, 0.16, 2.75), '#e2574c', { outline: 0.05, material: plush('#e2574c', null, 'minky', 2) });
  rim.position.set(0, -2.22, 0.3);
  root.add(rim);
  // Ropes from the basket's corners up into the envelope.
  const ropeMat = toonMaterial('#8a6a4a', { map: null });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const from = new THREE.Vector3(sx * 0.85, -2.2, 0.3 + sz * 1.25);
      const to = new THREE.Vector3(sx * 0.95, -1.6, 0.3 + sz * 1.9);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, from.distanceTo(to), 6), ropeMat);
      rope.position.copy(from).add(to).multiplyScalar(0.5);
      rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      root.add(rope);
    }
  }
  // Two sandbags hanging off the basket's sides.
  for (const sx of [-1, 1]) {
    const bag = toonMesh(new THREE.SphereGeometry(0.22, 12, 10), '#d8b98a', { outline: 0.08, material: plush('#d8b98a', null, 'corduroy', 1) });
    bag.scale.set(0.9, 1.15, 0.9);
    bag.position.set(sx * 1.05, -2.85, 0.9);
    root.add(bag);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), ropeMat);
    tie.position.set(sx * 1.0, -2.5, 0.9);
    root.add(tie);
  }
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -5.4);
  for (let i = 0; i < 3; i++) {
    const blade = toonMesh(new THREE.BoxGeometry(0.25, 1.4, 0.06), '#3fa9f5', { outline: 0.06, material: makePlastic(toonMaterial('#3fa9f5', { map: null })) });
    blade.position.y = 0.7;
    const arm = new THREE.Group();
    arm.rotation.z = (i / 3) * Math.PI * 2;
    arm.add(blade);
    propeller.add(arm);
  }
  const hub = toonMesh(new THREE.SphereGeometry(0.22, 12, 10), '#f7c331', { outline: 0.08, material: makePlastic(toonMaterial('#f7c331', { map: null })) });
  propeller.add(hub);
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
