// The wanderers, drawn: a robot vacuum (a round grey disc with a bumper and a blinking light), a red
// toy lawnmower, and a red snowplow with a blade and a beacon; plus each
// vehicle's switch, a push button like the air strike's.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { GameState, MapData, WandererDef } from '@stuffed/sim';
import { sparkleGlowTexture } from './loot-views.ts';
import { nextMark, outlineProp, snowTexture } from './props.ts';
import { buildStrikeButton, hazardTexture } from './strike-views.ts';
import { makePlastic, toonMaterial, toonMesh } from './toon.ts';

const plastic = (c: string) => makePlastic(toonMaterial(c, { map: null }));

function vacuum(): { root: THREE.Group; light: THREE.Mesh } {
  const root = new THREE.Group();
  const body = toonMesh(new THREE.CylinderGeometry(0.75, 0.75, 0.28, 32), '#d7dbe2', { outline: 0.04, material: plastic('#d7dbe2') });
  body.position.y = 0.16;
  root.add(body);
  const top = toonMesh(new THREE.CylinderGeometry(0.55, 0.62, 0.06, 32), '#3b3f48', { outline: false, material: plastic('#3b3f48') });
  top.position.y = 0.32;
  root.add(top);
  const bumper = toonMesh(new THREE.CylinderGeometry(0.78, 0.78, 0.14, 32, 1, true, -Math.PI / 2.4, Math.PI / 1.2), '#2a2630', { outline: false, material: toonMaterial('#2a2630', { map: null, side: THREE.DoubleSide }) });
  bumper.position.y = 0.14;
  bumper.rotation.y = Math.PI / 2;
  root.add(bumper);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#39ff7a', toneMapped: false }));
  light.position.set(0.35, 0.36, 0);
  root.add(light);
  // One even outline round the whole thing (see outlineProp).
  outlineProp(root, nextMark(), 0.025);
  return { root, light };
}

/** A rounded box (a box with soft edges), for toy vehicles. */
function soft(width: number, height: number, d: number, r: number, color: string, material?: THREE.Material): THREE.Mesh {
  // The bevel grows the outline by `b` all round: draw it that much smaller, so the box comes out
  // exactly width x height x d.
  const b = r * 0.6;
  const w = width - 2 * b;
  const h = height - 2 * b;
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(d - 2 * b) / 2);
  return toonMesh(geo, color, { outline: 0.03, material: material ?? plastic(color) });
}

/** A chunky toy wheel: a black tyre with a coloured hub. */
function wheel(r: number, wide: number, hub: string): THREE.Group {
  const g = new THREE.Group();
  const tyre = toonMesh(new THREE.TorusGeometry(r * 0.7, r * 0.32, 10, 20), '#2a2630', { outline: 0.06 });
  tyre.scale.z = wide / (r * 0.64);
  g.add(tyre);
  const cap = toonMesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, wide * 1.02, 16), hub, { outline: false, material: plastic(hub) });
  cap.rotation.x = Math.PI / 2;
  g.add(cap);
  return g;
}

/**
 * A toy push mower (it drives along +x): a round red deck over its blade, a white engine with a
 * pull-cord handle on top, a push handle and chunky wheels.
 */
function mower(): THREE.Group {
  const g = new THREE.Group();
  const deck = toonMesh(new THREE.CylinderGeometry(0.85, 0.9, 0.35, 28), '#e2433f', { outline: 0.04, material: plastic('#e2433f') });
  deck.position.y = 0.42;
  g.add(deck);
  const skirt = toonMesh(new THREE.CylinderGeometry(0.92, 0.92, 0.1, 28), '#3b3f48', { outline: false });
  skirt.position.y = 0.26;
  g.add(skirt);
  const engine = toonMesh(new THREE.CylinderGeometry(0.38, 0.42, 0.42, 20), '#f4f4f0', { outline: 0.05, material: plastic('#f4f4f0') });
  engine.position.set(0.05, 0.8, 0);
  g.add(engine);
  const cap = toonMesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#3b3f48', { outline: 0.06, material: plastic('#3b3f48') });
  cap.position.set(0.05, 1.0, 0);
  g.add(cap);
  const pull = toonMesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), '#f7c331', { outline: 0.1, material: plastic('#f7c331') });
  pull.position.set(0.05, 1.32, 0);
  g.add(pull);
  // The push handle: two bars rising from the deck's back, joined by a grip.
  const metal = plastic('#c9cfd8');
  for (const z of [-0.45, 0.45]) {
    const bar = toonMesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), '#c9cfd8', { outline: 0.12, material: metal });
    bar.rotation.z = 0.95;
    bar.position.set(-1.0, 1.05, z);
    g.add(bar);
  }
  const grip = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), '#2a2630', { outline: 0.1 });
  grip.rotation.x = Math.PI / 2;
  grip.position.set(-1.6, 1.48, 0);
  g.add(grip);
  for (const [x, z] of [[0.55, 0.85], [0.55, -0.85], [-0.55, 0.85], [-0.55, -0.85]] as const) {
    const w = wheel(0.28, 0.22, '#f7c331');
    w.position.set(x, 0.28, z);
    g.add(w);
  }
  // One even outline round the whole thing (see outlineProp).
  outlineProp(g, nextMark(), 0.025);
  return g;
}

