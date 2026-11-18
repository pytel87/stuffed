// Walls, bushes and roofs. The sim only knows boxes and circles; each wall's look comes from its
// kind (see props.ts), each roof's from its building's kind.
import * as THREE from 'three';
import type { Building, Circle, MapData, Wall } from '@stuffed/sim';
import { buildWall, cardboardTexture, corrugatedTexture, foliage, plankTexture, quiltTexture, tableclothTexture, tiled, tileTexture } from './props.ts';
import { detailMaps, repeated } from './image-textures.ts';
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
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
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
  materials: THREE.Material[];
  meshes: THREE.Mesh[];
  opacity: number;
}

const ROOF_THICKNESS = 0.32;
const ROOF_OVERHANG = 0.2;
const ROOF_FADE_RATE = 10;

/** The roof over a building; its top is the walkable surface. Fades out while you're inside. */
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
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.Material;
    m.transparent = true;
    materials.push(m);
    if (o.castShadow) meshes.push(o);
  });
  return { object: g, materials, meshes, opacity: 1 };
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

/** Laundry piles in the Bedroom: socks, shirts and towels in a heap. */
const LAUNDRY = ['#e2574c', '#5d9cf5', '#f7c331', '#9b7bd8', '#5bd16a', '#ff9cbf', '#fffaf3'];

export function buildObstacles(map: MapData): { root: THREE.Group; bushes: BushView[]; roofs: RoofView[] } {
  const root = new THREE.Group();
  // Beach balls roll around: they're drawn from the match state (ball-views.ts); a pool's rim is
  // drawn with its pool (map-view.ts).
  map.walls.forEach((b, i) => {
    if (b.kind !== 'ball' && b.kind !== 'rim' && b.kind !== 'duck') root.add(buildWall(underRoof(b, map), i));
  });
  const indoors = map.theme === 'bedroom';
  const bushes = map.bushes.map((c, i) => {
    // Each pile starts at a different color so neighbors don't match.
    const colors = indoors ? [...LAUNDRY.slice(i % LAUNDRY.length), ...LAUNDRY.slice(0, i % LAUNDRY.length)] : undefined;
    const { object, view } = bush(c, colors, indoors ? OUTLINE_COLOR : undefined, i);
    root.add(object);
    return view;
  });
  const roofs = map.buildings.map((b) => {
    const view = roof(b);
    root.add(view.object);
    return view;
  });
  return { root, bushes, roofs };
}

/**
 * The roof over the building you are in fades out so you can see inside; the others stay.
 * In the debug view every roof is see-through.
 */
export function updateRoofs(roofs: RoofView[], localBuilding: number, debug: boolean, dt: number): void {
  roofs.forEach((r, i) => {
    const target = i === localBuilding ? 0 : debug ? 0.3 : 1;
    r.opacity += (target - r.opacity) * (1 - Math.exp(-ROOF_FADE_RATE * dt));
    if (Math.abs(r.opacity - target) < 0.01) r.opacity = target;
    r.object.visible = r.opacity > 0.01;
    for (const m of r.materials) {
      m.opacity = r.opacity;
      m.depthWrite = r.opacity > 0.99;
    }
    for (const mesh of r.meshes) mesh.castShadow = r.opacity > 0.5;
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
