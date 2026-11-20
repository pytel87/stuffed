// The pirate ship on Pirate Cove (the sim treats it as a one-car train; see SHIP): a wooden hull
// drawn to the deck's line (its bow narrows the way the sim's does), a railed deck, a mast with
// two billowing striped sails, a crow's nest, a skull flag, cannons, a wheel and a lantern, and a
// collar of foam where it sits in the water. Along +z (the way it sails), the deck at deckHeight.
import * as THREE from 'three';
import { halfWidthAt, SHIP } from '@stuffed/sim';
import { nextMark, outlineProp, plankTexture, tiled } from './props.ts';
import { toonMaterial, toonMesh } from './toon.ts';

const DECK = SHIP.deckHeight;
const HALF = SHIP.carLength / 2;

export interface ShipModel {
  root: THREE.Group;
  /** Rocks gently in the water (the hull, the deck and all on it). */
  rocker: THREE.Group;
  /** Faded while you're aboard, so they don't hide the deck. */
  sails: THREE.Mesh[];
  flag: THREE.Object3D;
}

/** The deck's edge, inset by `inset`: stern to bow down one side, back up the other. */
function outline(inset: number, scale = 1): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const along = -HALF + inset + ((2 * HALF - 2 * inset) * i) / steps;
    pts.push(new THREE.Vector2(Math.max(0, halfWidthAt(SHIP, along) - inset) * scale, along));
  }
  // (Clamped at 0: inset, the sides would cross over each other at the narrow bow tip.)
  for (let i = steps - 1; i >= 0; i--) {
    const along = -HALF + inset + ((2 * HALF - 2 * inset) * i) / steps;
    pts.push(new THREE.Vector2(-Math.max(0, halfWidthAt(SHIP, along) - inset) * scale, along));
  }
  return pts;
}

/** A slab of the hull's shape from `y0` up to `y1` (the shape lies in x and along +z). */
function slab(points: THREE.Vector2[], y0: number, y1: number, holes: THREE.Vector2[][] = []): THREE.BufferGeometry {
  // Drawn with y = -along, so turning it upright puts the bow at +z.
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

let sailTex: THREE.CanvasTexture | null = null;
/** Cream canvas with two red stripes down it, a dark hem round the edge and a patch. */
function sailTexture(): THREE.CanvasTexture {
  if (sailTex) return sailTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf1d9';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e2574c';
  for (const x of [26, 82]) g.fillRect(x, 0, 20, 128);
  // A patch, stitched on.
  g.fillStyle = '#e8d3a8';
  g.fillRect(70, 74, 30, 24);
  g.strokeStyle = '#8a6a4a';
  g.lineWidth = 2;
  g.setLineDash([4, 3]);
  g.strokeRect(70, 74, 30, 24);
  g.setLineDash([]);
  g.strokeStyle = '#4a3328';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);
  sailTex = new THREE.CanvasTexture(c);
  sailTex.colorSpace = THREE.SRGBColorSpace;
  return sailTex;
}

let flagTex: THREE.CanvasTexture | null = null;
/** A black flag with a friendly white skull over crossed bones. */
function flagTexture(): THREE.CanvasTexture {
  if (flagTex) return flagTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 84;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f1b24';
  g.fillRect(0, 0, 128, 84);
  g.strokeStyle = '#fdfbf7';
  g.lineCap = 'round';
  g.lineWidth = 9;
  for (const [x0, y0, x1, y1] of [[40, 66, 88, 30], [40, 30, 88, 66]]) {
    g.beginPath();
    g.moveTo(x0!, y0!);
    g.lineTo(x1!, y1!);
    g.stroke();
  }
  g.fillStyle = '#fdfbf7';
  g.beginPath();
  g.arc(64, 38, 19, 0, Math.PI * 2);
  g.fill();
  g.fillRect(55, 48, 18, 12);
  g.fillStyle = '#1f1b24';
  for (const x of [56, 72]) {
    g.beginPath();
    g.arc(x, 37, 5.5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(62, 46, 4, 5);
  flagTex = new THREE.CanvasTexture(c);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  return flagTex;
}

let foamTex: THREE.CanvasTexture | null = null;
/** A soft white oval: the water churned round the hull. */
function foamTexture(): THREE.CanvasTexture {
  if (foamTex) return foamTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  foamTex = new THREE.CanvasTexture(c);
  return foamTex;
}

/** A square sail hanging from a yard at `top`, `h` tall, bellied out forward. */
function sail(top: number, w: number, h: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, 10, 6);
  const pos = geo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) / w) * 2;
    const v = pos.getY(i) / h + 0.5;
    // Full in the middle, tied flat to the yard at the top.
    pos.setZ(i, 0.7 * (1 - u * u) * Math.sin(v * Math.PI * 0.5 + 0.5) * (1 - v * 0.6));
  }
  geo.computeVertexNormals();
  const mat = toonMaterial('#ffffff', { map: sailTexture() });
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, top - h / 2, 0.25);
  m.castShadow = true;
  return m;
}

