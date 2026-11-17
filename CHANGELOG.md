# Changelog

Newest first. Each entry is one runnable step of roadmap step 1 ("Toy in a box").

## Step 4.3: Four new items, hit direction (2026-11-17)

- Big Stuffing Bag (full stuffing, 8 s), Juice Box (+5 stuffing/s for 10 s and 15% faster),
  Bouncy Ball (an instant dash where you move, with a hop) and Cardboard Wall (stands up in front
  of you for 20 s; blocks plushies and shots until shot down; up to 3 each, only from the lawn).
  Placed walls count everywhere a wall does (movement, shots, line of sight, standing on top) and
  are sent to clients like the other slow parts. Models, effects and sounds for all four.
- Hit direction: when you're hit, a red arc around your plush points to where it came from
  (back along the shot, the burst, the swinger), even if the shooter is hidden.
- The invisible stop at the yard's edge moved far out into the water: the Rinse's foam is the
  edge of play.
- Burst rings add light so they read bright on the grass.

## Textures and fixes (2026-11-17)

- More detailed surfaces: a mottled lawn with grass blades, sand with ripples and pebbles, soil
  with clods and roots, wood with grain and knots, bricks and roof tiles in varied tones,
  speckled stepping stones. The picnic tablecloth is now blue gingham with a red hem, unlike the
  red-check blanket under the table. The felt circles on the lawn are gone.
- The open-chest prompt and the opening bar show the exact chest (plain, toy, royal, basket).
- Fixed: flickering on the house roof and lines poking through roofs and the tablecloth. Walls
  that reach up to a roof are drawn just under it.

## Step 4.2: Five new weapons, nicer chests, model pictures (2026-11-17)

- Rubber Band Rifle (hold to draw, release to fire; stronger and faster the longer you held,
  a red aim line while drawing, slower walking meanwhile), Marble Launcher (marbles bounce off
  walls twice, then burst for area damage and knockback; never hurts you), Pillow Hammer (a
  swing that bonks everyone in front and knocks them away), Glitter Bomb (lobbed in an arc to
  where you aim, over low cover; the burst blinds everyone inside for 3 s; two per pickup) and
  Bubble Wand (traps whoever it hits in a bubble for 1.5 s: no moving, shooting or looting).
  Bots use all of them. 15 new sounds generated with ElevenLabs.
- Chests by loot level: a plain wooden one, the red toy chest with a domed lid and a star latch,
  a royal blue and gold one, and a picnic basket. They're hollow (empty when open), and toy
  chests glow from under the lid until opened. The three old weapons got chunkier models.
- The HUD, prompts and results card show pictures of the real 3D models (weapons, items, skin
  parts), rendered once at startup.
- No fence around the yard: the lawn carries on, plushies can wander 12 units past the edges, and
  the Rinse is the real limit.

## Step 4.1: The Backyard map (2026-11-17)

- The first real map, 128 x 128: a house with four doors, rooms and a rain barrel up to its roof,
  and six zones around it: Treehouse (a platform reached by crate steps), Tool Shed (tight plank
  rooms), Kiddie Pool (water slows you to 60%), Picnic Plateau (a table to climb via the benches),
  Sandbox Desert (open sand and sandcastles) and Veggie Jungle (planters and bushes). Spawns on
  two rings, kept clear of walls and water.
- Chests have a loot level (low, medium, high, food); high gives rarer loot, food more healing.
- Walls and roofs have a look of their own: brick, planks, crates, a barrel, a tree trunk,
  benches, sandcastles, a bucket, planters, beach balls, a picnic basket; tiled, tin, plank and
  tablecloth roofs. Ground patches: sand, dirt, a picnic blanket, wooden floors, stepping stones.
  A kiddie pool with an inflatable rim and a rubber duck.
- Fixed: you could pick up loot (and open chests) on the level below, e.g. from a roof. Loot now
  lies on the surface it landed on and pickups need it within reach of your feet.
- Tests: map sanity (spawns and chests clear of walls), wading, loot levels, climbing the
  treehouse and the house roof, roof reach, drops on a roof, and a full bot match on the map.

## Step 3.2: Keeping parts: profiles and the Wardrobe (2026-11-17)

- A profile per device, created on the first visit: a random token in the browser (the server
  stores only its hash) and a random Hand-me-down look, which is also its first five parts.
  Profiles and collections live in Cloudflare D1; the tables are created on first use.
