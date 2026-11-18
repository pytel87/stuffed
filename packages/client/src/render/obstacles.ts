// Walls, bushes and roofs. The sim only knows boxes and circles; each wall's look comes from its
// kind (see props.ts), each roof's from its building's kind.
import * as THREE from 'three';
import type { Building, Circle, MapData, Wall } from '@stuffed/sim';
import { buildWall, cardboardTexture, corrugatedTexture, foliage, snowTexture, stoneTexture, plankTexture, quiltTexture, tableclothTexture, tiled, tileTexture } from './props.ts';
import { detailMaps, repeated } from './image-textures.ts';
import { mergeStatic } from './merge-static.ts';
import { feltTexture } from './toon.ts';
import { makeTriplanar, outlineMaterial, OUTLINE_COLOR, toonMaterial } from './toon.ts';

const OUTLINE = 0.045;
const BUSH = '#3f8f4a';

export interface BushView {
  circle: Circle;
  /** The leaf colors (one material per color). */
  materials: THREE.MeshToonMaterial[];
  /** Depth-only copies of the balls, drawn first while see-through, so only the nearest leaves show. */
  depth: THREE.Mesh[];
  outlines: THREE.Mesh[];
  /** The leafy balls (they stop taking shadows while see-through). */
  balls: THREE.Mesh[];
  seeThrough: boolean;
}

/**
 * A bush: a clump of leafy balls. `colors` gives each ball a color in turn (one for a leafy bush,
 * several for a laundry pile).
 */
function bush(circle: Circle, colors: readonly string[] = [BUSH], outlineColor = '#1f3f26', index = 0): { object: THREE.Object3D; view: BushView } {
  const g = new THREE.Group();
  g.position.set(circle.center.x, 0, circle.center.y);
  const leafy = colors[0] === BUSH;
  // Felt leaves on a bush; a laundry pile is knitted clothes.
  const detail = leafy ? foliage(1) : laundryDetail();
  // Leaves are projected from three sides (no stretching at the top of each ball); the knitted
  // laundry keeps its weave's normal map.
  const materials = colors.map((c) => {
    if (leafy) return makeTriplanar(toonMaterial(c, { map: detail.map }), 0.6);
    const m = toonMaterial(c, { map: detail.map });
    m.normalMap = detail.normal;
    return m;
  });
  const hull = outlineMaterial(outlineColor);
  // Pushed back a hair, so the see-through leaves never fight their own depth copies.
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const r = circle.radius;
  const balls: [number, number, number, number][] = [[0, 0, 1.15, r * 0.55]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    balls.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 0.75 + (i % 2) * 0.2, r * (0.42 + (i % 3) * 0.04)]);
  }
  const depth: THREE.Mesh[] = [];
  const outlines: THREE.Mesh[] = [];
  const ballMeshes: THREE.Mesh[] = [];
  balls.forEach(([x, z, y, size], i) => {
    const geo = new THREE.IcosahedronGeometry(size, 2);
    const ball = new THREE.Mesh(geo, materials[i % materials.length]!);
    ball.position.set(x, y, z);
    ball.castShadow = true;
    ball.receiveShadow = true;
    // After the depth-only copies (renderOrder 1) when see-through.
    ball.renderOrder = 2;
    ballMeshes.push(ball);
    const outline = new THREE.Mesh(geo, hull);
    outline.scale.setScalar(1.06);
    ball.add(outline);
    outlines.push(outline);
    const d = new THREE.Mesh(geo, depthOnly);
    d.position.copy(ball.position);
    d.visible = false;
    d.renderOrder = 1;
    depth.push(d);
    g.add(ball, d);
  });
  // Some bushes flower (white and pink), some have red berries; the rest are just leaves.
  if (leafy && index % 3 !== 2) {
    const flowers = index % 3 === 0;
    const petal = toonMaterial(flowers ? (index % 2 ? '#ffffff' : '#ffb3cf') : '#e2433f', { map: null });
    const middle = toonMaterial('#f7c331', { map: null });
    materials.push(petal, middle);
    let seed = index * 7919 + 13;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 9; k++) {
      const [bx, bz, by, size] = balls[k % balls.length]!;
      // On the upper half of a ball, facing outward.
      const a = rand() * Math.PI * 2;
      const up = 0.35 + rand() * 0.6;
      const n = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up));
      const spot = new THREE.Group();
      spot.position.set(bx, by, bz).addScaledVector(n, size * 0.98);
      spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      if (flowers) {
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2;
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), petal);
          leaf.scale.set(1, 0.4, 0.7);
          leaf.position.set(Math.cos(pa) * 0.1, 0, Math.sin(pa) * 0.1);
          leaf.renderOrder = 2;
          spot.add(leaf);
        }
        const mid = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), middle);
        mid.position.y = 0.03;
        mid.renderOrder = 2;
        spot.add(mid);
      } else {
        for (const [ox, oz] of [[0, 0], [0.11, 0.05], [-0.04, 0.11]] as const) {
          const berry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), petal);
          berry.position.set(ox, 0.04, oz);
          berry.renderOrder = 2;
          spot.add(berry);
        }
      }
      g.add(spot);
    }
  }
  return { object: g, view: { circle, materials, depth, outlines, balls: ballMeshes, seeThrough: false } };
}

