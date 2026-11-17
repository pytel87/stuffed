# Changelog

Newest first. Each entry is one runnable step of roadmap step 1 ("Toy in a box").

## Step 1.5b: The Rinse rises without phases (2026-11-17)

- The Rinse no longer has phases: after a 60 s grace period the circle shrinks steadily for
  540 s from the whole map to a random final point (at least 25% of the map away from the
  edges). Damage while soggy ramps from 1 to 10 stuffing per second as it closes. Every
  later circle still lies inside every earlier one.
- The dashed next-circle ring is gone; the HUD shows "The Rinse rises in 0:42" and then
  "The Rinse closes in 7:12", and the soggy warning shows the current damage rate.
- `config.zone` is now `delay`, `duration`, `damagePerSecond.start/end` and
  `finalCenterMargin`.

## Step 1.5: The Rinse (2026-11-17)

- Sim: the safe circle shrinks in 5 phases (wait/shrink 120/90, 90/60, 60/45, 45/30,
  30/30 s; 10 minutes in total) to radii of 42/28/17/8/0% of the map's shorter side. Each
  next circle is random but always inside the current one and shown during the wait.
  Outside it you are soggy: 1/2/5/8/10 stuffing per second by phase (applied once a second,
  buttons don't protect) and 20% slower. When the last circle closes the water finishes
  everyone off, so the match always ends. All numbers in `config.zone`.
- `zone` events for each stage change; `createGame({ zoneTimeScale })` and `?zonescale=`
  for faster test runs.
- Client: soapy water shader outside the circle (wobbling foam edge, ripples, bubbles;
  plushies wade in it), dashed ring for the next circle, water dripping off soggy
  plushies, a top-center timer ("The Rinse moves in 1:23"), a soggy warning with an arrow
  toward safety, and pop-in announcements when the water starts moving.
- Tests: phase order and total time, next circle shown and reached exactly, nesting across
  25 seeds, countdown, damage per second ignoring buttons, soggy slowdown, time scale, and
  the closed Rinse deciding the winner.

## Step 1.4: Chests and loot (2026-11-17)

- Sim: 30 toy chests on the test map; they are solid. Hold E for 1 s within range to open
  one (releasing E, walking away, shooting or swapping cancels). It drops one weapon (kind
  and rarity rolled from config weights, rarity odds 50/28/15/6/1) and one item stack,
  tossed to either side of the opener.
- Pickup: walk over items to take them (stacking up to each item's max in 3 slots);
  press E near a weapon to take it into an empty slot or swap it with the active one.
- Items on keys 3-5: Cotton Puff (+15 stuffing, max 75, 1 s), Sewing Kit (+50, 4 s),
  Button Pack (+25 buttons, 2 s). You move at half speed while using one; shooting or
  swapping cancels it; useless items (e.g. healing at full) don't start.
- Knocked-out plushies drop every weapon and item they carried.
- Everyone starts with a Hand-me-down Cork Popper (`?loadout=` still overrides).
- Client: toy-box chests with a lid that rattles while opening and swings open, loot that
  pops in, floats and spins over a rarity-colored glow and ring (a light beam from Limited
  Edition up), item models, confetti and pickup effects, HUD item slots, an E prompt
  naming the weapon and rarity, and a progress bar for opening and using.
- Tests: opening, cancelling, solidity, rarity odds, weapon pickup and swap, item pickup
  and stacking, healing caps, use time, slowdown, knockout drops, chest placement; the
  determinism test now presses E and uses items.

## Step 1.3: Walls and collision (2026-11-17)

- Sim: walls as boxes in a static spatial hash. Plushies slide along walls (substepped, so
  strong knockback can't tunnel) and push each other apart. Projectiles stop at walls
  (new `impact` event); a barrel poking through a wall can't shoot through it.
- Hiding, "bushes and roofs" model: walls block bullets, not sight. `canSee()` hides a plush
  in a bush (unless it shot in the last 1.5 s or the viewer is within 1.5 units), a plush
  inside a building from anyone outside it, and anything beyond 30 units. Maps gain
  `buildings` (roofed areas); players track the building they stand in.
- Test map: a roofed cardboard room with 4 doors, a book L in each corner, 12 toy blocks,
  8 bushes.
- Client: walls styled by shape (letter blocks, cardboard with tape, books), a taped
  cardboard lid on the room that fades when you walk in (see-through in F1 debug), bushes
  that turn see-through while you stand in them, unseen plushies hidden, wall-impact puffs
  and splashes.
- `?seed=` URL parameter to replay a match setup; the seed shows in the debug overlay.
- Fix: the first frame could get a negative time step, which made plushies flash white.
- Tests: geometry, spatial hash vs brute force, blocking, sliding, no tunneling, push-apart,
  shots stopped by walls, bushes, roofs, range, reveal on shooting, clear spawns.

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