- After a match you keep the parts you carried: all of them if you won, otherwise each by its
  rarity's chance (100/60/35/15/5%). Online the room rolls and saves this and tells you; solo
  matches report from the browser. The results card shows the kept parts.
- The Wardrobe (hanger on the title menu): a turning preview of your plush, one row per slot to
  flip through owned parts, and the recovery code; entering a code on another device puts the
  same profile there. Rooms start you in your look.
- Head icons show each animal (ears, eye bumps, fin, comb and beak).
- API: `POST/GET /api/profile`, `PUT /api/profile/look`, `POST /api/profile/recover`,
  `POST /api/profile/solo`.

## Gentler bots and full-set glow (2026-11-17)

- Bots spend the first 20 seconds looting and only fight back if hurt. After that they react
  more slowly, aim worse, lead moving targets less, pause longer between bursts and ignore
  passers-by unless closer than 4.5 units. Measured over 30 seeds, a plush that just stands
  still now survives a median of 59 s instead of 19 s (worst 22 s instead of 8 s), the first
  knockout comes at about 26 s instead of 10 s, and a match runs about 4 minutes.
- A plush wearing all five parts of one animal glows: a pool of light in the animal's color
  underfoot and a pulsing tint. Hidden with the plush in bushes and under roofs.

## Step 3.1: Patchwork parts (2026-11-17)

- Four animals (Bear, Frog, Shark, Chicken) with a part for each of the five slots: 20 parts.
  New models: chicken head, flipper and fin legs, pom tail, lily-pad backpack, shark tail,
  feather fan and an egg-shell hat.
- Parts have a rarity. Every chest pops a part, which floats over a neon ring in its rarity
  color. E puts it on (a found part it replaces drops); Q stashes it in the one stash slot; Q
  with nothing in reach puts the stashed part on. On touch, tap the sack in the prompt, or the
  stash slot next to the stuffing bar.
- Unstitched plushies drop the parts they found and their stash; a plush's own starting look
  never drops. Bots put on any part rarer than what they wear.
- Ground loot rings are neon with a soft glow.
- Fixed: on wide screens (phones in landscape) the lawn could cover everything when standing
  in the building. The lawn is now drawn in tiles.
- HUD buttons (weapons, items, stash) take taps above the touch sticks.
- Network protocol version 2 (parts are part of the state now).
- Tests: wearing, stashing, swapping, drops on knockout, sets, and a bot dressing up.

## Mobile play and a new look (2026-11-17)

- Plays on phones and tablets. Twin sticks appear under your thumbs: left half moves, right
  half aims, and a longer drag shoots. There are Jump and Grab buttons; Grab lights up when
  there's something to pick up. Tap a weapon card to switch to it (tap the one in hand to
  reload), and tap an item to use it. Aim assist snaps to a visible plush within 15°. Touch
  mode turns on with a touch and off when a mouse moves.
- Landscape layout with safe-area insets (notches) and a "turn your phone" screen in portrait.
  Fullscreen (with a landscape lock on Android) is in ⚙. A web app manifest and icons let the
  game be added to the home screen.
- Phones render at up to 1.5x with smaller shadow maps. The camera backs off on screens
  narrower than 16:9.
- UI rework with almost no text: icon set in the game's style, stitched cards for the menu,
  lobby, results and help, and the ⚙ sheet (sound, fullscreen, controls, leave).
- HUD: a single stuffing bar with buttons as a blue coat over it; ammo is a thin strip along
  the bottom of the weapon card in its rarity color (it drains as you shoot and refills while reloading); hotkeys are plain digits.
  The E / Grab prompt and the opening bar float over the chest or weapon in the scene.
- Results show placement, the knocker's weapon and name, and knockouts, damage and time as
  icons.

## Step 2.4: Smaller updates and deploy setup (2026-11-17)

- Compact snapshots (`encodeSnapshot` / `decodeSnapshot` in `@stuffed/sim/net`): every
  update carries your own plush in full, other visible plushies with only what drawing needs,
  projectiles with only position, motion and height, and events. Chests, loot, the zone's
  plan, names and looks, and knocked-out plushies are sent only when they change for that
  player; the client keeps them and computes the zone circle from the tick. Typical update
  with 4 plushies in view: about 2.6 KB instead of 8.2 KB (about 37 KB/s per player).