/** Knitted laundry: the knit fabric's detail, repeated for the heaped clothes. */
function laundryDetail(): { map: THREE.Texture; normal: THREE.Texture } {
  const base = detailMaps('fabric_knit', feltTexture().image as HTMLCanvasElement);
  return { map: repeated(base.map, 2, 2), normal: repeated(base.normal, 2, 2) };
}

export interface RoofView {
  object: THREE.Group;
  /** The building it covers (loot lying on top fades with it). */
  building: Building;
  materials: THREE.Material[];
  meshes: THREE.Mesh[];
  /** The dark outline shells; they step aside while the roof is see-through. */
  outlines: THREE.Mesh[];
  opacity: number;
  /** How far it fades while you're inside: a translucent ghost, so you still see the house. */
  insideOpacity: number;
}

const ROOF_THICKNESS = 0.32;
const ROOF_OVERHANG = 0.2;
const ROOF_FADE_RATE = 10;

/** The roof over a building; its top is the walkable surface. Fades to a ghost while you're inside. */
function roof(b: Building): RoofView {
  const g = new THREE.Group();
  g.position.set(b.x + b.w / 2, b.height - ROOF_THICKNESS / 2 + 0.01, b.y + b.h / 2);
  const w = b.w + ROOF_OVERHANG * 2;
  const d = b.h + ROOF_OVERHANG * 2;
  const top = ROOF_THICKNESS / 2;
  const lid = (material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, ROOF_THICKNESS, d), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.add(new THREE.Mesh(new THREE.BoxGeometry(w + OUTLINE * 2, ROOF_THICKNESS + OUTLINE * 2, d + OUTLINE * 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide })));
    g.add(mesh);
    return mesh;
  };
  const on = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const flat = (color: string) => toonMaterial(color, { map: null });

  switch (b.kind ?? 'cardboard') {
    case 'cardboard': {
      lid(toonMaterial('#d8b48a', { map: tiled(cardboardTexture(), w / 3, d / 3) }));
      on(new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.02, 0.6), flat('#efe2c2')), 0, top + 0.011, 0);
      on(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, d + 0.02), flat('#efe2c2')), 0, top + 0.011, 0);
      on(new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.025, 0.05), new THREE.MeshBasicMaterial({ color: '#a8845c' })), 0, top + 0.013, 0);
      break;
    }
    case 'igloo': {
      // A dome of snow blocks (rows of bricks drawn on it) down to the ground, with an entrance
      // tunnel at its doorway. Fades like any roof while you're inside.
      // Wide enough to cover the ring of snow blocks under it.
      const R = Math.min(b.w, b.h) / 2 + 1.35;
      const H = b.height + 0.25;
      const base = -(b.height - ROOF_THICKNESS / 2 + 0.01);
      const bricks = toonMaterial('#ffffff', { map: iglooBricks() });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), bricks);
      dome.scale.set(R, H, R);
      dome.position.y = base;
      dome.castShadow = true;
      dome.receiveShadow = true;
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }));
      hull.scale.set(1.03, 1.03, 1.03);
      dome.add(hull);
      g.add(dome);
      // The tunnel: a half-tube out of the doorway (the side with no blocks, toward the open ground).
      const door = iglooDoor(b);
      const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 1.6, 18, 1, true, 0, Math.PI), toonMaterial('#ffffff', { map: iglooBricks(), side: THREE.FrontSide }));
      tunnel.rotation.set(0, -door, Math.PI / 2);
      // Taller than it is wide: a proper arched doorway (local x is up once it's laid on its side).
      tunnel.scale.set(1.35, 1, 1);
      tunnel.position.set(Math.cos(door) * (R - 0.15), base, Math.sin(door) * (R - 0.15));
      tunnel.castShadow = true;
      g.add(tunnel);
      // Its inside in shade, so the doorway reads as an opening.
      const shade = new THREE.Mesh(tunnel.geometry, toonMaterial('#7f9fbf', { map: null, side: THREE.BackSide }));
      shade.scale.setScalar(0.995);
      tunnel.add(shade);
      break;
    }
    case 'cabin': {
      // A log cabin's roof under a thick layer of snow, with icicles along the front and a chimney.
      lid(toonMaterial('#ffffff', { map: tiled(snowTexture(), w / 4, d / 4) }));
      const chimney = on(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), toonMaterial('#9aa0a6', { map: tiled(stoneTexture(), 1, 1) })), w / 2 - 2.2, top + 0.7, -d / 2 + 2);
      chimney.castShadow = true;
      on(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.6), toonMaterial('#ffffff', { map: snowTexture() })), w / 2 - 2.2, top + 1.5, -d / 2 + 2);
      const icicle = toonMaterial('#d8f1ff', { map: null });
      for (let i = 0; i < Math.floor(w / 0.8); i++) {
        const len = 0.25 + ((i * 7) % 4) * 0.08;
        const ic = on(new THREE.Mesh(new THREE.ConeGeometry(0.07, len, 6), icicle), -w / 2 + 0.4 + i * 0.8, -top - len / 2, d / 2);
        ic.rotation.x = Math.PI;
      }
      break;
    }
    case 'house': {
      lid(toonMaterial('#ffffff', { map: tiled(tileTexture(), w / 3, d / 3) }));
      // a little chimney in one corner (just for looks)
      const chimney = on(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), toonMaterial('#e9c9a8')), w / 2 - 2.2, top + 0.6, -d / 2 + 2);
      chimney.castShadow = true;
      break;
    }
    case 'shed':
      lid(toonMaterial('#9fc4a8', { map: tiled(corrugatedTexture(), w / 1.5, 1) }));
      break;
    case 'treehouse': {
      lid(toonMaterial('#ffffff', { map: tiled(plankTexture(), w / 1.6, d / 4) }));
      // corner posts with a rope railing between them (for looks; the edge is open)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        on(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), flat('#8e6036')), (sx * w) / 2 - sx * 0.2, top + 0.45, (sz * d) / 2 - sz * 0.2);
      }
      break;
    }
    case 'bed': {
      // A patchwork quilt, a pillow at the headboard end and a teddy on it.
      lid(toonMaterial('#ffffff', { map: tiled(quiltTexture(), w / 6, d / 6) }));
      const pillow = on(new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 0.35, 2.4), flat('#fffaf3')), -w / 4, top + 0.17, -d / 2 + 1.6);
      pillow.castShadow = true;
      const pillow2 = on(new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 0.35, 2.4), flat('#fffaf3')), w / 4, top + 0.17, -d / 2 + 1.6);
      pillow2.castShadow = true;
      on(new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d * 0.25), flat('#fffaf3')), 0, top + 0.03, -d / 2 + d * 0.33);
      break;
    }
    case 'desk': {
      // A wooden desktop with a sheet of paper, crayons and a little lamp.
      lid(toonMaterial('#ffffff', { map: tiled(plankTexture(), w / 2, d / 4) }));
      on(new THREE.Mesh(new THREE.BoxGeometry(3, 0.02, 4), flat('#ffffff')), -w / 5, top + 0.011, 0).rotation.y = 0.2;
      ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a'].forEach((c, i) => {
        const crayon = on(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), flat(c)), 1 + i * 0.35, top + 0.1, 1.2);
        crayon.rotation.z = Math.PI / 2;
        crayon.rotation.y = 0.3;
      });
      const lampBase = on(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.2, 16), flat('#5d9cf5')), w / 2 - 2, top + 0.1, -d / 2 + 1.6);
      lampBase.castShadow = true;
      const lampShade = on(new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 16, 1, true), flat('#fde39a')), w / 2 - 2, top + 1.4, -d / 2 + 1.6);
      lampShade.castShadow = true;
      on(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), flat('#5d9cf5')), w / 2 - 2, top + 0.65, -d / 2 + 1.6);
      break;
    }
    case 'table': {
      // Blue gingham with a red hem, so it doesn't look like the blanket under the table.
      lid(toonMaterial('#ffffff', { map: tiled(tableclothTexture(), w / 4.8, d / 4.8) }));
      for (const [sx, sz, x, z] of [[w + 0.04, 0.12, 0, d / 2], [w + 0.04, 0.12, 0, -d / 2], [0.12, d + 0.04, w / 2, 0], [0.12, d + 0.04, -w / 2, 0]] as const) {
        on(new THREE.Mesh(new THREE.BoxGeometry(sx, ROOF_THICKNESS + 0.04, sz), flat('#e25b5b')), x, 0, z);
      }
      // plates and a cake on the cloth
      for (const [x, z] of [[-w / 3, -d / 4], [w / 3, d / 4], [0, -d / 4]] as const) {
        on(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.06, 20), flat('#ffffff')), x, top + 0.03, z);
      }
      on(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 20), flat('#f6a5c0')), w / 4, top + 0.25, -d / 6).castShadow = true;
      on(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 20), flat('#fff7ef')), w / 4, top + 0.52, -d / 6);
      break;
    }
  }

  // Every roof material fades with it.
  const materials: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];
  const outlines: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.Material;
    m.transparent = true;
    materials.push(m);
    if (o.castShadow) meshes.push(o);
    if (m instanceof THREE.MeshBasicMaterial && m.side === THREE.BackSide) outlines.push(o);
  });
  return { object: g, building: b, materials, meshes, outlines, opacity: 1, insideOpacity: b.kind === 'igloo' ? 0.28 : 0.2 };
}