export function buildShip(): ShipModel {
  const root = new THREE.Group();
  const rocker = new THREE.Group();
  root.add(rocker);
  const body = new THREE.Group();
  rocker.add(body);
  const add = (m: THREE.Object3D, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    body.add(m);
    return m;
  };

  // The hull: dark and a little narrower below, warm planks above, a gold stripe between.
  // (Extruded shapes' UVs are in world units: one repeat every few units.)
  const hullWood = toonMaterial('#ffffff', { map: tiled(plankTexture(), 0.25, 0.25) });
  hullWood.color.set('#b97a45');
  add(toonMesh(slab(outline(0, 0.9), -0.2, 0.7), '#6b4128', { outline: 0.02 }), 0, 0, 0);
  add(toonMesh(slab(outline(0), 0.7, DECK + 0.05), '#b97a45', { outline: 0.02, material: hullWood }), 0, 0, 0);
  add(toonMesh(slab(outline(-0.04), 0.66, 0.8), '#f2c14e', { outline: false }), 0, 0, 0);
  // The deck, and a rail round it.
  const deckWood = toonMaterial('#ffffff', { map: tiled(plankTexture(), 0.3, 0.3) });
  deckWood.color.set('#e7c08e');
  add(new THREE.Mesh(slab(outline(0.15), DECK, DECK + 0.06), deckWood), 0, 0, 0);
  // (No outline of its own: round the inside it lay on the deck as a dark band.)
  // (Both sides drawn: the walls round a hole come out facing away.)
  add(toonMesh(slab(outline(0), DECK, DECK + 0.4, [outline(0.18)]), '#9a6538', { outline: false, material: toonMaterial('#9a6538', { map: null, side: THREE.DoubleSide }) }), 0, 0, 0);
  add(toonMesh(slab(outline(-0.03), DECK + 0.4, DECK + 0.48, [outline(0.21)]), '#6b4128', { outline: false, material: toonMaterial('#6b4128', { map: null, side: THREE.DoubleSide }) }), 0, 0, 0);
  // The mast, two yards, a crow's nest up top.
  const wood = '#8a5a32';
  add(toonMesh(new THREE.CylinderGeometry(0.22, 0.3, 8.6, 12), wood, { outline: 0.1 }), 0, DECK + 4.3, 0);
  for (const [y, w] of [[DECK + 3.5, 4.4], [DECK + 6.3, 3.6]] as const) {
    const yard = toonMesh(new THREE.CylinderGeometry(0.1, 0.1, w, 8), wood, { outline: 0.12 });
    yard.rotation.z = Math.PI / 2;
    add(yard, 0, y, 0.15);
  }
  // The crow's nest: a solid cup (walls with a thickness, a rim and a floor), so its outline only
  // shows round the outside (an open tube showed the dark outline inside it from above).
  const cup = [[0, -0.25], [0.5, -0.25], [0.62, 0.25], [0.52, 0.25], [0.42, -0.15], [0, -0.15]].map(([x, y]) => new THREE.Vector2(x, y));
  add(toonMesh(new THREE.LatheGeometry(cup, 16), '#6b4128', { outline: 0.05 }), 0, DECK + 7.3, 0);
  // The bowsprit, poking up and forward from the bow.
  const sprit = toonMesh(new THREE.CylinderGeometry(0.09, 0.14, 2.6, 8), wood, { outline: 0.12 });
  sprit.rotation.x = Math.PI / 2 - 0.35;
  add(sprit, 0, DECK + 0.5, HALF + 0.9);
  // Two cannons a side, out of ports in the hull.
  for (const side of [-1, 1]) {
    for (const z of [-1.8, 1]) {
      const cannon = toonMesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 12), '#2a2730', { outline: 0.06 });
      cannon.rotation.z = Math.PI / 2;
      add(cannon, side * (SHIP.carWidth / 2 + 0.1), 0.98, z);
    }
  }
  // The wheel at the stern: on a tapered pedestal, tipped forward so its face turns up (upright,
  // it was only a thin stick from above), eight spokes with round handles past the rim, a hub.
  const pedestal = toonMesh(new THREE.CylinderGeometry(0.1, 0.17, 0.85, 8), wood, { outline: 0.1 });
  add(pedestal, 0, DECK + 0.42, -HALF + 1.45);
  const wheel = new THREE.Group();
  wheel.add(toonMesh(new THREE.TorusGeometry(0.4, 0.06, 8, 24), '#6b4128', { outline: 0.1 }));
  wheel.add(toonMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 12).rotateX(Math.PI / 2), '#4b2e1c', { outline: 0.1 }));
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const spoke = toonMesh(new THREE.CylinderGeometry(0.03, 0.035, 0.62, 6), '#6b4128', { outline: 0.15 });
    spoke.position.set(Math.cos(a) * 0.31, Math.sin(a) * 0.31, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    const knob = toonMesh(new THREE.SphereGeometry(0.06, 8, 6), '#6b4128', { outline: 0.15 });
    knob.position.set(Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0);
    wheel.add(knob);
  }
  // (Its top toward the bow: its face turned up and back to whoever stands at it.)
  wheel.rotation.x = 0.7;
  add(wheel, 0, DECK + 0.95, -HALF + 1.32);
  // A lantern on a post at the stern rail: an iron cage round a glowing light, a little roof and
  // a ring on top.
  add(toonMesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), wood, { outline: 0.1 }), 0, DECK + 0.35, -HALF + 0.3);
  const lantern = new THREE.Group();
  lantern.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), new THREE.MeshBasicMaterial({ color: '#ffd36a', toneMapped: false })));
  const iron = '#2f3640';
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const bar = toonMesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), iron, { outline: 0.15 });
    bar.position.set(x * 0.12, 0, z * 0.12);
    lantern.add(bar);
  }
  const base = toonMesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), iron, { outline: 0.1 });
  base.position.y = -0.16;
  lantern.add(base);
  const roof = toonMesh(new THREE.ConeGeometry(0.22, 0.16, 4).rotateY(Math.PI / 4), iron, { outline: 0.1 });
  roof.position.y = 0.23;
  lantern.add(roof);
  const ring = toonMesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), iron, { outline: 0.2 });
  ring.position.y = 0.35;
  lantern.add(ring);
  add(lantern, 0, DECK + 0.89, -HALF + 0.3);
  // Outlined like the props, all round the whole ship (pulled toward the camera: drawn a little
  // behind it, its own sides hid half the line and the dark hull the rest), never across it.
  body.updateMatrixWorld(true);
  outlineProp(body, nextMark(), 0.035);
  // (Not merged: baking its pieces together evened out the outline hulls' normals, and the lines
  // came out a pixel thin. It's one model; its few dozen pieces draw fine on their own.)
  // (Matte: old wood and iron, no lacquer shine.)
  body.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });

  // The sails (not merged: they fade) and the flag (it flutters).
  const sails = [sail(DECK + 3.5, 4, 1.9), sail(DECK + 6.3, 3.2, 1.7)];
  for (const s of sails) rocker.add(s);
  const flag = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85, 6, 1), new THREE.MeshBasicMaterial({ map: flagTexture(), side: THREE.DoubleSide }));
  // Off the back of the masthead, flying behind as it sails.
  cloth.rotation.y = Math.PI / 2;
  cloth.position.set(0, 0, -0.68);
  flag.add(cloth);
  flag.position.set(0, DECK + 8.25, 0);
  rocker.add(flag);

  // Foam where the hull meets the water (not rocked: it lies on the sea).
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(SHIP.carWidth + 2.6, SHIP.carLength + 3.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: foamTexture(), transparent: true, depthWrite: false, opacity: 0.8 }),
  );
  foam.position.set(0, 0.03, 0.4);
  foam.renderOrder = -1;
  root.add(foam);
  return { root, rocker, sails, flag };
}

/** Sails see-through (`opacity` below 1) or solid again. */
export function fadeSails(sails: readonly THREE.Mesh[], opacity: number): void {
  for (const s of sails) {
    const m = s.material as THREE.Material;
    if (m.opacity === opacity) continue;
    m.opacity = opacity;
    m.transparent = opacity < 1;
    m.depthWrite = opacity >= 1;
    s.castShadow = opacity >= 1;
  }
}
