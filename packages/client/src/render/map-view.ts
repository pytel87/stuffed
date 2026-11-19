// Static map visuals: felt lawn (no fence: it carries on past the edges), ground patches (sand, dirt, a picnic blanket,
// stepping stones), pools, and decorative grass. Built once per match.
import * as THREE from 'three';
import type { Circle, Decor, Ground, MapData } from '@stuffed/sim';
import {
  carpetTexture, cloverTexture, bigDrawingTexture, cobblesTexture, dirtTexture, drift, gravelTexture, iceTexture, lawnTexture, mulchTexture, needlesTexture,
  outlineProp, patioTexture, picnicTexture, playmatTexture, plowedTexture, rugTexture, sandTexture, snowTexture, stoneTexture, tiled, waterTexture, woodFloorTexture,
} from './props.ts';
import { mergeStatic } from './merge-static.ts';
import { evenOutlines, makePlastic, outlineMaterial, OUTLINE_COLOR, pushedOutlineMaterial, thickOutlineMaterial, toonMaterial, toonMesh } from './toon.ts';

/** How far the lawn (and its patches and grass) carries on past the map's edges. */
const LAWN_BEYOND = 64;
/** Patches and grass stop a little earlier; it's all underwater past there anyway. */
const DECOR_BEYOND = 24;

