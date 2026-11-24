// Accounts: you sign in with Google (see google.ts) and link your profile to it, one profile per
// account. It's then safe: on any device, signing in again puts it on that device.
// Everything here is keyed by the verified Google identity, never by what the page claims.
import { completeSets } from '@stuffed/sim';
import type { Look, Profile, ProfileSummary } from '@stuffed/sim/net';
import type { GoogleIdentity } from './google.ts';
import { hashToken, loadProfile, randomToken } from './profiles.ts';

export interface Account {
  id: string;
  email: string;
}

/** The account for this Google identity, made the first time (its email kept up to date). */
export async function accountFor(db: D1Database, who: GoogleIdentity): Promise<Account> {
  const found = await db.prepare("SELECT id, email FROM accounts WHERE provider = 'google' AND subject = ?").bind(who.sub).first<Account>();
  if (found) {
    if (who.email && who.email !== found.email) await db.prepare('UPDATE accounts SET email = ? WHERE id = ?').bind(who.email, found.id).run();
    return { id: found.id, email: who.email || found.email };
  }
  const id = crypto.randomUUID();
  // (Two sign-ins at once: the second insert loses and reads the first's.)
  await db
    .prepare("INSERT INTO accounts (id, provider, subject, email, created_at) VALUES (?, 'google', ?, ?, ?) ON CONFLICT (provider, subject) DO NOTHING")
    .bind(id, who.sub, who.email, Date.now())
    .run();
  return (await db.prepare("SELECT id, email FROM accounts WHERE provider = 'google' AND subject = ?").bind(who.sub).first<Account>())!;
}

/** The account's profiles, oldest first, with enough to tell them apart. */
export async function accountProfiles(db: D1Database, accountId: string): Promise<ProfileSummary[]> {
  const { results } = await db.prepare('SELECT id FROM profiles WHERE account_id = ? ORDER BY created_at').bind(accountId).all<{ id: string }>();
  const out: ProfileSummary[] = [];
  for (const { id } of results) {
    const p = await loadProfile(db, id);
    if (p) out.push(summaryOf(p));
  }
  return out;
}

export function summaryOf(p: Profile): ProfileSummary {
  const plain = p.parts.filter((x) => !x.holo);
  return { id: p.id, look: p.look as Look, parts: new Set(plain.map((x) => `${x.slot}:${x.animal}`)).size, sets: completeSets(plain).length, buttons: p.buttons };
}

/**
 * Links a profile to the account: one profile per account. 'elsewhere' if the profile is already
 * another account's, 'taken' if the account already has another profile (play that one instead).
 */
export async function linkProfile(db: D1Database, profileId: string, accountId: string): Promise<'ok' | 'elsewhere' | 'taken'> {
  const other = await db.prepare('SELECT 1 AS ok FROM profiles WHERE account_id = ? AND id <> ?').bind(accountId, profileId).first();
  if (other) return 'taken';
  const res = await db.prepare('UPDATE profiles SET account_id = ? WHERE id = ? AND (account_id IS NULL OR account_id = ?)').bind(accountId, profileId, accountId).run();
  return res.meta.changes > 0 ? 'ok' : 'elsewhere';
}

/**
 * Merges this device's profile (not linked to any account) into the account's: its parts and holo
 * parts join (counts adding up), its Buttons' history moves over, every device that played it plays
 * the account's from now on, and it's gone. The account's look stays. Null if there's nothing to
 * merge into, or the profile is an account's.
 */
export async function mergeIntoAccount(db: D1Database, accountId: string, profileId: string): Promise<Profile | null> {
  const into = await db.prepare('SELECT id FROM profiles WHERE account_id = ? ORDER BY created_at LIMIT 1').bind(accountId).first<{ id: string }>();
  const from = await db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id IS NULL').bind(profileId).first<{ id: string }>();
  if (!into || !from || into.id === from.id) return null;
  const owned = (table: string) =>
    db
      .prepare(
        `INSERT INTO ${table} (profile_id, slot, animal, rarity, count, first_at) SELECT ?, slot, animal, rarity, count, first_at FROM ${table} WHERE profile_id = ? ` +
          'ON CONFLICT (profile_id, slot, animal, rarity) DO UPDATE SET count = count + excluded.count, first_at = MIN(first_at, excluded.first_at)',
      )
      .bind(into.id, from.id);
  await db.batch([
    owned('owned_parts'),
    owned('owned_holo'),
    db.prepare('DELETE FROM owned_parts WHERE profile_id = ?').bind(from.id),
    db.prepare('DELETE FROM owned_holo WHERE profile_id = ?').bind(from.id),
    db.prepare('UPDATE buttons SET profile_id = ? WHERE profile_id = ?').bind(into.id, from.id),
    db.prepare('UPDATE tokens SET profile_id = ? WHERE profile_id = ?').bind(into.id, from.id),
    db.prepare('DELETE FROM transfers WHERE profile_id = ?').bind(from.id),
    db.prepare('DELETE FROM profiles WHERE id = ? AND account_id IS NULL').bind(from.id),
  ]);
  return loadProfile(db, into.id);
}

export async function unlinkProfile(db: D1Database, profileId: string): Promise<void> {
  await db.prepare('UPDATE profiles SET account_id = NULL WHERE id = ?').bind(profileId).run();
}

/** Puts one of the account's profiles on this device: a token of its own. Null if it isn't theirs. */
export async function useProfile(db: D1Database, accountId: string, profileId: string): Promise<{ token: string; profile: Profile } | null> {
  const owned = await db.prepare('SELECT 1 AS ok FROM profiles WHERE id = ? AND account_id = ?').bind(profileId, accountId).first();
  if (!owned) return null;
  const token = randomToken();
  await db.prepare('INSERT INTO tokens (token_hash, profile_id, created_at) VALUES (?, ?, ?)').bind(await hashToken(token), profileId, Date.now()).run();
  return { token, profile: (await loadProfile(db, profileId))! };
}

/** Deletes the account and every profile linked to it, with all they hold. */
export async function deleteAccount(db: D1Database, accountId: string): Promise<void> {
  const owned = 'SELECT id FROM profiles WHERE account_id = ?';
  await db.batch([
    ...['owned_parts', 'owned_holo', 'buttons', 'tokens', 'transfers'].map((t) => db.prepare(`DELETE FROM ${t} WHERE profile_id IN (${owned})`).bind(accountId)),
    db.prepare('DELETE FROM profiles WHERE account_id = ?').bind(accountId),
    db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId),
  ]);
}
