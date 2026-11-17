// One plush on screen: a single rig with 5 part slots. Animation (walk, squash and stretch,
// lean) is render-only and derived from interpolated sim velocity; the sim never sees it.
import * as THREE from 'three';
import { config, fullSet, PART_SLOTS } from '@stuffed/sim';
import type { Animal, PartLoadout, PartSlot, Rarity, Vec2, WeaponKind } from '@stuffed/sim';
import { bodyColor, buildPart, type PartObject } from './placeholder-parts.ts';
import { mergeStatic } from './merge-static.ts';
import { PlushArms } from './plush-arms.ts';
import { OUTLINE_COLOR, toonMaterial } from './toon.ts';
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

/** Glow color for a plush wearing a full set of one animal. */
const SET_GLOW: Record<Animal, string> = {
  bear: '#ffb347',
  frog: '#7dff6a',
  shark: '#4fd2ff',
  chicken: '#fff27a',
  dino: '#5dffc8',
  owl: '#ffd27a',
  axolotl: '#ff8ad0',
  penguin: '#a8e4ff',
  bunny: '#d9b8ff',
  unicorn: '#ff9cf0',
  cat: '#ffd36a',
  fox: '#ff9a4a',
  panda: '#a8f07a',
  pig: '#ff9cb5',
  lion: '#ffc23a',
  elephant: '#9ccfff',
  turtle: '#8fe07a',
  hedgehog: '#ffb070',
  koala: '#c9d6e6',
  octopus: '#d79bff',
};

let glowTexture: THREE.CanvasTexture | null = null;
function glowMap(): THREE.CanvasTexture {
  if (!glowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTexture = new THREE.CanvasTexture(c);
  }
  return glowTexture;
}

