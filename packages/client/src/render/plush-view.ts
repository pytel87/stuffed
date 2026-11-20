// One plush on screen: a single rig with 5 part slots. Animation (walk, squash and stretch,
// lean) is render-only and derived from interpolated sim velocity; the sim never sees it.
import * as THREE from 'three';
import { holoMaterial, isDark } from './holo.ts';
import { ANIMAL_KIND } from '../animal-kinds.ts';
import { setUmbrellaPanels } from './set-umbrellas.ts';
import { coarsen, LOW_DETAIL } from './low-detail.ts';
import { config, fullSet, PART_SLOTS } from '@stuffed/sim';
import type { Animal, PartLoadout, PartSlot, Rarity, Vec2, WeaponKind } from '@stuffed/sim';
import { bodyColor, buildPart, FACE_ACCESSORIES, HEAD_TOP_LIFT, type PartObject } from './placeholder-parts.ts';
import { mergeStatic } from './merge-static.ts';
import { PlushArms } from './plush-arms.ts';
import { detailMaps, repeated } from './image-textures.ts';
import { feltTexture, makePlastic, outlineMaterial, OUTLINE_COLOR, toonMaterial } from './toon.ts';
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
  axolotl: '#ffa070',
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
  mouse: '#f0d6b8',
  sheep: '#fff8e6',
  raccoon: '#c9cfe0',
  bee: '#ffe14a',
  flamingo: '#ff7ab8',
  giraffe: '#ffcf6a',
  sloth: '#cfdc8a',
  dragon: '#ff5a4a',
  phoenix: '#ff9a3a',
  yeti: '#a8e4ff',
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

const UMBRELLA_PANELS = ['#ff8a80', '#ffd166', '#8fd3ff', '#a5d6a7', '#ffb3cf', '#b39ddb', '#ffab5e', '#fff3d6'];
/** Where the canopy's sphere sits (its top is higher, its rim lower). */
const UMBRELLA_Y = 1.9;
let umbrellaGeo: {
  panels: THREE.BufferGeometry[];
  hull: THREE.BufferGeometry;
  rimLine: THREE.BufferGeometry;
  pompom: THREE.BufferGeometry;
  stick: THREE.BufferGeometry;
  hook: THREE.BufferGeometry;
  rim: number;
  rimY: number;
  topY: number;
} | null = null;

/** The parasol's shapes, shared by every plush. */
function umbrellaGeometry(): NonNullable<typeof umbrellaGeo> {
  if (umbrellaGeo) return umbrellaGeo;
  const r = 1.2;
  const open = 1.05;
  const flat = 0.6;
  const n = UMBRELLA_PANELS.length;
  const panels = Array.from({ length: n }, (_, i) =>
    new THREE.SphereGeometry(r, 6, 6, (i / n) * Math.PI * 2, (Math.PI * 2) / n, 0, open).scale(1, flat, 1),
  );
  umbrellaGeo = {
    panels,
    hull: new THREE.SphereGeometry(r + 0.08, 32, 6, 0, Math.PI * 2, 0, open + 0.02).scale(1, flat, 1),
    // A dark line round the canopy's edge (a hull can't outline an open edge).
    rimLine: new THREE.TorusGeometry(r * Math.sin(open), 0.04, 6, 48).rotateX(Math.PI / 2),
    pompom: new THREE.SphereGeometry(0.07, 8, 6),
    stick: new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6),
    hook: new THREE.TorusGeometry(0.11, 0.03, 6, 12, Math.PI).rotateZ(Math.PI),
    rim: r * Math.sin(open),
    rimY: r * Math.cos(open) * flat,
    topY: r * flat,
  };
  return umbrellaGeo;
}

let umbrellaNormal: THREE.Texture | null = null;
function umbrellaWeave(): THREE.Texture {
  if (!umbrellaNormal) umbrellaNormal = repeated(detailMaps('fabric_minky', feltTexture().image as HTMLCanvasElement).normal, 2, 1);
  return umbrellaNormal;
}

const GLITTER_COLORS = ['#ff7ac8', '#fff27a', '#7af0ff', '#ffffff', '#c58bff'];
let glitterTex: THREE.CanvasTexture | null = null;
/** A small four-point twinkle, white (tinted per flake). */
function glitterFlakeTexture(): THREE.CanvasTexture {
  if (glitterTex) return glitterTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(16, 2);
  g.quadraticCurveTo(17.5, 14.5, 30, 16);
  g.quadraticCurveTo(17.5, 17.5, 16, 30);
  g.quadraticCurveTo(14.5, 17.5, 2, 16);
  g.quadraticCurveTo(14.5, 14.5, 16, 2);
  g.fill();
  glitterTex = new THREE.CanvasTexture(c);
  glitterTex.colorSpace = THREE.SRGBColorSpace;
  return glitterTex;
}

