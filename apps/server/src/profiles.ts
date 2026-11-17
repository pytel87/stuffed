// Player profiles in D1: one per device (a random token kept in the browser; only its hash is
// stored), plus a recovery code that adds another device to the same profile. A profile owns
// parts (its collection) and picks the look it starts every match in from them.
import { ANIMALS, PART_SLOTS } from '@stuffed/sim';
import type { Animal, OwnedPart, Part, PartSlot, Rarity } from '@stuffed/sim';

export type Look = Record<PartSlot, OwnedPart>;

/** A part in the collection, and how many times it was kept (duplicates become Thread later). */
export interface OwnedEntry extends Part {
  count: number;
}

export interface Profile {
  id: string;
  recovery: string;
  look: Look;
  parts: OwnedEntry[];
}

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, recovery TEXT NOT NULL UNIQUE, look TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS owned_parts (profile_id TEXT NOT NULL, slot TEXT NOT NULL, animal TEXT NOT NULL, rarity INTEGER NOT NULL, count INTEGER NOT NULL, first_at INTEGER NOT NULL, PRIMARY KEY (profile_id, slot, animal, rarity))',
];

let schemaReady: Promise<void> | null = null;

/** Creates the tables on first use (cheap no-ops after that), so there's no migration step. */
function ensureSchema(db: D1Database): Promise<void> {
  schemaReady ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).then(
    () => undefined,
    (err: unknown) => {
      schemaReady = null;
      throw err;
    },
  );
  return schemaReady;
}

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

/** A list of parts from a request, or null if anything in it is off. */
export function parseParts(value: unknown, max: number): Part[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const parts: Part[] = [];
  for (const p of value as Record<string, unknown>[]) {
    if (!p || !isPartOf(p.slot, p.animal, p.rarity)) return null;
    parts.push({ slot: p.slot as PartSlot, animal: p.animal as Animal, rarity: p.rarity as Rarity });
  }
  return parts;
}

/** A full look from a request, or null. */
export function parseLook(value: unknown): Look | null {
  if (!value || typeof value !== 'object') return null;
  const look = {} as Look;
  for (const slot of PART_SLOTS) {
    const p = (value as Record<string, Record<string, unknown> | undefined>)[slot];
    if (!p || !isPartOf(slot, p.animal, p.rarity)) return null;
    look[slot] = { animal: p.animal as Animal, rarity: p.rarity as Rarity };
  }
  return look;
}

// ---------- profiles ----------

/** A new profile: a random Hand-me-down look, which is also its first five parts. */
export async function createProfile(db: D1Database): Promise<{ token: string; profile: Profile }> {
  await ensureSchema(db);
  const id = crypto.randomUUID();
  const now = Date.now();
  const look = {} as Look;
  for (const slot of PART_SLOTS) look[slot] = { animal: ANIMALS[Math.floor(Math.random() * ANIMALS.length)]!, rarity: 0 };
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
  await ensureSchema(db);
  const row = await db.prepare('SELECT profile_id FROM tokens WHERE token_hash = ?').bind(await hashToken(token)).first<{ profile_id: string }>();
  return row?.profile_id ?? null;
}

export async function loadProfile(db: D1Database, id: string): Promise<Profile | null> {
  await ensureSchema(db);
  const row = await db.prepare('SELECT id, recovery, look FROM profiles WHERE id = ?').bind(id).first<{ id: string; recovery: string; look: string }>();
  if (!row) return null;
  const { results } = await db
    .prepare('SELECT slot, animal, rarity, count FROM owned_parts WHERE profile_id = ? ORDER BY slot, animal, rarity')
    .bind(id)
    .all<OwnedEntry>();
  return { id: row.id, recovery: row.recovery, look: JSON.parse(row.look) as Look, parts: results };
}

/** Adds this device to the profile with that recovery code; returns a token for it. */
export async function recoverProfile(db: D1Database, code: string): Promise<{ token: string; profile: Profile } | null> {
  const clean = normalizeCode(code);
  if (!clean) return null;
  await ensureSchema(db);
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
  const owns = (slot: PartSlot) => profile.parts.some((p) => p.slot === slot && p.animal === look[slot].animal && p.rarity === look[slot].rarity);
  if (!PART_SLOTS.every(owns)) return null;
  await db.prepare('UPDATE profiles SET look = ? WHERE id = ?').bind(JSON.stringify(look), id).run();
  return { ...profile, look };
}

/** Puts kept parts into the collection (a part kept again counts up). */
export async function addParts(db: D1Database, id: string, parts: readonly Part[]): Promise<void> {
  if (parts.length === 0) return;
  await ensureSchema(db);
  await db.batch(addPartStatements(db, id, parts, Date.now()));
}

function addPartStatements(db: D1Database, id: string, parts: readonly Part[], now: number): D1PreparedStatement[] {
  return parts.map((p) =>
    db
      .prepare(
        'INSERT INTO owned_parts (profile_id, slot, animal, rarity, count, first_at) VALUES (?, ?, ?, ?, 1, ?) ' +
          'ON CONFLICT (profile_id, slot, animal, rarity) DO UPDATE SET count = count + 1',
      )
      .bind(id, p.slot, p.animal, p.rarity, now),
  );
}
