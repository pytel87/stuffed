// Stubby, stretchy plush arms with mitten hands. They belong to the shared rig (not a part
// slot), take the body part's color, and reach for grip points on the held weapon.
import * as THREE from 'three';
import type { WeaponKind } from '@stuffed/sim';
import { WEAPON_GRIPS } from './weapon-models.ts';
import { lighten, outlineMaterial, toonMaterial } from './toon.ts';

const ARM_RADIUS = 0.065;
/** Shoulders sit on the body's front sides (rig space, +z forward, +x = plush's left). */
const SHOULDERS = [new THREE.Vector3(-0.3, 0.8, 0.12), new THREE.Vector3(0.3, 0.8, 0.12)] as const;
/** Where a free hand rests, swinging with the walk. */
const REST = [new THREE.Vector3(-0.44, 0.5, 0.06), new THREE.Vector3(0.44, 0.5, 0.06)] as const;
const ARM_SWING = 0.16;
const FORWARD = new THREE.Vector3(0, 0, 1);

// Unit-length tube along +z, scaled to the shoulder-hand distance each frame.
const tubeGeo = new THREE.CylinderGeometry(ARM_RADIUS, ARM_RADIUS, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const jointGeo = new THREE.SphereGeometry(ARM_RADIUS, 12, 8);
const mittenGeo = new THREE.SphereGeometry(0.1, 16, 12);
const thumbGeo = new THREE.SphereGeometry(0.045, 10, 8);

interface Arm {
  tube: THREE.Mesh;
  mitten: THREE.Group;
}

export class PlushArms {
  readonly group = new THREE.Group();
  private readonly arms: Arm[];
  private readonly armMat = toonMaterial('#ffffff');
  private readonly mittenMat = toonMaterial('#ffffff');
  private grip: WeaponKind | null = null;
  private readonly hand = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(outlineColor: string) {
    const hull = outlineMaterial(outlineColor);
    this.arms = SHOULDERS.map((shoulder, i) => {
      const tube = new THREE.Mesh(tubeGeo, this.armMat);
      tube.castShadow = true;
      tube.position.copy(shoulder);
      const tubeHull = new THREE.Mesh(tubeGeo, hull);
      tubeHull.scale.set(1.35, 1.35, 1);
      tube.add(tubeHull);
      this.group.add(tube);

      const joint = new THREE.Mesh(jointGeo, this.armMat);
      joint.position.copy(shoulder);
      this.group.add(joint);

      const mitten = new THREE.Group();
      const palm = new THREE.Mesh(mittenGeo, this.mittenMat);
      palm.scale.set(1, 0.85, 1.1);
      palm.castShadow = true;
      const palmHull = new THREE.Mesh(mittenGeo, hull);
      palmHull.scale.setScalar(1.12);
      palm.add(palmHull);
      mitten.add(palm);
      const thumb = new THREE.Mesh(thumbGeo, this.mittenMat);
      thumb.position.set(i === 0 ? 0.07 : -0.07, 0.04, 0.03);
      const thumbHull = new THREE.Mesh(thumbGeo, hull);
      thumbHull.scale.setScalar(1.2);
      thumb.add(thumbHull);
      mitten.add(thumb);
      this.group.add(mitten);
      return { tube, mitten };
    });
  }

  setColor(bodyColor: string): void {
    this.armMat.color.set(bodyColor);
    this.mittenMat.color.copy(lighten(bodyColor, 0.15));
  }

  setGrip(kind: WeaponKind | null): void {
    this.grip = kind;
  }

  /** `weaponSocket` is the weapon's current position in rig space (it moves with recoil). */
  update(weaponSocket: THREE.Vector3, walkPhase: number, moveAmount: number): void {
    const grips = this.grip ? WEAPON_GRIPS[this.grip] : null;
    const targets = [grips?.main ?? null, grips?.support ?? null];

    this.arms.forEach((arm, i) => {
      const shoulder = SHOULDERS[i]!;
      const grip = targets[i];
      if (grip) {
        this.hand.set(...grip).add(weaponSocket);
      } else {
        const swing = Math.sin(walkPhase + (i === 0 ? 0 : Math.PI)) * ARM_SWING * moveAmount;
        this.hand.copy(REST[i]!).setZ(REST[i]!.z + swing);
      }
      this.dir.subVectors(this.hand, shoulder);
      const len = Math.max(0.01, this.dir.length());
      this.dir.divideScalar(len);
      arm.tube.quaternion.setFromUnitVectors(FORWARD, this.dir);
      arm.tube.scale.set(1, 1, len);
      arm.mitten.position.copy(this.hand);
      arm.mitten.quaternion.copy(arm.tube.quaternion);
    });
  }
}
