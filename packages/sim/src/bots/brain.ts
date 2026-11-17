// Bot brains. A bot is just another source of Inputs: it reads the game state and decides what
// a player would press. Runs in the sim package so the Colyseus server can run bots unchanged.
// Each bot has its own seeded RNG, so a match with bots is still fully deterministic.
import { config } from '../config.ts';
import { nextFloat, nextRange, seedRng } from '../rng.ts';
import { findInteraction } from '../systems/loot.ts';
import { canUseItem } from '../systems/items.ts';
import { canSee } from '../systems/visibility.ts';
import { Btn } from '../types.ts';
import type { EntityId, GameState, GroundLoot, Input, Part, Player, RngState, Vec2, WeaponInstance, WeaponKind } from '../types.ts';
import { raycastWalls, type World } from '../world.ts';

export const BOT = {
  /** Enemies farther than this are never engaged (they rarely hit from there). */
  engageRange: 16,
  /** Enemies this close are always fought. */
  threatRange: 6,
  /** Below this much stuffing a bot with a healing item backs off from fights to heal. */
  retreatBelow: 45,
  /** Each bot rolls an aggression in this range; it scales how far it starts fights when well armed. */
  aggression: [0.2, 0.85] as [number, number],
  /** Seconds a bot keeps fighting back after being hurt, at any range it can see. */
  hurtMemory: 3,
  /** Seconds between first seeing an enemy and starting to shoot. */
  reaction: [0.6, 1.3] as [number, number],
  /** Aim wobble: the aim point drifts this far (units) per 10 units of distance. */
  aimError: 2.4,
  /** Bots fire in bursts: seconds shooting, then seconds paused. */
  burst: [0.5, 1.1] as [number, number],
  burstPause: [0.6, 1.4] as [number, number],
  /** How much of the target's motion bots lead their shots by (1 = perfect). */
  leadFactor: 0.6,
  /** Preferred fighting distance per weapon. */
  preferredRange: { cork_popper: 9, foam_dart_smg: 6.5, super_soaker: 3.5 } satisfies Record<WeaponKind, number>,
  /** Chance per second to hop while fighting. */
  combatJumpsPerSecond: 0.6,
  /** Look this far for chests and loot. */
  lootRange: 26,
  /** Heal when stuffing drops below this and no enemy is around. */
  healBelow: 65,
  /** Seconds without seeing an enemy before healing or looting again. */
  calmAfter: 1.5,
} as const;

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
}

/** Drives every bot in the match. Keep one per match; it holds each bot's memory. */
export class BotController {
  private readonly memory = new Map<EntityId, Memory>();

  constructor(private readonly seed: number) {}

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
    let wantJump = false;
    let goal: Vec2 | null = null;
    const health = bot.stuffing + bot.buttons;
    if (health < m.lastHealth) m.lastHurtTick = state.tick;
    m.lastHealth = health;

    const enemy = this.pickTarget(world, state, bot, m);
    const zone = state.zone.current;
    const toCenter = dist(bot.pos, zone.center);
    // Get back inside (with a margin) when the water is close or already here.
    const zoneUrgent = bot.soggy || (state.zone.stage === 'shrinking' && toCenter > zone.radius - 4);

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
      const weapon = this.chooseWeapon(bot, dist(bot.pos, enemy.pos), input);
      this.aimAt(state, bot, enemy, weapon, m, input);
      const range = weapon ? BOT.preferredRange[weapon.kind] : 6;
      const d = dist(bot.pos, enemy.pos);
      if (weapon && state.tick >= m.fireFromTick && this.inBurst(state, m) && this.clearShot(world, bot, enemy)) input.buttons |= Btn.Fire;
      if (weapon && weapon.ammo === 0) input.buttons &= ~Btn.Fire;

