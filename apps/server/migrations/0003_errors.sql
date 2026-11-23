-- What went wrong on players' devices (and in the server): sent by the game, kept 30 days, read
-- with `pnpm errors`. No player data: what failed, the game's build, the page and the browser.
CREATE TABLE IF NOT EXISTS errors (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, detail TEXT NOT NULL, build TEXT NOT NULL, page TEXT NOT NULL, agent TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS errors_at ON errors (at);