export function buildMapView(map: MapData): THREE.Group {
  const g = new THREE.Group();
  const { width: w, height: h } = map;

  // No fence around the yard: the lawn just goes on (the Rinse is the edge of play).
  const lw = w + 2 * LAWN_BEYOND;
  const lh = h + 2 * LAWN_BEYOND;
  // The Bedroom: wooden floorboards instead of the lawn.
  const indoors = map.theme === 'bedroom';
  const snowy = map.theme === 'snow';
  const lawnMat = indoors
    ? toonMaterial('#ffffff', { map: tiled(woodFloorTexture(), lw / 4, lh / 4) })
    : snowy
      ? toonMaterial('#ffffff', { map: tiled(snowTexture(), lw / 10, lh / 10) })
      : toonMaterial('#ffffff', { map: tiled(lawnTexture(), lw / 8, lh / 8) });
  // Split into tiles: two huge triangles reaching far past the screen get their depth wrong on
  // some GPUs (seen with wide phone screens), and the lawn then covers everything on it.
  const lawnGeo = new THREE.PlaneGeometry(lw, lh, Math.ceil(lw / 4), Math.ceil(lh / 4));
  if (!indoors) {
    // Big soft patches of lighter and darker green, so the lawn isn't one even carpet.
    patches(lawnGeo, map, snowy ? 0.12 : 0.3, w / 2, h / 2, true);
    lawnMat.vertexColors = true;
  }
  const lawn = new THREE.Mesh(lawnGeo, lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(w / 2, 0, h / 2);
  lawn.receiveShadow = true;
  g.add(lawn);

  for (const ground of map.grounds ?? []) g.add(groundPatch(ground, map));
  for (const pool of map.pools ?? []) g.add(poolView(pool));
  for (const ice of map.ice ?? []) g.add(iceView(ice));
  for (const d of map.decor ?? []) g.add(decorItem(d, mapRandom(map, Math.round(d.x * 13 + d.y * 7))));
  return g;
}

/** How the newer patches look: their texture, the size of one repeat, how much they're tinted
 *  in soft blobs (like the lawn, so a meadow matches the grass round it), how wide their edge
 *  fades into the ground round them (none: a crisp edge, for things laid down like a patio or a
 *  mat), and how high they lie (underlays, like the patio round the house, below the floor on them). */
interface Look {
  texture: () => THREE.Texture;
  tile: number;
  tint?: number;
  feather?: number;
  y?: number;
}
const LOOKS: Partial<Record<Ground['kind'], Look>> = {
  dirt: { texture: dirtTexture, tile: 8, tint: 0.1, feather: 1.6 },
  mulch: { texture: mulchTexture, tile: 9, tint: 0.1, feather: 1.4 },
  gravel: { texture: gravelTexture, tile: 5, feather: 1.2, y: 0.006 },
  patio: { texture: patioTexture, tile: 6, y: 0.006 },
  clover: { texture: cloverTexture, tile: 11, tint: 0.3, feather: 2.2 },
  carpet: { texture: carpetTexture, tile: 5 },
  playmat: { texture: playmatTexture, tile: 14 },
  needles: { texture: needlesTexture, tile: 5, tint: 0.12, feather: 2.6 },
  cobbles: { texture: cobblesTexture, tile: 9, feather: 1.8 },
  plowed: { texture: plowedTexture, tile: 6, feather: 1.2 },
};

function groundPatch(ground: Ground, map: MapData): THREE.Object3D {
  const look = LOOKS[ground.kind];
  if (look) return lookPatch(ground, look, map);
  if (ground.kind === 'drawing') {
    // One big sheet of paper, the drawing stretched over it once.
    const box = ground.box!;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(box.w, box.h).rotateX(-Math.PI / 2), toonMaterial('#ffffff', { map: bigDrawingTexture() }));
    sheet.position.set(box.x + box.w / 2, 0.012, box.y + box.h / 2);
    sheet.receiveShadow = true;
    return sheet;
  }
  const box = ground.box ?? { x: 0, y: 0, w: 0, h: 0 };
  const cx = box.x + box.w / 2;
  const cz = box.y + box.h / 2;
  if (ground.kind === 'stones') {
    // Round stepping stones along the box's long side.
    const g = new THREE.Group();
    const rand = mapRandom(map, Math.round(cx * 7 + cz));
    const long = box.w > box.h;
    const length = Math.max(box.w, box.h);
    const n = Math.max(1, Math.round(length / 1.8));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const r = 0.55 + rand() * 0.25;
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.08, 14), toonMaterial('#ffffff', { map: stoneTexture() }));
      stone.position.set(cx + (long ? t * length : (rand() - 0.5) * 0.6), 0.04, cz + (long ? (rand() - 0.5) * 0.6 : t * length));
      stone.receiveShadow = true;
      // Outlined like everything else: round its top, and a dark ring on the lawn round its foot
      // (the lawn hides the outline's lower half).
      stone.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.035, r * 1.05 + 0.035, 0.08 + 0.04, 14), pushedOutlineMaterial(OUTLINE_COLOR)));
      const foot = new THREE.Mesh(new THREE.RingGeometry(r * 1.05 - 0.01, r * 1.05 + 0.045, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }));
      foot.position.y = -0.04 + 0.016;
      stone.add(foot);
      g.add(stone);
    }
    return g;
  }
  if (ground.kind === 'rug') {
    // A round braided rug, an oval filling the box.
    const rug = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48).rotateX(-Math.PI / 2), toonMaterial('#ffffff', { map: rugTexture() }));
    rug.scale.set(box.w, 1, box.h);
    rug.position.set(cx, 0.015, cz);
    rug.receiveShadow = true;
    return rug;
  }
  const geometry = new THREE.PlaneGeometry(box.w, box.h, Math.ceil(box.w / 8), Math.ceil(box.h / 8)).rotateX(-Math.PI / 2);
  const material =
    ground.kind === 'blanket'
      ? toonMaterial('#ffffff', { map: tiled(picnicTexture(), box.w / 15, box.h / 15) })
      : ground.kind === 'floor'
        ? toonMaterial('#ffffff', { map: tiled(woodFloorTexture(), box.w / 3, box.h / 3) })
        : toonMaterial('#ffffff', { map: tiled(sandTexture(), box.w / 8, box.h / 8) });
  if (ground.kind === 'sand') {
    patches(geometry, map, 0.1, cx, cz);
    material.vertexColors = true;
  }
  const patch = new THREE.Mesh(geometry, material);
  patch.position.set(cx, 0.012, cz);
  patch.receiveShadow = true;
  if (ground.kind !== 'sand') return patch;
  const g = new THREE.Group();
  g.add(patch, sandBits(box, map));
  return g;
}

/** A patch with one of the newer looks, a box or a circle. With a feather, it's a fine grid a
 *  little bigger than its shape whose corners fade out across a ragged, gently wobbling edge. */
