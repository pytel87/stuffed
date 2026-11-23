// Player profiles in D1: one per device (a random token kept in the browser; only its hash is
// stored), plus a recovery code that adds another device to the same profile. A profile owns
// parts (its collection) and picks the look it starts every match in from them.
import { ANIMALS, awardOf, BUTTONS, COMMON_ANIMALS, PART_SLOTS, setOffer } from '@stuffed/sim';
import type { Animal, ButtonAward, ButtonLine, Part, PartSlot, Rarity } from '@stuffed/sim';
import type { Look, OwnedEntry, Profile } from '@stuffed/sim/net';

export type { Look, OwnedEntry, Profile };

// The tables are made by the numbered files in migrations/ (applied before the server starts).

// ---------- codes and tokens ----------

/** No 0/O or 1/I, so a code read aloud or copied by hand still works. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** "k7pm 3xqd", "K7PM3XQD" and "K7PM-3XQD" are the same code. */
export function normalizeCode(input: string): string | null {
  const chars = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (chars.length !== 8 || [...chars].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- validation of untrusted input ----------

function isPartOf(slot: unknown, animal: unknown, rarity: unknown): boolean {
  return (
    PART_SLOTS.includes(slot as PartSlot) &&
    ANIMALS.includes(animal as Animal) &&
    Number.isInteger(rarity) &&
    (rarity as number) >= 0 &&
    (rarity as number) <= 4
  );
}

/** A full look from a request, or null. */
export function parseLook(value: unknown): Look | null {
  if (!value || typeof value !== 'object') return null;
  const look = {} as Look;
  for (const slot of PART_SLOTS) {
    const p = (value as Record<string, Record<string, unknown> | undefined>)[slot];
    if (!p || !isPartOf(slot, p.animal, p.rarity) || (p.holo !== undefined && typeof p.holo !== 'boolean')) return null;
    look[slot] = { animal: p.animal as Animal, rarity: p.rarity as Rarity, ...(p.holo === true ? { holo: true } : {}) };
  }
  return look;
}

// ---------- profiles ----------

/** A new profile: a random look of common animals, which is also its first five parts. */
export async function createProfile(db: D1Database): Promise<{ token: string; profile: Profile }> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const look = {} as Look;
  for (const slot of PART_SLOTS) look[slot] = { animal: COMMON_ANIMALS[Math.floor(Math.random() * COMMON_ANIMALS.length)]!, rarity: 0 };
  const token = randomToken();
  // A clash on the recovery code is very unlikely; just try another.
  for (let attempt = 0; ; attempt++) {
    const recovery = randomCode();
    try {
      await db.batch([
        db.prepare('INSERT INTO profiles (id, recovery, look, created_at) VALUES (?, ?, ?, ?)').bind(id, recovery, JSON.stringify(look), now),
        db.prepare('INSERT INTO tokens (token_hash, profile_id, created_at) VALUES (?, ?, ?)').bind(await hashToken(token), id, now),
        ...addPartStatements(db, id, PART_SLOTS.map((slot) => ({ slot, ...look[slot] })), now),
      ]);
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
  return { token, profile: (await loadProfile(db, id))! };
}

export async function profileIdForToken(db: D1Database, token: string): Promise<string | null> {
  if (!token) return null;
  const row = await db.prepare('SELECT profile_id FROM tokens WHERE token_hash = ?').bind(await hashToken(token)).first<{ profile_id: string }>();
  return row?.profile_id ?? null;
}

export async function loadProfile(db: D1Database, id: string): Promise<Profile | null> {
  const row = await db.prepare('SELECT id, recovery, look FROM profiles WHERE id = ?').bind(id).first<{ id: string; recovery: string; look: string }>();
  if (!row) return null;
  const [plain, holo, balance] = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT slot, animal, rarity, count FROM owned_parts WHERE profile_id = ? ORDER BY slot, animal, rarity').bind(id),
    db.prepare('SELECT slot, animal, rarity, count FROM owned_holo WHERE profile_id = ? ORDER BY slot, animal, rarity').bind(id),
    db.prepare('SELECT COALESCE(SUM(delta), 0) AS buttons FROM buttons WHERE profile_id = ?').bind(id),
  ]);
  const parts = [...(plain!.results as unknown as OwnedEntry[]), ...(holo!.results as unknown as OwnedEntry[]).map((p) => ({ ...p, holo: true }))];
  return { id: row.id, recovery: row.recovery, look: JSON.parse(row.look) as Look, parts, buttons: Number(balance!.results[0]?.buttons ?? 0) };
}

/** How long a transfer code lasts: the hop from the old address to the new one takes seconds. */
const TRANSFER_MS = 5 * 60_000;

/**
 * A one-time code for taking this profile (and `prefs`, the device's small local settings) to the
 * game's new address. Long and random, unlike a recovery code: it travels in a link.
 */
export async function startTransfer(db: D1Database, id: string, prefs: Record<string, string>): Promise<string> {
  const code = randomToken();
  const now = Date.now();
  await db.batch([
    // (Old ones go while we're here.)
    db.prepare('DELETE FROM transfers WHERE expires_at < ?').bind(now),
    db.prepare('INSERT INTO transfers (code, profile_id, prefs, expires_at) VALUES (?, ?, ?, ?)').bind(code, id, JSON.stringify(prefs), now + TRANSFER_MS),
  ]);
  return code;
}

/** Uses up a transfer code: this device gets its own token for that profile, and the settings. */
export async function claimTransfer(db: D1Database, code: string): Promise<{ token: string; profile: Profile; prefs: Record<string, string> } | null> {
  if (!/^[\w-]{20,64}$/.test(code)) return null;
  const row = await db
    .prepare('DELETE FROM transfers WHERE code = ? AND expires_at >= ? RETURNING profile_id, prefs')
    .bind(code, Date.now())
    .first<{ profile_id: string; prefs: string }>();
  if (!row) return null;
  const token = randomToken();
  await db.prepare('INSERT INTO tokens (token_hash, profile_id, created_at) VALUES (?, ?, ?)').bind(await hashToken(token), row.profile_id, Date.now()).run();
  const profile = await loadProfile(db, row.profile_id);
  return profile ? { token, profile, prefs: JSON.parse(row.prefs) as Record<string, string> } : null;
}

/** Adds this device to the profile with that recovery code; returns a token for it. */
export async function recoverProfile(db: D1Database, code: string): Promise<{ token: string; profile: Profile } | null> {
  const clean = normalizeCode(code);
  if (!clean) return null;
  const row = await db.prepare('SELECT id FROM profiles WHERE recovery = ?').bind(clean).first<{ id: string }>();
  if (!row) return null;
  const token = randomToken();
  await db.prepare('INSERT INTO tokens (token_hash, profile_id, created_at) VALUES (?, ?, ?)').bind(await hashToken(token), row.id, Date.now()).run();
  return { token, profile: (await loadProfile(db, row.id))! };
}

/** Changes the look; every part of it must be in the collection. */
export async function setLook(db: D1Database, id: string, look: Look): Promise<Profile | null> {
  const profile = await loadProfile(db, id);
  if (!profile) return null;
  const owns = (slot: PartSlot) =>
    profile.parts.some((p) => p.slot === slot && p.animal === look[slot].animal && p.rarity === look[slot].rarity && !!p.holo === !!look[slot].holo);
  if (!PART_SLOTS.every(owns)) return null;
  await db.prepare('UPDATE profiles SET look = ? WHERE id = ?').bind(JSON.stringify(look), id).run();
  return { ...profile, look };
}

/** Puts kept parts into the collection (a part kept again counts up). */
export async function addParts(db: D1Database, id: string, parts: readonly Part[]): Promise<void> {
  if (parts.length === 0) return;
  await db.batch(addPartStatements(db, id, parts, Date.now()));
}

function addPartStatements(db: D1Database, id: string, parts: readonly Part[], now: number): D1PreparedStatement[] {
  return parts.map((p) =>
    db
      .prepare(
        `INSERT INTO ${p.holo ? 'owned_holo' : 'owned_parts'} (profile_id, slot, animal, rarity, count, first_at) VALUES (?, ?, ?, ?, 1, ?) ` +
          'ON CONFLICT (profile_id, slot, animal, rarity) DO UPDATE SET count = count + 1',
      )
      .bind(id, p.slot, p.animal, p.rarity, now),
  );
}

// ---------- Buttons ----------

/** The start of today (UTC), for the daily bonus and the solo cap. */
function dayStart(now: number): number {
  return now - (now % 86_400_000);
}

/**
 * Puts a match's Buttons on the profile, once per `ref` (the match, and the player in it), with the
 * day's first-win bonus. Matches are all played on the server, so the lines are its own count.
 * Returns what was actually given, and the new balance.
 */
export async function awardButtons(db: D1Database, id: string, lines: readonly ButtonLine[], ref: string): Promise<{ award: ButtonAward; balance: number }> {
  const now = Date.now();
  const day = await db
    .prepare("SELECT COUNT(*) AS daily FROM buttons WHERE profile_id = ? AND created_at >= ? AND reason LIKE '%:dailyWin'")
    .bind(id, dayStart(now))
    .first<{ daily: number }>();
  const given = [...lines];
  if (given.some((l) => l.reason === 'win') && !day?.daily) given.push({ reason: 'dailyWin', amount: BUTTONS.dailyWin });
  const toGive = awardOf(given).lines;
  // Only what actually went in (a match counted again adds nothing, and says so).
  const results = toGive.length
    ? await db.batch(
        toGive.map((l) =>
          db.prepare('INSERT OR IGNORE INTO buttons (profile_id, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, l.amount, `match:${l.reason}`, `${ref}:${l.reason}`, now),
        ),
      )
    : [];
  const award = awardOf(toGive.filter((_, i) => (results[i]?.meta.changes ?? 0) > 0));
  const balance = await db.prepare('SELECT COALESCE(SUM(delta), 0) AS b FROM buttons WHERE profile_id = ?').bind(id).first<{ b: number }>();
  return { award, balance: balance?.b ?? 0 };
}

export type BuyResult = { profile: Profile } | { error: 'locked' | 'nothing_missing' | 'too_few_buttons' | 'no_profile' };

/**
 * Buys the parts missing from one animal's set (or holo set) with Buttons. All at once or not at
 * all: the charge only goes through if the balance covers it, and the parts only come with the
 * charge. `requestId` makes a repeated request (a double tap, a retry) count once.
 */
export async function buySet(db: D1Database, id: string, animal: Animal, holo: boolean, requestId: string): Promise<BuyResult> {
  const profile = await loadProfile(db, id);
  if (!profile) return { error: 'no_profile' };
  const ref = `shop:${id}:${requestId}`;
  const offer = setOffer(profile.parts, animal, holo);
  if (offer.locked) return { error: 'locked' };
  if (offer.missing.length === 0) return { profile };
  const now = Date.now();
  const charged = 'EXISTS (SELECT 1 FROM buttons WHERE ref = ?)';
  await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO buttons (profile_id, delta, reason, ref, created_at) ' +
          'SELECT ?, ?, ?, ?, ? WHERE (SELECT COALESCE(SUM(delta), 0) FROM buttons WHERE profile_id = ?) >= ?',
      )
      .bind(id, -offer.price, `shop:${holo ? 'holo' : 'set'}:${animal}`, ref, now, id, offer.price),
    ...offer.missing.map((slot) =>
      db
        .prepare(`INSERT OR IGNORE INTO ${holo ? 'owned_holo' : 'owned_parts'} (profile_id, slot, animal, rarity, count, first_at) SELECT ?, ?, ?, 0, 1, ? WHERE ${charged}`)
        .bind(id, slot, animal, now, ref),
    ),
  ]);
  const paid = await db.prepare('SELECT 1 AS ok FROM buttons WHERE ref = ?').bind(ref).first();
  if (!paid) return { error: 'too_few_buttons' };
  return { profile: (await loadProfile(db, id))! };
}
