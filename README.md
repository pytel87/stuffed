# STUFFED

A top-down cartoon battle royale. Players are patchwork stuffed-animal plushies stitched from
swappable parts; they loot toy chests and fight until one is left while a soapy flood
("The Rinse") shrinks the safe zone.

Roadmap step 1, **Toy in a box**, is complete: a single-player browser prototype where you
loot, fight 15 bots and outlast the Rinse. Next is step 2, **Online brawl** (Colyseus).

## Run it

Needs Node 22.12+ (or 20.19+) and pnpm 10.

```sh
pnpm i && pnpm dev
```

This starts the game client (Vite, usually http://localhost:5173) and the game server
(Cloudflare Worker via `wrangler dev` on port 1999). Then:

- Open http://localhost:5173: the title menu has **Play solo** (15 bots, in your browser),
  **Create a room** and **Join** with a code. A room's lobby shows its invite link
  (`?room=CODE`); the host picks the bots and presses Start. Bots fill up to 10 plushies.
- Shortcuts: `?solo` starts a solo match, `?online` creates a room, `?room=CODE` joins one.
- **Other computers at home:** run `pnpm dev:lan` and open the client from the other machine
  with this computer's local IP (e.g. http://192.168.1.20:5173/?room=CODE).

`pnpm dev:solo` runs only the client. Add `&lag=150` to an online URL to fake 150 ms of
network round trip on localhost.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Client dev server with hot reload |
| `pnpm test` | Sim unit tests (Vitest) |
| `pnpm typecheck` | Strict TypeScript check of every package |
| `pnpm build` | Production build of the client into `packages/client/dist` |

## Sound

Sound effects are MP3s in [packages/client/public/sfx](packages/client/public/sfx), generated
with the ElevenLabs sound-generation API from the prompts in [tools/sfx.json](tools/sfx.json).
The game only plays the files; the API is only called by the generator:

```sh
cp .env.example .env.local   # then put your ELEVEN_LABS_API_KEY in it (git-ignored)
pnpm sfx                     # generates any sound that has no file yet
pnpm sfx --force cork_pop    # regenerates one (e.g. after editing its prompt)
```

Playback is plain Web Audio ([audio/sound.ts](packages/client/src/audio/sound.ts)): sounds
are heard from the camera, fade with distance, pan left/right and vary slightly in pitch.

## The Backyard

Matches are played on the Backyard
([packages/sim/src/maps/backyard.ts](packages/sim/src/maps/backyard.ts)), 128 x 128: a house in
the middle with a door on every side and a rain barrel to climb onto its roof, and six zones
around it:

| Zone | Where | What's there | Chests |
| --- | --- | --- | --- |
| Treehouse | north-west | a plank platform on a trunk; hop up the crates; hide underneath | high |
| Tool Shed | north-east | tight plank rooms with doorways; a crate up to the roof | high |
| Kiddie Pool | east | shallow water slows you to 60%; a chest in the middle | medium |
| Picnic Plateau | south-east | a giant table to climb via the benches; hide under it | food (more healing) |
| Sandbox Desert | south-west | open sand, sandcastles, a bucket; long sightlines | medium |
| Veggie Jungle | west | planter rows to hop over, leafy bushes | low |

Chests have a loot level: high-level ones give rarer weapons and parts, low-level ones more
common ones, and food crates more healing items. Loot lies on whatever surface it landed on
(a plush knocked out on a roof drops its things there), and you can only pick up or open what's
within reach of your feet: not the lawn below from a roof. The old 80 x 80 test map
([test-map.ts](packages/sim/src/maps/test-map.ts)) stays for the tests.

## The Toss

Every match starts on a toy blimp flying across the yard. Press Jump (Space, or the jump button
on touch) to drop off and glide down under an umbrella, steering where you want to land. If you
don't, you're dropped when it reaches the far side.

## Bots

You play against 15 bots. For the first 20 seconds they only loot (and fight back if hurt).
After that they pick up better weapons and parts, heal when hurt, stay ahead of the Rinse, jump
low obstacles, and fight what they can see (with reaction time, imperfect aim and bursts). Their brain is in
[packages/sim/src/bots/brain.ts](packages/sim/src/bots/brain.ts); tuning knobs are in `BOT`
at its top. Bots only produce `Input`s, the same as a player, so the server can run them too.

## Controls

| Action | Key |
| --- | --- |
| Move | W A S D |
| Jump | Space |
| Aim | Mouse |
| Shoot | Left click (hold) |
| Switch weapon | 1, 2 or mouse wheel |
| Reload | R |
| Open a toy chest | Hold E (1 s) |
| Pick up a weapon | E (items are picked up by walking over them) |
| Put on a part | E |
| Stash a part / wear the stashed part | Q |
| Use an item | 3, 4, 5 |
| Debug overlay (FPS, draw calls, frame time, tick, hitboxes) | F1 |
| Play again (after the match or a knockout) | Enter |
| Mute / unmute sound | M |

### On a phone or tablet

Hold the device sideways (in portrait the game asks you to turn it). The ⚙ button has
fullscreen, which on Android also locks landscape; on iPhone, "Add to Home Screen" opens
the game fullscreen.

| Action | Touch |
| --- | --- |
| Move | Drag anywhere on the left half (a stick appears under your thumb) |
| Aim | Drag on the right half; a short drag aims, a longer one also shoots |
| Jump | Arrow button, bottom right |
| Open a chest / pick up a weapon / put on a part | Hand button (lights up when there's something to grab; hold it for chests) |
| Stash a part | Tap the sack in the floating prompt; tap the stash slot to wear what's in it |
| Switch weapon / reload | Tap a weapon card; tap the one in hand to reload |
| Use an item | Tap it |
| Sound, fullscreen, controls, leave | ⚙ top right |

With the aim stick held, aim snaps onto the nearest visible plush within 15° and 16 m.
With the aim stick idle, your plush faces where it walks. Touch controls turn on with the first touch
and off again when a mouse moves, so a laptop with a touchscreen works both ways.

### The screen

- The bar at the bottom (top-left on touch) is your stuffing. Buttons show as a blue coat
  along its top, and they soak hits first.
- The thin colored strip along the bottom of a weapon card is its ammo, in the weapon's rarity
  color. It drains as you shoot and refills in white while you reload.
- What E or the hand would do floats over the chest or weapon itself. The opening bar floats
  over the chest; the bar for using an item floats over your plush.
- The water drop at the top counts down to the Rinse. When you're in the water, a badge
  points back to dry land.

### Parts (Patchwork)

Every plush is stitched from five parts (head, body, legs, tail or back, accessory) of twelve
animals: Bear, Frog, Shark, Chicken, Dino, Owl, Axolotl, Penguin, Bunny, Unicorn, Cat and Fox.
Each chest also pops a part, floating over a ring. E puts it on. Q puts it in your one stash slot instead (it shows next to your
stuffing bar), and Q with nothing in reach swaps the stash with the part you wear in that slot.
When you're knocked out, only your weapons and items drop; the parts you found and your stash
go home with you. Bots drop their parts for others to take, and put on parts that build toward
a set. A plush wearing all
five parts of one animal glows in that animal's color. Parts never change stats or hitboxes.

### Keeping parts: profiles and the Wardrobe

Each device gets a profile on its first visit (no sign-up): a random token in the browser, and
a random look that is also its first five parts. Everyone keeps every part they carried
(found and still worn, or stashed), win or lose; the results card shows them. Online, the
room saves this; solo matches report it to the server from the browser.

The hanger next to your name on the title menu opens the Wardrobe: flip through the parts you
own for each slot to choose the look you start every match in. The gallery button in its corner
shows all twelve animals in full, with the parts you own lit up. It also shows the profile's
recovery code: typing it into the Wardrobe on another device puts the same profile there too.

Everyone starts with a Hand-me-down Cork Popper; better weapons and items come from toy
chests. To test a weapon without finding it, add `?loadout=kind:rarity,kind:rarity` to the
URL, for example
`?loadout=foam_dart_smg:2,super_soaker:4`. Kinds: `cork_popper`, `foam_dart_smg`,
`super_soaker`, `rubber_band_rifle`, `marble_launcher`, `pillow_hammer`, `glitter_bomb`,
`bubble_wand`; rarity 0 (Hand-me-down) to 4 (One-of-a-Kind).

| Weapon | How it works |
| --- | --- |
| Cork Popper | reliable starter pistol |
| Foam Dart SMG | fast, low damage, sprays |
| Super Soaker | wide cone with knockback |
| Rubber Band Rifle | hold to draw (a red line shows the aim), let go to fire; stronger the longer you held |
| Marble Launcher | marbles bounce off walls twice, then burst for area damage |
| Pillow Hammer | swing to bonk everyone in front and knock them away |
| Glitter Bomb | lob it where you aim; the burst blinds everyone in it for 3 s (2 per pickup) |
| Bubble Wand | traps whoever it hits in a bubble for 1.5 s |

| Item | What it does |
| --- | --- |
| Cotton Puff / Sewing Kit / Big Stuffing Bag | +15 (up to 75) / +50 / full stuffing |
| Button Pack | +25 buttons |
| Juice Box | +5 stuffing per second for 10 s, and a little faster |
| Bouncy Ball | an instant dash where you're moving |
| Cardboard Wall | a wall in front of you for 20 s, until it's shot down |

Add `?seed=123` to replay the same spawns and cosmetics (the debug overlay shows the current
seed), and `?zonescale=0.1` to run the Rinse 10x faster. Parameters combine:
`?seed=7&zonescale=0.1&loadout=foam_dart_smg:3`.

## Deploy

One Cloudflare Worker (`stuffed-rooms`) serves both the game files and the game rooms, so
there is one address and nothing else to host.

```sh
npx wrangler login   # once, with your Cloudflare account (wrangler whoami to check)
pnpm run deploy      # builds the client, then deploys the Worker with the client as its assets
```

Profiles live in a D1 database. Create it once and put its id in
[apps/server/wrangler.jsonc](apps/server/wrangler.jsonc) (`d1_databases`, replacing the zeros):

```sh
cd apps/server && npx wrangler d1 create stuffed
```

The tables are created on first use. `pnpm dev` uses a local copy of the database.

Wrangler prints the address; the current deployment is
https://stuffed-rooms.partyhub-vs.workers.dev. (Use `pnpm run deploy`: plain `pnpm deploy` is
a built-in pnpm command.)
Open it, create a room and send the invite link. Deploys disconnect matches in progress, so
deploy between games. To serve the client from somewhere else (e.g. Vercel), build it with
`VITE_SERVER_HOST=<worker host>` and add that site to `ALLOWED_ORIGINS` in
[apps/server/wrangler.jsonc](apps/server/wrangler.jsonc).

## Smoothness

The sim ticks 30 times a second but everything is drawn at your display's frame rate,
interpolated between ticks. If it still looks choppy, press F1 and check `fps`:

- **Exactly 30:** the browser is capping it. Chrome's Energy Saver (on battery, or Settings →
  Performance) and Safari's Low Power Mode limit pages to 30 fps; plug in or turn it off.
