// The toy train, drawn where the match clock says it is (see sim systems/train.ts): an engine
// with a chimney puffing steam, then the cars, each turning along the track.
import * as THREE from 'three';
import { TRAIN, trainCars } from '@stuffed/sim';
import type { MapData, TrainTrack } from '@stuffed/sim';
import { mergeStatic } from './merge-static.ts';
import { outlinedBox } from './props.ts';
import { toonMaterial, toonMesh } from './toon.ts';

const COLORS = ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a', '#9b7bd8'];

function buildCar(index: number): THREE.Group {
  const g = new THREE.Group();
  const engine = index === 0;
  const L = TRAIN.carLength;
  const W = TRAIN.carWidth;
  const color = engine ? '#e2574c' : COLORS[index % COLORS.length]!;
  // Body along +z (the way it drives).
  const body = outlinedBox(W * 0.9, engine ? 0.8 : 0.9, L * 0.9, toonMaterial(color, { map: null }));
  body.position.y = 0.75;
  g.add(body);
  const base = outlinedBox(W, 0.2, L, toonMaterial('#2a1f2d', { map: null }));
  base.position.y = 0.3;
  g.add(base);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = toonMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14), '#fdfbf7', { outline: 0.12 });
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set((sx * W) / 2, 0.28, (sz * L) / 3);
      g.add(wheel);
    }
  }
  if (engine) {
    // The cab at the back, a chimney at the front, a cow catcher.
    const cab = outlinedBox(W * 0.9, 0.7, L * 0.38, toonMaterial('#3d7ff2', { map: null }));
    cab.position.set(0, 1.5, -L * 0.24);
    g.add(cab);
    const roof = outlinedBox(W, 0.12, L * 0.44, toonMaterial('#2a1f2d', { map: null }));
    roof.position.set(0, 1.9, -L * 0.24);
    g.add(roof);
    const chimney = toonMesh(new THREE.CylinderGeometry(0.2, 0.28, 0.6, 12), '#2a1f2d', { outline: 0.1 });
    chimney.position.set(0, 1.45, L * 0.3);
    g.add(chimney);
    const catcher = toonMesh(new THREE.ConeGeometry(0.55, 0.5, 4), '#f7c331', { outline: 0.08 });
    catcher.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    catcher.position.set(0, 0.35, L / 2 + 0.15);
    g.add(catcher);
  } else {
    // An open wagon with a load of toy blocks.
    for (const [x, z, c] of [[-0.3, -0.5, '#f7c331'], [0.3, 0.1, '#5bd16a'], [-0.2, 0.6, '#3d7ff2']] as const) {
      const blk = outlinedBox(0.5, 0.5, 0.5, toonMaterial(c, { map: null }));
      blk.position.set(x, 1.4, z);
      blk.rotation.y = x * 2;
      g.add(blk);
    }
  }
  mergeStatic(g);
  return g;
}

export class TrainView {
  private readonly cars: THREE.Group[] = [];
  private readonly track: TrainTrack | null;
  private smokeIn = 0;

  constructor(parent: THREE.Object3D, map: MapData) {
    this.track = map.track ?? null;
    if (!this.track) return;
    for (let i = 0; i < this.track.cars; i++) {
      const car = buildCar(i);
      parent.add(car);
      this.cars.push(car);
    }
  }

  /** `tick` may be fractional (between ticks). `puff` gets the chimney top now and then. */
  update(tick: number, dt: number, puff: (x: number, y: number, z: number) => void): void {
    if (!this.track) return;
    const cars = trainCars(this.track, tick);
    cars.forEach((c, i) => {
      const g = this.cars[i]!;
      g.position.set(c.pos.x, 0, c.pos.y);
      g.rotation.y = Math.atan2(c.dir.x, c.dir.y);
    });
    this.smokeIn -= dt;
    if (this.smokeIn <= 0 && cars[0]) {
      this.smokeIn = 0.35;
      const c = cars[0];
      puff(c.pos.x + c.dir.x * TRAIN.carLength * 0.3, 1.9, c.pos.y + c.dir.y * TRAIN.carLength * 0.3);
    }
  }
}