/**
 * A wall reaching up to a roof (house and shed walls, table legs) is drawn a little shorter,
 * so its top and outline stay under the roof instead of poking through it.
 */
function underRoof(wall: Wall, map: MapData): Wall {
  for (const b of map.buildings) {
    const inside = wall.x >= b.x - 0.01 && wall.y >= b.y - 0.01 && wall.x + wall.w <= b.x + b.w + 0.01 && wall.y + wall.h <= b.y + b.h + 0.01;
    if (inside && wall.height >= b.height - 0.05) return { ...wall, height: b.height - 0.08 };
  }
  return wall;
}

/**
 * A pine tree in the snow: three tiers of felt-needle cones with snow on their tops, on a short
 * trunk. Works like a bush (hide in it; see-through while you're inside).
 */
function pine(circle: Circle, index: number): { object: THREE.Object3D; view: BushView } {
  const g = new THREE.Group();
  g.position.set(circle.center.x, 0, circle.center.y);
  g.rotation.y = index * 1.3;
  const needles = makeTriplanar(toonMaterial('#2f7a4a', { map: foliage(1).map }), 0.6);
  const snow = toonMaterial('#ffffff', { map: snowTexture() });
  const materials = [needles, snow];
  const hull = outlineMaterial('#1f3f26');
  // Pushed back a hair, so the see-through cones never fight their own depth copies.
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const r = circle.radius;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), toonMaterial('#6b4630'));
  trunk.position.y = 0.4;
  g.add(trunk);
  const depth: THREE.Mesh[] = [];
  const outlines: THREE.Mesh[] = [];
  const meshes: THREE.Mesh[] = [];
  const tiers: [number, number, number][] = [[r * 1.05, 1.6, 0.6], [r * 0.8, 1.4, 1.5], [r * 0.52, 1.2, 2.3]];
  for (const [base, height, y] of tiers) {
    const parts: [THREE.BufferGeometry, THREE.Material, boolean][] = [
      [new THREE.ConeGeometry(base, height, 14), needles, true],
      // Snow resting on the tier: a flatter white cone just over its top part.
      [new THREE.ConeGeometry(base * 0.55, height * 0.42, 14).translate(0, height * 0.3, 0), snow, false],
    ];
    for (const [geo, mat, outlined] of parts) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y + height / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 2;
      meshes.push(mesh);
      if (outlined) {
        const outline = new THREE.Mesh(geo, hull);
        outline.scale.setScalar(1.06);
        mesh.add(outline);
        outlines.push(outline);
      }
      const d = new THREE.Mesh(geo, depthOnly);
      d.position.copy(mesh.position);
      d.visible = false;
      d.renderOrder = 1;
      depth.push(d);
      g.add(mesh, d);
    }
  }
  return { object: g, view: { circle, materials, depth, outlines, balls: meshes, seeThrough: false } };
}

