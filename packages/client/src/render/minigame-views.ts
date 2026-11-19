// The mini-games, drawn: sparkling treasure mounds (holes once dug), the shooting gallery's booth
// with its ducks popping up and the run's lights, bowling pins (lying down once knocked over), and
// each hill's flag rising on its pole as someone holds it, with the progress ring round it.
import * as THREE from 'three';
import { config, galleryTargets } from '@stuffed/sim';
import type { GameState, MapData } from '@stuffed/sim';
import { glowMap, sparkleTexture } from './loot-views.ts';
import { outlinedBox } from './props.ts';
import { makePlastic, toonMaterial, toonMesh } from './toon.ts';

const plastic = (c: string) => makePlastic(toonMaterial(c, { map: null }));
const GOLD = '#ffd23a';

/** A little spade (for the dig prompt). */
export function buildSpade(): THREE.Group {
  const g = new THREE.Group();
  const handle = toonMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), '#a8743f', { outline: 0.1 });
  handle.position.y = 0.75;
  g.add(handle);
  const grip = toonMesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), '#e2433f', { outline: 0.1, material: plastic('#e2433f') });
  grip.position.y = 1.22;
  g.add(grip);
  const blade = toonMesh(new THREE.BoxGeometry(0.34, 0.4, 0.05), '#5d9cf5', { outline: 0.08, material: plastic('#5d9cf5') });
  blade.position.y = 0.22;
  g.add(blade);
  return g;
}

/** A yellow rubber duck target on a stick (it flips up and down from its foot). */
function duck(): THREE.Group {
  const g = new THREE.Group();
  const stick = toonMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), '#8e6036', { outline: false });
  stick.position.y = 0.25;
  g.add(stick);
  const yellow = plastic('#ffd23a');
  const body = toonMesh(new THREE.SphereGeometry(0.32, 14, 10), GOLD, { outline: 0.06, material: yellow });
  body.scale.set(1.2, 0.9, 0.7);
  body.position.y = 0.75;
  g.add(body);
  const head = toonMesh(new THREE.SphereGeometry(0.2, 12, 10), GOLD, { outline: 0.06, material: yellow });
  head.position.set(0.18, 1.1, 0);
  g.add(head);
  const beak = toonMesh(new THREE.ConeGeometry(0.07, 0.18, 8), '#ff7a2f', { outline: 0.1, material: plastic('#ff7a2f') });
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.4, 1.08, 0);
  g.add(beak);
  for (const s of [-1, 1]) {
    const eye = toonMesh(new THREE.SphereGeometry(0.035, 8, 6), '#2a1f2d', { outline: false });
    eye.position.set(0.26, 1.16, s * 0.12);
    g.add(eye);
  }
  // Face the shooters (south, +z: toward the camera).
  g.rotation.y = -Math.PI / 2;
  return g;
}

/** Red and white stripes, for the booth's front and awning. */
let stripeTex: THREE.CanvasTexture | null = null;
function stripes(): THREE.CanvasTexture {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#e2433f';
    g.fillRect(i * 16, 0, 16, 16);
  }
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  stripeTex.wrapS = THREE.RepeatWrapping;
  return stripeTex;
}

