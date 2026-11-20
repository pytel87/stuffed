// The piñata: one per map (a paper donkey on a frame, or a big wrapped present). Shots,
// hammer bonks and bursts wear it down; when it breaks, good loot showers out around it.
import { config } from '../config.ts';
import { rollPart } from '../parts.ts';
import { pick, pickIndexWeighted, pickWeighted } from '../rng.ts';
import type { EntityId, GameState, Part, Rarity, Vec2 } from '../types.ts';
import type { World } from '../world.ts';
import { spawnLoot } from './loot.ts';
import { makeWeapon } from './weapons.ts';

const P = config.pinata;

/** The height of its middle (it hangs or sits there), or null when there's none left to hit. */
export function pinataMiddle(state: GameState): number | null {
  const p = state.pinata;
  return p && !p.broken ? p.z + P.lift[p.kind] : null;
}

/** Whether something at height `z` (give or take `r`) is level with it. */
export function levelWithPinata(state: GameState, z: number, r = 0): boolean {
  const mid = pinataMiddle(state);
  return mid !== null && z + r > mid - P.halfHeight && z - r < mid + P.halfHeight;
}

/** A hit: it jiggles, and breaks once it's had enough. */
export function hitPinata(world: World, state: GameState, amount: number, byId: EntityId | null): void {
  const p = state.pinata;
  if (!p || p.broken || amount <= 0) return;
  p.hp -= amount;
  p.hitTick = state.tick;
  state.events.push({ type: 'pinataHit', pos: { ...p.pos }, byId });
  if (p.hp > 0) return;
  p.broken = true;
  p.hp = 0;
  // The loot showers out in a ring around it.
  const spots: Vec2[] = [];
  const n = P.loot.weapons + P.loot.items + P.loot.parts;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    spots.push({ x: p.pos.x + Math.cos(a) * P.lootDistance, y: p.pos.y + Math.sin(a) * P.lootDistance });
  }
  let k = 0;
  for (let i = 0; i < P.loot.weapons; i++) {
    const kind = pickWeighted(state.rng, config.chest.weaponWeights);
    const rarity = Math.max(2, pickIndexWeighted(state.rng, config.chest.rarityWeights.high)) as Rarity;
    spawnLoot(world, state, spots[k++]!, { type: 'weapon', weapon: makeWeapon(kind, rarity) }, p.z);
  }
  for (let i = 0; i < P.loot.items; i++) {
    const item = pickWeighted(state.rng, config.chest.itemWeights);
    spawnLoot(world, state, spots[k++]!, { type: 'item', item: { kind: item, count: config.items[item].chestCount } }, p.z);
  }
  for (let i = 0; i < P.loot.parts; i++) {
    const part = rollPart(state.rng, state.players.find((q) => q.id === byId), config.parts.holoChanceRich);
    spawnLoot(world, state, spots[k++]!, { type: 'part', part }, p.z);
  }
  state.events.push({ type: 'pinataBurst', pos: { ...p.pos }, byId });
}