let iglooTex: THREE.CanvasTexture | null = null;
/** Snow bricks: offset rows of soft blocks with light blue joints (round a dome: 16 across, 6 up). */
function iglooBricks(): THREE.CanvasTexture {
  if (iglooTex) return iglooTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = '#b8d8f0';
  g.lineWidth = 3;
  const rows = 6;
  const rh = 192 / rows;
  for (let r = 0; r < rows; r++) {
    g.beginPath();
    g.moveTo(0, r * rh);
    g.lineTo(512, r * rh);
    g.stroke();
    const n = 16 - r * 2;
    for (let i = 0; i < n; i++) {
      const x = ((i + (r % 2) * 0.5) * 512) / n;
      g.beginPath();
      g.moveTo(x, r * rh);
      g.lineTo(x, (r + 1) * rh);
      g.stroke();
    }
  }
  iglooTex = new THREE.CanvasTexture(c);
  iglooTex.colorSpace = THREE.SRGBColorSpace;
  iglooTex.wrapS = THREE.RepeatWrapping;
  return iglooTex;
}

/** An igloo's bottom: a smooth, low curved wall of snow bricks round it, open at the doorway.
 *  It stays while the dome fades, so you see the walls round you inside. */
function iglooBase(b: Building, door: number): THREE.Object3D {
  const inner = Math.min(b.w, b.h) / 2 + 0.05;
  const outer = inner + 1.05;
  const h = 0.6;
  const profile = [new THREE.Vector2(inner, 0), new THREE.Vector2(outer, 0), new THREE.Vector2(outer, h), new THREE.Vector2(inner, h), new THREE.Vector2(inner, 0)];
  // Lathe angles run from +z toward +x; the door (map x/y) is at (cos, sin).
  const gap = 0.6;
  const phiDoor = Math.PI / 2 - door;
  const geo = new THREE.LatheGeometry(profile, 40, phiDoor + gap, Math.PI * 2 - gap * 2);
  const wall = new THREE.Mesh(geo, toonMaterial('#ffffff', { map: iglooBricks(), side: THREE.DoubleSide }));
  wall.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
  wall.castShadow = true;
  wall.receiveShadow = true;
  return wall;
}