- **Below 50 and uneven:** the GPU is struggling. The game lowers its render resolution
  automatically (`gpu … x1.5` in F1); `?quality=high` keeps full resolution.

## Layout

```
packages/sim      Pure, deterministic game simulation. No DOM, no rendering, no Math.random.
packages/client   three.js renderer (toon shader), input, UI. Reads sim state, sends inputs.
apps/server       Authoritative game server: Cloudflare Worker + one Durable Object per room.
```

### How the pieces fit

- **Sim**: `createGame({ seed, map, roster })` builds a `GameState`;
  `step(world, state, inputs)` advances it one 30 Hz tick in place. `world` holds static map
  data that never changes during a match. Randomness comes from a seeded sfc32 RNG whose state
  lives inside `GameState`, so the same seed and inputs always produce the same game.
- **Tuning**: every gameplay number is in [packages/sim/src/config.ts](packages/sim/src/config.ts).
- **Client**: talks only to a `GameSession` (`advance`, `frame`). `LocalSession` runs the sim
  in the browser (solo); `NetworkMatch` plays a match from the server. Either way the renderer
  draws between two states (interpolation), so motion is smooth at any frame rate.
- **Server** ([apps/server](apps/server)): a Cloudflare Worker routes `/parties/room/CODE`
  sockets (partyserver) to that room's Durable Object. The room runs the same `step()` at 30 Hz
  with everyone's inputs and the bots, and sends each player a snapshot of what their plush
  can see 15 times a second. Messages are in
  [packages/sim/src/net/protocol.ts](packages/sim/src/net/protocol.ts).
