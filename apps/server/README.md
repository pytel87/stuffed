# @stuffed/server

Placeholder for roadmap step 2 ("Online brawl").

Plan: a Colyseus room that owns the authoritative `GameState` from `@stuffed/sim`,
collects `Input`s from clients and bots, calls `step()` at 30 Hz, and syncs state
(only what each player can see) back to clients.