function booth(x: number, y: number): { root: THREE.Group; ducks: THREE.Group[]; lights: THREE.Mesh[] } {
  const root = new THREE.Group();
  root.position.set(x, 0, y);
  const half = ((config.games.gallery.targets - 1) / 2) * config.games.gallery.spacing + 1;
  // (Snug outlines: scaled-up copies of these long boards stuck out past their ends as dark blocks.)
  const stripe = (w: number) => {
    const t = stripes().clone();
    t.repeat.set(w / 2, 1);
    t.needsUpdate = true;
    return toonMaterial('#ffffff', { map: t });
  };
  const counter = outlinedBox(half * 2, 0.4, 0.6, stripe(half * 2));
  counter.position.set(0, 0.2, 1.3);
  root.add(counter);
  const back = outlinedBox(half * 2, 2.4, 0.5, toonMaterial('#3d7ff2', { map: null }));
  back.position.set(0, 1.2, -0.85);
  root.add(back);
  for (const s of [-1, 1]) {
    const post = outlinedBox(0.3, 2.9, 0.3, toonMaterial('#f7c331', { map: null }));
    post.position.set(s * (half + 0.15), 1.45, -0.85);
    root.add(post);
  }
  // A striped awning along the top of the back board, tipped toward the shooters.
  const awning = outlinedBox(half * 2 + 0.8, 0.12, 0.9, stripe(half * 2 + 0.8));
  awning.position.set(0, 2.55, -0.5);
  awning.rotation.x = 0.35;
  root.add(awning);
  // The run's lights along the counter's front.
  const lights: THREE.Mesh[] = [];
  for (let i = 0; i < config.games.gallery.need; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#5a4a3a', toneMapped: false }));
    bulb.position.set((i - (config.games.gallery.need - 1) / 2) * 0.5, 0.42, 1.3);
    root.add(bulb);
    lights.push(bulb);
  }
  const ducks = galleryTargets({ gallery: { x, y } } as MapData).map((t) => {
    const d = duck();
    d.position.set(t.x - x, 0, 0);
    root.add(d);
    return d;
  });
  return { root, ducks, lights };
}

function pin(): THREE.Group {
  const g = new THREE.Group();
  const profile = [[0, 0], [0.12, 0], [0.18, 0.15], [0.2, 0.3], [0.12, 0.55], [0.09, 0.65], [0.13, 0.78], [0.1, 0.9], [0, 0.95]].map(([a, b]) => new THREE.Vector2(a, b));
  g.add(toonMesh(new THREE.LatheGeometry(profile, 14), '#ffffff', { outline: 0.06, material: plastic('#ffffff') }));
  const band = toonMesh(new THREE.TorusGeometry(0.105, 0.025, 6, 16), '#e2433f', { outline: false, material: plastic('#e2433f') });
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.66;
  g.add(band);
  return g;
}

/** A hill: a pole with a flag (raised as it's held) and a ring that fills up. */
function hillView(radius: number): { root: THREE.Group; flag: THREE.Mesh; fill: THREE.Mesh } {
  const root = new THREE.Group();
  const pole = toonMesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), '#c9cfd8', { outline: 0.3, material: plastic('#c9cfd8') });
  pole.position.y = 1.2;
  root.add(pole);
  const flag = toonMesh(new THREE.PlaneGeometry(0.8, 0.5).translate(0.4, -0.25, 0), GOLD, { outline: false, material: toonMaterial(GOLD, { map: null, side: THREE.DoubleSide }) });
  root.add(flag);
  const track = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.08, radius + 0.08, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#2a1f2d', transparent: true, opacity: 0.45, depthWrite: false }),
  );
  track.position.y = 0.03;
  // Drawn before the gold fill (drawn after it, the track's shade dimmed the gold to brown).
  track.renderOrder = 1;
  root.add(track);
  const fill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, depthWrite: false, toneMapped: false }));
  fill.position.y = 0.035;
  fill.renderOrder = 2;
  root.add(fill);
  return { root, flag, fill };
}

export class MiniGameViews {
  private mapId = '';
  private root: THREE.Group | null = null;
  private digs: { mound: THREE.Object3D; hole: THREE.Object3D; star: THREE.Sprite }[] = [];
  private booth: ReturnType<typeof booth> | null = null;
  private pins: THREE.Group[] = [];
  private hills: (ReturnType<typeof hillView> & { step: number; radius: number })[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.root?.removeFromParent();
    this.root = null;
    this.booth = null;
    this.digs = [];
    this.pins = [];
    this.hills = [];
    this.mapId = '';
  }

