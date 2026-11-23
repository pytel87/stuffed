-- The tables as they were created on first use before migrations (hence IF NOT EXISTS: the live
-- database already has them). From now on every change is a new numbered file here, applied by
-- `pnpm run deploy` (remotely) and `pnpm dev` (locally) before the server starts.

-- Profiles: one per player, a recovery code to add devices, the look they start matches in.
CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, recovery TEXT NOT NULL UNIQUE, look TEXT NOT NULL, created_at INTEGER NOT NULL);
-- Each device's token (only its hash), and whose profile it opens.
CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL, created_at INTEGER NOT NULL);
-- The collection: every part kept, and how many times.
CREATE TABLE IF NOT EXISTS owned_parts (profile_id TEXT NOT NULL, slot TEXT NOT NULL, animal TEXT NOT NULL, rarity INTEGER NOT NULL, count INTEGER NOT NULL, first_at INTEGER NOT NULL, PRIMARY KEY (profile_id, slot, animal, rarity));
-- Holographic parts, kept apart.
CREATE TABLE IF NOT EXISTS owned_holo (profile_id TEXT NOT NULL, slot TEXT NOT NULL, animal TEXT NOT NULL, rarity INTEGER NOT NULL, count INTEGER NOT NULL, first_at INTEGER NOT NULL, PRIMARY KEY (profile_id, slot, animal, rarity));
-- Buttons: every one earned or spent is a row (the balance is their sum); `ref` names what it was
-- for, once, so the same match or purchase can't be counted twice.
CREATE TABLE IF NOT EXISTS buttons (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id TEXT NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, ref TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS buttons_profile ON buttons (profile_id, created_at);
