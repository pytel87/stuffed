import type { EntityId, GameState, Player, Vec2 } from '../types.ts';

/**
 * Buttons (armor) absorb damage first; the rest comes out of stuffing. `ignoreArmor` skips
 * the buttons (the Rinse). A plush at 0 stuffing is Unstitched (eliminated).
 */
export function applyDamage(
  state: GameState,
  target: Player,
  amount: number,
  sourceId: EntityId | null,
  { ignoreArmor = false, from }: { ignoreArmor?: boolean; from?: Vec2 } = {},
): void {
  if (!target.alive || amount <= 0) return;
  const armorDamage = ignoreArmor ? 0 : Math.min(target.buttons, amount);
  target.buttons -= armorDamage;
  const damage = amount - armorDamage;
  const removed = armorDamage + Math.min(damage, Math.max(0, target.stuffing));
  target.stuffing -= damage;
  state.events.push({ type: 'hit', targetId: target.id, sourceId, damage, armorDamage, ...(from ? { from } : {}) });
  const source = sourceId === null ? undefined : state.players.find((p) => p.id === sourceId);
  if (source && source.id !== target.id) source.damageDealt += removed; // no credit for overkill
  if (target.stuffing <= 0) eliminate(state, target, sourceId);
}

export function eliminate(state: GameState, target: Player, byId: EntityId | null): void {
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
  state.events.push({ type: 'eliminated', playerId: target.id, byId, placement: target.placement });
}

export function countAlive(state: GameState): number {
  let n = 0;
  for (const p of state.players) if (p.alive) n++;
  return n;
}

/** Ends the match when at most one plush is left standing. */
export function checkWinner(state: GameState): void {
  if (state.status !== 'playing' || state.players.length < 2) return;
  const alive = state.players.filter((p) => p.alive);
  if (alive.length > 1) return;
  state.status = 'ended';
  const winner = alive[0];
  state.winnerId = winner ? winner.id : null;
  if (winner) winner.placement = 1;
}
