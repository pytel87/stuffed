import { describe, expect, it } from 'vitest';
import { BotController, createGame, createWorld, step, TEST_MAP } from '../src/index.ts';
import type { EntityId, GameState } from '../src/index.ts';
import { decodeSnapshot, emptySnapshotParts, encodeSnapshot, type CompactSnapshot, type SnapshotMemory } from '../src/net/protocol.ts';

function match(seed = 3) {
  const world = createWorld(TEST_MAP);
  const roster = Array.from({ length: 10 }, (_, i) => ({ name: `P${i}`, isBot: true }));
  const state = createGame({ seed, map: TEST_MAP, roster });
  return { world, state, bots: new BotController(seed) };
}

/** Plays `ticks` ticks, sending one update every 2 ticks through encode → decode. */
function stream(ticks: number) {
  const { world, state, bots } = match();
  const memory: SnapshotMemory = {};
  const parts = emptySnapshotParts();
  const you = state.players[0]!.id;
  let decoded: GameState | null = null;
  const sizes: number[] = [];
  for (let t = 0; t < ticks; t++) {
    step(world, state, bots.inputs(world, state));
    if (state.tick % 2) continue;
    const json = encodeSnapshot(state, state.players, you, state.events, memory);
    sizes.push(json.length);
    decoded = decodeSnapshot(JSON.parse(json) as CompactSnapshot, parts)?.state ?? null;
  }
  return { state, decoded: decoded!, you, sizes };
}

describe('compact snapshots', () => {
  it('rebuild the game state the client needs after many updates', () => {
    const { state, decoded, you } = stream(600);
    expect(decoded.tick).toBe(state.tick);
    expect(decoded.players.map((p) => p.id)).toEqual(state.players.map((p) => p.id));
    for (const p of state.players) {
      const d = decoded.players.find((q) => q.id === p.id)!;
      expect(d.name).toBe(p.name);
      expect(d.parts).toEqual(p.parts);
      expect(d.alive).toBe(p.alive);
      expect(d.pos.x).toBeCloseTo(p.pos.x, 2);
      expect(d.stuffing).toBeCloseTo(p.stuffing, 2);
      expect(d.weapons[d.activeSlot]?.kind).toBe(p.weapons[p.activeSlot]?.kind);
    }
    expect(decoded.chests.map((c) => c.opened)).toEqual(state.chests.map((c) => c.opened));
    expect(decoded.loot.map((l) => l.id)).toEqual(state.loot.map((l) => l.id));
    expect(decoded.zone.current.radius).toBeCloseTo(state.zone.current.radius, 2);
    // Your own plush keeps its private details; others don't.
    const me = decoded.players.find((p) => p.id === you)!;
    expect(me.lastInputSeq).toBe(state.players.find((p) => p.id === you)!.lastInputSeq);
  });

  it('are much smaller than full states once the slow parts have been sent', () => {
    const { state, sizes } = stream(600);
    const full = JSON.stringify(state).length;
    const typical = sizes.slice(10).sort((a, b) => a - b)[Math.floor(sizes.length / 2)]!;
    expect(typical).toBeLessThan(full * 0.5);
  });

  it('send unchanged slow parts only once', () => {
    const { world, state, bots } = match();
    const memory: SnapshotMemory = {};
    const first = JSON.parse(encodeSnapshot(state, state.players, null, [], memory)) as CompactSnapshot;
    expect(first.chests).toBeDefined();
    expect(first.roster).toBeDefined();
    step(world, state, new Map<EntityId, never>());
    void bots;
    const second = JSON.parse(encodeSnapshot(state, state.players, null, [], memory)) as CompactSnapshot;
    expect(second.chests).toBeUndefined();
    expect(second.roster).toBeUndefined();
  });
});