function lookPatch(ground: Ground, look: Look, map: MapData): THREE.Mesh {
  const feather = look.feather ?? 0;
  const circle = ground.circle;
  const box = ground.box ?? { x: 0, y: 0, w: 0, h: 0 };
  const cx = circle ? circle.center.x : box.x + box.w / 2;
  const cz = circle ? circle.center.y : box.y + box.h / 2;
  const w = (circle ? circle.radius * 2.2 : box.w) + feather * 2;
  const h = (circle ? circle.radius * 2.2 : box.h) + feather * 2;
  const step = feather ? 0.5 : 8;
  const geometry = new THREE.PlaneGeometry(w, h, Math.ceil(w / step), Math.ceil(h / step)).rotateX(-Math.PI / 2);
  const material = toonMaterial('#ffffff', { map: tiled(look.texture(), w / look.tile, h / look.tile) });
  if (look.tint) patches(geometry, map, look.tint, cx, cz);
  if (feather) {
    // How far outside its shape each point is (negative inside); a circle's edge wobbles round it.
    const rand = mapRandom(map, Math.round(cx * 5 + cz * 3));
    const phases = [rand(), rand(), rand()].map((p) => p * Math.PI * 2);
    const outside = circle
      ? (x: number, z: number) => {
          const a = Math.atan2(z, x);
          const r = circle.radius * (1 + 0.05 * Math.sin(3 * a + phases[0]!) + 0.03 * Math.sin(5 * a + phases[1]!));
          return Math.hypot(x, z) - r;
        }
      : (x: number, z: number) => {
          const qx = Math.abs(x) - box.w / 2;
          const qz = Math.abs(z) - box.h / 2;
          return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        };
    fadeEdge(geometry, (x, z) => outside(x, z) + feather * 0.45 * ragged(x + cx + phases[2]!, z + cz), feather);
    material.transparent = true;
    material.depthWrite = false;
  }
  if (look.tint || feather) material.vertexColors = true;
  const patch = new THREE.Mesh(geometry, material);
  patch.position.set(cx, look.y ?? 0.012, cz);
  // Underneath anything else see-through (and an underlay under the patches on it).
  patch.renderOrder = look.y ? -2 : -1;
  patch.receiveShadow = true;
  return patch;
}

/** Small-scale noise, about -1..1, for a ragged edge (in world units). */
function ragged(x: number, z: number): number {
  return 0.55 * Math.sin(x * 1.3 + z * 0.7) * Math.sin(z * 1.1 - x * 0.5) + 0.3 * Math.sin(x * 2.3 - z * 1.9 + Math.sin(z * 0.9) * 2) + 0.15 * Math.sin(x * 4.1 + z * 3.7 + Math.sin(x * 0.7) * 3);
}

/** Fades a flat patch's vertices out where `outside(x, z)` (local units outside its edge) runs
 *  from -feather/2 to +feather/2, keeping any tint already on them. */
function fadeEdge(geo: THREE.BufferGeometry, outside: (x: number, z: number) => number, feather: number): void {
  const pos = geo.attributes.position!;
  const tint = geo.attributes.color;
  const colors = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(outside(pos.getX(i), pos.getZ(i)) / feather + 0.5, 0, 1);
    for (let c = 0; c < 3; c++) colors[i * 4 + c] = tint ? tint.getComponent(i, c) : 1;
    colors[i * 4 + 3] = 1 - t * t * (3 - 2 * t);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
}

/** Tints a flat ground's vertices lighter and darker in big soft blobs (`amount` either way).
 *  The geometry is laid flat (x, z), centered on (cx, cz) in the world. */
