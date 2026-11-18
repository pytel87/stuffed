import type { EntityId, GameEvent, GameState, Input, MapData } from '@stuffed/sim';

/** Produces one Input per sim tick (keyboard + mouse today; gamepad later). */
export interface InputSource {
  sample(): Input;
}

/** Two consecutive sim states plus how far between them (0..1) the render time is. */
export interface RenderFrame {
  prev: GameState;
  curr: GameState;
  alpha: number;
  /**
   * Online: the moment your own plush is drawn at (prediction runs ahead of the others, which are
   * drawn a little in the past). Things that are pure clockwork, like the toy train, are drawn
   * then too. Unset: the same moment as everything else.
   */
  nowTick?: number;
}

/**
 * What the renderer and UI talk to. LocalSession runs the sim in the browser (step 1);
 * a NetworkSession backed by Colyseus implements the same interface in step 2.
 */
export interface GameSession {
  readonly map: MapData;
  /** Your plush, or -1 when you only watch. */
  readonly localPlayerId: EntityId;
  /** False until there is something to draw (a network match waits for its first snapshot). */
  readonly ready: boolean;
  /** Advance real time; runs as many fixed sim ticks as are due. */
  advance(dtSeconds: number): void;
  frame(): RenderFrame;
  /** Events from every tick since the last call (a frame can span several ticks). */
  takeEvents(): GameEvent[];
  /** Plushies still in the match, seen or not (online, the state holds only those in sight). */
  playersLeft(): number;
  /** Any player's name, seen or not. */
  playerName(id: EntityId): string;
}
