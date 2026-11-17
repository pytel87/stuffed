// One plush on screen: a single rig with 5 part slots. Animation (walk, squash and stretch,
// lean) is render-only and derived from interpolated sim velocity; the sim never sees it.
import * as THREE from 'three';
import { config, PART_SLOTS } from '@stuffed/sim';
import type { PartLoadout, PartSlot, Rarity, Vec2, WeaponKind } from '@stuffed/sim';
import { bodyColor, buildPart, type PartObject } from './placeholder-parts.ts';
import { PlushArms } from './plush-arms.ts';
import { OUTLINE_COLOR } from './toon.ts';
import { buildWeapon } from './weapon-models.ts';

/** Where each slot's part attaches, in rig space (+z = facing direction, y = up). */
const SOCKETS: Record<PartSlot, [number, number, number]> = {
  legs: [0, 0, 0],
  body: [0, 0.66, 0],
  head: [0, 1.17, 0.04],
  tail: [0, 0.62, -0.34],
  accessory: [0, 1.17, 0.04],
};

const WALK_RADIANS_PER_UNIT = 2.2;
const SQUASH = 0.09;
const BOB = 0.14;
const LEAN = 0.15;
const LEG_SWING = 0.8;
/**
 * Held weapon, in front of the plush's right side; not a cosmetic slot. The side offset is the
 * sim's muzzleSide so shots leave from the barrel the player sees (rig -x = plush's right).
 */
const WEAPON_SOCKET: [number, number, number] = [-config.combat.muzzleSide, 0.6, 0.34];
const RECOIL_DISTANCE = 0.14;
const FLASH_SECONDS = 0.14;
/** Above this height over the surface below, the plush counts as in the air. */
const AIRBORNE = 0.03;
const LEG_TUCK = -0.7;

let shadowTexture: THREE.CanvasTexture | null = null;
function shadowMap(): THREE.CanvasTexture {
  if (!shadowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    shadowTexture = new THREE.CanvasTexture(c);
  }
  return shadowTexture;
}

export class PlushView {
  readonly root = new THREE.Group();
  private readonly lean = new THREE.Group();
  private readonly facing = new THREE.Group();
  private readonly squash = new THREE.Group();
  private readonly slots = {} as Record<PartSlot, THREE.Group>;
  private readonly hitbox: THREE.Mesh;
  private parts: Partial<PartLoadout> = {};
  private legPivots: THREE.Object3D[] = [];
  private walkPhase = 0;
  private moveAmount = 0;
  private readonly leanAxis = new THREE.Vector3();
  private readonly weaponSocket = new THREE.Group();
  private weaponKey = '';
  private recoil = 0;
  private flashTime = 0;
  private toonMaterials: THREE.MeshToonMaterial[] = [];
  private readonly arms: PlushArms;
  /** Soft blob on the surface below; shrinks and fades with height so jumps read from above. */
  private readonly blob: THREE.Mesh;
  private airAmount = 0;
  private wasAirborne = false;
  private lastZ = 0;
  private landSquash = 0;

