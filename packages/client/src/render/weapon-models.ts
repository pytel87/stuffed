// Placeholder toy weapons, held in the plush's weapon socket (+z = forward). A band in the
// rarity color makes the tier readable at a glance.
import * as THREE from 'three';
import { config } from '@stuffed/sim';
import type { Rarity, WeaponKind } from '@stuffed/sim';
import { toonMesh } from './toon.ts';

type Point = [number, number, number];

/**
 * Where the mittens hold each weapon, in weapon-socket space. `main` is the right hand on the
 * grip; `support` is the left hand on the barrel or tank, or null for one-handed weapons.
 */
export const WEAPON_GRIPS: Record<WeaponKind, { main: Point; support: Point | null }> = {
  cork_popper: { main: [0, -0.12, 0.06], support: null },
  foam_dart_smg: { main: [0, -0.1, 0.02], support: [0.02, -0.08, 0.42] },
  super_soaker: { main: [0, -0.14, 0.04], support: [0.03, -0.07, 0.44] },
};

export function buildWeapon(kind: WeaponKind, rarity: Rarity, outline: string): THREE.Group {
  const g = new THREE.Group();
  const band = config.rarity[rarity].color;
  const cyl = (r: number, len: number, color: string, z: number, o: number | false = 0.08) => {
    const m = toonMesh(new THREE.CylinderGeometry(r, r, len, 16), color, { outline: o, outlineColor: outline });
    m.rotation.x = Math.PI / 2;
    m.position.z = z;
    g.add(m);
    return m;
  };
  const box = (sx: number, sy: number, sz: number, color: string, x: number, y: number, z: number) => {
    const m = toonMesh(new THREE.BoxGeometry(sx, sy, sz), color, { outline: 0.06, outlineColor: outline });
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  switch (kind) {
    case 'cork_popper':
      cyl(0.075, 0.55, '#2bb3a6', 0.25);
      cyl(0.09, 0.07, band, 0.42, false);
      box(0.08, 0.18, 0.1, '#2bb3a6', 0, -0.1, 0.06);
      break;
    case 'foam_dart_smg':
      box(0.16, 0.16, 0.5, '#f2873d', 0, 0, 0.22);
      box(0.1, 0.22, 0.12, '#3d7ff2', 0, -0.16, 0.2);
      cyl(0.05, 0.16, '#3d7ff2', 0.54);
      cyl(0.095, 0.06, band, 0.36, false);
      break;
    case 'super_soaker': {
      cyl(0.09, 0.62, '#f7c331', 0.28);
      cyl(0.06, 0.12, '#e2574c', 0.64);
      const tank = toonMesh(new THREE.SphereGeometry(0.17, 20, 14), '#5fb7f0', { outline: 0.06, outlineColor: outline });
      tank.position.set(0, 0.17, 0.12);
      g.add(tank);
      box(0.08, 0.2, 0.1, '#f7c331', 0, -0.12, 0.04);
      cyl(0.105, 0.06, band, 0.46, false);
      break;
    }
  }
  return g;
}
