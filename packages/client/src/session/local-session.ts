import { BotController, createGame, createWorld, DT, DEFAULT_PARTS, step, TEST_MAP } from '@stuffed/sim';
import type { EntityId, GameEvent, GameState, MapData, RosterEntry, WeaponSpec, World } from '@stuffed/sim';
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
}

export class LocalSession implements GameSession {
  readonly map: MapData;
  readonly localPlayerId: EntityId;
  private readonly world: World;
  private state: GameState;
  private prev: GameState;
  private accumulator = 0;
  private events: GameEvent[] = [];
  /** Bots run here in single player; on the server in step 2. */
  private readonly bots: BotController;

  constructor(
    private readonly input: InputSource,
    { seed, map = TEST_MAP, botCount = 15, loadout, zoneTimeScale = 1 }: LocalSessionOptions,
  ) {
    this.map = map;
    this.world = createWorld(map);
    const roster: RosterEntry[] = [
      { name: 'You', isBot: false, parts: DEFAULT_PARTS, ...(loadout ? { loadout } : {}) },
      ...Array.from({ length: botCount }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true })),
    ];
    this.state = createGame({ seed, map, roster, zoneTimeScale });
    this.bots = new BotController(seed);
    this.prev = structuredClone(this.state);
    this.localPlayerId = this.state.players[0]!.id;
  }

  advance(dtSeconds: number): void {
    this.accumulator += Math.min(dtSeconds, MAX_FRAME_SECONDS);
    while (this.accumulator >= DT) {
      this.prev = structuredClone(this.state);
      const inputs = this.bots.inputs(this.world, this.state);
      inputs.set(this.localPlayerId, this.input.sample());
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
