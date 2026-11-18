import * as THREE from 'three';
import { ANIMALS, canSee, chargeAmount, config, createWorld, groundHeight, muzzlePosition, PART_SLOTS, wading, wornSet } from '@stuffed/sim';
import type { Animal, EntityId, GameEvent, GameState, MapData, PartLoadout, PartSlot, Player, Vec2, WeaponKind, World } from '@stuffed/sim';
import type { RenderFrame } from '../session/session.ts';
import { CAMERA, CameraRig } from './camera-rig.ts';
import { Effects } from './effects.ts';
import { BallViews } from './ball-views.ts';
import { GoalViews } from './goal-views.ts';
import { TrainView } from './train-view.ts';
import { ReviveMarkers } from './revive-markers.ts';
import { buildMapView } from './map-view.ts';
import { ChestViews, LootViews } from './loot-views.ts';
import { buildObstacles, updateBushes, updateRoofs, type BushView, type RoofView } from './obstacles.ts';
import { PlacedWallViews } from './placed-walls.ts';
import { TossView } from './toss-view.ts';
import { PlushView } from './plush-view.ts';
import { ProjectileViews } from './projectile-views.ts';
import { RINSE_BW, RinseGrade, RinseView } from './rinse-view.ts';
import { buildPart } from './placeholder-parts.ts';
import { makeTriplanar, toonMaterial } from './toon.ts';
import { foliage } from './props.ts';
import { buildWeapon } from './weapon-models.ts';