function patches(geo: THREE.BufferGeometry, map: MapData, amount: number, cx = 0, cz = 0, darkenBeyond = false): void {
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const seed = map.id.length * 1.7;
  for (let i = 0; i < pos.count; i++) {
    // The lawn plane is still in the xy plane here (it's rotated as a mesh); patches use xz.
    const x = pos.getX(i) + cx;
    const z = (pos.getZ(i) || -pos.getY(i)) + cz;
    const n = Math.sin(x * 0.26 + seed) * Math.cos(z * 0.22 - seed) + 0.6 * Math.sin((x + z) * 0.45 + seed * 2) * Math.sin((x - z) * 0.37);
    // Past the map's edge the lawn darkens bit by bit into the deep green beyond.
    const out = darkenBeyond ? Math.max(0, -x, x - map.width, -z, z - map.height) : 0;
    const v = (1 + (n / 1.6) * amount) * (1 - Math.min(0.45, out * 0.012));
    // Lighter patches lean a little yellow (sunny), darker ones a little blue (shady).
    colors[i * 3] = v * (1 + (v - 1) * 0.5);
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v * (1 - (v - 1) * 0.6);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

let scallopGeo: THREE.BufferGeometry | null = null;
/** A scallop shell lying flat: a rounded fan, closed (so it takes an outline all round). */
function scallop(): THREE.BufferGeometry {
  if (scallopGeo) return scallopGeo;
  const fan = new THREE.Shape();
  fan.moveTo(0, -0.05);
  fan.absarc(0, 0.02, 0.2, Math.PI * 0.05, Math.PI * 0.95, false);
  fan.lineTo(0, -0.05);
  scallopGeo = new THREE.ExtrudeGeometry(fan, { depth: 0.02, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 16 })
    .rotateX(-Math.PI / 2)
    .translate(0, -0.01, 0.06);
  return scallopGeo;
}

/** Shells, pebbles and little mounds scattered on a sandpit (merged into a few meshes). */
function sandBits(box: { x: number; y: number; w: number; h: number }, map: MapData): THREE.Object3D {
  const g = new THREE.Group();
  const rand = mapRandom(map, Math.round(box.x * 11 + box.y * 3));
  const n = Math.round((box.w * box.h) / 7);
  const shellColors = ['#ffd9c9', '#fff1dc', '#ffc7d6'];
  for (let i = 0; i < n; i++) {
    const x = box.x + 0.5 + rand() * (box.w - 1);
    const z = box.y + 0.5 + rand() * (box.h - 1);
    const kind = rand();
    // Clear of the buried treasure (a pebble stuck into its mound).
    if ((map.digs ?? []).some((d) => Math.hypot(d.x - x, d.y - z) < 1.6)) continue;
    if (kind < 0.35) {
      // a scallop shell: a flat fan with ribs
      // (Low things are outlined all round: resting on their outlines, not sunk into the sand,
      // or only a crescent of outline showed along their far edge.)
      const shell = toonMesh(scallop(), shellColors[i % 3]!);
      shell.rotation.y = rand() * Math.PI * 2;
      evenOutlines(shell, 0.025);
      const geo = shell.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      shell.position.set(x, -geo.boundingBox!.min.y + 0.035, z);
      g.add(shell);
    } else if (kind < 0.75) {
      const pr = 0.1 + rand() * 0.08;
      const pebble = toonMesh(new THREE.SphereGeometry(pr, 10, 8), rand() < 0.5 ? '#c9c2b6' : '#a9a197');
      pebble.scale.set(1.3, 0.55, 1);
      pebble.rotation.y = rand() * Math.PI;
      evenOutlines(pebble, 0.025);
      pebble.position.set(x, pr * 0.55 + 0.03, z);
      g.add(pebble);
    } else {
      // a little heap of darker, damp sand
      const mound = toonMesh(new THREE.SphereGeometry(0.4 + rand() * 0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e7c98c', { outline: false });
      mound.scale.set(1, 0.3, 0.8);
      mound.position.set(x, 0.012, z);
      g.add(mound);
    }
  }
  mergeStatic(g);
  return g;
}

/** A frozen pond: glossy ice with frost, and a soft bank of snow round its edge. */
function iceView(pond: Circle): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(pond.center.x, 0, pond.center.y);
  const frost = tiled(iceTexture(), pond.radius / 5, pond.radius / 5);
  const ice = new THREE.Mesh(new THREE.CircleGeometry(pond.radius, 64).rotateX(-Math.PI / 2), makePlastic(toonMaterial('#e6f6ff', { map: frost }), true));
  ice.position.y = 0.02;
  ice.receiveShadow = true;
  g.add(ice);
  // A smooth bank of snow round its edge (one ring, outlined; separate lumps hid each other's outlines).
  // (Its snow repeated along it: stretched once round the ring, it smeared into streaks.)
  const around = (2 * Math.PI * (pond.radius + 0.3)) / 3;
  const bank = new THREE.Mesh(new THREE.TorusGeometry(pond.radius + 0.3, 0.5, 10, 96).rotateX(Math.PI / 2), toonMaterial('#ffffff', { map: tiled(snowTexture(), around, 1) }));
  bank.scale.y = 0.55;
  // Up a little, so its outline isn't lost in the snow along its foot.
  bank.position.y = 0.12;
  bank.receiveShadow = true;
  bank.add(new THREE.Mesh(new THREE.TorusGeometry(pond.radius + 0.3, 0.6, 10, 96).rotateX(Math.PI / 2), outlineMaterial(OUTLINE_COLOR)));
  g.add(bank);
  // Its foot on the ice gets a line too (an outline round it would be under the ice there).
  const foot = new THREE.Mesh(new THREE.RingGeometry(pond.radius + 0.3 - 0.58, pond.radius + 0.3 - 0.44, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }));
  foot.position.y = 0.025;
  g.add(foot);
  mergeStatic(g);
  return g;
}

/** A flat dark sheet `w` x `d` plus an outline's width all round, `y` below its owner's middle:
 *  the outline of something lying flat (paper). */
function flatEdge(w: number, d: number, y: number): THREE.Mesh {
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.07, d + 0.07).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }));
  edge.position.y = y;
  return edge;
}

