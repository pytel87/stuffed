import { config, secondsToTicks } from '../config.ts';
import type { EntityId, GameState, KnockoutCause, Player, Vec2 } from '../types.ts';

/**
 * Patches (armor) absorb damage first; the rest comes out of stuffing. `ignoreArmor` skips
 * the patches (the Rinse). A plush at 0 stuffing is Unstitched (eliminated).
 */
export function applyDamage(
  state: GameState,
  target: Player,
  amount: number,
  sourceId: EntityId | null,
  { ignoreArmor = false, from, cause }: { ignoreArmor?: boolean; from?: Vec2; cause?: KnockoutCause } = {},
): void {
  // The victory lap: nobody can be hurt any more.
  if (!target.alive || amount <= 0 || state.victoryUntil !== null) return;
  // A warm-up: the hit lands (its puff, its push) but takes nothing.
  if (state.peaceful) {
    state.events.push({ type: 'hit', targetId: target.id, sourceId, damage: 0, armorDamage: 0, ...(from ? { from } : {}) });
    return;
  }
  const armorDamage = ignoreArmor ? 0 : Math.min(target.patches, amount);
  target.patches -= armorDamage;
  const damage = amount - armorDamage;
  const removed = armorDamage + Math.min(damage, Math.max(0, target.stuffing));
  target.stuffing -= damage;
  state.events.push({ type: 'hit', targetId: target.id, sourceId, damage, armorDamage, ...(from ? { from } : {}) });
  const source = sourceId === null ? undefined : state.players.find((p) => p.id === sourceId);
  if (source && source.id !== target.id) source.damageDealt += removed; // no credit for overkill
  if (target.stuffing <= 0) eliminate(state, target, sourceId, cause);
}

export function eliminate(state: GameState, target: Player, byId: EntityId | null, cause?: KnockoutCause): void {
  if (!target.alive) return;
  target.alive = false;
  target.stuffing = 0;
  target.vel = { x: 0, y: 0 };
  target.knockback = { x: 0, y: 0 };
  target.action = null;
  target.eliminatedTick = state.tick;
  target.eliminatedBy = byId;
  const killer = byId === null ? undefined : state.players.find((p) => p.id === byId);
  if (killer && killer.id !== target.id) killer.knockouts++;
  // Placement = 1 + players still standing, so the first one out of 16 places 16th.
  target.placement = countAlive(state) + 1;
  state.events.push({ type: 'eliminated', playerId: target.id, byId, placement: target.placement, ...(cause ? { cause } : {}) });
}

export function countAlive(state: GameState): number {
  let n = 0;
  for (const p of state.players) if (p.alive) n++;
  return n;
}

/**
 * Decides the winner when at most one plush (or one team) is left standing, and starts the
 * victory lap; the match ends when it's over (see step).
 */
export function checkWinner(state: GameState): void {
  if (state.status !== 'playing' || state.victoryUntil !== null || state.players.length < 2) return;
  const alive = state.players.filter((p) => p.alive);
  const team = alive[0]?.team ?? 0;
  // Team mode: it's over when everyone left is on one team; they all win.
  if (alive.length > 1 && (team === 0 || alive.some((p) => p.team !== team))) return;
  state.victoryUntil = state.tick + secondsToTicks(config.victoryLap);
  if (state.victoryUntil <= state.tick) state.status = 'ended';
  if (team !== 0) {
    state.winnerTeam = team;
    state.winnerId = null;
    for (const p of alive) p.placement = 1;
    return;
  }
  const winner = alive[0];
  state.winnerId = winner ? winner.id : null;
  if (winner) winner.placement = 1;
}

/** On the same team (team mode): they can't hurt each other. */
export function teammates(a: { team: number } | undefined, b: { team: number }): boolean {
  return !!a && a.team !== 0 && a.team === b.team;
}
