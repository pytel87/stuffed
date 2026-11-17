import { BACKYARD, BotController, createGame, createWorld, DT, step } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, MapData, RosterEntry, WeaponSpec, World } from '@stuffed/sim';

/** Your plush's look in solo play without a profile (bots get random ones). */
const YOUR_LOOK: RosterEntry['parts'] = { head: 'bear', body: 'bear', legs: 'chicken', tail: 'bear', accessory: 'frog' };
import type { GameSession, InputSource, RenderFrame } from './session.ts';

/** Longest real-time gap simulated in one frame; longer stalls (tab switch) are dropped. */
const MAX_FRAME_SECONDS = 0.25;

export interface LocalSessionOptions {
  seed: number;
  map?: MapData;
  botCount?: number;
  /** The local player's starting weapons (defaults to the sim's starting loadout). */
  loadout?: WeaponSpec[];
  /** Scales the Rinse's timings; 1 = as configured. */
  zoneTimeScale?: number;
  /** Bots only, nobody to control (the match behind the title menu). */
  watchOnly?: boolean;
  /** Your starting look (from your profile). */
  look?: RosterEntry['parts'];
}

export class LocalSession implements GameSession {
  readonly map: MapData;
  /** -1 when watching only. */
  readonly localPlayerId: EntityId;
  readonly ready = true;
  private readonly world: World;
  private state: GameState;
  private prev: GameState;
  private accumulator = 0;
  private events: GameEvent[] = [];
  /** Bots run here in single player; on the server in step 2. */
  private readonly bots: BotController;

  constructor(
    private readonly input: InputSource,
    { seed, map = BACKYARD, botCount = 15, loadout, zoneTimeScale = 1, watchOnly = false, look = YOUR_LOOK }: LocalSessionOptions,
  ) {
    this.map = map;
    this.world = createWorld(map);
    const roster: RosterEntry[] = [
      ...(watchOnly ? [] : [{ name: 'You', isBot: false, parts: look, ...(loadout ? { loadout } : {}) }]),
      ...Array.from({ length: botCount }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true })),
    ];
    this.state = createGame({ seed, map, roster, zoneTimeScale });
    this.bots = new BotController(seed);
    this.prev = structuredClone(this.state);
    this.localPlayerId = watchOnly ? -1 : this.state.players[0]!.id;
  }

  advance(dtSeconds: number): void {
    this.accumulator += Math.min(dtSeconds, MAX_FRAME_SECONDS);
    while (this.accumulator >= DT) {
      this.prev = structuredClone(this.state);
      const inputs = this.bots.inputs(this.world, this.state);
      if (this.localPlayerId !== -1) inputs.set(this.localPlayerId, this.input.sample());
      step(this.world, this.state, inputs);
      this.events.push(...this.state.events);
      this.accumulator -= DT;
    }
  }

  frame(): RenderFrame {
    return { prev: this.prev, curr: this.state, alpha: this.accumulator / DT };
  }

  takeEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}