  update(map: MapData, state: GameState, time: number): void {
    if (this.mapId !== map.id) this.build(map);
    const g = state.games;
    this.digs.forEach((d, i) => {
      const dug = !!g.digs[i];
      d.mound.visible = d.star.visible = !dug;
      d.hole.visible = dug;
      d.star.scale.setScalar(0.6 + Math.sin(time * 5 + i) * 0.12);
      (d.star.material as THREE.SpriteMaterial).opacity = 0.6 + Math.sin(time * 3 + i * 2) * 0.4;
    });
    if (this.booth && g.gallery) {
      const gal = g.gallery;
      this.booth.ducks.forEach((d, i) => {
        const target = i === gal.up ? 0 : -Math.PI / 2;
        d.rotation.z += (target - d.rotation.z) * 0.35;
      });
      const resting = state.tick < gal.readyTick;
      this.booth.lights.forEach((l, i) => {
        const on = resting || i < gal.hits;
        (l.material as THREE.MeshBasicMaterial).color.set(on ? (resting && Math.sin(time * 6 + i) > 0 ? '#ffffff' : GOLD) : '#5a4a3a');
      });
    }
    if (g.pins) {
      this.pins.forEach((p, i) => {
        const down = !!g.pins!.down[i];
        p.rotation.x += ((down ? Math.PI / 2 : 0) - p.rotation.x) * 0.25;
        p.position.y = down ? 0.12 : 0;
      });
    }
    this.hills.forEach((h, i) => {
      const s = g.hills[i];
      if (!s) return;
      const k = Math.min(1, s.progress / (config.games.hill.hold * config.tickRate));
      h.flag.position.y = 0.6 + k * 1.75;
      h.flag.rotation.y = Math.sin(time * 3) * 0.25;
      const step = Math.floor(k * 64);
      if (step !== h.step) {
        h.step = step;
        h.fill.geometry.dispose();
        h.fill.geometry = new THREE.RingGeometry(h.radius - 0.08, h.radius + 0.08, 64, 1, Math.PI / 2 - (step / 64) * Math.PI * 2, (step / 64) * Math.PI * 2).rotateX(-Math.PI / 2);
      }
      h.fill.visible = step > 0;
      h.root.visible = state.tick >= s.readyTick;
    });
  }

  private build(map: MapData): void {
    this.clear();
    this.mapId = map.id;
    const root = new THREE.Group();
    const snow = map.theme === 'snow';
    for (const d of map.digs ?? []) {
      // A darker heap of dug-over sand (or snow) with a red X on it and a soft gold glow round it.
      const mound = new THREE.Group();
      mound.position.set(d.x, 0, d.y);
      const heap = toonMesh(new THREE.SphereGeometry(0.7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), snow ? '#e4eef8' : '#c9a36a', { outline: 0.05 });
      heap.scale.y = 0.4;
      mound.add(heap);
      for (const turn of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.18), toonMaterial('#d63a2f', { map: null }));
        bar.rotation.y = turn;
        bar.position.y = 0.29;
        mound.add(bar);
      }
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(1.3, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: GOLD, map: glowMap(), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
      );
      glow.position.y = 0.02;
      mound.add(glow);
      root.add(mound);
      const hole = new THREE.Group();
      const pit = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2), toonMaterial(snow ? '#9db8cf' : '#7a5a34', { map: null }));
      pit.position.y = 0.03;
      hole.add(pit);
      const pile = toonMesh(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow ? '#ffffff' : '#e8cf95', { outline: 0.05 });
      pile.scale.y = 0.5;
      pile.position.set(0.8, 0, 0.3);
      hole.add(pile);
      hole.position.set(d.x, 0, d.y);
      hole.visible = false;
      root.add(hole);
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture(), depthWrite: false, toneMapped: false, transparent: true }));
      star.position.set(d.x, 0.9, d.y);
      star.renderOrder = 5;
      root.add(star);
      this.digs.push({ mound, hole, star });
    }
    if (map.gallery) {
      this.booth = booth(map.gallery.x, map.gallery.y);
      root.add(this.booth.root);
    }
    for (const p of map.pins ?? []) {
      const v = pin();
      v.position.set(p.x, 0, p.y);
      root.add(v);
      this.pins.push(v);
    }
    for (const h of map.hills ?? []) {
      const v = hillView(h.radius);
      v.root.position.set(h.x, h.z, h.y);
      root.add(v.root);
      this.hills.push({ ...v, step: -1, radius: h.radius });
    }
    this.scene.add(root);
    this.root = root;
  }
}