/** A kiddie pool: shallow water inside an inflatable striped ring, and a rubber duck. */
function poolView(pool: Circle): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(pool.center.x, 0, pool.center.y);
  // The water reaches in under the rim (stopping at the pool's edge left a strip of lawn inside it).
  const reach = pool.radius + 0.35;
  const ripples = tiled(waterTexture(), reach / 4, reach / 4);
  const water = new THREE.Mesh(new THREE.CircleGeometry(reach, 64).rotateX(-Math.PI / 2), toonMaterial('#bfe9ff', { map: ripples }));
  drift(water, ripples);
  water.position.y = 0.03;
  water.receiveShadow = true;
  g.add(water);
  // The inflatable rim: two stacked glossy tubes with blue and white stripes, and a valve.
  const stripes = stripedVinyl();
  // Its top is at the rim's height in the sim (0.7): you jump over it, or onto it.
  for (const [y, r] of [[0.2, 0.26], [0.46, 0.24]] as const) {
    const tube = new THREE.Mesh(new THREE.TorusGeometry(pool.radius + 0.35, r, 16, 64), makePlastic(toonMaterial('#ffffff', { map: stripes }), true));
    tube.castShadow = tube.receiveShadow = true;
    // Its outline: a slightly fatter tube round the same circle (scaling the ring would push it out),
    // kept behind the other tube, so it shows round the rim's edge but not as hairlines across it.
    tube.add(new THREE.Mesh(new THREE.TorusGeometry(pool.radius + 0.35, r + 0.05, 12, 64), pushedOutlineMaterial(OUTLINE_COLOR, 0.025)));
    tube.rotation.x = Math.PI / 2;
    tube.position.y = y;
    g.add(tube);
  }
  // A dark line on the water along the rim's inner edge (the water hides the outline there).
  const inner = new THREE.Mesh(new THREE.RingGeometry(pool.radius + 0.35 - 0.33, pool.radius + 0.35 - 0.24, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }));
  inner.position.y = 0.035;
  g.add(inner);
  const valve = toonMesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 10), '#fff8ef', { outline: 0.1 });
  valve.position.set(pool.radius + 0.35, 0.72, 0);
  g.add(valve);
  return g;
}

let vinyl: THREE.CanvasTexture | null = null;
/** Blue and white stripes round an inflatable ring (16 of each), with a soft seam line. */
function stripedVinyl(): THREE.CanvasTexture {
  if (vinyl) return vinyl;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 16;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 32; i++) {
    g.fillStyle = i % 2 ? '#fff8ef' : '#3fa9f5';
    g.fillRect((i * 512) / 32, 0, 512 / 32, 16);
    g.fillStyle = 'rgba(42,31,45,0.18)';
    g.fillRect((i * 512) / 32, 0, 1.5, 16);
  }
  vinyl = new THREE.CanvasTexture(c);
  vinyl.colorSpace = THREE.SRGBColorSpace;
  vinyl.wrapS = THREE.RepeatWrapping;
  return vinyl;
}

/** A glossy rubber duck (drawn by ball-views.ts: it can be pushed about) at (x, z): a round body with an upturned tail, wings, a wide flat
 *  beak and button eyes. */