/** Which way an igloo's doorway faces (radians, in the map's x/y): the gap in its block ring. */
const iglooDoors = new Map<Building, number>();
function iglooDoor(b: Building): number {
  return iglooDoors.get(b) ?? Math.PI;
}

/** Laundry piles in the Bedroom: socks, shirts and towels in a heap. */
const LAUNDRY = ['#e2574c', '#5d9cf5', '#f7c331', '#9b7bd8', '#5bd16a', '#ff9cbf', '#fffaf3'];

export function buildObstacles(map: MapData): { root: THREE.Group; bushes: BushView[]; roofs: RoofView[] } {
  const root = new THREE.Group();
  // Beach balls roll around: they're drawn from the match state (ball-views.ts); a pool's rim is
  // drawn with its pool (map-view.ts).
  map.walls.forEach((b, i) => {
    if (b.kind !== 'ball' && b.kind !== 'rim' && b.kind !== 'duck' && b.kind !== 'igloo' && b.kind !== 'ramp') root.add(buildWall(underRoof(b, map), i));
  });
  const indoors = map.theme === 'bedroom';
  const bushes = map.bushes.map((c, i) => {
    if (map.theme === 'snow') {
      const { object, view } = pine(c, i);
      root.add(object);
      return view;
    }
    // Each pile starts at a different color so neighbors don't match.
    const colors = indoors ? [...LAUNDRY.slice(i % LAUNDRY.length), ...LAUNDRY.slice(0, i % LAUNDRY.length)] : undefined;
    const { object, view } = bush(c, colors, indoors ? OUTLINE_COLOR : undefined, i);
    root.add(object);
    return view;
  });
  // Each igloo's doorway: the direction (from its middle) of the widest gap in its snow blocks.
  for (const b of map.buildings) {
    if (b.kind !== 'igloo') continue;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const angles = map.walls
      .filter((w) => w.kind === 'igloo' && Math.hypot(w.x + w.w / 2 - cx, w.y + w.h / 2 - cy) < b.w)
      .map((w) => Math.atan2(w.y + w.h / 2 - cy, w.x + w.w / 2 - cx))
      .sort((a, c) => a - c);
    let best = 0;
    let door = Math.PI;
    angles.forEach((a, i) => {
      const next = i + 1 < angles.length ? angles[i + 1]! : angles[0]! + Math.PI * 2;
      if (next - a > best) {
        best = next - a;
        door = (a + next) / 2;
      }
    });
    iglooDoors.set(b, door);
    root.add(iglooBase(b, door));
  }
  const roofs = map.buildings.map((b) => {
    const view = roof(b);
    root.add(view.object);
    return view;
  });
  return { root, bushes, roofs };
}

