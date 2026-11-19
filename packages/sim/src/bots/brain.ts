// Bot brains. A bot is just another source of Inputs: it reads the game state and decides what
// a player would press. Runs in the sim package so the Colyseus server can run bots unchanged.
// Each bot has its own seeded RNG, so a match with bots is still fully deterministic.
import { config } from '../config.ts';
import { PART_SLOTS } from '../parts.ts';
import { nextFloat, nextRange, seedRng } from '../rng.ts';
import { chestInReach, findInteraction } from '../systems/loot.ts';
import { chargeAmount } from '../systems/weapons.ts';
import { canUseItem } from '../systems/items.ts';
import { TRAIN, trainCars } from '../systems/train.ts';
import { canSee } from '../systems/visibility.ts';
import { Btn } from '../types.ts';
import type { Box, EntityId, GameState, GroundLoot, Input, Part, Player, RngState, Vec2, WeaponInstance, WeaponKind } from '../types.ts';
import { raycastWalls, type World } from '../world.ts';
import { clearWalk, findPath } from './nav.ts';

export const BOT = {
  /** Seconds at the start of a match when bots only loot, and fight only someone who hurts them. */
  truce: 20,
  /** Enemies farther than this are never engaged (they rarely hit from there). */
  engageRange: 16,
  /** Enemies this close are always fought. */
  threatRange: 4.5,
  /** Below this much stuffing a bot with a healing item backs off from fights to heal. */
  retreatBelow: 45,
  /** Each bot rolls an aggression in this range; it scales how far it starts fights when well armed. */
  aggression: [0.2, 0.85] as [number, number],
  /** Seconds a bot keeps fighting back after being hurt, at any range it can see. */
  hurtMemory: 3,
  /** Seconds between first seeing an enemy and starting to shoot. */
  reaction: [1.0, 1.9] as [number, number],
  /** Aim wobble: the aim point drifts this far (units) per 10 units of distance. */
  aimError: 3.8,
  /** Bots fire in bursts: seconds shooting, then seconds paused. */
  burst: [0.5, 1.1] as [number, number],
  burstPause: [1.0, 2.0] as [number, number],
  /** How much of the target's motion bots lead their shots by (1 = perfect). */
  leadFactor: 0.4,
  /** Preferred fighting distance per weapon. */
  preferredRange: {
    cork_popper: 9,
    foam_dart_smg: 6.5,
    super_soaker: 3.5,
    rubber_band_rifle: 15,
    marble_launcher: 8,
    pillow_hammer: 1.3,
    glitter_bomb: 8,
    bubble_wand: 6,
  } satisfies Record<WeaponKind, number>,
  /** How much a bot values each weapon (before rarity). */
  weaponValue: {
    cork_popper: 1,
    foam_dart_smg: 1.6,
    super_soaker: 1.4,
    rubber_band_rifle: 1.5,
    marble_launcher: 1.5,
    pillow_hammer: 1.2,
    glitter_bomb: 1.1,
    bubble_wand: 1.2,
  } satisfies Record<WeaponKind, number>,
  /** Rubber Band Rifle: let go once drawn this far. */
  releaseCharge: 0.85,
  /** Chance per second to hop while fighting. */
  combatJumpsPerSecond: 0.6,
  /** Look this far for chests and loot. */
  lootRange: 26,
  /** Go whack the piñata when it's this close. */
  pinataRange: 14,
  /** Go press the air strike button when it's ready and this close. */
  strikeButtonRange: 12,
  /** Heal when stuffing drops below this and no enemy is around. */
  healBelow: 65,
  /** Seconds without seeing an enemy before healing or looting again. */
  calmAfter: 1.5,
} as const;

/** How tough the bots are. Normal is BOT as above; the others scale its knobs. */
export type BotLevel = 'easy' | 'normal' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'normal', 'hard'];

interface LevelTuning {
  /** Multiplies the reaction time (slower to start shooting). */
  reaction: number;
  /** Multiplies the aim wobble. */
  aimError: number;
  /** Multiplies how much they lead moving targets. */
  lead: number;
  /** Multiplies the pauses between bursts. */
  pause: number;
  /** Multiplies how far they'll go looking for a fight. */
  engage: number;
}

const LEVEL: Record<BotLevel, LevelTuning> = {
  easy: { reaction: 1.6, aimError: 1.6, lead: 0.4, pause: 1.6, engage: 0.75 },
  normal: { reaction: 1, aimError: 1, lead: 1, pause: 1, engage: 1 },
  hard: { reaction: 0.6, aimError: 0.6, lead: 1.8, pause: 0.6, engage: 1.15 },
};

