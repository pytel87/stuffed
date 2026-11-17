# Changelog

Newest first. Each entry is one runnable step of roadmap step 1 ("Toy in a box").

## Step 1.2: Shooting (2026-11-17)

- Sim: Cork Popper, Foam Dart SMG and Super Soaker (7-pellet cone with knockback) as
  visible, dodgeable projectiles. Magazines, auto and manual reload (R), fire rate,
  spread, range. 2 weapon slots with a short swap delay (1, 2, mouse wheel).
- Rarity tiers in config: +8/16/24/32% damage and faster reloads.
- Damage: buttons absorb first, then stuffing; 0 stuffing eliminates (placement recorded);
  the match ends when one plush is left.
- Projectiles use a swept-circle test so they can't skip through a plush between ticks.
- Client: held weapon models with a rarity-colored band and recoil, projectile models with
  trails, cotton puffs, button bits, water splashes, knockout burst, hit flash, damage
  numbers, HUD (stuffing, buttons, weapon slots, ammo, reload bar).
- Plush arms: stretchy arms with mitten hands on the shared rig, dyed to the body part.
  They hold each weapon at its grip points (two-handed SMG and Super Soaker) and swing
  when the hands are free.
- Shots leave from the barrel tip: the sim's `muzzlePosition()` (weapon held to the
  shooter's right, barrel length per weapon) places projectiles, the gun model and muzzle
  effects, and the client aims from the muzzle so shots cross the cursor.
- Test loadout via `?loadout=` URL parameter until chests arrive.
- Tests: armor, elimination and win, fire rate, reload, rarity, pellet cone, swapping,
  muzzle position, hits, dodging, range, no self-hits, knockback, sweep test; the determinism
  test now fires.

## Step 1.1: Movement (2026-11-17)

- pnpm monorepo: `packages/sim`, `packages/client`, `apps/server` (placeholder), strict TypeScript, Vite, Vitest.
- Sim: full state types (players, projectiles, chests, loot, zone, inputs), seeded sfc32 RNG,
  `createGame` and a fixed 30 Hz `step`. Movement with acceleration and map bounds; input sanitizing.
- Tunables in `packages/sim/src/config.ts`.
- Client: three.js with a 3-tone toon shader, felt texture and inverted-hull outlines.
  Local session with a fixed-tick loop and render interpolation.
- Plush rig with 5 part sockets and placeholder parts (3 heads, 4 bodies, 2 legs, 2 tails,
  3 accessories); walk cycle with squash and stretch, bob, lean and leg swing.
- Camera: 60° top-down follow that leans toward the cursor.
- Test map: 80 × 80 felt lawn with hedge bounds; 1 player + 15 idle plushies.
- Debug overlay on F1: FPS, tick, position, speed, hitbox rings.
- Tests: RNG, movement (speed, diagonal, stopping, bounds, aim), input sanitizing, determinism.
