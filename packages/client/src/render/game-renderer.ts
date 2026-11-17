import * as THREE from 'three';
import { canSee, config, createWorld, groundHeight, muzzlePosition, PART_CATALOG, PART_SLOTS } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, MapData, Player, Vec2, World } from '@stuffed/sim';
import type { RenderFrame } from '../session/session.ts';
import { CameraRig } from './camera-rig.ts';
import { Effects } from './effects.ts';
import { buildMapView } from './map-view.ts';
import { ChestViews, LootViews } from './loot-views.ts';
import { buildObstacles, updateBushes, updateRoofs, type BushView, type RoofView } from './obstacles.ts';
import { PlushView } from './plush-view.ts';
import { ProjectileViews } from './projectile-views.ts';
import { RinseView } from './rinse-view.ts';
import { buildPart } from './placeholder-parts.ts';
import { toonMaterial } from './toon.ts';
import { buildWeapon } from './weapon-models.ts';

/** Height of the plane the cursor ray hits for aiming (roughly chest height). */
const AIM_PLANE_HEIGHT = 0.6;
const SUN_OFFSET = new THREE.Vector3(-8, 20, 10);
/**
 * Adaptive resolution: if frames average slower than this (seconds), render fewer pixels.
 * Retina screens start at 2x; each step drops 0.25 down to 1x.
 */
const SLOW_FRAME = 1 / 48;
const QUALITY_STEP = 0.25;
const QUALITY_SAMPLES = 90;
const QUALITY_COOLDOWN = 2.5;

