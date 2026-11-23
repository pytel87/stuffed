-- Accounts: a parent signs in with Google and links the kids' profiles to it, so they're safe and
-- come back on any device. One account, any number of profiles; a profile, at most one account.
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (provider, subject));
ALTER TABLE profiles ADD COLUMN account_id TEXT;
CREATE INDEX IF NOT EXISTS profiles_account ON profiles (account_id);
