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
}

/**
 * What the renderer and UI talk to. LocalSession runs the sim in the browser (step 1);
 * a NetworkSession backed by Colyseus implements the same interface in step 2.
 */
export interface GameSession {
  readonly map: MapData;
  readonly localPlayerId: EntityId;
  /** Advance real time; runs as many fixed sim ticks as are due. */
  advance(dtSeconds: number): void;
  frame(): RenderFrame;
  /** Events from every tick since the last call (a frame can span several ticks). */
  takeEvents(): GameEvent[];
}
