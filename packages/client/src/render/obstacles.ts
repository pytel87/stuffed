// Walls, bushes and roofs. The sim only knows boxes and circles; each wall's look comes from its
// kind (see props.ts), each roof's from its building's kind.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Building, Circle, MapData, Wall } from '@stuffed/sim';
import { boneTexture, buildWall, FOOT_LIFT, lavaTexture, nextMark, outlineProp, palmTree, rockMass, rockTexture, smoke, thatchTexture, cardboardTexture, outlinedBox, softBox, corrugatedTexture, foliage, snowTexture, stoneTexture, plankTexture, quiltTexture, tableclothTexture, tiled, tileTexture } from './props.ts';
import { detailMaps, repeated } from './image-textures.ts';
import { mergeStatic } from './merge-static.ts';
import { feltTexture } from './toon.ts';
import { evenOutlines, makeTriplanar, outlineMaterial, OUTLINE_COLOR, pushedOutlineMaterial, smoothNormals, thickOutlineMaterial, toonMaterial, toonMesh } from './toon.ts';

const OUTLINE = 0.03;
const BUSH = '#3f8f4a';
/** Pirate Cove's bushes: a brighter, tropical green. */
const PALM_BUSH = '#46a352';

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
  const leafy = colors[0] === BUSH || colors[0] === PALM_BUSH;
  // Felt leaves on a bush; a laundry pile is knitted clothes.
  const detail = leafy ? foliage(1) : laundryDetail();
  // Leaves are projected from three sides (no stretching at the top of each ball); the knitted
  // laundry keeps its weave's normal map.
  // Its balls mark where they're drawn (a number of its own), and its outline is drawn only off
  // them: round the whole heap, with no stray slivers of one ball's outline across a neighbor.
  const mark = (index % 255) + 1;
  const materials = colors.map((c) => {
    const m = leafy ? makeTriplanar(toonMaterial(c, { map: detail.map }), 0.6) : toonMaterial(c, { map: detail.map });
    if (!leafy) m.normalMap = detail.normal;
    m.stencilWrite = true;
    m.stencilRef = mark;
    m.stencilZPass = THREE.ReplaceStencilOp;
    return m;
  });
  const hull = new THREE.MeshBasicMaterial({ color: outlineColor, side: THREE.BackSide, stencilWrite: true, stencilRef: mark, stencilFunc: THREE.NotEqualStencilFunc });
  // (Its stencil test stays put: nothing else writes to the stencil.)
  hull.stencilFail = hull.stencilZFail = hull.stencilZPass = THREE.KeepStencilOp;
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
  // A ball that would sink into the floor is squashed onto it instead: cut off by the floor, its
  // outline (cut off further out) left a strip of floor between them.
  const squash = ([, , y, size]: (typeof balls)[number]) => Math.min(1, y / size);
  balls.forEach((b, i) => {
    const [x, z, y, size] = b;
    const geo = new THREE.IcosahedronGeometry(size, 2);
    const ball = new THREE.Mesh(geo, materials[i % materials.length]!);
    ball.position.set(x, y, z);
    ball.scale.y = squash(b);
    ball.castShadow = true;
    ball.receiveShadow = true;
    // After the depth-only copies (renderOrder 1) when see-through.
    ball.renderOrder = 2;
    ballMeshes.push(ball);
    const outline = new THREE.Mesh(geo, hull);
    outline.scale.setScalar(1.06);
    // After every ball of the heap has marked where it's drawn.
    outline.renderOrder = 3;
    ball.add(outline);
    outlines.push(outline);
    const d = new THREE.Mesh(geo, depthOnly);
    d.position.copy(ball.position);
    d.scale.copy(ball.scale);
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
      const b = balls[k % balls.length]!;
      const [bx, bz, by, size] = b;
      // On the upper half of a ball, facing outward.
      const a = rand() * Math.PI * 2;
      const up = 0.35 + rand() * 0.6;
      const n = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up));
      const spot = new THREE.Group();
      spot.position.set(bx + n.x * size * 0.98, by + n.y * size * 0.98 * squash(b), bz + n.z * size * 0.98);
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
/** A shipwreck's broken bow: how far in from its end the deck breaks off, at each share across it. */
const BOW_BREAK = Array.from({ length: 7 }, (_, i) => {
  const k = i + 1;
  return [(k % 2 ? 0.55 : 0.1) + ((k * 3) % 4) * 0.08, k / 8] as const;
});

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
      // Its outline: the dome an even width bigger (a scaled copy was thick on top, thin round it).
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }));
      hull.scale.set((R + 0.05) / R, (H + 0.05) / H, (R + 0.05) / R);
      dome.add(hull);
      g.add(dome);
      // And a dark line on the snow round its foot (the ground hides the outline's lower edge there).
      const foot = new THREE.Mesh(new THREE.RingGeometry(R - 0.01, R + 0.06, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }));
      foot.position.y = base + 0.02;
      g.add(foot);
      // The tunnel: a half-tube out of the doorway (the side with no blocks, toward the open ground).
      const door = iglooDoor(b);
      const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 1.6, 18, 1, true, 0, Math.PI), toonMaterial('#ffffff', { map: iglooBricks(), side: THREE.FrontSide }));
      tunnel.rotation.set(0, -door, Math.PI / 2);
      // Taller than it is wide: a proper arched doorway (local x is up once it's laid on its side).
      tunnel.scale.set(1.35, 1, 1);
      tunnel.position.set(Math.cos(door) * (R - 0.15), base, Math.sin(door) * (R - 0.15));
      tunnel.castShadow = true;
      // Outlined like the dome: the same half tube a little bigger, closed at its ends.
      tunnel.add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.62, 18, 1, false, 0, Math.PI), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide })));
      g.add(tunnel);
      // Its inside in shade, so the doorway reads as an opening.
      const shade = new THREE.Mesh(tunnel.geometry, toonMaterial('#7f9fbf', { map: null, side: THREE.BackSide }));
      shade.scale.setScalar(0.995);
      tunnel.add(shade);
      break;
    }
    case 'wreck': {
      // A shipwreck: the whole broken hull is drawn here (its walls are only for the sim). Plank
      // sides sloping out from the sand up to the deck, narrowing to a rounded stern (-x); the bow
      // (+x) snapped off, its deck ragged; a hole in the south side to get in. On deck: a hole stove in, the
      // mast snapped off and leaning with a torn sail, a rail along the stern. Listing a little.
      const base = -(b.height - ROOF_THICKNESS / 2 + 0.01);
      const L = b.w + 0.4;
      const D = b.h + 0.3;
      // Half its width at x (from its middle): full most of the way, rounding in to the stern.
      const halfAt = (x: number) => {
        const t = (x + L / 2) / L;
        return (D / 2) * (t < 0.3 ? 0.55 + 0.45 * Math.sin((t / 0.3) * (Math.PI / 2)) : 1);
      };
      // Round the hull: along the north side from the bow back to the stern, then the south side.
      const ring: { x: number; z: number; side: 'n' | 's' }[] = [];
      const steps = 26;
      for (let i = 0; i <= steps; i++) {
        const x = L / 2 - (L * i) / steps;
        ring.push({ x, z: -halfAt(x), side: 'n' });
      }
      for (let i = 0; i <= steps; i++) {
        const x = -L / 2 + (L * i) / steps;
        ring.push({ x, z: halfAt(x), side: 's' });
      }
      // The doorway: the hole in the south side (where the sim's wall has its gap).
      const doorFrom = -b.w / 2 + 5 - 0.1;
      const doorTo = -b.w / 2 + 8 + 0.1;
      const inDoor = (p: { x: number; side: string }) => p.side === 's' && p.x > doorFrom && p.x < doorTo;
      const sides = new THREE.Group();
      sides.rotation.x = 0.05;
      g.add(sides);
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      const bottomIn = 0.86;
      let run = 0;
      ring.forEach((p, i) => {
        if (i > 0) run += Math.hypot(p.x - ring[i - 1]!.x, p.z - ring[i - 1]!.z);
        pos.push(p.x * bottomIn, base, p.z * bottomIn, p.x, top, p.z);
        uv.push(run / 1.6, 0, run / 1.6, (top - base) / 0.8);
        if (i > 0 && !(inDoor(p) && inDoor(ring[i - 1]!)) && ring[i - 1]!.side === p.side) {
          const a = (i - 1) * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      });
      // The stern: closing the ring between the two sides' sterns.
      const ns = steps * 2;
      const ss = (steps + 1) * 2;
      idx.push(ns, ss, ns + 1, ns + 1, ss, ss + 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const planks = toonMaterial('#ffffff', { map: tiled(plankTexture(), 1, 1) });
      planks.color.set('#a57c58');
      planks.side = THREE.DoubleSide;
      const hullMesh = new THREE.Mesh(geo, planks);
      hullMesh.castShadow = hullMesh.receiveShadow = true;
      sides.add(hullMesh);
      // Its outline: the hull as a closed solid (sides, deck and bottom, no doorway), pushed out a
      // little and drawn from behind; the open shell's own showed only along its far edges, none
      // round its foot or the broken bow. Through the doorway its far side shows, dark inside.
      const shell: number[] = [];
      const bottomAt = (p: (typeof ring)[number]) => new THREE.Vector3(p.x * bottomIn, base, p.z * bottomIn);
      const topAt = (i: number) => new THREE.Vector3(pos[i * 6 + 3]!, pos[i * 6 + 4]!, pos[i * 6 + 5]!);
      const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, up?: boolean) => {
        if (up !== undefined) {
          const n = b.clone().sub(a).cross(c.clone().sub(a));
          if (n.y > 0 !== up) [b, c] = [c, b];
        }
        shell.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      };
      // Round the hull and back across its broken bow (the jagged edge the deck ends at).
      const loop = [
        ...ring.map((p, i) => ({ bottom: bottomAt(p), top: topAt(i) })),
        ...BOW_BREAK.map(([x, z]) => {
          const at = new THREE.Vector3((L / 2) * 0.985 - x, top, (D / 2 - D * z) * 0.97);
          return { bottom: new THREE.Vector3(at.x * bottomIn, base, at.z * bottomIn), top: at };
        }),
      ];
      loop.forEach((p, k) => {
        const q = loop[(k + 1) % loop.length]!;
        tri(p.bottom, q.bottom, p.top);
        tri(p.top, q.bottom, q.top);
      });
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(loop.map((p) => new THREE.Vector2(p.top.x, p.top.z)), [])) {
        tri(loop[a!]!.top, loop[b!]!.top, loop[c!]!.top, true);
        tri(loop[a!]!.bottom, loop[b!]!.bottom, loop[c!]!.bottom, false);
      }
      // The broken bow closed with planks along its jagged edge (it showed the dark inside).
      const bowPos: number[] = [];
      const bow = [loop[ring.length - 1]!, ...loop.slice(ring.length), loop[0]!];
      bow.forEach((p, k) => {
        if (k === 0) return;
        const q = bow[k - 1]!;
        bowPos.push(q.bottom.x, q.bottom.y, q.bottom.z, p.bottom.x, p.bottom.y, p.bottom.z, q.top.x, q.top.y, q.top.z);
        bowPos.push(q.top.x, q.top.y, q.top.z, p.bottom.x, p.bottom.y, p.bottom.z, p.top.x, p.top.y, p.top.z);
      });
      const bowGeo = new THREE.BufferGeometry();
      bowGeo.setAttribute('position', new THREE.Float32BufferAttribute(bowPos, 3));
      bowGeo.computeVertexNormals();
      const bowWall = new THREE.Mesh(bowGeo, toonMaterial('#7a5a3e', { map: null, side: THREE.DoubleSide }));
      sides.add(bowWall);
      const solid = new THREE.BufferGeometry();
      solid.setAttribute('position', new THREE.Float32BufferAttribute(shell, 3));
      solid.computeVertexNormals();
      const hullLine = new THREE.Mesh(smoothNormals(solid), thickOutlineMaterial(OUTLINE_COLOR, 0.035, 0, 0.15));
      hullLine.name = 'outline';
      sides.add(hullLine);
      // A dark rail along the top, barnacles here and there.
      ring.forEach((p, i) => {
        if (i === 0 || ring[i - 1]!.side !== p.side || (inDoor(p) && inDoor(ring[i - 1]!))) return;
        const q = ring[i - 1]!;
        const len = Math.hypot(p.x - q.x, p.z - q.z);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, 0.16, 0.2), flat('#6b4128'));
        rail.position.set((p.x + q.x) / 2, top + 0.05, (p.z + q.z) / 2);
        rail.rotation.y = -Math.atan2(p.z - q.z, p.x - q.x);
        sides.add(rail);
        if (i % 3 === 0) {
          // On the sloping side: as far out as the hull is at that height.
          const y = base + 0.55 + (i % 2) * 0.2;
          const k = bottomIn + (1 - bottomIn) * ((y - base) / (top - base));
          const barnacle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), flat('#d9d4c7'));
          barnacle.position.set(p.x * k, y, p.z * k);
          sides.add(barnacle);
        }
      });
      // The deck, in the hull's shape, its planks broken off ragged at the bow end.
      const deckPts = ring.map((p) => new THREE.Vector2(p.x * 0.985, -p.z * 0.97));
      for (const [x, z] of BOW_BREAK) deckPts.push(new THREE.Vector2((L / 2) * 0.985 - x, -(D / 2 - D * z) * 0.97));
      const deckShape = new THREE.Shape(deckPts);
      const deckGeo = new THREE.ShapeGeometry(deckShape).rotateX(-Math.PI / 2);
      const deck = toonMaterial('#ffffff', { map: tiled(plankTexture(), 0.4, 0.3) });
      deck.color.set('#c4a27c');
      const deckMesh = new THREE.Mesh(deckGeo, deck);
      deckMesh.position.y = top - 0.02;
      deckMesh.receiveShadow = true;
      sides.add(deckMesh);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.75, 7).rotateX(-Math.PI / 2), flat('#3b2a22'));
      hole.position.set(L / 6, top + 0.002, D / 6);
      hole.scale.set(1.3, 1, 0.9);
      sides.add(hole);
      const wood = '#8a5a32';
      const stump = new THREE.Group();
      stump.position.set(-L / 10, top, 0);
      stump.rotation.z = -0.32;
      // The mast, snapped off: its top broken off at a slant, a little ragged (a deep notch in it
      // read as a V, and broke its outline).
      const poleGeo = new THREE.CylinderGeometry(0.24, 0.3, 3.4, 12, 3);
      const pp = poleGeo.attributes.position!;
      for (let i = 0; i < pp.count; i++) {
        if (pp.getY(i) < 1.69) continue;
        const a = Math.atan2(pp.getZ(i), pp.getX(i));
        const r = Math.hypot(pp.getX(i), pp.getZ(i)) / 0.24;
        pp.setY(i, 1.7 - 0.22 - 0.22 * r * Math.cos(a) - 0.04 * r * Math.sin(a * 5));
      }
      poleGeo.computeVertexNormals();
      const pole = toonMesh(poleGeo, wood, { outline: 0.08 });
      pole.position.y = 1.7;
      stump.add(pole);
      // A spar still across it, hanging askew, and a torn sail down from that.
      const rig = new THREE.Group();
      rig.position.y = 2.5;
      rig.rotation.set(0, 0.35, 0.12);
      const spar = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), wood, { outline: 0.12 });
      spar.rotation.z = Math.PI / 2;
      rig.add(spar);
      const torn: [number, number][] = [[-1.1, 0], [1.1, 0], [1.0, -0.9], [0.7, -1.3], [0.45, -1.0], [0.1, -1.5], [-0.3, -1.1], [-0.6, -1.45], [-1.05, -1.0]];
      const sailMat = toonMaterial('#efe2c2', { map: null });
      sailMat.side = THREE.DoubleSide;
      const sail = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(torn.map(([x, y]) => new THREE.Vector2(x, y)))), sailMat);
      sail.position.set(0, -0.06, 0.12);
      sail.castShadow = true;
      rig.add(sail);
      // Its outline: a thin dark line round its torn edge (it's a flat sheet, no hull to draw).
      const edge = new THREE.CurvePath<THREE.Vector3>();
      torn.forEach(([x, y], i) => {
        const [nx, ny] = torn[(i + 1) % torn.length]!;
        edge.add(new THREE.LineCurve3(new THREE.Vector3(x, y, 0), new THREE.Vector3(nx, ny, 0)));
      });
      const line = new THREE.Mesh(new THREE.TubeGeometry(edge, 90, 0.03, 5, true), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }));
      line.position.copy(sail.position);
      rig.add(line);
      stump.add(rig);
      sides.add(stump);
      // One outline weight on the hull, mast and spar (pulled toward the camera: round the hull's foot too).
      evenOutlines(sides, 0.035, 0.15);
      // The mast, its spar and sail: one outline round them together (each piece's own crossed the
      // others in broken slivers).
      sides.updateMatrixWorld(true);
      outlineProp(stump, nextMark(), 0.03);
      break;
    }
    case 'hut': {
      // A beach hut's flat thatched roof (it's walkable).
      lid(toonMaterial('#ffffff', { map: tiled(thatchTexture(), w / 2.5, d / 2.5) }));
      break;
    }
    case 'cave': {
      // A hollow cliff: the whole rock mass (its walls are only for the sim), and on its front the
      // dark archway into the cave (behind the waterfall), framed by an arch of rock.
      const base = -(b.height - ROOF_THICKNESS / 2 + 0.01);
      const mass = rockMass(b.w, b.height, b.h);
      mass.position.y = base;
      // One even outline weight all round, pulled toward the camera so it shows round its foot.
      evenOutlines(mass, 0.03, 0.15);
      g.add(mass);
      const door = caveDoors.get(b);
      if (door) {
        const half = door.w / 2;
        const side = 0.9;
        const pts: THREE.Vector2[] = [new THREE.Vector2(half, 0), new THREE.Vector2(half, side)];
        for (let i = 1; i < 16; i++) {
          const a = (i / 16) * Math.PI;
          pts.push(new THREE.Vector2(Math.cos(a) * half, side + Math.sin(a) * half));
        }
        pts.push(new THREE.Vector2(-half, side), new THREE.Vector2(-half, 0));
        const front = b.h / 2 + 0.06;
        const hole = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), flat('#1d2a33'));
        hole.position.set(door.x, base + 0.02, front);
        g.add(hole);
        const rim = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(door.x + p.x * 1.06, base + p.y * 1.03, front + 0.05)));
        const stone = makeTriplanar(toonMaterial('#b5a793', { map: rockTexture() }), 0.45);
        // (An even outline along it: a scaled-up copy grew from the roof's middle, not the arch's,
        // and came out as a thick band off to one side.)
        const archRim = toonMesh(new THREE.TubeGeometry(rim, 40, 0.18, 8, false), '#b5a793', { material: stone, outline: 0.05 });
        evenOutlines(archRim, 0.03);
        g.add(archRim);
      }
      break;
    }
    case 'volcano':
      // (The summit's own tier draws it: this "building" is only there for the chest on top.)
      break;
    case 'skull': {
      // Skull Rock: a tall, bone-pale cranium over the cave (its walls are only for the sim), cracked
      // across its top. On its south face: heavy brows over dark sockets with a glow flickering in
      // them, a nose cavity, and the open jaw (the way in), framed by a ridge of bone with teeth
      // hanging from it and a fang either side.
      const base = -(b.height - ROOF_THICKNESS / 2 + 0.01);
      const a = b.w / 2 + 0.35;
      const c = b.h / 2 + 0.35;
      const tall = b.height + 0.2;
      // Old bone (bone_skull), projected from every side so it doesn't stretch over the dome.
      const bone = makeTriplanar(toonMaterial('#ffffff', { map: boneTexture() }), 0.3);
      const dome = toonMesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), '#efe3c6', { outline: false, material: bone });
      dome.scale.set(a, tall, c);
      dome.position.y = base;
      dome.castShadow = dome.receiveShadow = true;
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }));
      hull.scale.set((a + 0.05) / a, (tall + 0.05) / tall, (c + 0.05) / c);
      dome.add(hull);
      g.add(dome);
      // A point on the dome's south face at (x across, h above the ground), `out` off it.
      const onFace = (x: number, h: number) => c * Math.sqrt(Math.max(0, 1 - (x / a) ** 2 - (h / tall) ** 2));
      const at = (x: number, h: number, out = 0) => new THREE.Vector3(x, base + h, onFace(x, h) + out);
      // Something flat laid on the face there, facing out from it.
      const stick = (m: THREE.Object3D, x: number, h: number, out: number) => {
        m.position.copy(at(x, h, out));
        const n = new THREE.Vector3(x / (a * a), h / (tall * tall), onFace(x, h) / (c * c)).normalize();
        m.lookAt(m.position.clone().add(n));
        g.add(m);
        return m;
      };
      const dark = flat('#2a1f2d');
      // (Everything on the face in proportion to the head: k = 1 for a 7 x 6 skull.)
      const k = a / 3.85;
      // (High on the face, above the big jaw.)
      const eyeH = tall * 0.68;
      for (const s of [-1, 1]) {
        // The socket: a dark hollow on the face, a glow flickering deep in it like a candle.
        const socket = new THREE.Mesh(new THREE.CircleGeometry(0.62 * k, 28), dark);
        socket.scale.set(1, 0.88, 1);
        stick(socket, s * 1.35 * k, eyeH, 0.03);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.2 * k, 18), new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false, transparent: true }));
        glow.onBeforeRender = () => {
          const t = performance.now() / 1000;
          const k = 0.75 + 0.25 * Math.sin(t * 7 + s) * Math.sin(t * 3.1 + s * 2);
          glow.scale.setScalar(k);
          (glow.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.35 * k;
        };
        stick(glow, s * 1.35 * k, eyeH - 0.08 * k, 0.05);
        // A heavy brow over it, following the head's curve (sloping down toward the nose).
        const browPts = Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          // (Kept on the face: rising further out, its end stood off the dome like a horn.)
          const x = s * (0.55 + t * 1.3) * k;
          return at(x, eyeH + (0.45 + t * 0.15 + Math.sin(t * Math.PI) * 0.06) * k, 0.02);
        });
        // (No outline: half sunk into the head, it only showed in broken bits. Its shading and the
        // shadow it casts show it.)
        const brow = toonMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(browPts), 24, 0.16 * k, 8, false), '#efe3c6', { material: bone, outline: false });
        g.add(brow);
        // Rounded ends on it.
        for (const end of [browPts[0]!, browPts[browPts.length - 1]!]) {
          const cap = toonMesh(new THREE.SphereGeometry(0.16 * k, 12, 10), '#efe3c6', { material: bone, outline: false });
          cap.position.copy(end);
          g.add(cap);
        }
      }
      // The nose: a dark cavity, narrow at the top.
      const noseShape = new THREE.Shape();
      noseShape.moveTo(0, 0.3);
      noseShape.quadraticCurveTo(0.26, -0.05, 0.12, -0.25);
      noseShape.lineTo(-0.12, -0.25);
      noseShape.quadraticCurveTo(-0.26, -0.05, 0, 0.3);
      stick(new THREE.Mesh(new THREE.ShapeGeometry(noseShape).scale(k, k, 1), dark), 0, eyeH - 0.15 * k, 0.03);
      // The jaw: the dark opening (the doorway) on the face's curve, a ridge of bone round its top,
      // teeth hanging from it.
      // The jaw as wide as the way in (the gap in its front walls), a little over.
      const R = (caveDoors.get(b)?.w ?? 2.4) / 2 + 0.05;
      // (A tall jaw: straight sides up to the arch.)
      const side = 0.55 * k;
      const cols = 16;
      const rows = 12;
      const mouthPos: number[] = [];
      const mouthIdx: number[] = [];
      for (let i = 0; i <= cols; i++) {
        const x = -R + (2 * R * i) / cols;
        const topH = side + Math.sqrt(Math.max(0, R * R - x * x));
        for (let j = 0; j <= rows; j++) {
          const p = at(x, (topH * j) / rows, 0.03);
          mouthPos.push(p.x, p.y, p.z);
          if (i > 0 && j > 0) {
            const q = (i - 1) * (rows + 1) + (j - 1);
            const r = i * (rows + 1) + (j - 1);
            mouthIdx.push(q, r, q + 1, q + 1, r, r + 1);
          }
        }
      }
      const mouthGeo = new THREE.BufferGeometry();
      mouthGeo.setAttribute('position', new THREE.Float32BufferAttribute(mouthPos, 3));
      mouthGeo.setIndex(mouthIdx);
      g.add(new THREE.Mesh(mouthGeo, toonMaterial('#2a1f2d', { map: null, side: THREE.DoubleSide })));
      const ridgePts: THREE.Vector3[] = [at(R + 0.12, 0, 0.02)];
      for (let i = 0; i <= 20; i++) {
        const t = (i / 20) * Math.PI;
        ridgePts.push(at(Math.cos(t) * (R + 0.12), side + Math.sin(t) * (R + 0.12), 0.02));
      }
      ridgePts.push(at(-R - 0.12, 0, 0.02));
      // (No outline: half sunk into the head, like the brows, it only showed in broken bits.)
      const ridge = toonMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridgePts), 48, 0.16, 8, false), '#efe3c6', { material: bone, outline: false });
      g.add(ridge);
      // A row of teeth along the top of the jaw, side by side: square-fronted, softly rounded,
      // following the arch.
      const teeth = new THREE.Group();
      const toothMat = toonMaterial('#fbf4e2', { map: null });
      // (Seven of them whatever the jaw's size: they grow with it.)
      const ts = R / 1.25;
      for (let i = -3; i <= 3; i++) {
        const t = Math.PI / 2 + i * 0.24;
        const r = R - 0.05 * ts;
        const x = Math.cos(t) * r;
        const h = side + Math.sin(t) * r;
        const tooth = toonMesh(new RoundedBoxGeometry(0.27 * ts, 0.36 * ts, 0.2 * ts, 3, 0.07 * ts), '#fbf4e2', { material: toothMat, outline: 0.06 });
        tooth.position.copy(at(x, h - 0.12 * ts, 0.08));
        // Pointing in toward the arch's middle (straight down at its top).
        tooth.rotation.z = t - Math.PI / 2;
        teeth.add(tooth);
      }
      evenOutlines(teeth, 0.03);
      g.add(teeth);
      // A fang either side of the way in, pointing up from the ground.
      for (const s of [-1, 1]) {
        const fang = toonMesh(new THREE.ConeGeometry(0.2 * k, 0.7 * k, 10), '#fbf4e2', { material: toothMat, outline: 0.08 });
        fang.position.copy(at(s * (R + 0.42 * k), 0.35 * k, 0.08));
        g.add(fang);
      }
      // Cracks across the top of the cranium (lying on it).
      const crack = (points: [number, number][]) => {
        const pts = points.map(([x, z]) => {
          const y = tall * Math.sqrt(Math.max(0, 1 - (x / a) ** 2 - (z / c) ** 2));
          return new THREE.Vector3(x, base + y + 0.02, z);
        });
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 24, 0.045, 5, false), dark));
      };
      crack([[-1.6 * k, -1.2 * k], [-1.1 * k, -0.6 * k], [-1.3 * k, 0], [-0.8 * k, 0.5 * k]]);
      crack([[1.2 * k, -1.6 * k], [1.5 * k, -0.9 * k], [1.0 * k, -0.4 * k]]);
      break;
    }
    case 'cabin': {
      // A log cabin's roof under a thick layer of snow, with icicles along the front and a chimney.
      lid(toonMaterial('#ffffff', { map: tiled(snowTexture(), w / 4, d / 4) }));
      const chimney = on(outlinedBox(1.4, 1.4, 1.4, toonMaterial('#9aa0a6', { map: tiled(stoneTexture(), 1, 1) })), w / 2 - 2.2, top + 0.7, -d / 2 + 2);
      chimney.castShadow = true;
      on(outlinedBox(1.6, 0.25, 1.6, toonMaterial('#ffffff', { map: snowTexture() })), w / 2 - 2.2, top + 1.53, -d / 2 + 2);
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
      const chimney = on(outlinedBox(1.4, 1.2, 1.4, toonMaterial('#e9c9a8')), w / 2 - 2.2, top + 0.6, -d / 2 + 2);
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
        const post = on(toonMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), '#8e6036', { material: flat('#8e6036') }), (sx * w) / 2 - sx * 0.2, top + 0.45, (sz * d) / 2 - sz * 0.2);
        evenOutlines(post, 0.025);
      }
      break;
    }
    case 'bed': {
      // A patchwork quilt, a pillow at the headboard end and a teddy on it.
      lid(toonMaterial('#ffffff', { map: tiled(quiltTexture(), w / 6, d / 6) }));
      // Two plump pillows and the sheet turned down over the quilt, outlined like everything else.
      for (const sx of [-1, 1]) {
        const pillow = on(softBox(w * 0.32, 0.45, 2.4, 0.2, flat('#fffaf3')), (sx * w) / 4, top + 0.2, -d / 2 + 1.6);
        pillow.castShadow = true;
      }
      on(softBox(w + 0.04, 0.06, d * 0.25, 0.02, flat('#fffaf3')), 0, top + 0.03, -d / 2 + d * 0.33);
      break;
    }
    case 'desk': {
      // A wooden desktop with a sheet of paper, crayons and a little lamp.
      lid(toonMaterial('#ffffff', { map: tiled(plankTexture(), w / 2, d / 4) }));
      // Outlined like everything else, all the same weight (they had none).
      const outlined = (geo: THREE.BufferGeometry, color: string) => {
        const m = toonMesh(geo, color, { material: flat(color) });
        evenOutlines(m, 0.03);
        return m;
      };
      // The paper: a flat dark sheet a little bigger under it is its outline (a hull this thin
      // fought the desk top and broke up).
      const sheet = on(new THREE.Mesh(new THREE.BoxGeometry(3, 0.02, 4), flat('#ffffff')), -w / 5, top + 0.03, 0);
      sheet.rotation.y = 0.2;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.01, 4.08), new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }));
      edge.position.y = -0.012;
      sheet.add(edge);
      ['#e2574c', '#3d7ff2', '#f7c331', '#5bd16a'].forEach((c, i) => {
        // (Resting on their outlines: level with the desk top, the outline flickered against it.)
        const crayon = on(outlined(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), c), 1 + i * 0.35, top + 0.145, 1.2);
        crayon.rotation.z = Math.PI / 2;
        crayon.rotation.y = 0.3;
      });
      const lampBase = on(outlined(new THREE.CylinderGeometry(0.6, 0.7, 0.2, 16), '#5d9cf5'), w / 2 - 2, top + 0.145, -d / 2 + 1.6);
      lampBase.castShadow = true;
      // The shade closed (a hollow cone couldn't be outlined).
      const lampShade = on(outlined(new THREE.ConeGeometry(0.9, 0.9, 16), '#fde39a'), w / 2 - 2, top + 1.4, -d / 2 + 1.6);
      lampShade.castShadow = true;
      on(outlined(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), '#5d9cf5'), w / 2 - 2, top + 0.65, -d / 2 + 1.6);
      break;
    }
    case 'table': {
      // Blue gingham with a red hem, so it doesn't look like the blanket under the table.
      lid(toonMaterial('#ffffff', { map: tiled(tableclothTexture(), w / 4.8, d / 4.8) }));
      for (const [sx, sz, x, z] of [[w + 0.04, 0.12, 0, d / 2], [w + 0.04, 0.12, 0, -d / 2], [0.12, d + 0.04, w / 2, 0], [0.12, d + 0.04, -w / 2, 0]] as const) {
        on(outlinedBox(sx, ROOF_THICKNESS + 0.04, sz, flat('#e25b5b')), x, 0, z);
      }
      // Plates and a cake on the cloth, outlined like everything else (a snug closed copy a little
      // bigger all round, kept behind what it touches).
      const round = (rTop: number, rBottom: number, h: number, color: string) => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 32), flat(color));
        mesh.add(new THREE.Mesh(new THREE.CylinderGeometry(rTop + OUTLINE, rBottom + OUTLINE, h + OUTLINE * 2, 32), pushedOutlineMaterial(OUTLINE_COLOR)));
        return mesh;
      };
      // (Resting on their outlines, so the cloth doesn't cut them off along the bottom.)
      const lift = OUTLINE + 0.015;
      for (const [x, z] of [[-w / 3, -d / 4], [w / 3, d / 4], [0, -d / 4]] as const) on(round(0.55, 0.5, 0.06, '#ffffff'), x, top + 0.03 + lift, z);
      on(round(0.7, 0.7, 0.5, '#f6a5c0'), w / 4, top + 0.25 + lift, -d / 6).castShadow = true;
      on(round(0.72, 0.72, 0.1, '#fff7ef'), w / 4, top + 0.55 + lift, -d / 6);
      // A strawberry on top.
      on(toonMesh(new THREE.SphereGeometry(0.14, 14, 10), '#e2433f', { outline: 0.12 }), w / 4, top + 0.7 + lift, -d / 6);
      break;
    }
  }

  // Every roof material fades with it: its own copy of each (outline materials are shared, and
  // fading them faded every other thing outlined with them).
  const materials: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];
  const outlines: THREE.Mesh[] = [];
  const copies = new Map<THREE.Material, THREE.Material>();
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const shared = o.material as THREE.Material;
    let m = copies.get(shared);
    if (!m) {
      m = shared.clone();
      m.onBeforeCompile = shared.onBeforeCompile;
      m.customProgramCacheKey = shared.customProgramCacheKey;
      copies.set(shared, m);
    }
    o.material = m;
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
/** For each wall, the index of the first wall in the group of walls touching it (directly or through others). */
function touchingGroups(walls: readonly Wall[]): number[] {
  const parent = walls.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const touch = (a: Wall, b: Wall) => a.x <= b.x + b.w + 0.05 && b.x <= a.x + a.w + 0.05 && a.y <= b.y + b.h + 0.05 && b.y <= a.y + a.h + 0.05;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      if (walls[i]!.kind === walls[j]!.kind && touch(walls[i]!, walls[j]!)) {
        const a = find(i);
        const b = find(j);
        parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }
  return walls.map((_, i) => find(i));
}