/**
 * A toy snowplow (it drives along +x): a rounded red body and cab with a windscreen, a big
 * hazard-striped blade out front with snow heaped against it, chunky wheels, an exhaust pipe and a
 * beacon on the roof.
 */
function plow(): { root: THREE.Group; light: THREE.Mesh } {
  const root = new THREE.Group();
  const red = plastic('#d63a2f');
  const body = soft(1.6, 0.6, 1.3, 0.15, '#d63a2f', red);
  body.position.set(-0.1, 0.62, 0);
  root.add(body);
  const cab = soft(0.85, 0.75, 1.15, 0.15, '#d63a2f', red);
  cab.position.set(-0.35, 1.3, 0);
  root.add(cab);
  // A windscreen on the cab's front (it drives along +x).
  const windscreen = toonMesh(new THREE.BoxGeometry(0.04, 0.34, 0.8), '#7fc8f0', { outline: 0.06, material: plastic('#7fc8f0') });
  windscreen.position.set(0.085, 1.4, 0);
  root.add(windscreen);
  // The blade: hazard stripes on its face, a grey frame.
  const stripes = hazardTexture().clone();
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  stripes.repeat.set(2.5, 0.6);
  stripes.needsUpdate = true;
  const blade = toonMesh(new THREE.BoxGeometry(0.14, 0.7, 2.2), '#ffffff', { outline: 0.04, material: toonMaterial('#ffffff', { map: stripes }) });
  blade.position.set(1.0, 0.38, 0);
  blade.rotation.z = -0.2;
  root.add(blade);
  const arm = toonMesh(new THREE.BoxGeometry(0.4, 0.12, 0.6), '#3b3f48', { outline: 0.06 });
  arm.position.set(0.78, 0.45, 0);
  root.add(arm);
  // Snow heaped against the blade.
  const heap = toonMesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { outline: 0.04, material: toonMaterial('#ffffff', { map: snowTexture() }) });
  heap.scale.set(0.6, 0.6, 1.7);
  heap.position.set(1.32, 0, 0);
  root.add(heap);
  for (const [x, z] of [[0.35, 0.68], [0.35, -0.68], [-0.6, 0.68], [-0.6, -0.68]] as const) {
    const w = wheel(0.32, 0.26, '#f7c331');
    w.position.set(x, 0.32, z);
    root.add(w);
  }
  const pipe = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), '#3b3f48', { outline: 0.1 });
  pipe.position.set(-0.85, 1.25, 0.45);
  root.add(pipe);
  // The beacon on the roof, on a little base: dull while parked; while it drives, lit and glowing.
  const base = toonMesh(new THREE.CylinderGeometry(0.14, 0.16, 0.1, 14), '#3b3f48', { outline: 0.08 });
  base.position.set(-0.35, 1.82, 0);
  root.add(base);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8a5a2a', toneMapped: false }));
  light.scale.y = 1.3;
  light.position.set(-0.35, 1.87, 0);
  root.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleGlowTexture(), color: '#ffa53a', transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.4);
  glow.position.copy(light.position).add(new THREE.Vector3(0, 0.1, 0));
  // Drawn over the cab (it's light, not a thing), so the roof never cuts it off.
  (glow.material as THREE.SpriteMaterial).depthTest = false;
  glow.renderOrder = 5;
  glow.visible = false;
  glow.name = 'beacon';
  root.add(glow);
  // One even outline round the whole thing (see outlineProp).
  outlineProp(root, nextMark(), 0.025);
  return { root, light };
}

