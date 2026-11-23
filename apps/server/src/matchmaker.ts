// "Play online": one Durable Object for everyone that knows which public room is filling up. A
// player asking for a match gets its code; when it starts (or fills) the room says so, and the next
// player gets a fresh one. Kept in memory only: if this object restarts it just opens a new room.
import { DurableObject } from 'cloudflare:workers';
import { generateRoomCode } from '@stuffed/sim/net';
import { getServerByName } from 'partyserver';
import type { Room } from './room.ts';

/** Where new rooms live (as in index.ts: near the players). */
const ROOM_LOCATION: DurableObjectLocationHint = 'weur';

export class Matchmaker extends DurableObject<Env> {
  /** The public room taking players now. */
  private open: string | null = null;
  /** A room being opened (two players asking at once get the same one). */
  private opening: Promise<string> | null = null;

  /** The code of a public room to join. */
  async find(): Promise<string> {
    if (this.open) return this.open;
    this.opening ??= this.openRoom().finally(() => (this.opening = null));
    return this.opening;
  }

  /** A room stopped taking players (it started, or filled up). */
  async closed(code: string): Promise<void> {
    if (this.open === code) this.open = null;
  }

  private async openRoom(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = generateRoomCode(Math.random);
      const stub = await getServerByName<Env, Room>(this.env.Room, code, { locationHint: ROOM_LOCATION });
      if (await stub.claimPublic()) {
        this.open = code;
        return code;
      }
    }
    throw new Error('no_free_code');
  }
}