const T = config.tickRate;
const DEG = Math.PI / 180;

interface Memory {
  rng: RngState;
  seq: number;
  targetId: EntityId | null;
  /** Tick at which the bot may start shooting at its current target. */
  fireFromTick: number;
  lastEnemyTick: number;
  aimOffset: Vec2;
  aimOffsetUntil: number;
  strafe: 1 | -1;
  strafeUntil: number;
  wander: Vec2 | null;
  wanderUntil: number;
  /** Detour direction while stuck, and until when. */
  detour: Vec2 | null;
  detourUntil: number;
  lastPos: Vec2;
  stuckTicks: number;
  /** Alternates so E is a fresh press (weapon pickup needs one). */
  tapE: boolean;
  jumpHeld: boolean;
  aggression: number;
  /** Shooting until this tick, then paused until burstPauseUntil. */
  burstUntil: number;
  burstPauseUntil: number;
  lastHealth: number;
  lastHurtTick: number;
  /** A path around tall walls to the current goal, when it can't be walked to straight. */
  path: Vec2[] | null;
  pathGoal: Vec2 | null;
  pathAt: number;
  /** The last avoidance turn taken, tried first next time (no flip-flopping at walls). */
  lastTurn: number;
  /** Where the last enemy was last seen: chased for a moment after losing sight of it. */
  lastSeen: Vec2 | null;
  /** Heading in from the Rinse: keep going until well inside (no bouncing along its edge). */
  fleeingWater: boolean;
  /** The Toss: drop off the blimp this far along its line (0..1), and glide toward this spot. */
  dropAt: number;
  landing: Vec2 | null;
}

/** Drives every bot in the match. Keep one per match; it holds each bot's memory. */
export class BotController {
  private readonly memory = new Map<EntityId, Memory>();

  private readonly level: LevelTuning;

  constructor(
    private readonly seed: number,
    level: BotLevel = 'normal',
  ) {
    this.level = LEVEL[level] ?? LEVEL.normal;
  }

  /** One Input per living bot for this tick. */
  inputs(world: World, state: GameState): Map<EntityId, Input> {
    const out = new Map<EntityId, Input>();
    for (const bot of state.players) {
      if (!bot.isBot || !bot.alive) continue;
      out.set(bot.id, this.think(world, state, bot));
    }
    return out;
  }

  private mem(bot: Player): Memory {
    let m = this.memory.get(bot.id);
    if (!m) {
      m = {
        rng: seedRng((this.seed ^ Math.imul(bot.id, 0x9e3779b1)) >>> 0),
        seq: 0,
        targetId: null,
        fireFromTick: 0,
        lastEnemyTick: -1e9,
        aimOffset: { x: 0, y: 0 },
        aimOffsetUntil: 0,
        strafe: 1,
        strafeUntil: 0,
        wander: null,
        wanderUntil: 0,
        detour: null,
        detourUntil: 0,
        lastPos: { ...bot.pos },
        stuckTicks: 0,
        tapE: false,
        jumpHeld: false,
        aggression: 0,
        burstUntil: 0,
        burstPauseUntil: 0,
        lastHealth: bot.stuffing + bot.buttons,
        lastHurtTick: -1e9,
        dropAt: -1,
        path: null,
        pathGoal: null,
        pathAt: -1e9,
        lastTurn: 0,
        lastSeen: null,
        fleeingWater: false,
        landing: null,
      };
      m.aggression = nextRange(m.rng, BOT.aggression[0], BOT.aggression[1]);
      this.memory.set(bot.id, m);
    }
    return m;
  }