      if (zoneUrgent) {
        goal = zone.center;
      } else {
        // Keep the preferred distance and strafe around the target.
        if (state.tick >= m.strafeUntil) {
          m.strafe = nextFloat(m.rng) < 0.5 ? 1 : -1;
          m.strafeUntil = state.tick + Math.round(nextRange(m.rng, 0.6, 1.6) * T);
        }
        const away = unit(bot.pos.x - enemy.pos.x, bot.pos.y - enemy.pos.y);
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

      if (zoneUrgent) {
        goal = zone.center;
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
      if (!enemy && (move.x !== 0 || move.y !== 0)) {
        input.aimX = move.x;
        input.aimY = move.y;
      }
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

  // ---------- combat ----------

  /**
   * The nearest visible enemy worth fighting: anyone close, anyone while recently hurt, and
   * farther ones only when this bot is well armed (scaled by its aggression).
   */
  private pickTarget(world: World, state: GameState, bot: Player, m: Memory): Player | null {
    // Stick with the current fight while the target stays visible and in range.
    const current = m.targetId === null ? undefined : state.players.find((p) => p.id === m.targetId);
    if (current?.alive && dist(bot.pos, current.pos) <= BOT.engageRange && canSee(world, state, bot, current)) return current;

    const hurt = state.tick - m.lastHurtTick < BOT.hurtMemory * T;
    const armed = bot.weapons.some((w) => w !== null && (w.kind !== 'cork_popper' || w.rarity > 0));
    const reach = hurt ? BOT.engageRange : armed ? Math.max(BOT.threatRange, BOT.engageRange * m.aggression) : BOT.threatRange;
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
      m.fireFromTick = state.tick + Math.round(nextRange(m.rng, BOT.reaction[0], BOT.reaction[1]) * T);
    }
    return best;
  }

  /** True while in the shooting part of a burst; rolls the next burst and pause as they end. */
  private inBurst(state: GameState, m: Memory): boolean {
    if (state.tick >= m.burstPauseUntil) {
      m.burstUntil = state.tick + Math.round(nextRange(m.rng, BOT.burst[0], BOT.burst[1]) * T);
      m.burstPauseUntil = m.burstUntil + Math.round(nextRange(m.rng, BOT.burstPause[0], BOT.burstPause[1]) * T);
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
    const lead = (d / speed) * BOT.leadFactor;
    if (state.tick >= m.aimOffsetUntil) {
      const r = (BOT.aimError * d) / 10;
      const a = nextFloat(m.rng) * Math.PI * 2;
      const k = Math.sqrt(nextFloat(m.rng));
      m.aimOffset = { x: Math.cos(a) * r * k, y: Math.sin(a) * r * k };
      m.aimOffsetUntil = state.tick + Math.round(nextRange(m.rng, 0.25, 0.6) * T);
    }
    const tx = enemy.pos.x + enemy.vel.x * lead + m.aimOffset.x;
    const ty = enemy.pos.y + enemy.vel.y * lead + m.aimOffset.y;
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

    let goal: Vec2 | null = null;
    let bestD: number = BOT.lootRange;
    for (const loot of state.loot) {
      const d = dist(bot.pos, loot.pos);
      if (d >= bestD || !this.useful(bot, loot)) continue;
      goal = loot.pos;
      bestD = d;
    }
    for (const chest of state.chests) {
      if (chest.opened) continue;
      const d = dist(bot.pos, chest.pos) + 4; // loot on the ground first
      if (d < bestD) {
        goal = chest.pos;
        bestD = d;
      }
    }
    return goal;
  }

  private useful(bot: Player, loot: GroundLoot): boolean {
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
  private steer(world: World, state: GameState, bot: Player, goal: Vec2, m: Memory): { x: number; y: number; jump: boolean } {
    const moved = dist(bot.pos, m.lastPos);
    m.lastPos = { ...bot.pos };
    if (dist(bot.pos, goal) < 0.4) return { x: 0, y: 0, jump: false };

    m.stuckTicks = moved < 0.04 ? m.stuckTicks + 1 : 0;
    if (m.stuckTicks > T / 2) {
      const a = nextFloat(m.rng) * Math.PI * 2;
      m.detour = { x: Math.cos(a), y: Math.sin(a) };
      m.detourUntil = state.tick + Math.round(0.7 * T);
      m.stuckTicks = 0;
      return { ...m.detour, jump: true };
    }
    if (m.detour && state.tick < m.detourUntil) return { ...m.detour, jump: false };
    m.detour = null;

    const want = unit(goal.x - bot.pos.x, goal.y - bot.pos.y);
    const look = 1.6;
    const feet = bot.z + config.player.stepHeight;
    for (const turn of [0, 35, -35, 70, -70, 110, -110]) {
      const a = Math.atan2(want.y, want.x) + turn * DEG;
      const dir = { x: Math.cos(a), y: Math.sin(a) };
      const ahead = { x: bot.pos.x + dir.x * look, y: bot.pos.y + dir.y * look };
      // Walls the bot could hop onto don't count as blocking on the straight line: it jumps them.
      const tall = raycastWalls(world, bot.pos, ahead, bot.radius * 0.9, feet + jumpReach());
      if (tall !== null) continue;
      const low = turn === 0 && raycastWalls(world, bot.pos, ahead, bot.radius * 0.9, feet) !== null;
      return { x: dir.x, y: dir.y, jump: low };
    }
    return { x: want.x, y: want.y, jump: true };
  }
}

/** Highest top a jump can land on, above the current feet. */
function jumpReach(): number {
  return (config.player.jumpSpeed * config.player.jumpSpeed) / (2 * config.player.gravity) - 0.05;
}

function weaponValue(w: WeaponInstance): number {
  const base = { cork_popper: 1, foam_dart_smg: 1.6, super_soaker: 1.4 }[w.kind];
  return base + w.rarity * 0.5;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unit(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

/** Bots dress up: they put on any part rarer than the one they wear in that slot. */
function wantsPart(bot: Player, part: Part): boolean {
  return part.rarity > bot.parts[part.slot].rarity;
}