- One Worker serves the client too: `pnpm run deploy` builds the client and runs
  `wrangler deploy --assets`. In production the client connects to the host that served it;
  the Worker always accepts its own origin.
- Tests: snapshot round trip over a whole bot match, size, slow parts sent once.

## Smoother frames (2026-11-17)

- Adaptive resolution: if frames average slower than ~48 fps, the render resolution steps
  down (2x → 1.75 → … → 1x on Retina screens). `?quality=high` keeps full resolution.
- About 25% fewer draw calls: belly stitches merged (one mesh instead of 16 per plush), lawn
  felt patches merged by color, tiny parts (eyes, stitches, teeth) no longer cast shadows.
- The full-screen water shader is skipped while no water is in view.
- No more mid-match freezes the first time something appears: at startup every plush part,
  weapon, loot look, projectile, particle and see-through material is drawn once so its
  shader is compiled and linked (measured: a 600 ms stall when the first crowned bot came
  into view is gone).
- F1 shows draw calls, triangles, render scale, shader count and JS time per frame, and logs
  frames slower than 100 ms with the newest shader.

## Step 2.3: Title menu and lobby (2026-11-17)

- Title menu: your name (remembered), Play solo, Create a room, Join with a 4-letter code.
  A bots-only match plays behind the menu and the lobby and restarts by itself.
- Lobby: editable name (server `rename` message), invite link, Leave. The end card has a
  Menu button. Invite links still go straight to the lobby; `?solo` skips the menu.
- Hotkeys are ignored while typing in a text field.

## Step 2.2: Client prediction (2026-11-17)

- Sim: `predictPlayer()` moves one plush by one input exactly as `step()` would (aim,
  movement, collisions, jumps, bushes, roofs). A test replays unconfirmed inputs from a
  confirmed state and lands exactly where the server does.
- Client: your plush is predicted. Each input is applied locally the moment it's sent; each
  snapshot's confirmed state (the last input the server applied) is taken and the inputs
  still in flight are re-applied on top. Differences under 3 units fade out smoothly; bigger
  ones snap. Your plush is drawn at the predicted present, everyone else ~130 ms in the past.
- `?lag=MS` fakes network round trip on localhost. With 300 ms of lag, movement now tracks the
  keys like a local game (measured: same position curve as with no lag).
- Shots and hits are still confirmed by the server, so your own shots appear after the round
  trip.

## Step 2.1: Online rooms on Cloudflare (2026-11-17)

- Game server in `apps/server`: a Cloudflare Worker with one Durable Object per room
  (partyserver), modeled on partyhub's room server. `POST /create` hands out a free 4-letter
  room code; sockets connect at `/parties/room/CODE`; optional origin allow-list.
- Rooms: up to 10 plushies. Seats are kept per tab across reconnects; the first connected
  seat is host. The host picks how many bots fill the room and starts the match; after a
  match the host starts the next one. Late joiners watch.
- The room runs the sim at 30 Hz with a catch-up loop, one input per player per tick (a short
  queue; late inputs repeat what was held; after half a second without input a player stands
  still), and the bots. Every 2 ticks each player gets a snapshot with only the plushies
  their plush can see, plus the events since the last one. Floats are rounded in JSON.
- Shared protocol in `@stuffed/sim/net`.
- Client: `?online` creates a room, `?room=CODE` joins one, plain URL is solo. Lobby card
  with the invite link, players, host badge, bot count and Start. `NetworkMatch` draws about
  130 ms behind the newest snapshot, interpolating between snapshots, and sends inputs at
  30 Hz. End-of-match card shows "Waiting for host…" for non-hosts.
- `pnpm dev` runs client and server together; `pnpm dev:lan` exposes both on the home network.
- Your own plush still moves only when the server says so; client prediction is next.

## Sound effects (2026-11-17)

- 23 sound effects generated with the ElevenLabs sound-generation API from prompts in
  `tools/sfx.json` (`pnpm sfx`; key in git-ignored `.env.local`): weapon shots, hits on
  stuffing and buttons, wall impacts and splashes, knockouts, chest rattle and pop, pickups,
  healing and armor, reload, weapon swap, jump and landing, the Rinse rising, soggy squelch,
  win and lose stings, UI click.