/** The mower's or plow's switch: the same hazard-striped push button as the air strike's. */
function pushButton(): ReturnType<typeof buildStrikeButton> {
  return buildStrikeButton();
}

interface View {
  def: WandererDef;
  root: THREE.Group;
  light?: THREE.Mesh;
  lever?: ReturnType<typeof pushButton>;
}

export class WandererViews {
  private mapId = '';
  private root: THREE.Group | null = null;
  private views: View[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    this.root?.removeFromParent();
    this.root = null;
    this.views = [];
    this.mapId = '';
  }

  /** `prev`/`curr`/`alpha`: drawn between the last two states, like the plushies. */
  update(map: MapData, prev: GameState, curr: GameState, alpha: number, tick: number, time: number): void {
    if (this.mapId !== map.id) this.build(map);
    this.views.forEach((v, i) => {
      const a = prev.wanderers[i] ?? curr.wanderers[i];
      const b = curr.wanderers[i];
      if (!a || !b) return;
      v.root.position.set(a.pos.x + (b.pos.x - a.pos.x) * alpha, 0, a.pos.y + (b.pos.y - a.pos.y) * alpha);
      let turn = b.dir - a.dir;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      v.root.rotation.y = -(a.dir + turn * alpha);
      if (v.def.kind === 'vacuum' && v.light) v.light.visible = Math.sin(time * 4) > -0.3;
      if (v.def.kind === 'plow' && v.light) {
        const on = b.mode === 'moving';
        const flash = 0.5 + 0.5 * Math.sin(time * 12);
        (v.light.material as THREE.MeshBasicMaterial).color.set(on ? '#ffb347' : '#8a5a2a');
        const glow = v.root.getObjectByName('beacon') as THREE.Sprite | undefined;
        if (glow) {
          glow.visible = on;
          (glow.material as THREE.SpriteMaterial).opacity = 0.5 + flash * 0.5;
          glow.scale.setScalar(1.1 + flash * 0.7);
        }
      }
      if ((v.def.kind === 'mower' || v.def.kind === 'plow') && b.mode === 'moving') v.root.position.y = Math.abs(Math.sin(time * 18)) * 0.04;
      if (v.lever) {
        const ready = b.mode === 'idle' && tick >= b.readyTick;
        // Like the air strike button: popped up and red when it works; pushed
        // in and grey while the mower or plow is out, its lights coming on as it recharges.
        const span = config.wanderers.vehicle.cooldown * config.tickRate;
        const progress = ready ? 1 : b.mode === 'moving' ? 0 : Math.max(0, 1 - (b.readyTick - tick) / span);
        v.lever.dots.forEach((d, k) => (d.visible = progress >= (k + 1) / v.lever!.dots.length));
        v.lever.glow.visible = false;
        v.lever.cap.position.y = ready ? 0.58 : 0.45;
        (v.lever.cap.material as THREE.MeshToonMaterial).color.set(ready ? '#ff4a1c' : '#b8a9ad');
      }
    });
  }

  private build(map: MapData): void {
    this.clear();
    this.mapId = map.id;
    const root = new THREE.Group();
    for (const d of map.wanderers ?? []) {
      const v: View = { def: d, root: new THREE.Group() };
      if (d.kind === 'vacuum') {
        const m = vacuum();
        v.root.add(m.root);
        v.light = m.light;
      } else if (d.kind === 'mower') {
        v.root.add(mower());
      } else {
        const p = plow();
        v.root.add(p.root);
        v.light = p.light;
      }
      root.add(v.root);
      if (d.switch) {
        const l = pushButton();
        l.root.position.set(d.switch.x, 0, d.switch.y);
        root.add(l.root);
        v.lever = l;
      }
      this.views.push(v);
    }
    this.scene.add(root);
    this.root = root;
  }
}

/** For the switch prompt picture (without its ring and lights). */
export function buildLever(): THREE.Group {
  const b = pushButton();
  b.glow.removeFromParent();
  for (const d of b.dots) d.removeFromParent();
  return b.root;
}