  constructor(parts: PartLoadout, private readonly outlineColor = OUTLINE_COLOR) {
    this.root.add(this.lean);
    this.lean.add(this.facing);
    this.facing.add(this.squash);
    for (const slot of PART_SLOTS) {
      const socket = new THREE.Group();
      socket.name = `slot:${slot}`;
      socket.position.set(...SOCKETS[slot]);
      // Legs stay planted; everything else squashes and bobs.
      (slot === 'legs' ? this.facing : this.squash).add(socket);
      this.slots[slot] = socket;
    }
    this.weaponSocket.position.set(...WEAPON_SOCKET);
    this.squash.add(this.weaponSocket);
    this.arms = new PlushArms(outlineColor);
    this.squash.add(this.arms.group);
    const r = config.player.radius;
    this.hitbox = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.04, r, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ff3b6b', depthTest: false, transparent: true }),
    );
    this.hitbox.position.y = 0.03;
    this.hitbox.renderOrder = 10;
    this.hitbox.visible = false;
    this.root.add(this.hitbox);
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000000', map: shadowMap(), transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.root.add(this.blob);
    this.setParts(parts);
  }

  /** Swaps only the slots whose part id changed. */
  setParts(parts: PartLoadout): void {
    for (const slot of PART_SLOTS) {
      if (this.parts[slot] === parts[slot]) continue;
      const socket = this.slots[slot];
      for (const child of [...socket.children]) {
        socket.remove(child);
        disposeGeometries(child);
      }
      const part: PartObject = buildPart(slot, parts[slot], this.outlineColor);
      socket.add(part);
      if (slot === 'legs') this.legPivots = part.userData.swing ?? [];
    }
    if (this.parts.body !== parts.body) this.arms.setColor(bodyColor(parts.body));
    this.parts = { ...parts };
    this.collectMaterials();
    this.trimShadows();
  }

  setWeapon(kind: WeaponKind | null, rarity: Rarity): void {
    const key = kind ? `${kind}:${rarity}` : '';
    if (key === this.weaponKey) return;
    this.weaponKey = key;
    for (const child of [...this.weaponSocket.children]) {
      this.weaponSocket.remove(child);
      disposeGeometries(child);
    }
    if (kind) this.weaponSocket.add(buildWeapon(kind, rarity, this.outlineColor));
    this.arms.setGrip(kind);
    this.collectMaterials();
    this.trimShadows();
  }

  /** Kick the weapon back after a shot. */
  kick(): void {
    this.recoil = 1;
  }

  /** Seams flash white when hit. */
  flash(): void {
    this.flashTime = FLASH_SECONDS;
  }

  setHitboxVisible(visible: boolean): void {
    this.hitbox.visible = visible;
  }

  /**
   * `z` is the plush's feet height and `groundY` the surface below it. Returns true on the
   * frame the plush lands, so the caller can puff some dust.
   */
  update(pos: Vec2, vel: Vec2, aim: Vec2, z: number, groundY: number, dt: number, time: number): boolean {
    this.root.position.set(pos.x, z, pos.y);
    this.facing.rotation.y = Math.atan2(aim.x, aim.y);

    const height = z - groundY;
    const airborne = height > AIRBORNE;
    const landed = this.wasAirborne && !airborne;
    this.wasAirborne = airborne;
    if (landed) this.landSquash = 1;
    const climb = dt > 0 ? (z - this.lastZ) / dt : 0;
    this.lastZ = z;
    this.airAmount += ((airborne ? 1 : 0) - this.airAmount) * (1 - Math.exp(-18 * dt));
    this.landSquash = Math.max(0, this.landSquash - dt * 6);

    const speed = Math.hypot(vel.x, vel.y);
    const target = Math.min(1, speed / config.player.moveSpeed);
    this.moveAmount += (target - this.moveAmount) * (1 - Math.exp(-12 * dt));
    if (!airborne) this.walkPhase += speed * WALK_RADIANS_PER_UNIT * dt;
    const m = this.moveAmount * (1 - this.airAmount);

    // Walking bounce on the ground; stretch while rising, squash on landing.
    const stretch = Math.max(-0.12, Math.min(0.16, climb * 0.025)) * this.airAmount;
    const s = Math.sin(this.walkPhase * 2) * SQUASH * m + Math.sin(time * 2.4) * 0.025 * (1 - m) * (1 - this.airAmount) - stretch + this.landSquash * 0.22;
    this.squash.scale.set(1 + s, 1 - s, 1 + s);
    this.squash.position.y = Math.abs(Math.sin(this.walkPhase)) * BOB * m;

    this.blob.position.y = -height + 0.03;
    this.blob.scale.setScalar(Math.max(0.45, 1 - height * 0.3));
    (this.blob.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.max(0.4, 1 - height * 0.25);

    // Lean into the direction of travel (world space, independent of aim).
    if (speed > 0.01) {
      this.leanAxis.set(vel.y / speed, 0, -vel.x / speed);
      this.lean.quaternion.setFromAxisAngle(this.leanAxis, LEAN * m);
    } else {
      this.lean.quaternion.identity();
    }

    const swing = Math.sin(this.walkPhase) * LEG_SWING * m;
    const tuck = LEG_TUCK * this.airAmount;
    this.legPivots.forEach((hip, i) => (hip.rotation.x = (i % 2 ? -swing : swing) + tuck));

    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.weaponSocket.position.z = WEAPON_SOCKET[2] - this.recoil * RECOIL_DISTANCE;
    this.arms.update(this.weaponSocket.position, this.walkPhase, m);

    const flash = this.flashTime > 0 ? this.flashTime / FLASH_SECONDS : 0;
    this.flashTime = Math.max(0, this.flashTime - dt);
    for (const mat of this.toonMaterials) mat.emissive.setScalar(flash * 0.7);
    return landed;
  }

  /** Tiny parts (eyes, stitches, teeth, buttons) cast no shadow: invisible, but each costs a draw. */
  private trimShadows(): void {
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.castShadow) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere!.radius < 0.12) o.castShadow = false;
    });
  }

  private collectMaterials(): void {
    const mats = new Set<THREE.MeshToonMaterial>();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) mats.add(o.material);
    });
    this.toonMaterials = [...mats];
  }

  dispose(): void {
    this.root.removeFromParent();
    disposeGeometries(this.root);
  }
}

function disposeGeometries(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