- Web Audio playback: heard from the camera, distance falloff and stereo pan, pitch
  variation, at most 5 overlapping copies per sound. Loads on the first click or key press
  (browser autoplay rules). M mutes; remembered per browser.
- Sounds come from sim events plus frame-to-frame changes the sim has no event for (jumps,
  landings, reloads, swaps, starting to open a chest).

## Step 1.7: Win and lose (2026-11-17) — roadmap step 1 complete

- Sim: players track `knockouts`, `damageDealt` (no credit for overkill) and
  `eliminatedBy`; the Rinse gets no credit.
- Knocked out: an "Unstitched!" card with your placement, who knocked you out and with what
  (or the Rinse), knockouts, damage dealt and time survived. Play again (Enter) or Spectate.
- Spectating: the camera follows whoever knocked you out, then whoever knocks them out, or the
  nearest plush left; your HUD hides and a bar shows who you watch and how many are left.
  What's visible follows the spectated plush's view (bushes, roofs).
- Winning: a "Last plush standing!" card with confetti. If you were already out when the
  match ends, the card shows who won.
- Play again starts a fresh match with a new seed in place (no page reload): the renderer
  clears the old match's plushies, chests, loot and projectiles and snaps the camera.
- Tests: damage dealt, knockouts, killer, no credit for the Rinse.

## Step 1.6: Bots (2026-11-17)

- `BotController` in the sim: bots are input producers, deterministic with a per-bot seeded
  RNG, so the server can run them unchanged.
- Behavior: loot first (chests, better weapons, items they have room for), heal when hurt
  and calm, head back inside when the Rinse is close, wander inside the circle otherwise.
  Fight anyone within 6 units, anyone who just hurt them, and farther targets only when well
  armed (scaled by a per-bot aggression); stick with a fight while the target stays visible;
  keep a preferred distance per weapon, strafe, hop now and then, retreat to heal when low.
  Aim with reaction time, partial leading and wobble; fire in bursts.
- Movement: steer around tall walls, jump low ones, detour when stuck.
- Test map: spawns spread to two rings (about 15+ units apart).
- An all-bot 16-player match now lasts about 1.5 to 2 minutes on the test map.
- HUD: no pickup prompt or progress bar after you're knocked out.
- Tests: determinism, looting, no getting stuck, shooting close enemies, ignoring far ones
  with only the starter weapon, ignoring hidden enemies, returning to the circle, a full
  match to one winner.

## Fix: shots from the roof (2026-11-17)

- Roofs are now floors and ceilings for shots: a shot fired from a roof skims it, clears
  the room's walls and only then dips toward its target (it used to sink into the room and
  hit the far wall from inside); a shot fired under a roof can't rise through it.
- A shot that only touches a plush's feet (e.g. skimming under a roof someone stands on)
  no longer counts as a hit.

## Step 1.5c: Jumping and heights (2026-11-17)

- Space jumps (apex about 1.5, about 0.6 s in the air; exact constant-gravity integration).
  A fresh press is needed: no double jumps, no auto-jump while held. No jumping under a roof.
- Obstacles have heights: toy blocks 2.0 (too tall), cardboard room walls 1.4, books 1.2,
  chests 0.75. You jump over or onto anything low enough, walk along wall tops, stand on
  chests, and walk on the room's roof (being on the roof is not being inside). Ledges up
  to 0.2 are stepped onto without jumping.
- Shots fly at a height: they start at the shooter's chest and angle (at most 0.6 per unit)
  toward chest height over the surface under the aimed-at point, then fly level. They only
  hit plushies, walls and chests they overlap vertically: a jump dodges a level shot,
  chests and low walls are cover, a shot from a ledge clears low cover and hits players
  below, and a shot up at a ledge hits from range. The input aim vector now carries the
  aim distance.
- Plushies only push each other when they overlap in height; jumping high leaves a bush.
- Client: plush drawn at its height, legs tucked in the air, stretch on take-off and squash
  with a dust puff on landing, a soft shadow blob on the surface below that shrinks with
  height, shots drawn at their height, walls drawn at their data heights with the roof lid
  level with the wall tops, the camera rises with the floor you stand on, height in the
  debug overlay.
- Tests: apex and landing, fresh press, clearing low walls but not blocks, standing on and
  falling off walls, standing on chests, roofs, bushes, dodging shots, shooting from and up
  at ledges, cover; the determinism test now jumps.

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