function underRoof(wall: Wall, map: MapData): Wall {
  // (A volcano's summit is walked on, not roofed over.)
  if (wall.kind === 'volcano') return wall;
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

/**
 * A tropical bush on Pirate Cove to hide in (it works like any bush); every other one has a palm
 * growing up out of it (see palmTree), whose crown fades with the bush while you're inside.
 */
function tropicalBush(circle: Circle, index: number): { object: THREE.Object3D; view: BushView } {
  const withPalm = index % 2 === 0;
  const { object: g, view } = bush(withPalm ? { center: circle.center, radius: circle.radius * 0.85 } : circle, [PALM_BUSH], '#1f3f26', index);
  view.circle = circle;
  if (!withPalm) return { object: g, view };
  const tree = palmTree(index);
  // Outlined all round like a standalone palm (a wall: see outlineProp), fronds and all.
  outlineProp(tree, nextMark());
  tree.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o.material instanceof THREE.MeshToonMaterial) {
      o.renderOrder = 2;
      view.balls.push(o);
      if (!view.materials.includes(o.material)) view.materials.push(o.material);
    } else view.outlines.push(o);
  });
  g.add(tree);
  return { object: g, view };
}

/** How far a rocky side bulges out at a point: smooth, so neighbouring faces always meet. */
const lumpy = (x: number, y: number, z: number) => 1 + 0.03 * Math.sin(x * 1.7 + z * 2.3 + y * 3.1) + 0.02 * Math.sin(x * 3.9 - z * 3.3);

