-- One-time codes that move a device's profile to the game's new address (a browser keeps its
-- token per address). Made on the old address, claimed on the new one within a few minutes;
-- `prefs` carries the small local settings (name, map, sound) along.
CREATE TABLE IF NOT EXISTS transfers (code TEXT PRIMARY KEY, profile_id TEXT NOT NULL, prefs TEXT NOT NULL, expires_at INTEGER NOT NULL);