/** Height of the plane the cursor ray hits for aiming (roughly chest height). */
const AIM_PLANE_HEIGHT = 0.6;
const SUN_OFFSET = new THREE.Vector3(-8, 20, 10);
/** The sun's view (rotation only), to snap the shadow camera in its own plane. */
const SUN_VIEW = new THREE.Matrix4().lookAt(SUN_OFFSET, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
const SUN_VIEW_INV = SUN_VIEW.clone().invert();

/** `out` = `target` moved to the nearest whole shadow-map texel, as the sun sees it. */
function snapToTexels(target: THREE.Vector3, sun: THREE.DirectionalLight, out: THREE.Vector3): void {
  const cam = sun.shadow.camera;
  const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  out.copy(target).applyMatrix4(SUN_VIEW_INV);
  out.x = Math.round(out.x / texel) * texel;
  out.y = Math.round(out.y / texel) * texel;
  out.applyMatrix4(SUN_VIEW);
}
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
  private readonly placedWalls = new PlacedWallViews(this.scene);
  private readonly toss = new TossView(this.scene);
  /** Set trails: distance walked since the last print, and how many prints so far. */
  private readonly trailWalked = new Map<EntityId, number>();
  private readonly trailSteps = new Map<EntityId, number>();
  /** Distance walked in water since the last splash, per plush. */
  private readonly splashWalked = new Map<EntityId, number>();
  /** A plush splashed through water (for the sound). */
  onWaterStep: ((at: Vec2, id: EntityId) => void) | null = null;
  /** Beach balls rolling around. */
  private readonly balls = new BallViews(this.scene);
  /** Beach ball goals: nets and scoreboards. */
  private goals!: GoalViews;
  /** The toy train (maps with a track). */
  private train!: TrainView;
  /** Team mode: where knocked-out teammates can be re-stitched. */
  private readonly reviveMarkers = new ReviveMarkers(this.scene);
  private readonly loot = new LootViews(this.scene);
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -AIM_PLANE_HEIGHT);
  private readonly hit = new THREE.Vector3();
  private world!: World;
  private bushes: BushView[] = [];
  private roofs: RoofView[] = [];
  private rinse!: RinseView;
  private readonly shadowTarget = new THREE.Vector3();
  private readonly rinseGrade = RINSE_BW ? new RinseGrade() : null;
  private zoneNow: import('@stuffed/sim').Zone | null = null;
  private timeNow = 0;
  /** Everything that belongs to the map (rebuilt when a match is on another map). */
  private readonly mapLayer = new THREE.Group();
  private mapId = '';
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

    this.scene.add(this.mapLayer);
    this.setMap(map);
    this.warmUp();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Builds the map's ground, props, bushes, roofs, goals and water (once per map change). */
  setMap(map: MapData): void {
    if (map.id === this.mapId) return;
    this.mapId = map.id;
    // Far beyond the map (seen in the Toss): deep green past the lawn, dark wood past the floor.
    this.renderer.setClearColor(map.theme === 'bedroom' ? '#7a5a3e' : '#3f7a3c');
    // Free the old map's GPU memory: shapes, materials and their textures. (Shared ones, like
    // the felt texture or outline materials, are simply uploaded again when next used.)
    const materials = new Set<THREE.Material>();
    for (const child of [...this.mapLayer.children]) {
      this.mapLayer.remove(child);
      child.traverse((o) => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      });
    }
    for (const m of materials) {
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
      m.dispose();
    }
    this.mapLayer.add(buildMapView(map));
    const obstacles = buildObstacles(map);
    this.mapLayer.add(obstacles.root);
    this.goals = new GoalViews(this.mapLayer, map);
    this.train = new TrainView(this.mapLayer, map);
    this.bushes = obstacles.bushes;
    this.roofs = obstacles.roofs;
    this.rinse = new RinseView(map);
    this.mapLayer.add(this.rinse.mesh);
    this.world = createWorld(map);
  }

  /** Which parts are new to the player (a sparkle over them on the ground). */
  set isNewPart(fn: (slot: PartSlot, animal: Animal) => boolean) {
    this.loot.isNewPart = fn;
  }

  /** The canvas size the drawing buffer and camera were last set up for. */
  private sizedFor = '';

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.sizedFor = `${w}x${h}`;
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
        case 'ballBounce':
          this.balls.bounce(e.ballId);
          break;
        case 'trainBump': {
          this.plushes.get(e.playerId)?.flash();
          this.effects.pickup(e.pos.x, e.pos.y);
          break;
        }
        case 'goal':
          this.effects.goal(e.pos.x, e.pos.y);
          break;
        case 'chestOpened': {
          const chest = state.chests.find((c) => c.id === e.chestId);
          if (chest) this.effects.chestPop(chest.pos.x, chest.pos.y);
          break;
        }
        case 'pickup':
        case 'wear': {
          const p = byId.get(e.playerId);
          if (p) this.effects.pickup(p.pos.x, p.pos.y);
          break;
        }
        case 'itemUsed': {
          const p = byId.get(e.playerId);
          if (p && e.item !== 'cardboard_wall') this.effects.itemUsed(p.pos.x, p.pos.y, e.item === 'button_pack' || e.item === 'button_pile');
          break;
        }
        case 'wallPlaced': {
          const w = state.placedWalls.find((pw) => pw.id === e.wallId);
          if (w) this.effects.cardboard(w.x + w.w / 2, w.y + w.h / 2, false);
          break;
        }
        case 'impact':
          this.effects.impact(e.pos.x, e.pos.y, e.weapon === 'super_soaker');
          break;
        case 'burst':
          if (e.weapon === 'glitter_bomb') this.effects.glitterBurst(e.pos.x, e.z, e.pos.y, e.radius, config.weapons.glitter_bomb.effectTime ?? 3);
          else this.effects.marbleBurst(e.pos.x, e.z, e.pos.y, e.radius);
          break;
        case 'bounce':
          this.effects.bounce(e.pos.x, e.pos.y);
          break;
        case 'bonk': {
          const target = byId.get(e.targetId);
          if (target) this.effects.bonk(target.pos.x, target.pos.y);
          break;
        }
        case 'revived': {
          const p = byId.get(e.playerId);
          if (p) this.effects.revive(p.pos.x, p.pos.y);
          break;
        }
        case 'eliminated': {
          const p = byId.get(e.playerId);
          if (p) {
            this.effects.knockout(p.pos.x, p.pos.y);
            const set = wornSet(p.parts);
            if (set) this.effects.setKnockout(set, p.pos.x, p.pos.y);
          }
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
    for (const slot of PART_SLOTS) for (const animal of ANIMALS) samples.add(buildPart(slot, animal));
    // A plush in a full set, for its glow.
    samples.add(new PlushView(Object.fromEntries(PART_SLOTS.map((slot) => [slot, { animal: 'frog', rarity: 0, found: false }])) as PartLoadout).root);
    for (const kind of Object.keys(config.weapons) as WeaponKind[]) samples.add(buildWeapon(kind, 4, '#2a1f2d'));
    samples.add(new THREE.Mesh(new THREE.SphereGeometry(1), toonMaterial('#3f8f4a', { transparent: true, opacity: 0.4 })));
    // A bush you stand in: see-through felt leaves, without shadows.
    const seeThroughBush = new THREE.Mesh(new THREE.SphereGeometry(1), makeTriplanar(toonMaterial('#3f8f4a', { map: foliage(1).map, transparent: true, opacity: 0.42 }), 0.6));
    seeThroughBush.receiveShadow = false;
    samples.add(seeThroughBush);
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
    this.placedWalls.clear();
    this.toss.clear();
    this.balls.clear();
    this.reviveMarkers.clear();
    this.rig.reset();
  }

  render(frame: RenderFrame, opts: RenderOptions): void {
    // Phones report a rotation's new size a moment after the resize event: check every frame,
    // or the picture stays stretched to the old shape.
    if (`${this.canvas.clientWidth}x${this.canvas.clientHeight}` !== this.sizedFor) this.resize();
    const { prev, curr, alpha } = frame;
    const prevById = new Map<EntityId, Player>(prev.players.map((p) => [p.id, p]));
    const seen = new Set<EntityId>();
    // Whoever we follow decides what is visible: you, or the plush you spectate.
    // Placed walls count for height checks (a plush standing on a Cardboard Wall).
    this.world.placed = curr.placedWalls;
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
      view.setCharge(weapon ? chargeAmount(p, weapon.kind, curr.tick + alpha) : 0);
      if (view.setBubbled(curr.tick < p.bubbledUntil)) this.effects.bubblePop(p.pos.x, p.z + 0.85, p.pos.y);
      if (curr.tick < p.juiceUntil && Math.random() < opts.dt * 6) this.effects.juice(p.pos.x, p.z, p.pos.y);
      // Glittered: sparkling (seen through bushes and roofs) and shedding flakes.
      const glittered = p.alive && curr.tick < p.glitteredUntil;
      view.setGlittered(glittered, opts.time);
      if (glittered && Math.random() < opts.dt * 8) this.effects.glitterShed(p.pos.x, p.z, p.pos.y);


      const before = prevById.get(p.id) ?? p;
      const pos = lerp2(before.pos, p.pos, alpha);
      const vel = lerp2(before.vel, p.vel, alpha);
      const aim = p.id === opts.localPlayerId ? opts.localAim : lerpDir(before.aim, p.aim, alpha);
      const z = before.z + (p.z - before.z) * alpha;
      const groundY = groundHeight(this.world, curr, pos, z);
      if (view.update(pos, vel, aim, z, groundY, opts.dt, opts.time) && view.root.visible) this.effects.landing(pos.x, groundY, pos.y);
      if (p.drop === 'gliding' && view.root.visible && Math.random() < opts.dt * 14) this.effects.glideTrail(pos.x, z, pos.y);
      // A set (3+ parts of one animal) leaves a trail while walking on the ground.
      const set = view.root.visible && !p.drop ? wornSet(p.parts) : null;
      if (set && Math.hypot(vel.x, vel.y) > 1.5 && z - groundY < 0.05) {
        const walked = (this.trailWalked.get(p.id) ?? 0) + Math.hypot(vel.x, vel.y) * opts.dt;
        if (walked >= 0.7) {
          const step = (this.trailSteps.get(p.id) ?? 0) + 1;
          this.trailSteps.set(p.id, step);
          const speed = Math.hypot(vel.x, vel.y);
          this.effects.setTrail(set, pos.x, groundY, pos.y, step, vel.x / speed, vel.y / speed);
          this.trailWalked.set(p.id, 0);
        } else {
          this.trailWalked.set(p.id, walked);
        }
      }
      // Walking through water (the pool, or the Rinse when it's drawn as water): a splash every step or so.
      const speedNow = Math.hypot(vel.x, vel.y);
      if (view.root.visible && !p.drop && z - groundY < 0.05 && speedNow > 1.5 && ((p.soggy && !RINSE_BW) || wading(this.world, { pos, z }))) {
        const walked = (this.splashWalked.get(p.id) ?? 0) + speedNow * opts.dt;
        if (walked >= 0.9) {
          this.effects.waterStep(pos.x, groundY, pos.y, vel.x / speedNow, vel.y / speedNow);
          this.onWaterStep?.(pos, p.id);
          this.splashWalked.set(p.id, 0);
        } else {
          this.splashWalked.set(p.id, walked);
        }
      }
      // Plushies hidden in bushes, under a roof you're not under, or out of range are not drawn.
      // Riders are on board the blimp, out of sight (your own plush too).
      view.root.visible = p.drop !== 'riding' && (this.debug || !viewer || canSee(this.world, curr, viewer, p));
      view.setGliding(p.drop === 'gliding');
      view.setTeammate(!!viewer && viewer.team !== 0 && p.team === viewer.team && p.id !== viewer.id);
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

    this.projectiles.update(prev, curr, alpha, opts.time);
    this.chests.update(curr, opts.dt, opts.time);
    // Cardboard Walls: any that vanished burst into bits (shot down or folded away).
    for (const w of this.placedWalls.update(curr, opts.dt, opts.time)) this.effects.cardboard(w.x + w.w / 2, w.y + w.h / 2, true);
    this.loot.update(curr, opts.dt, opts.time);
    this.effects.update(opts.dt);
    this.balls.update(prev, curr, alpha, opts.dt);
    this.goals.update(curr, opts.dt);
    this.train.update(curr.tick - 1 + alpha, opts.dt, (x, y, z) => this.effects.steam(x, y, z));
    this.reviveMarkers.update(curr, viewer, opts.time);
    // How far out the camera is versus the usual (the Toss pulls back; tall screens back off too).
    const zoom = (this.camera.position.distanceTo(this.rig.target) / CAMERA.distance) * Math.max(1, this.camera.aspect / (16 / 9));
    this.rinse.update(curr.zone, opts.time, this.followPos, zoom);
    this.zoneNow = curr.zone;
    this.timeNow = opts.time;
    updateBushes(this.bushes, this.followPos.x, this.followPos.y);
    updateRoofs(this.roofs, viewer?.alive ? viewer.building : -1, this.debug, opts.dt);

    const following = opts.followId === opts.localPlayerId;
    // During the Toss the camera pulls back so you can pick a landing spot.
    const dropping = !!viewer?.drop;
    this.rig.update(this.followPos, following && !dropping ? opts.aimOffset : { x: 0, y: 0 }, opts.dt, this.followGround, dropping ? 2.6 : 1);
    this.toss.update(curr, curr.tick - 1 + alpha, opts.time);
    // Aim at chest height of the level you stand on.
    this.aimPlane.constant = -(this.localGround + config.combat.shotHeight);
    // Keep the shadow camera centered on what the player sees.
    // ...moving it in whole shadow-map texels, so shadow edges stay still instead of crawling.
    snapToTexels(this.rig.target, this.sun, this.shadowTarget);
    this.sun.target.position.copy(this.shadowTarget);
    this.sun.position.copy(this.shadowTarget).add(SUN_OFFSET);

    // `?rinse=bw`: the Rinse greys out what's in it (a screen pass) instead of drawing water.
    if (this.rinseGrade && this.rinse.mesh.visible && this.zoneNow) {
      this.rinse.mesh.visible = false;
      this.rinseGrade.render(this.renderer, this.scene, this.camera, this.zoneNow, this.timeNow);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
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