export interface RenderOptions {
  localPlayerId: EntityId;
  /** Plush the camera follows and whose view decides what's visible (you, or who you spectate). */
  followId: EntityId;
  /** Live aim of the local player, so its facing never waits for the next tick. */
  localAim: Vec2;
  /** Player-to-cursor vector, for the camera lean. */
  aimOffset: Vec2;
  dt: number;
  time: number;
}

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.5, 200);
  private readonly rig = new CameraRig(this.camera);
  private readonly sun = new THREE.DirectionalLight('#ffffff', 2.1);
  private readonly plushes = new Map<EntityId, PlushView>();
  private readonly projectiles = new ProjectileViews(this.scene);
  private readonly effects = new Effects(this.scene);
  private readonly chests = new ChestViews(this.scene);
  private readonly loot = new LootViews(this.scene);
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -AIM_PLANE_HEIGHT);
  private readonly hit = new THREE.Vector3();
  private readonly world: World;
  private readonly bushes: BushView[];
  private readonly roofs: RoofView[];
  private readonly rinse: RinseView;
  /** Seconds until each soggy plush drips again. */
  private readonly dripTimers = new Map<EntityId, number>();
  private debug = false;
  private pixelRatio: number;
  private readonly frameTimes: number[] = [];
  private qualityCooldown = QUALITY_COOLDOWN;
  /** Height of the surface the local plush stands over (for aiming). */
  private localGround = 0;
  /** Where the followed plush was last drawn, and the surface under it (for the camera). */
  private readonly followPos: Vec2 = { x: 0, y: 0 };
  private followGround = 0;
  /** Interpolated position of the local player in the last rendered frame. */
  readonly localPlayerPos: Vec2 = { x: 0, y: 0 };

  /** `fixedQuality`: keep full resolution even when frames are slow (?quality=high). */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    map: MapData,
    private readonly fixedQuality = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // Phones and tablets: dense screens, small GPUs. 1.5x still looks sharp at arm's length.
    const handheld = matchMedia('(pointer: coarse)').matches;
    this.pixelRatio = Math.min(handheld ? 1.5 : 2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor('#8ccdee');

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#9a8aa8', 1.25));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(handheld ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(buildMapView(map));
    const obstacles = buildObstacles(map);
    this.scene.add(obstacles.root);
    this.bushes = obstacles.bushes;
    this.roofs = obstacles.roofs;
    this.rinse = new RinseView(map);
    this.scene.add(this.rinse.mesh);
    this.world = createWorld(map);
    this.warmUp();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** What the last frame cost the GPU: draw calls and triangles (for the F1 overlay). */
  /** Names of the compiled shader programs, newest last (to spot mid-match compiles). */
  get programNames(): string[] {
    return (this.renderer.info.programs ?? []).map((p) => p.cacheKey);
  }

  get stats(): { calls: number; triangles: number; pixelRatio: number; programs: number } {
    const info = this.renderer.info.render;
    return {
      calls: info.calls,
      triangles: info.triangles,
      pixelRatio: this.renderer.getPixelRatio(),
      programs: this.renderer.info.programs?.length ?? 0,
    };
  }

  setDebug(on: boolean): void {
    this.debug = on;
    for (const view of this.plushes.values()) view.setHitboxVisible(on);
  }

  /** World (sim) point under the cursor at aim height, or null if the ray misses. */
  screenToWorld(clientX: number, clientY: number): Vec2 | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.aimPlane, this.hit) ? { x: this.hit.x, y: this.hit.z } : null;
  }

  /** Turns sim events into effects: muzzle pops, recoil, hit flashes, stuffing and knockouts. */
  playEvents(events: GameEvent[], state: GameState): void {
    const byId = new Map<EntityId, Player>(state.players.map((p) => [p.id, p]));
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          const p = byId.get(e.playerId);
          if (!p) break;
          this.plushes.get(p.id)?.kick();
          const tip = muzzlePosition(p.pos, p.aim, e.weapon);
          this.effects.muzzle(tip.x, tip.y, p.aim.x, p.aim.y, e.weapon === 'super_soaker');
          break;
        }
        case 'hit': {
          const target = byId.get(e.targetId);
          if (!target) break;
          this.plushes.get(target.id)?.flash();
          const source = e.sourceId !== null ? byId.get(e.sourceId) : undefined;
          let dx = 0;
          let dz = 0;
          if (source) {
            const len = Math.hypot(target.pos.x - source.pos.x, target.pos.y - source.pos.y) || 1;
            dx = (target.pos.x - source.pos.x) / len;
            dz = (target.pos.y - source.pos.y) / len;
          }
          if (e.damage > 0) this.effects.stuffingHit(target.pos.x, target.pos.y, dx, dz, e.damage);
          if (e.armorDamage > 0) this.effects.armorHit(target.pos.x, target.pos.y, dx, dz, e.armorDamage);
          if (source?.weapons[source.activeSlot]?.kind === 'super_soaker') this.effects.splash(target.pos.x, target.pos.y);
          break;
        }
        case 'chestOpened': {
          const chest = state.chests.find((c) => c.id === e.chestId);
          if (chest) this.effects.chestPop(chest.pos.x, chest.pos.y);
          break;
        }
        case 'pickup': {
          const p = byId.get(e.playerId);
          if (p) this.effects.pickup(p.pos.x, p.pos.y);
          break;
        }
        case 'itemUsed': {
          const p = byId.get(e.playerId);
          if (p) this.effects.itemUsed(p.pos.x, p.pos.y, e.item === 'button_pack');
          break;
        }
        case 'impact':
          this.effects.impact(e.pos.x, e.pos.y, e.weapon === 'super_soaker');
          break;
        case 'eliminated': {
          const p = byId.get(e.playerId);
          if (p) this.effects.knockout(p.pos.x, p.pos.y);
          break;
        }
        default:
          break;
      }
    }
  }

  /** Where the camera is looking (the followed plush); sounds are heard from here. */
  get cameraFocus(): Vec2 {
    return this.followPos;
  }

  /** Confetti around a winning plush. */
  celebrate(id: EntityId, state: GameState): void {
    const p = state.players.find((q) => q.id === id);
    if (!p) return;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      this.effects.chestPop(p.pos.x + Math.cos(a) * 1.2, p.pos.y + Math.sin(a) * 1.2);
    }
  }

  /**
   * Compiles every shader variant up front so the first time something appears mid-match
   * doesn't stall a frame for a shader compile: every plush part and weapon, loot glows and
   * beams, projectiles, particles, an open chest, and a see-through felt (bushes you stand in).
   */
  private warmUp(): void {
    const samples = new THREE.Group();
    for (const slot of PART_SLOTS) for (const id of PART_CATALOG[slot]) samples.add(buildPart(slot, id, '#2a1f2d'));
    for (const kind of ['cork_popper', 'foam_dart_smg', 'super_soaker'] as const) samples.add(buildWeapon(kind, 4, '#2a1f2d'));
    samples.add(new THREE.Mesh(new THREE.SphereGeometry(1), toonMaterial('#3f8f4a', { transparent: true, opacity: 0.4 })));
    samples.add(...this.loot.samples(), ...this.projectiles.samples(), ...this.chests.samples());
    // Spread them out in a grid at the map center, where the shadow camera can see them too.
    samples.children.forEach((o, i) => o.position.set(40 + (i % 8) * 1.5 - 6, 0.5, 40 + Math.floor(i / 8) * 1.5 - 6));
    this.scene.add(samples);
    this.effects.warmUp();
    this.renderer.compile(this.scene, this.camera);

    // A shader is only fully linked when it first draws (three.js then waits for the driver), so
    // draw everything once to the screen itself, shadows included, before the first real frame
    // replaces it. (An offscreen target would use different, linear-color shader variants.)
    const eye = new THREE.PerspectiveCamera(60, this.camera.aspect, 0.5, 200);
    eye.position.set(40, 30, 52);
    eye.lookAt(40, 0, 40);
    this.sun.target.position.set(40, 0, 40);
    this.sun.position.set(40, 0, 40).add(SUN_OFFSET);
    this.renderer.render(this.scene, eye);
    this.scene.remove(samples);
  }

  /** Lowers the render resolution while frames are slow (never below 1x). */
  private adaptQuality(dt: number): void {
    if (this.fixedQuality || dt <= 0 || this.pixelRatio <= 1) return;
    this.qualityCooldown -= dt;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > QUALITY_SAMPLES) this.frameTimes.shift();
    if (this.qualityCooldown > 0 || this.frameTimes.length < QUALITY_SAMPLES) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    if (avg <= SLOW_FRAME) return;
    this.pixelRatio = Math.max(1, this.pixelRatio - QUALITY_STEP);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
    this.frameTimes.length = 0;
    this.qualityCooldown = QUALITY_COOLDOWN;
  }

  /** Clears everything from the last match (the map stays) so a new match can start. */
  reset(): void {
    for (const view of this.plushes.values()) view.dispose();
    this.plushes.clear();
    this.dripTimers.clear();
    this.projectiles.clear();
    this.chests.clear();
    this.loot.clear();
    this.rig.reset();
  }

  render(frame: RenderFrame, opts: RenderOptions): void {
    const { prev, curr, alpha } = frame;
    const prevById = new Map<EntityId, Player>(prev.players.map((p) => [p.id, p]));
    const seen = new Set<EntityId>();
    // Whoever we follow decides what is visible: you, or the plush you spectate.
    const viewer = curr.players.find((p) => p.id === opts.followId);

    for (const p of curr.players) {
      if (!p.alive) continue;
      seen.add(p.id);
      let view = this.plushes.get(p.id);
      if (!view) {
        view = new PlushView(p.parts);
        view.setHitboxVisible(this.debug);
        this.plushes.set(p.id, view);
        this.scene.add(view.root);
      }
      view.setParts(p.parts);
      const weapon = p.weapons[p.activeSlot];
      view.setWeapon(weapon?.kind ?? null, weapon?.rarity ?? 0);

      const before = prevById.get(p.id) ?? p;
      const pos = lerp2(before.pos, p.pos, alpha);
      const vel = lerp2(before.vel, p.vel, alpha);
      const aim = p.id === opts.localPlayerId ? opts.localAim : lerpDir(before.aim, p.aim, alpha);
      const z = before.z + (p.z - before.z) * alpha;
      const groundY = groundHeight(this.world, curr, pos, z);
      if (view.update(pos, vel, aim, z, groundY, opts.dt, opts.time) && view.root.visible) this.effects.landing(pos.x, groundY, pos.y);
      // Plushies hidden in bushes, under a roof you're not under, or out of range are not drawn.
      view.root.visible = this.debug || !viewer || canSee(this.world, curr, viewer, p);
      if (p.soggy && view.root.visible) {
        const t = (this.dripTimers.get(p.id) ?? 0) - opts.dt;
        if (t <= 0) this.effects.drip(pos.x, pos.y);
        this.dripTimers.set(p.id, t <= 0 ? 0.3 : t);
      }

      if (p.id === opts.localPlayerId) {
        this.localPlayerPos.x = pos.x;
        this.localPlayerPos.y = pos.y;
        this.localGround = groundY;
      }
      if (p.id === opts.followId) {
        this.followPos.x = pos.x;
        this.followPos.y = pos.y;
        this.followGround = groundY;
      }
    }

    for (const [id, view] of this.plushes) {
      if (!seen.has(id)) {
        view.dispose();
        this.plushes.delete(id);
      }
    }

    this.projectiles.update(prev, curr, alpha);
    this.chests.update(curr, opts.dt, opts.time);
    this.loot.update(curr, opts.dt, opts.time);
    this.effects.update(opts.dt);
    this.rinse.update(curr.zone, opts.time, this.followPos);
    updateBushes(this.bushes, this.followPos.x, this.followPos.y);
    updateRoofs(this.roofs, viewer?.alive ? viewer.building : -1, this.debug, opts.dt);

    const following = opts.followId === opts.localPlayerId;
    this.rig.update(this.followPos, following ? opts.aimOffset : { x: 0, y: 0 }, opts.dt, this.followGround);
    // Aim at chest height of the level you stand on.
    this.aimPlane.constant = -(this.localGround + config.combat.shotHeight);
    // Keep the shadow camera centered on what the player sees.
    this.sun.target.position.copy(this.rig.target);
    this.sun.position.copy(this.rig.target).add(SUN_OFFSET);

    this.renderer.render(this.scene, this.camera);
    this.adaptQuality(opts.dt);
  }
}

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function lerpDir(a: Vec2, b: Vec2, t: number): Vec2 {
  const v = lerp2(a, b, t);
  const len = Math.hypot(v.x, v.y);
  return len > 1e-6 ? { x: v.x / len, y: v.y / len } : b;
}