const EDGE_SAMPLES = 160;
/** How wide the rock rim round the summit's lava pool is. */
const POOL_RIM = 0.35;
/** Lava's texture repeats every this many units. */
const LAVA_TILE = 2.5;
/** The safe rock island in the summit's pool (the sim's lava pool leaves it out). */
const VOLCANO_ISLAND = 1.35;

/**
 * A volcano, from the blocks of its tiers (each tier: blocks of one height round one middle, the
 * higher ones smaller). Each tier is drawn as one piece of dark rock round the outline of its
 * blocks together (their corners rounded off), its sides lumpy and leaning in, its top flat (it's
 * walked on); its summit a pool of lava round a little rock island (the chest's), smoking; rivers
 * of lava run from it down every face and across every ledge to the sand, on the rock's surface.
 */
function volcanoModel(pieces: readonly Wall[]): THREE.Group {
  const g = new THREE.Group();
  const cx = pieces.reduce((s, w) => s + w.x + w.w / 2, 0) / pieces.length;
  const cz = pieces.reduce((s, w) => s + w.y + w.h / 2, 0) / pieces.length;
  g.position.set(cx, 0, cz);
  const heights = [...new Set(pieces.map((w) => w.height))].sort((a, b) => a - b);
  const tiers = heights.map((h) => {
    // The tier's blocks, round the middle, corners rounded off.
    const boxes = pieces.filter((w) => w.height === h).map((w) => ({ hx: w.w / 2, hz: w.h / 2, round: Math.min(w.w, w.h) * 0.22 }));
    const inside = (x: number, z: number) =>
      boxes.some(({ hx, hz, round }) => {
        const qx = Math.abs(x) - (hx - round);
        const qz = Math.abs(z) - (hz - round);
        return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) <= round;
      });
    // How far out its outline is at angle a (on screen: x = sin a, z = cos a).
    const reach = Math.max(...boxes.map((b) => Math.hypot(b.hx, b.hz)));
    const exact = (a: number) => {
      let lo = 0;
      let hi = reach;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (inside(Math.sin(a) * mid, Math.cos(a) * mid)) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    // Sampled all round and smoothed a little: the sharp inner notches where blocks meet showed
    // slivers of outline and twisted the lava.
    const raw = Array.from({ length: EDGE_SAMPLES }, (_, i) => exact((i / EDGE_SAMPLES) * Math.PI * 2));
    const table = raw.map((_, i) => {
      let sum = 0;
      for (let k = -4; k <= 4; k++) sum += raw[(i + k + EDGE_SAMPLES) % EDGE_SAMPLES]!;
      return sum / 9;
    });
    const edge = (a: number) => {
      const f = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * EDGE_SAMPLES;
      const i = Math.floor(f);
      return table[i % EDGE_SAMPLES]! + (table[(i + 1) % EDGE_SAMPLES]! - table[i % EDGE_SAMPLES]!) * (f - i);
    };
    return { h, edge };
  });
  const lean = (t: { h: number }, y: number) => 1 - 0.05 * (y / t.h);
  // A point on tier t's side at angle a and height y (on its top edge at y = h).
  const side = (t: (typeof tiers)[number], a: number, y: number, out = 0) => {
    const r = t.edge(a) * (y >= t.h - 0.001 ? 1 : lean(t, y));
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const k = y >= t.h - 0.001 ? 1 : lumpy(x, y, z);
    return new THREE.Vector3(x * k + Math.sin(a) * out, y, z * k + Math.cos(a) * out);
  };
  const rock = makeTriplanar(toonMaterial('#8a7d76', { map: rockTexture() }), 0.45);
  const N = 160;
  const ROWS = 4;
  const drums = new THREE.Group();
  for (const t of tiers) {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let row = 0; row <= ROWS; row++) {
      const y = (t.h * row) / ROWS;
      for (let i = 0; i < N; i++) {
        const p = side(t, (i / N) * Math.PI * 2, y);
        // (Its foot just above the island's sand, which covered a sliver of it at the ground.)
        pos.push(p.x, row === 0 ? FOOT_LIFT : p.y, p.z);
      }
    }
    for (let row = 0; row < ROWS; row++) {
      for (let i = 0; i < N; i++) {
        const a = row * N + i;
        const b = row * N + ((i + 1) % N);
        idx.push(a, b, a + N, b, b + N, a + N);
      }
    }
    // The flat top: a fan from the middle.
    const middle = pos.length / 3;
    pos.push(0, t.h, 0);
    for (let i = 0; i < N; i++) idx.push(middle, ROWS * N + i, ROWS * N + ((i + 1) % N));
    // And its underside (for its outline to close round its foot).
    const under = pos.length / 3;
    pos.push(0, FOOT_LIFT, 0);
    for (let i = 0; i < N; i++) idx.push(under, (i + 1) % N, i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const block = toonMesh(geo, '#8a7d76', { material: rock, outline: 0.03 });
    block.castShadow = block.receiveShadow = true;
    drums.add(block);
  }
  // One even outline weight on every tier, pulled toward the camera so it shows round their feet.
  evenOutlines(drums, 0.03, 0.15);
  g.add(drums);
  // Lava: molten, its crust drifting (down the rivers, slowly round the pool).
  const lavaMaterial = (tex: THREE.Texture) => {
    const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return m;
  };
  // Rivers at angle `a`: from the pool on the summit over its edge, down its face, across the ledge
  // below, down the next face... to the sand, a hair off the rock all the way (over each edge, off
  // both the top and the face, so the edge never pokes through).
  // (One repeat of the texture every LAVA_TILE units, as on the pool.)
  const flowTex = tiled(lavaTexture(), 1, 1);
  const flow = lavaMaterial(flowTex);
  const river = (a: number) => {
    const steps: { l: THREE.Vector3; r: THREE.Vector3; off: THREE.Vector3 }[] = [];
    const width = 0.8;
    const up = new THREE.Vector3(0, 1, 0);
    const outward = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const corner = up.clone().add(outward).normalize();
    const point = (at: (b: number) => THREE.Vector3, off: THREE.Vector3) => {
      const half = width / 2 / Math.max(1, at(a).setY(0).length());
      const wig = Math.sin(steps.length * 0.9 + a * 3) * 0.02;
      steps.push({ l: at(a + wig - half), r: at(a + wig + half), off });
    };
    const flat = (t: (typeof tiers)[number], inset: number) => (b: number) => {
      const e = t.edge(b) - inset;
      return new THREE.Vector3(Math.sin(b) * e, t.h, Math.cos(b) * e);
    };
    for (let i = tiers.length - 1; i >= 0; i--) {
      const t = tiers[i]!;
      const below = i === 0 ? 0 : tiers[i - 1]!.h;
      if (i === tiers.length - 1) point(flat(t, POOL_RIM + 0.1), up);
      point((b) => side(t, b, t.h), corner);
      for (let s = 1; s <= 4; s++) {
        const y = t.h - ((t.h - below) * s) / 4;
        // Its foot, where the face meets the ledge: off both.
        point((b) => side(t, b, y), s === 4 && i > 0 ? corner : outward);
      }
      if (i > 0) point(flat(tiers[i - 1]!, 0.05), up);
    }
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let along = 0;
    steps.forEach((st, k) => {
      if (k > 0) along += st.l.distanceTo(steps[k - 1]!.l);
      for (const [p, u] of [[st.l, 0], [st.r, 1]] as const) {
        const q = p.clone().addScaledVector(st.off, 0.08);
        pos.push(q.x, q.y, q.z);
        uv.push((u * width) / LAVA_TILE, -along / LAVA_TILE);
      }
      if (k > 0) idx.push((k - 1) * 2, (k - 1) * 2 + 1, k * 2, (k - 1) * 2 + 1, k * 2 + 1, k * 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    g.add(new THREE.Mesh(geo, flow));
  };
  // Down the middle of the blocks' arms, where the rock is flattest.
  for (const a of [0, Math.PI / 2, (Math.PI * 3) / 2]) river(a);
  // The summit: a pool of lava filling it to a rim of rock, a little rock island in its middle
  // (where the chest is); smoke rising off it.
  const top = tiers[tiers.length - 1]!;
  const outline = Array.from({ length: 96 }, (_, i) => {
    const b = (i / 96) * Math.PI * 2;
    const e = top.edge(b) - POOL_RIM;
    return new THREE.Vector2(Math.sin(b) * e, -Math.cos(b) * e);
  });
  const pool = new THREE.Shape(outline);
  pool.holes.push(new THREE.Path().absarc(0, 0, VOLCANO_ISLAND, 0, Math.PI * 2, true));
  const poolTex = tiled(lavaTexture(), 1 / LAVA_TILE, 1 / LAVA_TILE);
  const poolMesh = new THREE.Mesh(new THREE.ShapeGeometry(pool, 24).rotateX(-Math.PI / 2), lavaMaterial(poolTex));
  // (It moves the rivers' lava too: drawn even when it's off screen.)
  poolMesh.frustumCulled = false;
  poolMesh.position.y = top.h + 0.03;
  poolMesh.onBeforeRender = () => {
    const t = performance.now() / 1000;
    poolTex.offset.set(Math.sin(t * 0.15) * 0.08, t * 0.012);
    flowTex.offset.y = t * 0.12;
  };
  g.add(poolMesh);
  g.add(smoke(0.9, top.h + 0.3, -0.6, 9));
  return g;
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
/** Each cave's (and Skull Rock's) doorway along its front (x from its middle, and how wide): the gap
 *  in its front wall. */
const caveDoors = new Map<Building, { x: number; w: number }>();
function iglooDoor(b: Building): number {
  return iglooDoors.get(b) ?? Math.PI;
}

/** Laundry piles in the Bedroom: socks, shirts and towels in a heap. */
const LAUNDRY = ['#e2574c', '#5d9cf5', '#f7c331', '#9b7bd8', '#5bd16a', '#ff9cbf', '#fffaf3'];

export function buildObstacles(map: MapData): { root: THREE.Group; bushes: BushView[]; roofs: RoofView[] } {
  const root = new THREE.Group();
  // Beach balls roll around: they're drawn from the match state (ball-views.ts); a pool's rim is
  // drawn with its pool (map-view.ts).
  // Walls that touch (a corner of two pieces, a row of blocks) share an outline mark, so their
  // outline goes round them together instead of one's drawing over the other at the joint.
  const group = touchingGroups(map.walls);
  map.walls.forEach((b, i) => {
    // (A shipwreck's sides are drawn with its deck, like an igloo's blocks with its dome.)
    if (b.kind !== 'ball' && b.kind !== 'rim' && b.kind !== 'duck' && b.kind !== 'igloo' && b.kind !== 'ramp' && b.kind !== 'hull' && b.kind !== 'skull' && b.kind !== 'volcano' && b.kind !== 'cave') {
      const fitted = underRoof(b, map);
      root.add(buildWall(fitted, i, fitted !== b, 32 + (group[i]! % 220)));
    }
  });
  const indoors = map.theme === 'bedroom';
  const bushes = map.bushes.map((c, i) => {
    if (map.theme === 'snow' || map.theme === 'island') {
      const { object, view } = map.theme === 'snow' ? pine(c, i) : tropicalBush(c, i);
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
  // A volcano: drawn whole from its tiers' pieces (see volcanoModel).
  const volcanoPieces = map.walls.filter((w) => w.kind === 'volcano');
  if (volcanoPieces.length > 0) root.add(volcanoModel(volcanoPieces));
  for (const b of map.buildings) {
    if (b.kind !== 'cave' && b.kind !== 'skull') continue;
    const front = map.walls
      .filter((w) => w.kind === b.kind && Math.abs(w.y + w.h - (b.y + b.h)) < 0.01)
      .map((w) => [w.x, w.x + w.w] as const)
      .sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < front.length; i++) {
      const gap = front[i]![0] - front[i - 1]![1];
      if (gap > 0.5) caveDoors.set(b, { x: front[i - 1]![1] + gap / 2 - (b.x + b.w / 2), w: gap });
    }
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