  private think(world: World, state: GameState, bot: Player): Input {
    const m = this.mem(bot);
    const input: Input = {
      seq: m.seq++,
      moveX: 0,
      moveY: 0,
      aimX: bot.aim.x,
      aimY: bot.aim.y,
      buttons: 0,
      weaponSlot: -1,
      cycleWeapon: false,
      useItemSlot: -1,
    };
    if (bot.drop) return this.toss(world, state, bot, m, input);
    let wantJump = false;
    let goal: Vec2 | null = null;
    const health = bot.stuffing + bot.buttons;
    if (health < m.lastHealth) m.lastHurtTick = state.tick;
    m.lastHealth = health;

    const enemy = this.pickTarget(world, state, bot, m);
    const zone = state.zone.current;
    const toCenter = dist(bot.pos, zone.center);
    // Get back inside (with a margin) when the water is close or already here.
    const nearWater = bot.soggy || (state.zone.stage === 'shrinking' && toCenter > zone.radius - 4);
    // Once running from the water, keep running until comfortably inside (8 units from the edge).
    if (nearWater) m.fleeingWater = true;
    else if (toCenter < zone.radius - 8) m.fleeingWater = false;
    const zoneUrgent = nearWater || (m.fleeingWater && state.zone.stage !== 'waiting');

    const canHeal = bot.items.some((s) => s !== null && config.items[s.kind].stuffing > 0 && canUseItem(bot, s.kind));
    const retreating = enemy !== null && bot.stuffing < BOT.retreatBelow && canHeal && !zoneUrgent;

    if (retreating && enemy) {
      // Back off out of sight, then heal once calm.
      m.lastEnemyTick = state.tick;
      const away = unit(bot.pos.x - enemy.pos.x, bot.pos.y - enemy.pos.y);
      goal = { x: bot.pos.x + away.x * 4, y: bot.pos.y + away.y * 4 };
      if (nextFloat(m.rng) < (BOT.combatJumpsPerSecond * 1.5) / T) wantJump = true;
    } else if (enemy) {
      m.lastEnemyTick = state.tick;
      m.lastSeen = { ...enemy.pos };
      const weapon = this.chooseWeapon(bot, dist(bot.pos, enemy.pos), input);
      this.aimAt(state, bot, enemy, weapon, m, input);
      const range = weapon ? BOT.preferredRange[weapon.kind] : 6;
      const d = dist(bot.pos, enemy.pos);
      const mode = weapon ? config.weapons[weapon.kind].mode : undefined;
      if (weapon && mode === 'charge') {
        // Hold to draw the band back; let go when it's drawn far enough (and the shot is clear).
        const drawn = chargeAmount(bot, weapon.kind, state.tick);
        const clear = this.clearShot(world, bot, enemy);
        if (state.tick >= m.fireFromTick && !(bot.chargeStartTick !== null && drawn >= BOT.releaseCharge && clear)) input.buttons |= Btn.Fire;
      } else if (weapon && mode === 'melee') {
        if (state.tick >= m.fireFromTick && d <= (config.weapons[weapon.kind].reach ?? 1.8) + 0.3) input.buttons |= Btn.Fire;
      } else if (weapon && state.tick >= m.fireFromTick && this.inBurst(state, m) && (mode === 'throw' || this.clearShot(world, bot, enemy))) {
        input.buttons |= Btn.Fire;
      }
      if (weapon && weapon.ammo === 0) input.buttons &= ~Btn.Fire;

      if (zoneUrgent) {
        goal = zone.center;
      } else {
        // Keep the preferred distance and strafe around the target.
        if (state.tick >= m.strafeUntil) {
          m.strafe = nextFloat(m.rng) < 0.5 ? 1 : -1;
          m.strafeUntil = state.tick + Math.round(nextRange(m.rng, 0.6, 1.6) * T);
        }
        // (Right under or over it: "away" is the way it's facing from, not the jittery tiny gap.)
        const away = d < OVERHEAD ? { x: -bot.aim.x, y: -bot.aim.y } : unit(bot.pos.x - enemy.pos.x, bot.pos.y - enemy.pos.y);
        const radial = d > range + 1.5 ? -1 : d < range - 1.5 ? 1 : 0;
        const side = { x: -away.y * m.strafe, y: away.x * m.strafe };
        const dir = unit(away.x * radial + side.x, away.y * radial + side.y);
        goal = { x: bot.pos.x + dir.x * 3, y: bot.pos.y + dir.y * 3 };
      }
      if (nextFloat(m.rng) < BOT.combatJumpsPerSecond / T) wantJump = true;
    } else {
      m.targetId = null;
      const calm = state.tick - m.lastEnemyTick > BOT.calmAfter * T;
      const best = bot.weapons[bot.activeSlot] ?? bot.weapons[0] ?? bot.weapons[1];
      if (best && best.ammo < config.weapons[best.kind].magazine / 2 && best.reloadEndTick === null) input.buttons |= Btn.Reload;

      const roof = bot.z > 1.5 ? roofUnder(world, bot.pos) : null;
      if (zoneUrgent) {
        goal = zone.center;
      } else if (roof) {
        // Up on a roof with nothing to fight: walk off the nearest edge (chests are down below).
        goal = offEdge(roof, bot.pos);
      } else if (!calm && m.lastSeen && dist(bot.pos, m.lastSeen) > 1) {
        // Just lost sight of the enemy (into a bush, under a roof): go where it was, facing it,
        // instead of turning away at once (which made bots dither at roof edges and doorways).
        goal = m.lastSeen;
        input.aimX = m.lastSeen.x - bot.pos.x;
        input.aimY = m.lastSeen.y - bot.pos.y;
      } else if (calm && this.tryHeal(bot, input)) {
        goal = null; // stand still while healing
      } else {
        const loot = calm ? this.lootGoal(state, bot, m, input) : null;
        goal = loot === 'stay' ? null : (loot ?? this.wanderGoal(state, bot, m));
      }
    }

    if (goal) {
      const move = this.steer(world, state, bot, goal, m);
      input.moveX = move.x;
      input.moveY = move.y;
      if (move.jump) wantJump = true;
      const chasing = !enemy && m.lastSeen !== null && state.tick - m.lastEnemyTick <= BOT.calmAfter * T;
      if (!enemy && !chasing && (move.x !== 0 || move.y !== 0)) {
        input.aimX = move.x;
        input.aimY = move.y;
      }
    }

    // The toy train coming: step off the rails, out to the side.
    const dodge = this.dodgeTrain(world, state, bot);
    if (dodge) {
      input.moveX = dodge.x;
      input.moveY = dodge.y;
    }
    // An air strike marked where it stands, a jack-in-the-box about to pop or the pond cracking
    // under it: get out of the way.
    const run = this.dodgeStrike(state, bot) ?? this.dodgeToy(world, state, bot) ?? this.dodgeWanderer(world, state, bot);
    if (run) {
      input.moveX = run.x;
      input.moveY = run.y;
    }

    // Jump is a press: release in between so the next press counts.
    if (wantJump && !m.jumpHeld) {
      input.buttons |= Btn.Jump;
      m.jumpHeld = true;
    } else {
      m.jumpHeld = false;
    }
    return input;
  }