/**
 * The roof over the building you are in fades to a ghost so you can see inside; the others stay.
 * In the debug view every roof is see-through.
 */
export function updateRoofs(roofs: RoofView[], localBuilding: number, debug: boolean, dt: number): void {
  roofs.forEach((r, i) => {
    const target = i === localBuilding ? r.insideOpacity : debug ? 0.3 : 1;
    r.opacity += (target - r.opacity) * (1 - Math.exp(-ROOF_FADE_RATE * dt));
    if (Math.abs(r.opacity - target) < 0.01) r.opacity = target;
    r.object.visible = r.opacity > 0.01;
    for (const m of r.materials) {
      m.opacity = r.opacity;
      m.depthWrite = r.opacity > 0.99;
    }
    for (const mesh of r.meshes) mesh.castShadow = r.opacity > 0.5;
    for (const o of r.outlines) o.visible = r.opacity > 0.99;
  });
}

/** Bushes you stand in turn see-through so you can see your plush. */
export function updateBushes(bushes: BushView[], localX: number, localY: number): void {
  for (const b of bushes) {
    const inside = Math.hypot(localX - b.circle.center.x, localY - b.circle.center.y) < b.circle.radius + 0.4;
    if (b.seeThrough === inside) continue;
    b.seeThrough = inside;
    // See-through as one even layer: the depth-only copies go first, so only the nearest leaves
    // are tinted (no blotchy overlaps), and the outlines step aside.
    for (const m of b.materials) {
      m.transparent = inside;
      m.opacity = inside ? 0.42 : 1;
      m.needsUpdate = true;
    }
    for (const d of b.depth) d.visible = inside;
    for (const o of b.outlines) o.visible = !inside;
    // Their shadows (on each other and on the ground under the bush) would show through as dark
    // blotches and arcs: a see-through bush casts and takes none.
    for (const ball of b.balls) {
      ball.receiveShadow = !inside;
      ball.castShadow = !inside;
    }
  }
}
