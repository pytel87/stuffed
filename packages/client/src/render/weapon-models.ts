// Toy weapons, held in the plush's weapon socket (+z = forward, y up). Chunky, bright and
// outlined like the plushies; a ring in the rarity color makes the tier readable at a glance.
// Barrel tips sit at the sim's barrelLength minus the socket's forward offset (0.34), so shots
// leave from the muzzle you see.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { Rarity, WeaponKind } from '@stuffed/sim';
import { evenOutlines, GEAR_OUTLINE, lighten, makePlastic, toonMaterial, toonMesh } from './toon.ts';

type Point = [number, number, number];

/**
 * Where the mittens hold each weapon, in weapon-socket space. `main` is the right hand on the
 * grip; `support` is the left hand on the barrel or tank, or null for one-handed weapons.
 */
export const WEAPON_GRIPS: Record<WeaponKind, { main: Point; support: Point | null }> = {
  cork_popper: { main: [0, -0.12, 0.04], support: null },
  foam_dart_smg: { main: [0, -0.12, 0.02], support: [0.02, -0.1, 0.4] },
  super_soaker: { main: [0, -0.14, 0.04], support: [0.02, -0.12, 0.42] },
  rubber_band_rifle: { main: [0, -0.12, 0.0], support: [0.02, -0.06, 0.4] },
  marble_launcher: { main: [0, -0.14, 0.04], support: [0.02, -0.12, 0.36] },
  pillow_hammer: { main: [0, -0.04, 0.0], support: [0, -0.04, 0.16] },
  glitter_bomb: { main: [0, -0.1, 0.12], support: null },
  bubble_wand: { main: [0, -0.04, 0.02], support: null },
};

/** A little builder: every piece is toon-shaded and outlined in the given color. */
function kit(g: THREE.Group, outline: string) {
  const add = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  return {
    /** A cylinder along z (a barrel), centered at z. */
    tube: (r: number, len: number, color: string, x: number, y: number, z: number, o: number | false = 0.08, r2 = r) => {
      const m = toonMesh(new THREE.CylinderGeometry(r2, r, len, 18), color, { outline: o, outlineColor: outline });
      m.rotation.x = Math.PI / 2;
      return add(m, x, y, z);
    },
    box: (sx: number, sy: number, sz: number, color: string, x: number, y: number, z: number, o: number | false = 0.06) =>
      add(toonMesh(new THREE.BoxGeometry(sx, sy, sz), color, { outline: o, outlineColor: outline }), x, y, z),
    ball: (r: number, color: string, x: number, y: number, z: number, o: number | false = 0.06) =>
      add(toonMesh(new THREE.SphereGeometry(r, 18, 12), color, { outline: o, outlineColor: outline }), x, y, z),
    /** A ring around the z axis (trigger guards, rarity bands). */
    ring: (r: number, tube: number, color: string, x: number, y: number, z: number, axis: 'z' | 'x' = 'z') => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24), toonMaterial(color, { map: null }));
      if (axis === 'x') m.rotation.y = Math.PI / 2;
      return add(m, x, y, z);
    },
  };
}

