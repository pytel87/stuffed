# STUFFED

A top-down cartoon battle royale. Players are patchwork stuffed-animal plushies stitched from
swappable parts; they loot toy chests and fight until one is left while a soapy flood
("The Rinse") shrinks the safe zone.

This repo is at roadmap step 1, **Toy in a box**: a single-player browser prototype.

## Run it

Needs Node 22.12+ (or 20.19+) and pnpm 10.

```sh
pnpm i && pnpm dev
```

Then open the URL Vite prints (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `pnpm dev` | Client dev server with hot reload |
| `pnpm test` | Sim unit tests (Vitest) |
| `pnpm typecheck` | Strict TypeScript check of every package |
| `pnpm build` | Production build of the client into `packages/client/dist` |

## Bots

You play against 15 bots. They loot chests, pick up better weapons, heal when hurt, stay
ahead of the Rinse, jump low obstacles, and fight what they can see (with reaction time,
imperfect aim and bursts). Their brain is in
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
| Use an item | 3, 4, 5 |
| Debug overlay (FPS, tick, hitboxes) | F1 |

Everyone starts with a Hand-me-down Cork Popper; better weapons and items come from toy
chests. To test a weapon without finding it, add `?loadout=kind:rarity,kind:rarity` to the
URL, for example
`?loadout=foam_dart_smg:2,super_soaker:4`. Kinds: `cork_popper`, `foam_dart_smg`,
`super_soaker`; rarity 0 (Hand-me-down) to 4 (One-of-a-Kind).

Add `?seed=123` to replay the same spawns and cosmetics (the debug overlay shows the current
seed), and `?zonescale=0.1` to run the Rinse 10x faster. Parameters combine:
`?seed=7&zonescale=0.1&loadout=foam_dart_smg:3`.

## Layout

```
packages/sim      Pure, deterministic game simulation. No DOM, no rendering, no Math.random.
packages/client   three.js renderer (toon shader), input, UI. Reads sim state, sends inputs.
apps/server       Placeholder for the Colyseus authoritative server (roadmap step 2).
```

### How the pieces fit

- **Sim**: `createGame({ seed, map, roster })` builds a `GameState`;
  `step(world, state, inputs)` advances it one 30 Hz tick in place. `world` holds static map
  data that never changes during a match. Randomness comes from a seeded sfc32 RNG whose state
  lives inside `GameState`, so the same seed and inputs always produce the same game.
- **Tuning**: every gameplay number is in [packages/sim/src/config.ts](packages/sim/src/config.ts).
- **Client**: talks only to a `GameSession` (`advance`, `frame`). Today that is
  `LocalSession`, which runs the sim in the browser. In step 2 a Colyseus-backed session
  implements the same interface. The renderer draws between the last two ticks
  (interpolation), so motion is smooth at any frame rate.
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