export function rubberDuck(x: number, z: number): THREE.Group {
  const duck = new THREE.Group();
  duck.position.set(x, 0.12, z);
  duck.rotation.y = 0.6;
  const yellow = () => makePlastic(toonMaterial('#ffd23a', { map: null }));
  const body = toonMesh(new THREE.SphereGeometry(0.45, 20, 14), '#ffd23a', { outline: 0.06, material: yellow() });
  body.scale.set(1.25, 0.75, 1);
  body.position.y = 0.2;
  duck.add(body);
  const tail = toonMesh(new THREE.ConeGeometry(0.2, 0.4, 12), '#ffd23a', { outline: 0.08, material: yellow() });
  tail.rotation.z = Math.PI / 2 + 0.7;
  tail.position.set(-0.55, 0.38, 0);
  duck.add(tail);
  for (const s of [-1, 1]) {
    const wing = toonMesh(new THREE.SphereGeometry(0.2, 12, 8), '#f5bf1f', { outline: 0.1, material: makePlastic(toonMaterial('#f5bf1f', { map: null })) });
    wing.scale.set(1.3, 0.6, 0.4);
    wing.position.set(-0.05, 0.3, s * 0.42);
    duck.add(wing);
  }
  const head = toonMesh(new THREE.SphereGeometry(0.3, 18, 12), '#ffd23a', { outline: 0.07, material: yellow() });
  head.position.set(0.32, 0.68, 0);
  duck.add(head);
  const orange = () => makePlastic(toonMaterial('#f08a2c', { map: null }));
  for (const [y, sy] of [[0.63, 0.32], [0.57, 0.24]] as const) {
    const bill = toonMesh(new THREE.SphereGeometry(0.16, 14, 8), '#f08a2c', { outline: 0.1, material: orange() });
    bill.scale.set(1.3, sy, 1);
    bill.position.set(0.6, y, 0);
    duck.add(bill);
  }
  for (const s of [-1, 1]) {
    const eye = toonMesh(new THREE.SphereGeometry(0.055, 10, 8), '#2a1f2d', { outline: false, material: makePlastic(toonMaterial('#2a1f2d', { map: null })) });
    eye.position.set(0.52, 0.78, s * 0.15);
    duck.add(eye);
  }
  return duck;
}