/** `showRarity` false leaves out the rarity ring (HUD pictures, where the slot shows the rarity). */
export function buildWeapon(kind: WeaponKind, rarity: Rarity, outline: string, showRarity = true): THREE.Group {
  const g = new THREE.Group();
  const band = config.rarity[rarity].color;
  const k = kit(g, outline);

  switch (kind) {
    case 'cork_popper': {
      // A teal toy pistol with a cork in the muzzle and an orange trigger guard.
      const body = '#2bb3a6';
      k.tube(0.075, 0.4, body, 0, 0.02, 0.3);
      k.tube(0.09, 0.08, lighten(body, 0.25).getStyle(), 0, 0.02, 0.48, 0.08);
      k.tube(0.058, 0.08, '#d9a066', 0, 0.02, 0.55, 0.12, 0.068); // the cork, poking out
      k.box(0.15, 0.17, 0.22, body, 0, 0.03, 0.08);
      k.box(0.05, 0.05, 0.08, '#f2a03d', 0, 0.14, 0.12); // rear sight
      const grip = k.box(0.09, 0.22, 0.11, '#1f8f85', 0, -0.12, 0.03);
      grip.rotation.x = -0.3;
      k.ring(0.06, 0.016, '#f2a03d', 0, -0.07, 0.13, 'x');
      if (showRarity) k.ring(0.083, 0.022, band, 0, 0.02, 0.38);
      break;
    }
    case 'foam_dart_smg': {
      // A classic foam blaster: a chunky orange body, a blue top rail and barrel with a yellow tip,
      // a straight yellow magazine, a blue grip and a short stock.
      const blue = '#3d7ff2';
      k.box(0.18, 0.2, 0.5, '#f2873d', 0, 0, 0.2);
      k.box(0.1, 0.06, 0.38, blue, 0, 0.13, 0.2); // top rail
      k.tube(0.06, 0.16, blue, 0, 0.02, 0.52);
      k.tube(0.07, 0.06, '#f7d046', 0, 0.02, 0.62); // muzzle tip
      const mag = k.box(0.09, 0.26, 0.14, '#f7d046', 0, -0.2, 0.3);
      mag.rotation.x = 0.12;
      const grip = k.box(0.09, 0.22, 0.11, blue, 0, -0.15, 0.02);
      grip.rotation.x = -0.3;
      k.ring(0.055, 0.016, '#f7d046', 0, -0.08, 0.1, 'x'); // trigger guard
      k.box(0.12, 0.16, 0.14, blue, 0, 0.0, -0.11); // stock
      if (showRarity) k.ring(0.11, 0.025, band, 0, 0, 0.38);
      break;
    }
    case 'super_soaker': {
      // A yellow water blaster: a big tank of water on top, an orange pump under the barrel.
      k.tube(0.09, 0.6, '#f7c331', 0, 0, 0.3);
      k.tube(0.06, 0.12, '#e2574c', 0, 0, 0.64);
      const tank = k.ball(0.19, '#4fb3f0', 0, 0.2, 0.1);
      tank.scale.set(1, 0.9, 1.25);
      k.ball(0.06, '#e6f7ff', 0.07, 0.3, 0.06, false); // shine
      k.tube(0.05, 0.1, '#f7c331', 0, 0.12, 0.26, 0.1); // tank neck
      k.tube(0.075, 0.2, '#f2873d', 0, -0.11, 0.42); // pump
      k.box(0.09, 0.22, 0.11, '#f7c331', 0, -0.13, 0.03).rotation.x = -0.25;
      if (showRarity) k.ring(0.105, 0.025, band, 0, 0, 0.52);
      break;
    }
    case 'rubber_band_rifle': {
      // A long wooden ruler-rifle: a red rubber band stretched from the front notch to a
      // clothespin trigger at the back.
      k.box(0.09, 0.09, 0.82, '#d9a066', 0, 0.02, 0.27); // the ruler
      for (let i = 0; i < 7; i++) k.box(0.092, 0.012, 0.012, '#8e6036', 0, 0.068, -0.05 + i * 0.1, false); // ruler marks
      k.box(0.1, 0.08, 0.05, '#8e6036', 0, 0.08, 0.66); // front notch
      k.box(0.12, 0.1, 0.16, '#e2574c', 0, 0.08, -0.06); // clothespin
      for (const x of [-0.035, 0.035]) {
        const strand = k.tube(0.012, 0.72, '#ff4d6d', x, 0.11, 0.3, false);
        strand.rotation.x = Math.PI / 2 - 0.02;
      }
      const grip = k.box(0.09, 0.22, 0.11, '#a87440', 0, -0.13, 0.0);
      grip.rotation.x = -0.35;
      if (showRarity) k.ring(0.075, 0.022, band, 0, 0.02, 0.5);
      break;
    }
    case 'marble_launcher': {
      // A chunky purple tube with a flared mouth and a hopper of marbles on top.
      k.tube(0.12, 0.42, '#8a5cd6', 0, 0, 0.26);
      k.tube(0.12, 0.12, '#b48cf0', 0, 0, 0.53, 0.06, 0.16); // flared mouth
      const hopper = k.tube(0.13, 0.16, '#f2c14e', 0, 0.18, 0.12, 0.06, 0.08);
      hopper.rotation.x = 0; // a funnel standing up
      ['#ff5a5a', '#3fa9f5', '#5bd16a'].forEach((c, i) => k.ball(0.055, c, (i - 1) * 0.06, 0.28, 0.12 + (i % 2) * 0.03, 0.12));
      k.box(0.1, 0.22, 0.12, '#6a40b0', 0, -0.15, 0.04).rotation.x = -0.25;
      if (showRarity) k.ring(0.13, 0.025, band, 0, 0, 0.36);
      break;
    }
    case 'pillow_hammer': {
      // A long handle with a big puffy square pillow on the end: tufted corners and a button in
      // the middle of each face.
      k.tube(0.035, 0.56, '#a87440', 0, 0, 0.23);
      const head = new THREE.Group();
      head.position.set(0, 0, 0.72);
      // Facing mostly up (the game's camera looks down), a little to the side for the HUD picture.
      const n = new THREE.Vector3(0.45, 1, 0).normalize();
      const along = new THREE.Vector3(0, 0, 1);
      const across = new THREE.Vector3().crossVectors(along, n);
      head.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, n));
      // Puffy: a box whose thickness tapers to thin seams at the edges.
      const W = 0.78;
      const H = 0.56;
      const T = 0.26;
      const geo = new THREE.BoxGeometry(W, H, T, 10, 8, 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / (W / 2);
        const y = pos.getY(i) / (H / 2);
        const puff = Math.max(0.15, (1 - x * x * x * x) * (1 - y * y * y * y));
        pos.setZ(i, pos.getZ(i) * puff);
      }
      geo.computeVertexNormals();
      head.add(toonMesh(geo, '#b8d8ff', { outline: 0.05, outlineColor: outline }));
      // Tufted corners and a button on each face.
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const tuft = toonMesh(new THREE.ConeGeometry(0.06, 0.13, 8), '#9cc4f5', { outline: 0.12, outlineColor: outline });
          tuft.position.set((sx * W) / 2, (sy * H) / 2, 0);
          tuft.rotation.z = Math.atan2(sy, sx) - Math.PI / 2;
          head.add(tuft);
        }
      }
      for (const side of [-1, 1]) {
        const button = toonMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.035, 14), '#e2574c', { outline: 0.12, outlineColor: outline });
        button.rotation.x = Math.PI / 2;
        button.position.z = side * (T / 2 + 0.005);
        head.add(button);
      }
      g.add(head);
      if (showRarity) k.ring(0.045, 0.02, band, 0, 0, 0.36);
      break;
    }
    case 'glitter_bomb': {
      // A pink ball speckled with glitter, a gold cap and a curly fuse with a spark on top.
      k.ball(0.17, '#ff7ac8', 0, 0.02, 0.18);
      const glitter = ['#fff27a', '#7af0ff', '#ffffff', '#c58bff'];
      for (let i = 0; i < 10; i++) {
        // Spread over the ball (a golden-angle spiral), skipping the bottom.
        const t = (i + 0.5) / 10;
        const y = 1 - t * 1.5;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const a = i * 2.39996;
        const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
        const flake = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), new THREE.MeshBasicMaterial({ color: glitter[i % glitter.length]!, toneMapped: false }));
        flake.position.set(0, 0.02, 0.18).addScaledVector(dir, 0.172);
        flake.scale.set(1, 1, 0.4);
        flake.lookAt(flake.position.clone().add(dir));
        g.add(flake);
      }
      k.tube(0.055, 0.06, '#f7c331', 0, 0.2, 0.18, 0.1).rotation.x = 0; // the cap
      const fuse = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.23, 0.18),
        new THREE.Vector3(0.03, 0.29, 0.16),
        new THREE.Vector3(-0.02, 0.33, 0.13),
        new THREE.Vector3(0.02, 0.37, 0.11),
      ]);
      g.add(toonMesh(new THREE.TubeGeometry(fuse, 12, 0.014, 6), '#5a4030', { outline: false }));
      // The spark: a bright little star.
      for (const [sx, sy, sz] of [[1, 1, 0.35], [0.35, 1, 1]] as const) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: '#ffd23a', toneMapped: false }));
        spark.scale.set(sx, sy, sz);
        spark.position.copy(fuse.getPoint(1)).add(new THREE.Vector3(0, 0.02, 0));
        g.add(spark);
      }
      if (showRarity) k.ring(0.17, 0.02, band, 0, 0.02, 0.18, 'x');
      break;
    }
    case 'bubble_wand': {
      // A pink stick with a big loop and a shimmering soap film in it. The loop is turned half
      // toward the side and half up, so it reads as a loop from above and from the side.
      k.tube(0.025, 0.46, '#ff7ac8', 0, 0, 0.26);
      const head = new THREE.Group();
      head.position.set(0, 0, 0.64);
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 1, 0).normalize());
      head.add(toonMesh(new THREE.TorusGeometry(0.15, 0.028, 10, 32), '#ff7ac8', { outline: 0.12, outlineColor: outline }));
      const film = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 28),
        new THREE.MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
      );
      head.add(film);
      const shine = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.095, 20, 1, 0.4, 1.4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      shine.position.z = 0.002;
      head.add(shine);
      g.add(head);
      k.tube(0.04, 0.12, '#ffd23a', 0, 0, 0.03); // handle cap
      if (showRarity) k.ring(0.035, 0.016, band, 0, 0, 0.3);
      break;
    }
  }
  // Glossy toy plastic (the Pillow Hammer is cloth and wood: it keeps its soft felt).
  if (kind !== 'pillow_hammer') {
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) makePlastic(o.material);
    });
  }
  // One outline weight on every bit (small ones had hairlines).
  evenOutlines(g, GEAR_OUTLINE);
  return g;
}