- **Prediction**: online, your own plush moves the instant you press a key. The client applies
  each input with the sim's `predictPlayer()` (the same movement code the server runs), and on
  every snapshot re-applies the inputs the server hasn't confirmed yet on top of the confirmed
  state, smoothing away small differences. Everyone else is drawn slightly in the past,
  interpolated between snapshots.
- **Plush rig**: each player is one rig with 5 part sockets (head, body, legs, tail,
  accessory). Placeholder parts are built in code in
  [placeholder-parts.ts](packages/client/src/render/placeholder-parts.ts); real models replace
  them per slot without changing the rig.
- **Collision**: walls are boxes in a static spatial hash (`world.walls`); plushies and
  projectiles are circles. Movement substeps and slides along walls; projectiles use swept
  tests so nothing tunnels.
- **Hiding**: walls block bullets but not sight (the camera looks over them). You hide in
  bushes (until you shoot) and under roofs: a plush inside a building is hidden from everyone
  outside it, and that roof fades for whoever is inside. `canSee()` holds these rules; the
  client uses it to decide what to draw, and the server will use it to decide what to send.
- **Heights**: walls, chests and roofs have a top height. A plush (feet height `z`) is
  blocked by an obstacle only while its feet are below the top; above that it passes over or
  stands on it. Shots start at chest height and angle toward chest height over the surface
  under the cursor, then fly level; they hit only what they overlap vertically, so a jump can
  dodge them.
- **Units**: 1 world unit = 1 plush width. Sim `(x, y, z)` maps to three.js `(x, z, y)`.