/** Scratch for aiming the laser level. */
const UNLEAN = new THREE.Quaternion();
const LEVEL = new THREE.Quaternion();

export class PlushView {
  readonly root = new THREE.Group();
  private readonly lean = new THREE.Group();
  /** How far into the winner's dance (0..1, eased; see dance). */
  private danceAmount = 0;
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
  /** Holographic parts (see setHolo). */
  private holo: ReadonlySet<PartSlot> = new Set();
  private holoKey = '';
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
  /** Its canopy panels: a rainbow, or a full set's colors and pattern (see setUmbrellaPanels). */
  private readonly umbrellaPanels: THREE.MeshToonMaterial[];
  /** Glitter swirling round a glittered plush (made the first time it's needed). */
  private glitter: THREE.Group | null = null;
  /** The Rubber Band Rifle's aim line while drawing it: a thin vivid laser in a faint glow. */
  private readonly beam: THREE.Mesh;
  private readonly beamCore: THREE.Mesh;
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
      // Pulled toward the camera: it lies on whatever flat surface is below (the pool's water,
      // a blanket) without flickering against it.
      new THREE.MeshBasicMaterial({ color: '#000000', map: shadowMap(), transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
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

    // A plush parasol: a domed canopy of eight fabric panels with a pompom at each rib, a ball on
    // top and a glossy hooked handle.
    this.umbrella = new THREE.Group();
    const U = umbrellaGeometry();
    const weave = umbrellaWeave();
    this.umbrellaPanels = UMBRELLA_PANELS.map((c, i) => {
      const m = toonMaterial(c, { side: THREE.DoubleSide });
      m.normalMap = weave;
      const panel = new THREE.Mesh(U.panels[i]!, m);
      panel.position.y = UMBRELLA_Y;
      this.umbrella.add(panel);
      return m;
    });
    const hull = new THREE.Mesh(U.hull, outlineMaterial(outlineColor));
    hull.position.y = UMBRELLA_Y;
    this.umbrella.add(hull);
    const rimLine = new THREE.Mesh(U.rimLine, new THREE.MeshBasicMaterial({ color: outlineColor }));
    rimLine.position.y = UMBRELLA_Y + U.rimY;
    this.umbrella.add(rimLine);
    const pom = toonMaterial('#fff6ec', { map: null });
    for (let i = 0; i < UMBRELLA_PANELS.length; i++) {
      const a = (i / UMBRELLA_PANELS.length) * Math.PI * 2;
      const ball = new THREE.Mesh(U.pompom, pom);
      ball.position.set(-Math.cos(a) * U.rim, UMBRELLA_Y + U.rimY, Math.sin(a) * U.rim);
      this.umbrella.add(ball);
    }
    const top = new THREE.Mesh(U.pompom, toonMaterial('#ffd23a', { map: null }));
    top.scale.setScalar(1.4);
    top.position.y = UMBRELLA_Y + U.topY + 0.05;
    this.umbrella.add(top);
    const stick = new THREE.Mesh(U.stick, toonMaterial('#8e6036', { map: null }));
    stick.position.y = 1.85;
    this.umbrella.add(stick);
    const hook = new THREE.Mesh(U.hook, makePlastic(toonMaterial('#e2574c', { map: null })));
    hook.position.set(0.11, 1.18, 0);
    this.umbrella.add(hook);
    this.umbrella.visible = false;
    this.squash.add(this.umbrella);

    // A thin red line from the band rifle out along the aim, brighter as it's drawn.
    this.beam = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    this.beamCore = new THREE.Mesh(
      new THREE.PlaneGeometry(0.018, 1).rotateX(-Math.PI / 2).translate(0, 0.002, 0.5),
      new THREE.MeshBasicMaterial({ color: '#ff3d63', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    this.beam.add(this.beamCore);
    // From the rifle's front notch, held with it (it bobs, squashes and recoils with the gun).
    this.beam.position.set(0, 0.08, 0.68);
    this.beam.scale.z = 16;
    this.beam.visible = false;
    this.weaponSocket.add(this.beam);
    // Phones and tablets: fewer triangles in the arms, bubble and parasol (parts do it as built).
    coarsen(this.root);
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
    // Hats sit on top of a taller head (the octopus's dome) instead of sinking into it.
    const lift = FACE_ACCESSORIES.has(parts.accessory.animal) ? 0 : (HEAD_TOP_LIFT[parts.head.animal] ?? 0);
    this.slots.accessory.position.y = SOCKETS.accessory[1] + lift;
    const set = fullSet(parts);
    this.dressUmbrella(set);
    this.glowRing.visible = set !== null;
    this.glowColor = set ? new THREE.Color(SET_GLOW[set]) : null;
    if (set) (this.glowRing.material as THREE.MeshBasicMaterial).color.set(SET_GLOW[set]);
    if (this.bodyAnimal !== parts.body.animal) {
      this.bodyAnimal = parts.body.animal;
      this.arms.setColor(bodyColor(parts.body.animal));
    }
    this.applyHolo();
    this.collectMaterials();
    this.trimShadows();
    return true;
  }

  /** The parasol in a full set's colors and pattern, or the rainbow one. */
  private dressUmbrella(set: Animal | null): void {
    const looks = set ? setUmbrellaPanels(set, UMBRELLA_PANELS.length) : null;
    this.umbrellaPanels.forEach((m, i) => {
      m.color.set(looks ? looks[i]!.color : UMBRELLA_PANELS[i]!);
      const map = looks ? looks[i]!.map : null;
      if (m.map !== map) {
        m.map = map;
        m.needsUpdate = true;
      }
    });
  }

  /** Which parts are holographic (a try-out of shiny variants; the arms go with the body). */
  setHolo(slots: readonly PartSlot[]): void {
    const key = [...slots].sort().join(',');
    if (key === this.holoKey) return;
    this.holoKey = key;
    this.holo = new Set(slots);
    this.applyHolo();
    this.collectMaterials();
  }

  private applyHolo(): void {
    const finish = (group: THREE.Object3D, on: boolean) =>
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const base = (o.userData.holoBase as THREE.Material | undefined) ?? (o.material as THREE.Material);
        if (!(base instanceof THREE.MeshToonMaterial)) return;
        if (o.userData.holoBase) (o.material as THREE.Material).dispose();
        if (on && !isDark(base)) {
          o.userData.holoBase = base;
          o.material = holoMaterial(base);
        } else {
          o.material = base;
          delete o.userData.holoBase;
        }
      });
    for (const slot of PART_SLOTS) finish(this.slots[slot], this.holo.has(slot));
    finish(this.arms.group, this.holo.has('body'));
  }

  setWeapon(kind: WeaponKind | null, rarity: Rarity): void {
    const key = kind ? `${kind}:${rarity}` : '';
    if (key === this.weaponKey) return;
    this.weaponKey = key;
    for (const child of [...this.weaponSocket.children]) {
      if (child === this.beam) continue; // the laser stays (it's held with any gun)
      this.weaponSocket.remove(child);
      disposeGeometries(child);
    }
    this.weaponKind = kind;
    if (kind) {
      const model = buildWeapon(kind, rarity, this.outlineColor);
      coarsen(model);
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

  /** Covered in glitter (a Glitter Bomb): a swirl of colored flakes, seen through bushes and
   *  roofs, so everyone can tell they can't hide. */
  setGlittered(on: boolean, time: number): void {
    if (on && !this.glitter) {
      this.glitter = new THREE.Group();
      for (let i = 0; i < GLITTER_COLORS.length * 2; i++) {
        const flake = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glitterFlakeTexture(),
            color: GLITTER_COLORS[i % GLITTER_COLORS.length]!,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        );
        flake.renderOrder = 20;
        this.glitter.add(flake);
      }
      this.root.add(this.glitter);
    }
    if (!this.glitter) return;
    this.glitter.visible = on;
    if (!on) return;
    const n = this.glitter.children.length;
    this.glitter.children.forEach((f, i) => {
      const k = i / n;
      const a = time * (1.6 + (i % 3) * 0.4) + k * Math.PI * 2;
      const y = 0.3 + ((time * 0.6 + k * 2.3) % 1) * 2.2;
      const r = 0.55 + 0.15 * Math.sin(time * 3 + i);
      f.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const twinkle = 0.5 + 0.5 * Math.sin(time * 9 + i * 1.7);
      f.scale.setScalar(0.26 + twinkle * 0.2);
      (f as THREE.Sprite).material.opacity = 0.55 + twinkle * 0.45;
    });
  }

  /** Gliding down from the Toss under an umbrella. */
  /**
   * The victory-lap dance, the head animal's own (by its kind): springy ones bounce high and spin,
   * heavy ones stomp from side to side, winged ones flutter and take off, squishy ones wobble like
   * jelly, fluffy ones twirl. A few add a signature touch (the frog's big hops, the bee's buzzing
   * circle, the penguin's belly slide, the dragon and phoenix rearing up). `on` eases it in and out,
   * so walking off to loot stops it smoothly.
   */
  dance(on: boolean, dt: number, time: number, animal: Animal): void {
    this.danceAmount += ((on ? 1 : 0) - this.danceAmount) * (1 - Math.exp(-6 * dt));
    const k = this.danceAmount;
    this.squash.rotation.x = 0;
    if (k < 0.01) return;
    // (update put the plush back in place this frame; these add on top, scaled by how far in it is.)
    const lift = (y: number) => (this.root.position.y += y * k);
    const squish = (s: number) => this.squash.scale.set(this.squash.scale.x * (1 + s * k), this.squash.scale.y * (1 - s * k), this.squash.scale.z * (1 + s * k));
    const sway = (z: number) => (this.lean.rotation.z += z * k);
    const turn = (y: number) => (this.facing.rotation.y += y * k);
    const pitch = (x: number) => (this.squash.rotation.x = x * k);
    /** One full turn, eased, `length` of every `period` seconds. */
    const spin = (period: number, length: number) => {
      const c = (time % period) / period;
      return c < length ? (1 - Math.cos((c / length) * Math.PI)) * Math.PI : 0;
    };
    switch (ANIMAL_KIND[animal]) {
      case 'springy': {
        const beat = time * 6;
        const hop = Math.abs(Math.sin(beat));
        lift(hop * (animal === 'frog' ? 0.62 : 0.42));
        squish((1 - hop) ** 6 * 0.25 - hop * 0.05);
        sway(Math.sin(beat * 0.5) * 0.15);
        turn(spin(2.1, 0.3));
        break;
      }
      case 'heavy': {
        // A stomp on each beat, rocking from foot to foot, turning a little side to side.
        const beat = time * 4;
        const step = Math.sin(beat);
        lift(Math.abs(step) * 0.14);
        sway(step * 0.3);
        squish(Math.max(0, -Math.cos(beat * 2)) ** 3 * 0.14);
        turn(Math.sin(beat * 0.5) * 0.35);
        break;
      }
      case 'winged': {
        // Fluttering little hops, then a take-off with a turn every couple of seconds.
        const flutter = time * 11;
        const c = (time % 2.4) / 2.4;
        const takeOff = c < 0.35 ? Math.sin((c / 0.35) * Math.PI) : 0;
        lift(Math.abs(Math.sin(flutter)) * 0.1 + takeOff * 0.55);
        sway(Math.sin(flutter) * 0.1);
        turn(spin(2.4, 0.35));
        if (animal === 'penguin') {
          // The belly slide: tipping right over onto its front and back up.
          const slide = (time % 3) / 3;
          pitch(slide > 0.5 && slide < 0.9 ? Math.sin(((slide - 0.5) / 0.4) * Math.PI) * 1.2 : 0);
        } else if (animal === 'bee') {
          // Buzzing round in a little circle, up off the ground.
          this.root.position.x += Math.cos(time * 6) * 0.35 * k;
          this.root.position.z += Math.sin(time * 6) * 0.35 * k;
          lift(0.25);
        } else if (animal === 'dragon' || animal === 'phoenix') {
          // Rearing up proudly at the top of each take-off.
          pitch(-takeOff * 0.45);
        }
        break;
      }
      case 'squishy': {
        // A jelly wobble, twisting this way and that.
        const beat = time * 5;
        squish(Math.sin(beat) * 0.22);
        turn(Math.sin(beat * 0.5) * 0.6);
        sway(Math.sin(beat * 0.5 + 1) * 0.12);
        lift(Math.max(0, Math.sin(beat)) * 0.08);
        break;
      }
      case 'fluffy': {
        // Twirls with a soft bob in between.
        lift(Math.abs(Math.sin(time * 5)) * 0.16);
        sway(Math.sin(time * 2.5) * 0.2);
        turn(spin(1.6, 0.6));
        break;
      }
    }
  }


  setGliding(gliding: boolean): void {
    this.umbrella.visible = gliding;
  }

  /** How far the band rifle is drawn (0 = not charging). */
  setCharge(amount: number): void {
    this.beam.visible = amount > 0;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.2 + amount * 0.25;
    (this.beamCore.material as THREE.MeshBasicMaterial).opacity = 0.85 + amount * 0.15;
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
    // The band rifle's laser points level along the aim, however the plush leans or bobs (it
    // pointed at the ground while walking).
    if (this.beam.visible) {
      this.weaponSocket.updateWorldMatrix(true, false);
      this.weaponSocket.getWorldQuaternion(UNLEAN).invert();
      this.root.getWorldQuaternion(LEVEL).multiply(this.facing.quaternion);
      this.beam.quaternion.copy(UNLEAN).multiply(LEVEL);
    }

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

  /**
   * Tiny parts (eyes, stitches, teeth, buttons) cast no shadow: invisible, but each costs a draw.
   * On phones and tablets no part does: the soft blob under the plush is its shadow.
   */
  private trimShadows(): void {
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.castShadow) return;
      if (LOW_DETAIL) return void (o.castShadow = false);
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere!.radius < 0.12) o.castShadow = false;
    });
  }

  private collectMaterials(): void {
    // New parts or a new weapon: faded again on the next frame if the plush is (see fadeObject).
    delete this.root.userData.fade;
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
