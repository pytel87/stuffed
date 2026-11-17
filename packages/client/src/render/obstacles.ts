// Walls, bushes and roofs. The sim only knows boxes and circles; each wall's look comes from its
// kind (see props.ts), each roof's from its building's kind.
import * as THREE from 'three';
import type { Building, Circle, MapData, Wall } from '@stuffed/sim';
import { buildWall, corrugatedTexture, ginghamTexture, plankTexture, tiled, tileTexture } from './props.ts';
import { feltTexture, outlineMaterial, OUTLINE_COLOR, toonMaterial } from './toon.ts';

const OUTLINE = 0.045;
const BUSH = '#3f8f4a';

export interface BushView {
  circle: Circle;
  material: THREE.MeshToonMaterial;
}

function bush(circle: Circle): { object: THREE.Object3D; view: BushView } {
  const g = new THREE.Group();
  g.position.set(circle.center.x, 0, circle.center.y);
  const material = toonMaterial(BUSH);
  const hull = outlineMaterial('#1f3f26');
  const r = circle.radius;
  const balls: [number, number, number, number][] = [[0, 0, 1.15, r * 0.55]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    balls.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 0.75 + (i % 2) * 0.2, r * (0.42 + (i % 3) * 0.04)]);
  }
  for (const [x, z, y, size] of balls) {
    const geo = new THREE.IcosahedronGeometry(size, 2);
    const ball = new THREE.Mesh(geo, material);
    ball.position.set(x, y, z);
    ball.castShadow = true;
    ball.receiveShadow = true;
    const outline = new THREE.Mesh(geo, hull);
    outline.scale.setScalar(1.06);
    ball.add(outline);
    g.add(ball);
  }
  return { object: g, view: { circle, material } };
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
      const lidTex = feltTexture().clone();
      lidTex.repeat.set(w / 3, d / 3);
      lidTex.needsUpdate = true;
      lid(toonMaterial('#d8b48a', { map: lidTex }));
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
    case 'table': {
      // Blue gingham with a red hem, so it doesn't look like the blanket under the table.
      lid(toonMaterial('#ffffff', { map: tiled(ginghamTexture(), w / 1.2, d / 1.2) }));
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

export function buildObstacles(map: MapData): { root: THREE.Group; bushes: BushView[]; roofs: RoofView[] } {
  const root = new THREE.Group();
  // Beach balls roll around: they're drawn from the match state (ball-views.ts).
  map.walls.forEach((b, i) => {
    if (b.kind !== 'ball') root.add(buildWall(underRoof(b, map), i));
  });
  const bushes = map.bushes.map((c) => {
    const { object, view } = bush(c);
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
    const opacity = inside ? 0.4 : 1;
    if (b.material.opacity === opacity) continue;
    b.material.opacity = opacity;
    b.material.transparent = inside;
    b.material.depthWrite = !inside;
    b.material.needsUpdate = true;
  }
}