  /** Which way to step if a train car will be here within a second or so (null: safe). */
  private dodgeTrain(world: World, state: GameState, bot: Player): Vec2 | null {
    const track = world.map.track;
    if (!track || bot.z >= TRAIN.deckHeight - 0.05) return null;
    // Where the cars will be over the next second and a half.
    for (const ahead of [0.2, 0.5, 0.8, 1.1, 1.5]) for (const car of trainCars(track, state.tick + Math.round(ahead * T))) {
      const dx = bot.pos.x - car.pos.x;
      const dy = bot.pos.y - car.pos.y;
      const along = dx * car.dir.x + dy * car.dir.y;
      const side = dx * -car.dir.y + dy * car.dir.x;
      if (Math.abs(along) > TRAIN.carLength * 1.5 || Math.abs(side) > TRAIN.carWidth / 2 + bot.radius + 0.4) continue;
      // Out the side it's already nearer.
      const s = side >= 0 ? 1 : -1;
      return { x: -car.dir.y * s, y: car.dir.x * s };
    }
    return null;
  }

  // ---------- the Toss ----------

  /** Ride the blimp to a random point of its line, drop, and glide toward the nearest chest. */
  private toss(world: World, state: GameState, bot: Player, m: Memory, input: Input): Input {
    if (bot.drop === 'riding') {
      if (m.dropAt < 0) m.dropAt = nextRange(m.rng, 0.12, 0.88);
      const t = state.toss;
      const k = t ? (state.tick - t.startTick) / Math.max(1, t.endTick - t.startTick) : 1;
      if (k >= m.dropAt && !m.jumpHeld) input.buttons |= Btn.Jump;
      m.jumpHeld = (input.buttons & Btn.Jump) !== 0;
      return input;
    }
    if (!m.landing) {
      let best: Vec2 | null = null;
      let bestD = 28;
      for (const c of state.chests) {
        const d = dist(bot.pos, c.pos);
        // Chests under a roof would land the bot on top of the roof instead.
        const covered = underAnyRoof(world, c.pos);
        if (!c.opened && !covered && d < bestD) {
          best = c.pos;
          bestD = d;
        }
      }
      m.landing = best ?? { ...bot.pos };
    }
    const dx = m.landing.x - bot.pos.x;
    const dy = m.landing.y - bot.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.8) {
      input.moveX = dx / d;
      input.moveY = dy / d;
    }
    return input;
  }

  // ---------- combat ----------

  /**
   * The nearest visible enemy worth fighting: anyone close, anyone while recently hurt, and
   * farther ones only when this bot is well armed (scaled by its aggression).
   */
  private pickTarget(world: World, state: GameState, bot: Player, m: Memory): Player | null {
    // Stick with the current fight while the target stays visible and in range.
    const current = m.targetId === null ? undefined : state.players.find((p) => p.id === m.targetId);
    const engage = BOT.engageRange * this.level.engage;
    if (current?.alive && dist(bot.pos, current.pos) <= engage && canSee(world, state, bot, current)) return current;

    const hurt = state.tick - m.lastHurtTick < BOT.hurtMemory * T;
    if (!hurt && state.tick < BOT.truce * T * state.zone.timeScale) return null;
    const armed = bot.weapons.some((w) => w !== null && (w.kind !== 'cork_popper' || w.rarity > 0));
    const reach = hurt ? engage : armed ? Math.max(BOT.threatRange, engage * m.aggression) : BOT.threatRange;
    let best: Player | null = null;
    let bestD: number = reach;
    for (const p of state.players) {
      if (p.id === bot.id || !p.alive) continue;
      const d = dist(bot.pos, p.pos);
      if (d > bestD || !canSee(world, state, bot, p)) continue;
      best = p;
      bestD = d;
    }
    if (best && best.id !== m.targetId) {
      m.targetId = best.id;
      m.fireFromTick = state.tick + Math.round(nextRange(m.rng, BOT.reaction[0], BOT.reaction[1]) * this.level.reaction * T);
    }
    return best;
  }

  /** True while in the shooting part of a burst; rolls the next burst and pause as they end. */
  private inBurst(state: GameState, m: Memory): boolean {
    if (state.tick >= m.burstPauseUntil) {
      m.burstUntil = state.tick + Math.round(nextRange(m.rng, BOT.burst[0], BOT.burst[1]) * T);
      m.burstPauseUntil = m.burstUntil + Math.round(nextRange(m.rng, BOT.burstPause[0], BOT.burstPause[1]) * this.level.pause * T);
    }
    return state.tick < m.burstUntil;
  }

  /** Picks the slot to hold for this distance; returns the weapon it will fire. */
  private chooseWeapon(bot: Player, d: number, input: Input): WeaponInstance | null {
    let bestSlot = -1;
    let bestScore = -Infinity;
    bot.weapons.forEach((w, i) => {
      if (!w) return;
      const fit = Math.abs(BOT.preferredRange[w.kind] - d);
      const score = w.rarity * 0.8 - fit * 0.35 + (w.ammo > 0 ? 0 : -3);
      if (score > bestScore) {
        bestScore = score;
        bestSlot = i;
      }
    });
    if (bestSlot === -1) return null;
    if (bestSlot !== bot.activeSlot) input.weaponSlot = bestSlot as 0 | 1;
    return bot.weapons[bot.activeSlot] ?? null;
  }

  private aimAt(state: GameState, bot: Player, enemy: Player, weapon: WeaponInstance | null, m: Memory, input: Input): void {
    const d = dist(bot.pos, enemy.pos);
    const speed = weapon ? config.weapons[weapon.kind].projectileSpeed : 25;
    const lead = speed > 0 ? (d / speed) * Math.min(1, BOT.leadFactor * this.level.lead) : 0;
    if (state.tick >= m.aimOffsetUntil) {
      const r = (BOT.aimError * this.level.aimError * d) / 10;
      const a = nextFloat(m.rng) * Math.PI * 2;
      const k = Math.sqrt(nextFloat(m.rng));
      m.aimOffset = { x: Math.cos(a) * r * k, y: Math.sin(a) * r * k };
      m.aimOffsetUntil = state.tick + Math.round(nextRange(m.rng, 0.25, 0.6) * T);
    }
    const tx = enemy.pos.x + enemy.vel.x * lead + m.aimOffset.x;
    const ty = enemy.pos.y + enemy.vel.y * lead + m.aimOffset.y;
    // Nearly straight above or below it (up on a roof over it): keep facing as it does, or the tiny
    // gap between them, changing every tick, spun it round and round.
    if (Math.hypot(tx - bot.pos.x, ty - bot.pos.y) < OVERHEAD) {
      input.aimX = bot.aim.x;
      input.aimY = bot.aim.y;
      return;
    }
    input.aimX = tx - bot.pos.x;
    input.aimY = ty - bot.pos.y;
  }

  /** No tall wall between the bot and its target at shot height. */
  private clearShot(world: World, bot: Player, enemy: Player): boolean {
    const z = bot.z + config.combat.shotHeight;
    return raycastWalls(world, bot.pos, enemy.pos, 0.1, z) === null;
  }

  // ---------- looting and healing ----------

  private tryHeal(bot: Player, input: Input): boolean {
    if (bot.action?.kind === 'useItem') return true;
    const needs = bot.stuffing < BOT.healBelow || bot.buttons < 40;
    if (!needs) return false;
    const slot = bot.items.findIndex((s) => s !== null && canUseItem(bot, s.kind));
    if (slot === -1) return false;
    input.useItemSlot = slot as 0 | 1 | 2;
    return true;
  }

  /**
   * Where to go for the most useful nearby loot or chest; 'stay' while pressing E on it;
   * null when there's nothing worth getting.
   */
  private lootGoal(state: GameState, bot: Player, m: Memory, input: Input): Vec2 | 'stay' | null {
    // Already opening a chest: keep holding E and stay put.
    if (bot.action?.kind === 'openChest') {
      input.buttons |= Btn.Interact;
      return 'stay';
    }

    // E picks up a nearby weapon before opening a chest, so only press it when that's wanted.
    const interaction = findInteraction(state, bot);
    const wanted =
      (interaction?.kind === 'weapon' && this.wants(bot, interaction.loot)) ||
      (interaction?.kind === 'part' && wantsPart(bot, interaction.part));
    if (wanted) {
      m.tapE = !m.tapE;
      if (m.tapE) input.buttons |= Btn.Interact;
      return 'stay';
    }
    if (interaction?.kind === 'chest') {
      input.buttons |= Btn.Interact;
      return 'stay';
    }
    // The piñata close by: whack it open (it's full of good loot).
    const pin = state.pinata;
    if (pin && !pin.broken && Math.abs(bot.z - pin.z) < 1 && dist(bot.pos, pin.pos) < BOT.pinataRange) {
      const d = dist(bot.pos, pin.pos);
      const weapon = bot.weapons[bot.activeSlot];
      const reach = weapon && config.weapons[weapon.kind].mode === 'melee' ? 1.6 : 5;
      if (d > reach) return pin.pos;
      input.aimX = pin.pos.x - bot.pos.x;
      input.aimY = pin.pos.y - bot.pos.y;
      // A press every few ticks (single-shot weapons need a fresh press each time).
      if (state.tick % 6 < 3) input.buttons |= Btn.Fire;
      return 'stay';
    }
    // At the air strike button: press it.
    if (interaction?.kind === 'strike') {
      m.tapE = !m.tapE;
      if (m.tapE) input.buttons |= Btn.Interact;
      return 'stay';
    }
    // Close to it (and on its level) while it's ready: go press it.
    const button = state.strikeButton;
    if (
      button &&
      state.tick >= button.readyTick &&
      Math.abs(bot.z - button.z) <= config.loot.reachHeight &&
      dist(bot.pos, button.pos) < BOT.strikeButtonRange
    ) {
      return button.pos;
    }

    let goal: Vec2 | null = null;
    let bestD: number = BOT.lootRange;
    for (const loot of state.loot) {
      const d = dist(bot.pos, loot.pos);
      if (d >= bestD || !this.useful(bot, loot)) continue;
      goal = loot.pos;
      bestD = d;
    }
    for (const chest of state.chests) {
      // Only one it can open from its level: up on a roof, it walks off first (the wander goal
      // takes it down); one up on a roof is for climbers.
      if (chest.opened || !chestInReach(bot, chest)) continue;
      const d = dist(bot.pos, chest.pos) + 4; // loot on the ground first
      if (d < bestD) {
        goal = chest.pos;
        bestD = d;
      }
    }
    return goal;
  }

  private useful(bot: Player, loot: GroundLoot): boolean {
    // Bots don't climb: loot on a roof or crate top above them is out of reach.
    if (Math.abs(loot.z - bot.z) > config.loot.reachHeight) return false;
    const c = loot.content;
    if (c.type === 'weapon') return this.wants(bot, loot);
    if (c.type === 'part') return wantsPart(bot, c.part);
    return bot.items.some((s) => s === null || (s.kind === c.item.kind && s.count < config.items[s.kind].maxStack));
  }

  /** Would picking this weapon up be an upgrade? */
  private wants(bot: Player, loot: GroundLoot): boolean {
    if (loot.content.type !== 'weapon') return false;
    const w = loot.content.weapon;
    if (bot.weapons.some((h) => h === null)) return !bot.weapons.some((h) => h?.kind === w.kind && h.rarity >= w.rarity);
    const worst = Math.min(...bot.weapons.map((h) => weaponValue(h!)));
    const active = bot.weapons[bot.activeSlot]!;
    return weaponValue(w) > worst && weaponValue(w) > weaponValue(active);
  }

  private wanderGoal(state: GameState, bot: Player, m: Memory): Vec2 {
    const zone = state.zone.current;
    if (!m.wander || state.tick >= m.wanderUntil || dist(bot.pos, m.wander) < 1.5 || dist(m.wander, zone.center) > zone.radius * 0.8) {
      const a = nextFloat(m.rng) * Math.PI * 2;
      const r = Math.sqrt(nextFloat(m.rng)) * Math.max(2, Math.min(zone.radius * 0.6, 30));
      m.wander = { x: zone.center.x + Math.cos(a) * r, y: zone.center.y + Math.sin(a) * r };
      m.wanderUntil = state.tick + Math.round(nextRange(m.rng, 4, 9) * T);
    }
    return m.wander;
  }

  // ---------- movement ----------

  /**
   * Heads for the goal, hopping low obstacles and turning around tall ones. If the bot barely
   * moved for half a second while trying to, it takes a random detour for a moment.
   */
  /** The jack-in-the-box's tune playing close by, or the ice cracking under it: the way out. */
  private dodgeToy(world: World, state: GameState, bot: Player): Vec2 | null {
    const t = state.toy;
    if (!t || state.tick >= t.startTick) return null;
    let from: Vec2 | null = null;
    let reach = 0;
    if (t.kind === 'jack') {
      from = t.at;
      reach = config.toys.jack.radius + 1;
    } else if (t.kind === 'icedrill') {
      const pond = world.map.ice?.[0];
      if (pond) {
        from = pond.center;
        reach = pond.radius + 0.5;
      }
    }
    if (!from) return null;
    const dx = bot.pos.x - from.x;
    const dy = bot.pos.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d > reach) return null;
    return d > 1e-6 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
  }

  /** A mower or plow coming at it: the way out of it. */
  private dodgeWanderer(world: World, state: GameState, bot: Player): Vec2 | null {
    const defs = world.map.wanderers ?? [];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i]!;
      const s = state.wanderers[i];
      if (!s) continue;
      const dx = bot.pos.x - s.pos.x;
      const dy = bot.pos.y - s.pos.y;
      const dist = Math.hypot(dx, dy);
      if ((d.kind === 'mower' || d.kind === 'plow') && s.mode === 'moving' && dist < 5) {
        // Coming this way: step off its line, to the side it's already on.
        const ux = Math.cos(s.dir);
        const uy = Math.sin(s.dir);
        if (dx * ux + dy * uy < 0) continue;
        const side = dx * -uy + dy * ux >= 0 ? 1 : -1;
        return { x: -uy * side, y: ux * side };
      }
    }
    return null;
  }

  /** Inside a marked air strike circle: the way out (away from its middle), else null. */
  private dodgeStrike(state: GameState, bot: Player): Vec2 | null {
    for (const s of state.strikes) {
      const dx = bot.pos.x - s.pos.x;
      const dy = bot.pos.y - s.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > config.strike.radius + bot.radius + 0.5) continue;
      return d > 1e-6 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
    }
    return null;
  }

  private steer(world: World, state: GameState, bot: Player, goal: Vec2, m: Memory): { x: number; y: number; jump: boolean } {
    const moved = dist(bot.pos, m.lastPos);
    m.lastPos = { ...bot.pos };
    if (dist(bot.pos, goal) < 0.4) return { x: 0, y: 0, jump: false };

    m.stuckTicks = moved < 0.04 ? m.stuckTicks + 1 : 0;
    if (m.stuckTicks > T / 2) m.path = null; // stuck: plan again
    if (m.stuckTicks > T) {
      const a = nextFloat(m.rng) * Math.PI * 2;
      m.detour = { x: Math.cos(a), y: Math.sin(a) };
      m.detourUntil = state.tick + Math.round(0.7 * T);
      m.stuckTicks = 0;
      return { ...m.detour, jump: true };
    }
    if (m.detour && state.tick < m.detourUntil) return { ...m.detour, jump: false };
    m.detour = null;

    const target = this.waypoint(world, state, bot, goal, m);
    const want = unit(target.x - bot.pos.x, target.y - bot.pos.y);
    const look = 1.6;
    const feet = bot.z + config.player.stepHeight;
    // Keep turning the way it turned last time while that still works (no flip-flopping).
    const turns = [0, 35, -35, 70, -70, 110, -110];
    if (m.lastTurn !== 0) turns.splice(1, 0, m.lastTurn);
    for (const turn of turns) {
      const a = Math.atan2(want.y, want.x) + turn * DEG;
      const dir = { x: Math.cos(a), y: Math.sin(a) };
      const ahead = { x: bot.pos.x + dir.x * look, y: bot.pos.y + dir.y * look };
      // Walls the bot could hop onto don't count as blocking on the straight line: it jumps them.
      const tall = raycastWalls(world, bot.pos, ahead, bot.radius * 0.9, feet + jumpReach());
      if (tall !== null) continue;
      const low = turn === 0 && raycastWalls(world, bot.pos, ahead, bot.radius * 0.9, feet) !== null;
      m.lastTurn = turn;
      return { x: dir.x, y: dir.y, jump: low };
    }
    return { x: want.x, y: want.y, jump: true };
  }

  /**
   * Where to head now for `goal`: the goal itself when it can be walked to straight, otherwise
   * the next waypoint of a path around the walls (planned again when the goal moves, now and
   * then, or when stuck).
   */
  private waypoint(world: World, state: GameState, bot: Player, goal: Vec2, m: Memory): Vec2 {
    if (bot.z > 0.5 || clearWalk(world, bot.pos, goal)) {
      m.path = null;
      return goal;
    }
    const stale = !m.path || !m.pathGoal || dist(m.pathGoal, goal) > 2 || state.tick - m.pathAt > T * 2;
    if (stale) {
      m.path = findPath(world, bot.pos, goal);
      m.pathGoal = { ...goal };
      m.pathAt = state.tick;
    }
    const path = m.path;
    if (!path || path.length === 0) return goal;
    // Drop waypoints already reached; skip ahead to the farthest one in plain view.
    while (path.length > 1 && dist(bot.pos, path[0]!) < 0.8) path.shift();
    for (let i = Math.min(path.length - 1, 4); i > 0; i--) {
      if (clearWalk(world, bot.pos, path[i]!)) {
        path.splice(0, i);
        break;
      }
    }
    return path[0]!;
  }
}