/** Render-only randomness; seeded by map id so the layout is the same every match. */
function mapRandom(map: MapData, salt: number): () => number {
  let seed = salt;
  for (const ch of map.id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}


const CRAYONS = ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a', '#9b7bd8', '#ff9cbf', '#f28a2c'];

let drawingTex: THREE.CanvasTexture | null = null;
/** A child's drawing: a sun, a house and grass. */
function drawingTexture(): THREE.CanvasTexture {
  if (drawingTex) return drawingTex;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 96, 128);
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.fillStyle = '#f7c331';
  g.beginPath();
  g.arc(72, 24, 12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e2574c';
  g.strokeRect(22, 62, 40, 34);
  g.beginPath();
  g.moveTo(18, 64);
  g.lineTo(42, 40);
  g.lineTo(66, 64);
  g.stroke();
  g.strokeStyle = '#5bd16a';
  g.beginPath();
  for (let x = 6; x < 92; x += 8) {
    g.moveTo(x, 114);
    g.lineTo(x + 3, 104);
  }
  g.stroke();
  drawingTex = new THREE.CanvasTexture(c);
  drawingTex.colorSpace = THREE.SRGBColorSpace;
  return drawingTex;
}

/** Floor clutter: drawn only, nothing to bump into. */
function decorItem(d: Decor, rand: () => number): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.turn ?? 0;
  const flat = (color: string) => toonMaterial(color, { map: null });
  switch (d.kind) {
    case 'track': {
      // A dark felt strip under the track, red sleepers across it and two steel rails, all with
      // dark edges so the track reads clearly on the wooden floor.
      const rx = d.rx ?? 8;
      const ry = d.ry ?? 5;
      const oval = (off: number, y: number) =>
        new THREE.CatmullRomCurve3(
          Array.from({ length: 120 }, (_, i) => {
            const a = (i / 120) * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a) * (rx + off), y, Math.sin(a) * (ry + off));
          }),
          true,
        );
      // The felt strip: a flat ring between two ovals.
      const inner = oval(-1.05, 0).getSpacedPoints(240);
      const outer = oval(1.05, 0).getSpacedPoints(240);
      const pos: number[] = [];
      for (let i = 0; i < 240; i++) {
        const [a0, a1, b0, b1] = [inner[i]!, inner[i + 1]!, outer[i]!, outer[i + 1]!];
        pos.push(a0.x, 0.02, a0.z, b0.x, 0.02, b0.z, a1.x, 0.02, a1.z, a1.x, 0.02, a1.z, b0.x, 0.02, b0.z, b1.x, 0.02, b1.z);
      }
      const stripGeo = new THREE.BufferGeometry();
      stripGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      stripGeo.computeVertexNormals();
      const strip = new THREE.Mesh(stripGeo, toonMaterial('#3d4a6b', { side: THREE.DoubleSide }));
      strip.receiveShadow = true;
      g.add(strip);
      const n = Math.round((Math.PI * (rx + ry)) / 0.85);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        // Outlined evenly all round (a scaled copy was heavy at its ends, missing along its sides),
        // resting on its outline (lower, the track's strip cut it off).
        const sleeper = toonMesh(new THREE.BoxGeometry(1.5, 0.1, 0.32), '#e2574c', { material: toonMaterial('#e2574c', { map: null }) });
        evenOutlines(sleeper, 0.03, -0.02);
        // (High enough that the outline's underside, the line seen round it from above, clears the
        // track's strip.)
        sleeper.position.set(Math.cos(a) * rx, 0.14, Math.sin(a) * ry);
        // Across the track: along the outward direction of the oval.
        sleeper.rotation.y = -Math.atan2(Math.sin(a) * rx, Math.cos(a) * ry);
        sleeper.receiveShadow = true;
        g.add(sleeper);
      }
      // Rails: a thin tube along each oval (scaling a ring would stretch its thickness too), with
      // a dark hull for an outline.
      for (const off of [-0.45, 0.45]) {
        // Resting on the sleepers' tops (0.19), so its outline runs unbroken over them.
        const curve = oval(off, 0.265);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.085, 8, true), flat('#cfd6e2')));
        // (Its depth pulled toward the camera: along its near side the outline is the shell's
        // underside, which the sleepers it rests on hid.)
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.115, 8, true), thickOutlineMaterial('#2a1f2d', 0, 0, 0.12)));
      }
      break;
    }
    case 'crayon': {
      const color = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
      const body = toonMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10), color, { outline: 0.12 });
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.11;
      g.add(body);
      const tip = toonMesh(new THREE.ConeGeometry(0.11, 0.22, 10), color, { outline: false });
      tip.rotation.z = -Math.PI / 2;
      tip.position.set(0.56, 0.11, 0);
      g.add(tip);
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.4, 10), flat('#fffaf3'));
      wrap.rotation.z = Math.PI / 2;
      wrap.position.set(-0.1, 0.11, 0);
      g.add(wrap);
      break;
    }
    case 'paper': {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2).rotateX(-Math.PI / 2), toonMaterial('#ffffff', { map: drawingTexture() }));
      sheet.position.y = 0.03;
      sheet.receiveShadow = true;
      // Outlined like everything else: a dark sheet a little bigger under it (a sheet this thin
      // can't take an outline of its own).
      sheet.add(flatEdge(1.5, 2, -0.008));
      g.add(sheet);
      break;
    }
    case 'sock': {
      // Lying flat on the floor: a leg along x and a foot turned off it, with a white band; all
      // one outline weight, and resting on their outlines (sunk in, the floor cut them off).
      const color = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
      const flatH = 0.45;
      const lie = 0.22 * flatH + 0.03;
      const leg = toonMesh(new THREE.CapsuleGeometry(0.22, 0.7, 6, 14).rotateZ(Math.PI / 2), color);
      leg.scale.y = flatH;
      leg.position.y = lie;
      g.add(leg);
      const foot = toonMesh(new THREE.CapsuleGeometry(0.22, 0.35, 6, 14).rotateX(Math.PI / 2), color);
      foot.scale.y = flatH;
      foot.position.set(0.6, lie, 0.22);
      g.add(foot);
      const stripe = toonMesh(new THREE.CylinderGeometry(0.235, 0.235, 0.14, 16).rotateZ(Math.PI / 2), '#fffaf3', { material: flat('#fffaf3') });
      stripe.scale.y = flatH;
      stripe.position.set(-0.35, lie, 0);
      g.add(stripe);
      for (const m of [leg, foot, stripe]) evenOutlines(m, 0.025);
      break;
    }
    case 'puzzle': {
      for (let i = 0; i < 3; i++) {
        const color = CRAYONS[(i * 2 + Math.floor(rand() * 7)) % CRAYONS.length]!;
        const piece = toonMesh(new THREE.BoxGeometry(0.55, 0.06, 0.55), color, { castShadow: false, material: flat(color) });
        evenOutlines(piece, 0.025);
        // Resting on their outlines (lower, the floor cut the outline off along the near edge),
        // each a little higher than the last, so overlapping pieces don't flicker.
        piece.position.set((rand() - 0.5) * 1.4, 0.06 + i * 0.03, (rand() - 0.5) * 1.4);
        piece.rotation.y = rand() * Math.PI;
        piece.receiveShadow = true;
        g.add(piece);
      }
      break;
    }
    case 'marbles': {
      const glass = ['#ff5a5a', '#3fa9f5', '#5bd16a', '#f7c331'];
      for (let i = 0; i < 4; i++) {
        const m = toonMesh(new THREE.SphereGeometry(0.16, 12, 10), glass[i % glass.length]!, { outline: 0.1 });
        m.position.set((rand() - 0.5) * 1.6, 0.16, (rand() - 0.5) * 1.6);
        g.add(m);
      }
      break;
    }
    case 'sled': {
      // A little red wooden sled on curly runners.
      const seat = toonMesh(new THREE.BoxGeometry(1.4, 0.1, 0.6), '#e2433f', { outline: 0.06 });
      seat.position.y = 0.28;
      g.add(seat);
      for (const s of [-1, 1]) {
        const runner = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 6, 20, Math.PI * 0.6), makePlastic(flat('#c9cfd8')));
        runner.rotation.set(0, 0, Math.PI * 1.2);
        runner.position.set(0.1, 0.8, s * 0.26);
        g.add(runner);
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), flat('#8a5a34'));
        strut.position.set(s * 0.45, 0.15, 0);
        g.add(strut);
      }
      break;
    }
    case 'snowballs': {
      // A little pyramid of snowballs, ready to throw.
      const snow = toonMaterial('#ffffff', { map: snowTexture() });
      for (const [x, y, z] of [[-0.22, 0.2, -0.12], [0.22, 0.2, -0.12], [0, 0.2, 0.22], [0, 0.52, 0]] as const) {
        const ball = toonMesh(new THREE.SphereGeometry(0.22, 12, 10), '#ffffff', { outline: 0.06, material: snow });
        ball.position.set(x, y, z);
        g.add(ball);
      }
      break;
    }
    case 'mitten': {
      // A lost knitted mitten, lying flat.
      const color = ['#e2433f', '#3d7ff2', '#5bd16a', '#9b7bd8'][Math.floor(rand() * 4)]!;
      const hand = toonMesh(new THREE.SphereGeometry(0.3, 14, 10), color, { outline: 0.08 });
      hand.scale.set(0.8, 0.25, 1.1);
      hand.position.y = 0.08;
      g.add(hand);
      const thumb = toonMesh(new THREE.SphereGeometry(0.12, 10, 8), color, { outline: 0.1 });
      thumb.scale.set(1, 0.4, 1.4);
      thumb.position.set(0.24, 0.08, 0.05);
      thumb.rotation.y = 0.6;
      g.add(thumb);
      const cuff = toonMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12), '#fffaf3', { outline: 0.08 });
      cuff.rotation.x = Math.PI / 2;
      cuff.scale.set(1, 1, 0.45);
      cuff.position.set(0, 0.08, -0.36);
      g.add(cuff);
      break;
    }
    case 'car': {
      // Resting on its wheels' outlines (lower, the open foot cut a notch out of each wheel's line).
      g.position.y = 0.03;
      const color = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
      const body = toonMesh(new THREE.BoxGeometry(1.1, 0.3, 0.6), color, { outline: 0.06 });
      body.position.y = 0.3;
      g.add(body);
      const cab = toonMesh(new THREE.BoxGeometry(0.55, 0.25, 0.5), '#d4f4ff', { outline: 0.08 });
      cab.position.set(-0.05, 0.55, 0);
      g.add(cab);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        // Charcoal rubber (as dark as the outline, a wheel and its line were one blob) with a hub.
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 24), flat('#4a4552'));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx * 0.35, 0.15, sz * 0.32);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.104, 16), flat('#e8e4ec'));
        wheel.add(hub);
        g.add(wheel);
      }
      break;
    }
  }
  // Small things on the floor: one even outline round each (the track keeps its own, see above).
  if (d.kind !== 'track') outlineProp(g, 32 + (Math.round(d.x * 7 + d.y * 13) % 220), 0.025);
  mergeStatic(g);
  return g;
}
