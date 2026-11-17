// Messages between browser and game server (JSON over WebSocket). Shared so both sides agree.
import type { EntityId, GameEvent, GameState, Input } from '../types.ts';

export const PROTOCOL_VERSION = 1;
/** Plushies per match, humans and bots together. */
export const MAX_PLAYERS = 10;
/** The server sends a snapshot every this many ticks (2 = 15 per second). */
export const SNAPSHOT_EVERY = 2;

/** Room codes: 4 consonants (no accidental words; no I, L, O, U, Y). About 130k codes. */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKMNPQRSTVWXZ';
export const ROOM_CODE_LENGTH = 4;

export function generateRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  return code;
}

/** Uppercases and trims; null if it can't be a valid code. */
export function parseRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

export type ClientMessage =
  /** First message on every connection. `token` identifies the seat across reconnects. */
  | { t: 'hello'; v: number; name: string; token: string }
  /** One per client tick (30 per second) while playing. */
  | { t: 'input'; i: Input }
  /** Host only: start a match (from the lobby or after one ends). */
  | { t: 'start'; bots: number }
  /** Change your name in the lobby. */
  | { t: 'rename'; name: string }
  | { t: 'ping'; c: number };

export interface LobbySeat {
  seat: number;
  name: string;
  connected: boolean;
  host: boolean;
}

export type RoomPhase = 'lobby' | 'playing' | 'ended';

export type ServerMessage =
  | { t: 'welcome'; code: string; seat: number | null }
  | { t: 'lobby'; phase: RoomPhase; seats: LobbySeat[]; bots: number }
  /** A match started; `you` is your plush, or null when you only watch. */
  | { t: 'start'; mapId: string; you: EntityId | null }
  /**
   * The match as you can see it: `s` is a GameState with only the plushies visible to you
   * (and its RNG blanked); `ev` are the events since the last snapshot.
   */
  | { t: 'snap'; s: GameState; ev: GameEvent[] }
  | { t: 'pong'; c: number; s: number }
  | { t: 'error'; code: 'version' | 'full' | 'not_host' | 'bad_message' };

/** Rounds floats so snapshots stay small (millimeter precision is plenty). */
export function compactJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
}