export class PlushView {
  readonly root = new THREE.Group();
  private readonly lean = new THREE.Group();
  private readonly facing = new THREE.Group();
  private readonly squash = new THREE.Group();
  private readonly slots = {} as Record<PartSlot, THREE.Group>;
  private readonly hitbox: THREE.Mesh;
  /** The animal per slot, to rebuild only the slots that changed. */
  private partKeys: Partial<Record<PartSlot, string>> = {};
  private bodyAnimal = '';
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
  /** While the plush wears a full set: a ring of light underfoot and a pulsing tint in the set's color. */
  private readonly glowRing: THREE.Mesh;
  /** Team mode: a blue ring on the ground under a teammate. */
  private readonly teamRing: THREE.Mesh;
  private glowColor: THREE.Color | null = null;
  /** A soap bubble around the plush while it's trapped. */
  private readonly bubble: THREE.Mesh;
  private bubbleAmount = 0;
  /** A paper umbrella held up while gliding down from the Toss. */
  private readonly umbrella: THREE.Group;
  /** The Rubber Band Rifle's aim line while drawing it. */
  private readonly beam: THREE.Mesh;
  /** Pillow Hammer swing in progress (1 → 0). */
  private swingTime = 0;
  private weaponKind: WeaponKind | null = null;

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
    this.glowRing = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowMap(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    this.glowRing.position.y = 0.01;
    this.glowRing.visible = false;
    this.blob.add(this.glowRing);
    this.teamRing = new THREE.Mesh(
      new THREE.RingGeometry(0.66, 0.8, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#5d9cf5', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
    );
    this.teamRing.position.y = 0.015;
    this.teamRing.visible = false;
    this.blob.add(this.teamRing);

    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#d4f4ff', transparent: true, opacity: 0.32, depthWrite: false }),
    );
    const bubbleRim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    this.bubble.add(bubbleRim);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    shine.position.set(-0.45, 0.55, 0.5);
    this.bubble.add(shine);
    this.bubble.position.y = 0.85;
    this.bubble.visible = false;
    this.root.add(this.bubble);

    // A paper umbrella: a shallow cone of colored panels on a stick.
    this.umbrella = new THREE.Group();
    const panels = ['#ff5a5a', '#ffd23a', '#3fa9f5', '#5bd16a', '#ff7ac8', '#fff6ec'];
    panels.forEach((c, i) => {
      const panel = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 0.5, 6, 1, true, (i / 6) * Math.PI * 2, Math.PI / 3),
        toonMaterial(c, { map: null, side: THREE.DoubleSide }),
      );
      panel.position.y = 2.35;
      this.umbrella.add(panel);
    });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), toonMaterial('#8e6036', { map: null }));
    stick.position.y = 1.8;
    this.umbrella.add(stick);
    this.umbrella.visible = false;
    this.squash.add(this.umbrella);

    // A thin red line from the band rifle out along the aim, brighter as it's drawn.
    this.beam = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    this.beam.position.set(WEAPON_SOCKET[0], WEAPON_SOCKET[1] + 0.06, WEAPON_SOCKET[2] + 0.7);
    this.beam.scale.z = 16;
    this.beam.visible = false;
    this.facing.add(this.beam);
    this.setParts(parts);
  }

  /** Swaps only the slots whose animal changed. Returns whether any did. */
  setParts(parts: PartLoadout): boolean {
    let changed = false;
    for (const slot of PART_SLOTS) {
      const worn = parts[slot];
      const key = worn.animal;
      if (this.partKeys[slot] === key) continue;
      this.partKeys[slot] = key;
      changed = true;
      const socket = this.slots[slot];
      for (const child of [...socket.children]) {
        socket.remove(child);
        disposeGeometries(child);
      }
      const part: PartObject = buildPart(slot, worn.animal);
      socket.add(part);
      if (slot === 'legs') this.legPivots = part.userData.swing ?? [];
    }
    if (!changed) return false;
    const set = fullSet(parts);
    this.glowRing.visible = set !== null;
    this.glowColor = set ? new THREE.Color(SET_GLOW[set]) : null;
    if (set) (this.glowRing.material as THREE.MeshBasicMaterial).color.set(SET_GLOW[set]);
    if (this.bodyAnimal !== parts.body.animal) {
      this.bodyAnimal = parts.body.animal;
      this.arms.setColor(bodyColor(parts.body.animal));
    }
    this.collectMaterials();
    this.trimShadows();
    return true;
  }

  setWeapon(kind: WeaponKind | null, rarity: Rarity): void {
    const key = kind ? `${kind}:${rarity}` : '';
    if (key === this.weaponKey) return;
    this.weaponKey = key;
    for (const child of [...this.weaponSocket.children]) {
      this.weaponSocket.remove(child);
      disposeGeometries(child);
    }
    this.weaponKind = kind;
    if (kind) {
      const model = buildWeapon(kind, rarity, this.outlineColor);
      mergeStatic(model);
      this.weaponSocket.add(model);
    }
    this.arms.setGrip(kind);
    this.collectMaterials();
    this.trimShadows();
  }

  /** Marks this plush as your teammate (team mode). */
  setTeammate(on: boolean): void {
    this.teamRing.visible = on;
  }

  /** Kick the weapon back after a shot. */
  kick(): void {
    this.recoil = 1;
    if (this.weaponKind === 'pillow_hammer') this.swingTime = 1;
  }

  /**
   * Trapped in a bubble or not. Returns true when the bubble just popped (for a splash).
   */
  setBubbled(trapped: boolean): boolean {
    const popped = !trapped && this.bubble.visible && this.bubbleAmount > 0.5;
    if (trapped && !this.bubble.visible) this.bubbleAmount = 0;
    this.bubble.visible = trapped;
    return popped;
  }

  /** Gliding down from the Toss under an umbrella. */
  setGliding(gliding: boolean): void {
    this.umbrella.visible = gliding;
  }

  /** How far the band rifle is drawn (0 = not charging). */
  setCharge(amount: number): void {
    this.beam.visible = amount > 0;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.2 + amount * 0.6;
    this.beam.scale.x = 1 + amount;
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
    // Pillow Hammer: a quick swing across from the right to the left.
    this.swingTime = Math.max(0, this.swingTime - dt * 5);
    this.weaponSocket.rotation.y = this.swingTime > 0 ? (this.swingTime - 0.5) * 2.4 : 0;
    // The bubble grows in, wobbles and bobs.
    if (this.bubble.visible) {
      this.bubbleAmount = Math.min(1, this.bubbleAmount + dt * 6);
      const w = Math.sin(time * 7) * 0.05;
      this.bubble.scale.set(this.bubbleAmount * (1 + w), this.bubbleAmount * (1 - w), this.bubbleAmount * (1 + w));
      this.bubble.position.y = 0.85 + Math.sin(time * 3) * 0.08;
    }
    this.arms.update(this.weaponSocket.position, this.walkPhase, m);

    const pulse = 0.5 + Math.sin(time * 3) * 0.5;
    if (this.glowColor) (this.glowRing.material as THREE.MeshBasicMaterial).opacity = 0.7 + pulse * 0.3;

    // Hit flash (white) on top of the full-set tint.
    const flash = this.flashTime > 0 ? this.flashTime / FLASH_SECONDS : 0;
    this.flashTime = Math.max(0, this.flashTime - dt);
    const tint = this.glowColor ? 0.12 + pulse * 0.14 : 0;
    for (const mat of this.toonMaterials) {
      if (this.glowColor) mat.emissive.copy(this.glowColor).multiplyScalar(tint);
      else mat.emissive.setScalar(0);
      if (flash > 0) mat.emissive.addScalar(flash * 0.7);
    }
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