/** An enemy closer than this sideways is (nearly) straight above or below the bot. */
const OVERHEAD = 0.6;

/** Highest top a jump can land on, above the current feet. */
function jumpReach(): number {
  return (config.player.jumpSpeed * config.player.jumpSpeed) / (2 * config.player.gravity) - 0.05;
}

function weaponValue(w: WeaponInstance): number {
  return BOT.weaponValue[w.kind] + w.rarity * 0.5;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unit(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

/**
 * Bots dress toward a set: they put on a part when its animal matches more of what they wear
 * than the part it would replace does.
 */
function wantsPart(bot: Player, part: Part): boolean {
  const current = bot.parts[part.slot].animal;
  if (part.animal === current) return false;
  const count = (animal: string) => PART_SLOTS.filter((s) => s !== part.slot && bot.parts[s].animal === animal).length;
  return count(part.animal) > count(current);
}

/** Inside a roofed building's area (a house, the shed, under the treehouse or the table). */
function underAnyRoof(world: World, p: Vec2): boolean {
  return world.map.buildings.some((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
}

function roofUnder(world: World, p: Vec2): Box | null {
  return world.map.buildings.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) ?? null;
}

/** A point just past the building edge nearest to `p`. */
function offEdge(b: Box, p: Vec2): Vec2 {
  const out = 2;
  const options: [number, Vec2][] = [
    [p.x - b.x, { x: b.x - out, y: p.y }],
    [b.x + b.w - p.x, { x: b.x + b.w + out, y: p.y }],
    [p.y - b.y, { x: p.x, y: b.y - out }],
    [b.y + b.h - p.y, { x: p.x, y: b.y + b.h + out }],
  ];
  options.sort((a, b2) => a[0] - b2[0]);
  return options[0]![1];
}
