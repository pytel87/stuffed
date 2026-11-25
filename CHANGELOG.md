# Changelog

Newest first. Each entry is one runnable step of roadmap step 1 ("Toy in a box").

## One rarity palette (2026-11-25)

- Weapons, items and animals share one set of rarity colours, the bright ones the loot already
  glowed in: green, light blue, purple, yellow (grey for the starting weapons). A gun picked up
  shows in your slot, and on its stripe, in the colour it glowed in on the ground (the slots were
  a darker blue and an orange-gold). The ground's purple is the animals' purple too.

## New clothes in the warm-up (2026-11-25)

- Changing clothes in the Wardrobe while waiting in a room shows at once: your plush in the warm-up
  wears the new look (everyone sees it), not only from the next match.

## Patches in blue, two bars on phones (2026-11-25)

- Patches have a colour of their own, a denim blue: their icon, their bar (desktop and phones) and
  the numbers when they're hit. In yellow they were easily taken for Buttons (orange-gold).
- Health and patches are two bars. On desktop they stand one over the other, every row alike (its
  icon on the left, the bar, its number on the right, in columns that don't move as the numbers
  change), patches on top in a thinner bar; on phones the pill is two halves (health left,
  patches right, an ink line between). Patches no longer lie over the health in a strip of their
  own (on phones with a line through the heart and the numbers), and with none, the health bar no
  longer looks half empty.

## A quieter Rinse, tidier cards (2026-11-25)

- The Rinse starting to rise rings a little toy alarm bell, no longer a loud rush of water (which
  was never evened out with the other sounds and came out about three times louder than any of
  them); the bell is at the level of the game's other signals.
- The Controls card on touch screens: every note's words start in line (the icons beside them are
  different widths), clear of the card's close button, and the card opens over the room's card,
  not under it.
- The gallery fits a narrow screen: its card is no wider than the screen, so its corner buttons
  (the hanger, ×) aren't cut off, and the cards scroll from below them, not under them.
- The phone in the "turn your phone" hint is in the middle of the screen (it sat low).
- The new version's Načíst button is the same pill as Soukromí, Podmínky and Kontakt (in pink).

## Put Pluffs on the home screen (2026-11-24)

- On a phone or tablet in the browser, a full-screen button in the title menu's top left corner
  (like the gear in the right one). On Android it asks the system to install Pluffs (it then opens
  full screen from the home screen), or else just goes full screen; iPhones and iPads can't be
  asked, so it shows the steps in a card like the others (Sdílet, Přidat na plochu, open it from
  there; a page can't open Safari's own Share, the one with Přidat na plochu). It isn't there in the app on
  the home screen, on a computer, or while the page is full screen.

## The iPad app's bottom strip, gone (2026-11-24)

- The app on the home screen has an ordinary black status bar at the top (time, battery) and the
  game below it, down to the bottom edge. With the see-through status bar, iOS started the page
  under it but kept it a status bar short, and left a strip along the bottom the page couldn't
  reach (32 px on an iPad; nothing drawn could cover it).
- The pulled-back camera (the Toss, a lookout) no longer counts against the shadows: it sees half
  the map for a little while, and an iPad dropped its shadows over the blimp ride.

## Shadows come back (2026-11-24)

- The game no longer gives up shadows for a busy moment: it judges the typical frame over about
  four seconds (not the average of the last one and a half), so a crowd or a burst of effects
  doesn't count, only a device that really can't keep up. And it comes back: after a while of
  smooth play it steps up again (sharpness first, then shadows every other frame, then every frame).
  If a step up has to be taken back soon after, it stays where it is for the visit.

## A dark edge, and stats on tablets (2026-11-24)

- The page round the game, and the colour Safari tints its bars and the strip by the home bar
  with, is the dark plum of the veil between scenes, not lawn green: iPads still showed a green
  strip along the bottom.
- Opened from the home screen on an iPad, the game reaches the bottom edge: iOS drew it from under
  the see-through status bar but left it as short as if the bar were still there, so a strip that
  tall stayed uncovered at the bottom. The game and the veil now reach down over it. (Told by
  Apple's own flag or the standard display mode, whichever says so; ?stats shows which it is,
  with the page's and the screen's size.)
- Five quick taps on the menu's PLUFFS logo turn that panel on or off, remembered on the device
  (for the app on the home screen, whose address can't be changed).
- ?stats opens a small panel with the frame rate, the frame's time, how much of it is the game's
  own work, the draws, and the shadows and sharpness in use (F1's panel, without its see-through
  roofs and hitboxes), for checking a phone or tablet.

## Lighter plushies (2026-11-24)

- Each plush is drawn in about a quarter fewer pieces (about 37 instead of 48): the still pieces of
  a part or a toy gun that differed only in colour are now one mesh, each piece's colour kept on
  its corners. A crowd of 16 costs about 170 fewer draws a frame. Nothing looks different: every
  animal's and every weapon's and item's picture comes out the same, pixel for pixel. (The map's
  merged props and loot are lighter the same way.) Pieces that take only a little shadow no
  longer stay separate for it.

## No green strip on iPads (2026-11-24)

- The game fills the whole window on iPads: it was sized to Safari's "100% of the screen's height",
  which could come out a little short (after turning it, by the home bar), and the page's green
  showed in a strip along the bottom. It's now pinned to the window's edges, and resizes when
  Safari's visible area changes.

## Waiting shows (2026-11-24)

- Whatever waits on the server says so: the button pressed shows a small turning ring in place of
  its label (a code from another device, buying a set, Online, Sólo, a new room), and signing in,
  linking, merging, switching, unlinking or deleting the account dims the Profil card's top under
  one. Nothing in it can be pressed twice meanwhile. Only after a moment, so quick answers don't
  flash it. Google's button shows the ring too while it loads.

## Smoother on older phones and tablets (2026-11-24)

- When frames run slow, the game now gives up the sun's shadows before pixels: first it redraws
  them every other frame, then turns them off (the soft blob under each plush stays), and only then
  draws fewer pixels. Shadows draw much of the scene a second time; fewer pixels barely helped. The
  shadow steps last for the visit; the sharpness comes back with each new scene as before.
- The map's thousands of still pieces are placed once, not worked out again every frame, and the
  effects' spare particles waiting in their pools are skipped too (only what moves is updated).

## Health at a glance on phones (2026-11-24)

- On touch screens the health pill is a bar itself, like the desktop's: filled from the left in
  white as far as your stuffing reaches (red and glowing from 30), patches coating its top half,
  so how much is left reads at a glance mid-fight (it was the number alone).
- The patches count is always beside your health (faded at 0), not only once you have some. On
  phones the pill has a fixed width, split down the middle: heart and health centred in the left
  half, patch and count in the right.

## Joining a room's warm-up (2026-11-24)

- Friends joining a room got into its warm-up but saw only the menu's map, zoomed out and frozen,
  and their plushies stood still for everyone else. While the server looked their profile up, the
  warm-up's updates already went to them and counted as delivered; their page started afresh after
  that and never got the whole picture. A page starting a warm-up now gets everything again.
- The room card's rows (bots and their difficulty, maps) shrink a little to fit rather than running
  past the card's edge (Safari on an iPhone held sideways laid them out wider).

## The tick on the head (2026-11-24)

- Linked to Google, the Profil card shows the green tick on your head (as the menu's cloud button
  does), not before "Propojeno s", where it pushed that line out of line with the email.

## Turn your phone (2026-11-24)

- The "turn your phone" hint (a touch screen held upright) shows one phone turning sideways, holding
  there, then fading and starting over (it was two phones, upright and sideways, rocking).
- No bright green strip at the bottom under that hint on iPhones: under Safari's bottom bar the
  page is dark too while it shows.

## One profile per Google account, merging (2026-11-24)

- A profile linked to Google comes back only by signing in with Google: its code stops working
  ("Tenhle profil je propojený s Googlem, přihlas se přes Google."), and the Profil card no longer
  shows it. Odpojit brings the code back.
- While the merge question is up, the Profil card shows only it (the codes come back after), so it
  fits a phone held sideways.
- Shorter words on the Profil card: "Ulož si sbírku přes Google a budeš ji mít na každém
  zařízení.", "Tvůj kód pro jiné zařízení", "Kód z jiného zařízení"; merging: "… už má profil.",
  Přepnout or Spojit.
- A Google account holds one profile ("Přidat i tento profil" is gone; the server refuses a second
  one). Signing in on a device that played without it, when the account has its profile already,
  offers to merge them: "… už má profil. Spojit ho s tím na tomhle zařízení?", both shown (head,
  parts, sets, Buttons), then Přepnout (play only the account's; this device's stays as it is,
  under its code: a sibling's, say) or Spojit. Neither: the card's close button. Merged, the parts and holo parts of both are in the
  account's profile (counts adding up), its Buttons are both balances together, the account's look
  stays, and every device that played the other one plays the account's from then on.

## A set's colour in the Wardrobe (2026-11-24)

- Wearing a whole set, the Wardrobe's preview takes on a soft wash of the animal's rarity colour
  (green, blue, purple, gold); a whole holo set, the gallery's slowly moving rainbow. A mixed
  outfit stands on the plain green, as before.

## Wardrobe filters (2026-11-24)

- Once a part's list in the Wardrobe is long enough to scroll, filters sit over it, one over each
  column, as big as the slot buttons: a star in each rarity's colour (common, uncommon, rare,
  legendary: tap one to see only those, again to see all) and a rainbow star (only holo). They
  combine; one with nothing to show is greyed out. The list runs down to the bottom of the slot
  buttons beside it and fades out where there's more to scroll, like the gallery.
- The gallery's rarity stars and the filters' are one star, drawn with an ink outline.

## Quieter button clicks (2026-11-24)

- The click of the menus' buttons (the cards, ⚙, the spectate bar) is about half as loud.
- The title menu's tune is softer than the match music (0.12 against 0.2).
- Pirate Cove's sea is quieter still (under half of before), and so are the splashes of wading:
  yours a third quieter, others' about half (a crowd in the water made a constant splashing).

## A quieter sea and music (2026-11-24)

- Pirate Cove's water is gentler: the sea all round about half as loud, the waterfall, a current
  taking you and the pirate ship's bow wave a third quieter.
- The music is quieter on every map (and behind the menu), by about a third: there under the game,
  not over it.

## The Profil card like the menu (2026-11-24)

- The line between the Google account and the device code on the Profil card is the menu's pink
  stitching, across the whole card (it was a shorter grey line).
- Its Odpojit and Smazat účet are the usual big buttons, sharing the row like Online and Solo (they
  were small ones of their own).
- Its top: your head on the left, the account's words beside it ("Propojeno s …", "Přihlas se
  přes Google …"; they sat off-centre under the head), its buttons or Google's across under them.
- The Profil button, which is about signing in and keeping your collection safe, is a cloud (it
  was a person), the green tick for a linked account on its corner.
- Not signed in, Google's button sits beside the head, as wide as its place, with the words about
  it under both (it was a short button in the middle, under the words).
- The pink stitched lines (menu, Profil) sit as far from what's above them as from what's below,
  to the eye: the buttons' shadows count as part of a row, and words' empty room above and below
  their letters doesn't.

## Online first on the menu (2026-11-24)

- The title menu's play row: Online first, in pink, then a stitched line, then Solo with the map
  and bot level it's played with (Online's are the server's, so they sat misleadingly beside it).
  Stitched lines now part the card in three: you, playing, and rooms with friends.

## Online on a random map again, chests under loot (2026-11-24)

- A chest with a weapon or part lying on it can be opened: E picked up what lay there instead,
  and with both weapon slots full it swapped weapons on the spot forever (yours dropping where the
  new one lay). Nothing lands on a closed chest any more (a dropped weapon or part, a knocked-out
  plush's loot): it lands just beside it. And with loot and a chest both in reach, E goes for the
  nearer one, the chest on a tie; a weapon at your feet still comes first.
- Starting the mower (or the Snowy Park's plow) is always heard by whoever pressed its switch:
  standing at the far end of its run, it was out of earshot, so it started in silence. Its engine
  now starts from it or its switch, whichever is nearer.
- An Online match is played on a map picked at random when its room opens (as before), not on the
  map of whoever opened it; the warm-up shows it while everyone waits. Friends' rooms still use the
  host's map.

## A clearer team switch (2026-11-24)

- The room's team switch says which way the match will be played: "Všichni jako tým proti botům"
  with teams on, "Každý sám za sebe" with them off (it always said "Hrát v týmu proti botům").

## Smoother cards (2026-11-24)

- A room's card comes up once, whole and already docked to the side: it showed in the middle (or
  small, before the room said you're its host) and then jumped there, and it popped in a second
  time as the warm-up started.
- The title menu comes up with your Wardrobe, Profil and Buttons already on it (it waits for your
  profile, a moment and a half at most); they used to pop in after it, resizing the card.
- Going from one card to another (the menu to the Wardrobe or Profil, and back) no longer flashes
  the scene bright in between: the dark tint behind the cards is one layer, there while any card
  is.
- Cards settle in with a short, gentle fade and grow, without the bounce.

## A still menu, a veil between scenes, dancing (2026-11-23)

- The title menu's background is the chosen map, still, seen from well above its middle, not
  a bots' match playing behind it: drawn once, then left, so the menu costs a phone next to nothing.
- "Odejít z Multi?" is now "Odejít z místnosti?".
- Every change of scene goes through a dark veil: picking another map on the menu, Solo, Online,
  joining a room, its warm-up and its match starting, going back to the menu. The veil falls,
  the new scene is built and drawn behind it, and it lifts only once the picture is settled
  (textures in, the still backdrop done), so nothing flickers or pops in. The cards (menu, lobby,
  results) stay above it.
- A warm-up gathers everyone at one meeting spot near the middle of the map (open, dry ground: by
  the house in the Backyard, on Treasure Island, beside the frozen pond, not on it), standing in
  rings; a newcomer pops in beside the others with a burst of confetti, a pop and their animal's
  happy cry, so you see (and hear) friends arrive.
- A new friends' room's warm-up starts straight on the host's chosen map (it started in the
  Backyard and only moved there a moment later, or not at all on a slow connection).
- Sharper picture: the game drew fewer pixels after any slow moment (loading a map, a busy
  warm-up, the menu's backdrop) and never went back, so plushies could turn blurry for the rest of
  the visit. Each scene now starts at full resolution, and its first moments (while it loads)
  aren't held against it.
- The Rinse no longer closes in during a room's warm-up: the server kept it still, but players'
  screens worked the circle out from the clock, so a long wait showed the water rising.
- An Online match is played on the map of whoever opened its room (their pick on the menu), not
  one picked at random; who joins later plays there too.
- Messages on every card (a wrong room code on the menu, the shop, the Profil card) show the same
  way: a pill on the card's bottom edge that pops in and fades after a few seconds; the card no
  longer grows a line for them.
- The red push buttons (the air strike's, and the mower's switch by the Backyard's meeting spot)
  no longer flicker round the cap's base while you aim: a ready cap stood exactly on its grey
  collar, and the outline under it fought the collar's top as the camera moved. The cap now sits a
  little into the collar (one height for both buttons; the mower's switch kept the old one), and
  the collar takes no shadows (the cap's came out there as grainy specks). The sun's shadows also
  move toward and away from the sun in steps now (as they already did sideways), not gliding with
  the camera.
- Nothing to loot in a warm-up: the map's games (digs, treasure, the gallery, pins, goals) still
  work and cheer, but give no prize (nothing found there would be kept).
- Dance in a room's warm-up: B (or the music-note button on touch) starts your animal's dance for a
  few seconds, seen by everyone; pressing again, walking, jumping or shooting stops it. It's on the
  desktop Controls card.

## Warm-up in the lobby (2026-11-23)

- While a room fills up (friends' rooms and public ones), everyone in it is already on the map:
  run around, jump, shoot and try the toys while the others join, with names over the plushies.
  Nobody gets hurt (shots just push), there are no chests and no Rinse, and it never ends; the
  real match replaces it (with the blimp drop), and after it the warm-up comes back. The lobby
  card docks to the left meanwhile. The host's map pick moves the warm-up there; a public room
  warms up on the map it'll be played on.
- The game: a peaceful mode (no damage, chests, piñata, Rinse or winner) and players joining and
  leaving a game under way. Typing in a field (your name) no longer walks your plush.
- The title menu's friends' row (code to join, + to make a room) is set apart by a stitched seam.

## Accounts (2026-11-23)

- A Profil button on the title menu (next to the Wardrobe; a green tick once signed in) opens the
  Profil card: the profile's head, Sign in with Google, and below it, without a Google account, the
  recovery code and the field to enter one. (They were in the Wardrobe's key view, hard to find.)
- Players (or a parent for them) can link a profile to a Google account ("Pokračovat s Googlem"), so the collection is safe and comes back on any device: signing in there lists the
  account's profiles (siblings each have one) to play here, or adds this one too. A linked profile
  shows its account, with Unlink and Delete account (which removes all its profiles; it asks to
  sign in again first). The recovery code still works without an account.
- The server checks Google's ID token itself (its signature against Google's keys, that it's for
  this game, not expired); migration 0004 adds the accounts table. The privacy pages say what an
  account stores (the e-mail and Google's ID for it) and that Google handles the sign-in.
- Switched on by the Google client ID (GOOGLE_CLIENT_ID on the server, and in the page); until it's
  set, nothing shows.

## Solo on the server (2026-11-23)

- The desktop Controls card says what each key does in a few words (it was keys and pictures only),
  and lists the ones it was missing: the mouse wheel and G (drop the weapon).
- The aim stick on touch screens now matches the Controls card: a pink knob, a dashed ring where
  shooting starts, and gold while it shoots.
- The touch controls card shows a little phone screen: the left thumb walks, the right one aims
  (dragged further out, past a dashed ring, it shoots: the knob flashes gold), Jump and Grab by
  the right edge, the items along the top; the sticks move by themselves. Beside it, a short line
  each: the left thumb walks, the right one aims (further to shoot), Jump, Grab (hold for a
  chest), the bag (keep a part for later), and the items (tap to use, hold to drop).
- Solo matches are now played on the game server, like online ones (one player and 15 bots, started
  at once, no lobby), so what they earn (parts, Buttons) can't be made up; the browser no longer
  reports solo results (that endpoint is gone). They feel the same: the same prediction as online.
- Offline, or if the server can't, Sólo still plays a practice match right on the device; its card
  says it doesn't count toward the collection. Test runs (?seed, ?loadout, ?animal) are practice too.
- The guards on browser-reported solo Buttons (a minute between matches, 2000 a day) are gone with it.
- Buttons rebalanced toward fighting and surviving: chests give fewer (low 1-2, medium 2-3, food
  1-2, high 3-5; a piñata 10), a knockout gives 10 (was 5) and pops up as "+10" where they went
  down, and the HUD's counter shows what the match has earned so far, knockouts included. Sets cost
  twice as much: 40, 80, 160 or 400 a part by rarity (a full set 200, 400, 800 or 2000; holo ×3).

## Play online (2026-11-23)

- The game starts in the browser's language (Czech for Czech and Slovak browsers, English for
  everyone else), and a CZ/EN button in the ⚙ options switches it (from the menus, not mid-match:
  the page reloads in the other language). The choice is remembered.
- **Online** on the title menu: straight into a public match with whoever else is looking. It
  starts as soon as 8 players are in (or the room is full), or 30 seconds after the first one came,
  with bots filling the rest and a map picked at random; the waiting card counts down. After the
  match, Again finds the next one. No host, no invite code.
- Friends' rooms are still there: + next to the code field makes one (the old Multi), and the
  code or the link joins it.
- The server: a Matchmaker Durable Object hands out the public room that's filling up; a room
  tells it when it starts, and the next player gets a fresh one.

## Knowing when it breaks (2026-11-23)

- Privacy and terms pages in Czech and English (pluffs.cz/soukromi, /podminky, /privacy, /terms),
  as small buttons on the Controls card's bottom edge (⚙ → ?), with Kontakt (an e-mail to
  hello@pluffs.cz). They describe exactly what's stored on the device and the server, for how long, and how to
  have it deleted (with the recovery code).
- Crashes on players' devices (and failed calls to the game server: loading a profile, a solo
  result, a purchase, the move to pluffs.cz, a lost graphics context) are reported to the server:
  what failed, the build, the page and the browser, nothing about the player. A few per visit,
  each kind once. The server's own failures are kept the same way. Kept 30 days.
- `pnpm errors` lists the last day's reports, grouped, most frequent first.

## Pluffs (2026-11-23)

- Fixed: returning players' profiles didn't load (no Wardrobe, no Buttons) since the API was locked
  to the game's own pages: browsers send no Origin header on same-site GETs, and those were refused.
- The game is now called **Pluffs** (*Plush Battle Royale*): the menu's logo, the page title, the
  home-screen app name and the share text; the Bedroom's alphabet blocks spell it too. STUFFED was
  already taken by a teddy-bear shooter on Steam and Xbox. The code keeps its working name.
- Ready for the move to the game's own address: the old one sends each device over with a one-time
  code, so its profile (collection, Buttons, look) and settings (name, map, sound) come along.
  Switched on by VITE_CANONICAL_ORIGIN at build time; until then nothing moves.

## Getting ready for players (2026-11-23)

- A page left open while a newer game is deployed now says so: "Je tu nová verze hry" with a
  Načíst button, in the menus, the lobby and on the results card (never mid-match). Online, an
  outdated page is told to reload instead of just failing to join. Each build writes its id to
  version.json for this.
- Only the game's own pages (and listed origins) may call the API or open game sockets.
- Per-address limits on new profiles, new rooms, solo results and purchases (generous: a class or
  a family shares one address).
- The database's tables now come from numbered migrations (apps/server/migrations), applied before
  every deploy and every local server start, instead of being created on first use.

## Buttons and home maps (2026-11-23)

- Buttons (Knoflíky), a currency you earn in matches: every chest drops a few into your pocket
  (a high chest 8-12), a broken piñata 15, and the end of a match adds 5 for playing, more for knockouts, a top 5
  or top 3 finish, a win and the first win of the day. You keep what you found even when knocked
  out. The players-left count shows your pocket; the results card shows what the match earned (tap
  it for the breakdown); your balance sits on the menu card's corner. Online matches are counted by
  the server; solo ones (reported by the browser) earn the same, with two guards against scripts:
  none for a match reported within a minute of the last, and at most 2000 a day.
- Armor is now patches (záplaty), so it isn't mixed up with the Buttons: the Patch Pack and the
  Patch Bundle (a stack tied with a ribbon), sewn on with a stitching sound, a patch on the health
  bar's coat, and bits of fabric flying off when it takes a hit.
- A shop in the Wardrobe gallery: each animal's card offers to complete its set for Buttons (you
  pay only for the parts you're missing: 20, 40, 80 or 200 a part, by rarity), and a finished set offers its
  holo set (three times the price). Tap once to ask, again to buy. Any animal can be bought.
- Home maps: every animal has one, where its parts turn up four times as often, and legendaries
  only there (the unicorn in the Backyard, the dragon in the Bedroom, the yeti in the Snowy Park,
  the mermaid and phoenix in Pirate Cove). Each gallery card shows its animal's home map. Protocol 21.

## Sea folk (2026-11-21)

- Two new animals: the Otter (epic), a diver with a diving mask and snorkel, big orange flippers
  and a paddle tail; and the Mermaid (legendary), with curly sea-green
  hair, a seashell bikini top on a string of pearls, a crown of shells, a fish tail she hops on and a
  shimmering rainbow fin. Their own voices, set effects (bubbles; glittering splashes) and umbrellas.
  Protocol 20.
- A full set no longer tints the whole plush or glows on the ground (it shone too much, and lit up
  the ground under the blimp): a few twinkles in the set's color circle its head instead.
- The Penguin's white face and tummy are sewn on cleanly (they broke up in dark blotches at the edges).
- Cleaner plushies, whatever they're stitched from: an unbroken line where the head meets the body
  (also mid-run), tails outlined where they lie over the body, tummy patches and stitches lying flat
  (no more teeth along the sides), bee stripes that wrap round, a closed turtle shell, a tidy
  elephant blanket, a solid lily pad, a nightcap that sits right, no "face" on the flamingo's tail,
  tails that reach the Mermaid's slim back, and resting hands beside wide bodies instead of in them.

## Pirate Cove (2026-11-20)

- A fourth map: Pirate Cove, sandy islands in a shallow lagoon. Off the islands you wade (slowly).
  Treasure Island in the middle has the best loot among crates and casks; four big isles on the
  diagonals and four small ones between them have palms, bushes to hide in and chests. One small
  isle is rocky, with a lookout rock to climb; rocks lie out in the lagoon.
- A current slaloms round the whole map, in and out between the isles: wade into it and it carries
  you along, a quick but exposed way round. Its streaks show which way it flows. Protocol 19.
- A pirate ship sails round Treasure Island against the current: jump aboard from the water and
  ride its deck; the mast is cover from shots. It rings its bell when it's about to run you down,
  and its sails fade while you're on board so they don't hide the deck.
- The Shipwreck: an old wreck run aground on the south-west isle, a building to hide in with a
  high chest inside. Climb onto its deck for the cannon's button: it calls a volley of cannonballs.
- Sunken treasure: four golden chests sunk in the lagoon between the isles, glowing, bubbles
  rising; stand in the water and hold E to dig one up (slow and in the open, with the sharks about).
  Pirate Cove now has 32 chests like the other maps (10 high: in the huts, the caves, the wreck, on
  the volcano's summit...).
- Buried treasure (X marks the spot) on three isles, and a paper parrot piñata hanging off a
  broken mast on Treasure Island. Rowboats pulled up on the beaches; standalone palms (no hiding
  in those) as well as palms growing out of bushes.
- Every isle has its own landmark: a stepped volcano to climb on Volcano Isle (rivers of lava
  down its sides, a smoking lava pool on top round a little island with a chest; the lava
  burns, and you hop off it with a sizzle), a rocky cliff on Waterfall Isle with a waterfall into a pond (foam,
  ripples and mist where it lands), and a secret cave behind the falling water with a high chest, a
  striped lighthouse, Skull Rock, a big cartoon skull with glowing eyes and a cave inside (in through its toothy jaw, a high chest), two huts on
  Coconut Isle and one on Palm Isle.
- Catapults on the four small isles fling you toward Treasure Island; a zip line runs (both ways)
  between the lookout rock on Rocky Isle and the Shipwreck's deck. A thatched hut on Coconut Isle
  to hide in (a chest inside, its roof climbable from a crate). Rocks have a craggy, lichen-spotted
  look.
- The lighthouse's lookout: E at its door takes you up inside for 10 s (Jump or E to come down early).
  Up there nobody sees you or can hit you, you can't shoot either, and the camera pulls right back
  so you see far round (2.2x your usual sight). One at a time (a ring round its foot fills while someone's up there).
- Wading, plushies sit waist-deep in the water, a ring of ripples round them (in the Backyard's pool
  too).
- Four sharks cruise the lagoon (hunting from 10 s in), their fins showing and their
  dark shapes swaying under the water: they sniff out anyone wading,
  chase them a little faster than you can wade (a dun-dun warns you), lunge up jaws first and bite
  (12 damage, a shove and a splash), then swim off to rest. Get to land, or into the current, to
  escape. They swim round the pirate ship. Bots swim away from them.
- Pirate Cove has its own music (a jolly sea shanty), sand footsteps, the sea lapping all round,
  a gull now and then, the waterfall's rush as you near it, a whoosh as the current takes you,
  and the paper parrot squawks when hit.
- The toy train (and the ship) now turn smoothly along their track instead of in small steps.

## Victory lap (2026-11-19)

- Knocking out the last plush no longer ends the match on the spot: the winner (or winning team)
  gets an 8 s victory lap to grab the loot, with confetti, the win tune and a banner right away;
  nobody can be hurt during it. Standing still, the winner dances (hops, wiggles and spins). The
  results come up when it's over. Protocol 16.
- Online lobby: the bot count sits on the face of a big robot between − and + (it was a small
  icon off to the side).
- The leave dialog asks in words ("Leave the match?", or "Leave the room?" between matches)
  instead of a house and a question mark.
- Online, the lobby's and the results card's leave buttons ask before you give up your seat in
  the room (solo, the results card still goes straight to the menu).
- Backyard: the lawnmower's lane is mowed short, a lighter striped strip with wheel tracks, so you
  can see where it'll drive (the snowplow already had its plowed lane).
- Behind the menu and the lobby, 4 bots play instead of 9 (lighter on phones).
- On touch, no second jump button in the middle while on the blimp or a zip line: the jump
  button drops you.
- First-time tips, each once per device as a toast when it matters: the controls card on your
  very first match, then how to open a chest, put on or bag a part, use an item, what you take
  home, the Rinse rising; after a match, what a set is, that a complete one unlocks holo parts,
  and where the gallery is.
- Toasts: red only for danger on its way (an air strike, the mower, the plow); tips and who won
  show in the calm cream pill of the area names, and stay up as long as they're meant to.
- The lobby's team toggle: two blue plushies for teams, one red one for everyone on their own
  (it was the same picture, just faded).
- The lobby's Wardrobe button shows up once your profile is ready (a first visit opened the lobby
  before it, and the button never appeared); the code's box is the same size and shape as the
  name field under it. Fields in narrow rows shrink to fit (on phones the Wardrobe button stuck out
  past the card's padding).
- The same spacing and the same "picked" look on every screen: every card has the same space
  between its edge and its content on all four sides (a little less on phones); buttons side by
  side or in a group of picks sit equally apart (the menu, lobby, wardrobe, gallery, options), and anything chosen
  (a wardrobe slot, the part you wear, the bots, the map) turns yellow with a pink border, keeping
  its size and place. Icons on pink buttons are white, like their text.
- The Multi lobby, redone: the code under "Invite friends: send them this code" in a ticket box
  (tap it to copy) with Share beside it; your name and wardrobe; "Bots" with one-tap picks (0 · 5
  · 10 · Max: as many as fit, fewer as friends join) and the difficulty on the right; "Map" with
  every map side by side, the chosen one picked out; "Players 2/16" over who's in (wrapping
  before the team toggle beside them); Start. On a phone in landscape it's two columns: the invite, bots and map on the left;
  your name, who's in and Start on the right (for a guest: the code beside the name, who's in
  across both underneath, and the wait for the host centered). Leaving asks "Leave Multi?" (it asked about a "room").
- The main menu's buttons read Solo / Multi (it was Solo / Room).
- On a desktop the weapon, item and bag slots are 1.2x bigger.
- The recovery code field is centered like the code above it.
- The recovery code screen: spaced like the main menu and only as big as its content (it stretched
  almost across the screen); short one-line labels lined up with the code box and the code field
  ("Your code for another device:", in Czech too: it was always in English); its way back to the
  Wardrobe sits top-left.
- The controls help shows the real models (the Cork Popper, a chest, a part, the items) instead
  of drawn stand-ins.
- Weapon, item and bag slots sink into their shadow when pressed, like the menu buttons (keys 1-5
  and the wheel press them on screen too); held, they still shrink toward a drop.
- The gallery's cards fade out at its top and bottom edges while there's more to scroll to (they
  were cut off flat), and stay inside the card's padding (they scrolled up under the corner
  buttons).
- Luck toward a set's last piece: when you have four parts of an animal, a part you find (from a
  chest you open or a piñata you burst) can be that set's missing one, until you pick it up: 1 time
  in 15 for a common animal, 25 for a rare one, 40 for an epic one and 60 for a legendary one.
- A full set drops in style: the umbrella from the blimp (and off a catapult) takes the set's
  colors and pattern (frog spots, bee stripes, dragon scales, flamingo hearts...), so everyone can
  see who's coming down.
- Winning dances by the head's animal: springy ones bounce high and spin (the frog highest), heavy
  ones stomp from foot to foot, winged ones flutter and take off (the penguin belly-slides, the bee
  buzzes round in a circle, the dragon and phoenix rear up), squishy ones wobble like jelly, fluffy
  ones twirl. In a full set, a finale burst every couple of seconds; a whole holo set adds rainbow
  glitter.
- Holo parts: rare holographic versions of every part, pearly with rainbow bands that shimmer as
  the plush turns. Once you own an animal's whole set, its parts can come out holo for you: 1 in 25
  from chests you open, 1 in 12 from royal chests and piñatas you burst. A holo part on the ground
  shimmers in its usual ring under a beam drifting through the rainbow (with a rainbow star while
  you don't own it yet); anyone can grab it. Holo parts are kept like any other and can be worn
  from the start of a match. In the wardrobe, bag and results card they sit on a soft rainbow with a
  little rainbow star; the gallery counts each complete set's holo parts (2/5), and a whole holo
  set turns its card holographic.
- The gallery opens with a summary of your collection: parts found, complete sets, holo parts and
  holo sets, each with a progress bar. Protocol 18.
- The Rubber Band Rifle's laser stays level while you walk (it tipped toward the ground as the
  plush leaned) and is brighter: a white-pink core in a red glow.
- Day to sunset over a match: daylight while the Rinse waits, then late afternoon and golden hour
  as it closes in, and a sunset for the final circle (warm lamp-light tones indoors in the
  Bedroom). The sun lowers as it goes, so shadows grow longer. Only the light changes, the same
  for everyone.
- The results card shows damage dealt with a broken heart instead of a lightning bolt.
- Snowy Park's lampposts: a matte cap with snow on its tip (a glossy highlight and a ball of snow
  overlapped on top).
- No more thin lines on the log cabin's snowy roof (the snow along the tops of its walls showed
  through).
- Cardboard Walls stand until they're shot down: no more folding away after 20 seconds, and no
  limit of three per plush. Protocol 17.
- Jumping off the zip line stops its whir.
- Let go of the zip line anytime with Jump: you drop off, carried on a little along it (the drop
  hint shows while you ride). The toy block under the Backyard's zip line moved out of its way.
- A chunky, high-contrast aiming cursor on desktop (it was the thin system crosshair).
- Menu icon buttons name themselves in a little bubble after a moment's hover, or on a long press
  on touch (which then doesn't press the button).
- Damage numbers for buttons knocked off are yellow, like the buttons bar (they were pale blue).
- Catapults in bright toy colors: a teal base, a hot-pink spring, a red platform with a sunny
  yellow rim and a white arrow (they were washed-out pastels).
- Bots no longer get caught flipping back and forth: at a roof's edge (they forgot they were on
  the roof once their middle was past it), in a doorway with an enemy inside (they now keep at it
  for half a second after losing sight, without shooting, before going to look), or while backing
  off hurt (they now hide and heal instead of walking back into view, and don't back into the
  Rinse or off the map).
- Animal voices: every plush speaks with its head's animal (30 of them, squeaky plush versions
  of an oink, a ribbit, a tiny dragon roar...): a yelp when hit (at most once a second), a wail
  when knocked out, and a cheer when revived or when it wins.
- Jumps sound like the animal (by its head), one simple sound for each kind: a springy boing
  (frog, bunny, cat...), a soft low boing (bear, elephant, yeti...), a flap of felt wings (birds,
  the dragon, the bee), a squishy bloop (sea creatures) or a little poof (sheep, koala,
  hedgehog...). Three takes each, picked at random and never the same twice in a row.
- The Rinse makes a plush yelp in its own voice, just like a hit (instead of a soggy squelch).
- Weapon sounds: each weapon keeps one shot sound of its own (so you can tell what's firing by
  ear), a touch different in pitch and loudness each shot; hits and impacts have two or three
  takes (picked at random, never the same twice in a row); all evened out to one loudness. The
  water gun splashes now instead of crackling. The Cork Popper had been silent (a broken
  clip), and the stuffing hit, the chest opening and the bouncy-ball boing were barely audible.
- Picking things up: each part slot sounds its own (a head snaps on, a body zips up, feet pat, a
  tail sticks on, an accessory chimes), and each item too (a rattle of buttons, a rustle of
  stuffing, a clink of the sewing tin, a slosh of juice, a flap of cardboard), instead of one
  squeaky squeeze for everything.
- Using an item makes a sound while it lasts (cut short if you're interrupted): cotton fluffed up,
  needle-and-thread stitching, buttons clicked on one by one, a straw slurped, stuffing pushed in,
  cardboard unfolded. Each finishes its own way: a small poof for a Cotton Puff, stitches and a
  twinkle for a Sewing Kit, a big poof for the Big Stuffing Bag, a happy gulp for a Juice Box.
- Each chest opens its own way: the plain wooden one creaks and clunks, the red toy chest poofs
  and chimes, the royal one bursts open with a grander rising chime, the picnic basket crackles
  and pops.
- Landings sound like the animal too, one simple sound for each of the same five kinds: a light
  pat, a soft cushioned plop, a flutter, a squishy splat, a fluffy flump (three takes each).
- Footsteps, the same for every plush: a soft brush on grass, a light knock on wooden planks (the
  Bedroom, and indoor floors on the other maps), a crunch in snow; splashes in water (now a little
  softer to match). Very quiet on purpose, yours a little louder than others'.
- A small tick when your shot lands, and a little chime when you knock someone out.
- Evened out the sounds that were far too loud (the defeat whistle, the air-strike whistle, the
  train toot, the snowplow horn) or too soft (buttons snapping on, digging, swapping, splashes).
- Sound pauses while the game's tab is in the background.
- Each map has its own match music: sunny ukulele and whistling in the Backyard, a sneaky toy
  piano and music box in the Bedroom, sleigh bells and glockenspiel on Snowy Park. Music loops
  without a seam now.

## Fixes (2026-11-19)

- Loot up on a roof, in the pool or on the frozen pond glows again (the roof, the water or the ice
  was drawn over its glow).
- Chests have an even outline all round, closed or open, domed lids included (it was missing on
  some sides, with the floor showing through under the lid's edge).
- A bot fighting someone right above it (up on a roof) no longer spins round and round.
- Plushes: every part has the same outline weight, head to toes (small parts like feet, ears,
  spikes, horns and fins had hairlines or none). Parts lying on the ground match.
- Plushes: two clean outlines, one round the head and what it wears, one round the body with its
  tail and feet; the only line inside is where the head meets the body (a lion's mane tufts no
  longer cross each other in slivers, gems and inner ears no longer leave gaps). Arms and mittens
  are outlined as thick as the rest.
- Weapons and items: one even outline on every bit, closed round boxy corners; stepping stones
  are outlined all round.
- Sandcastles: one even outline round the whole castle, battlements and flag included (the
  pieces' own lines were broken and crossed each other).
- The king of the hill flag is outlined (it was a flat sheet with none).
- Treetops (the treehouse's and the piñata tree's): one outline round the whole crown; the
  treehouse's rests on the platform (it was half sunk into it, hiding its outline). The treehouse's
  corner posts and the zip line's poles are outlined.
- Push buttons are round: a round base and a round plate with a ring of hazard stripes under the
  red button.
- The desk's lamp, crayons and sheet of paper are outlined (they had none), and the drawings and
  puzzle pieces on the Bedroom floor too; socks lie flat, outlined all round.
- The toy train: one outline weight on every part (wheels, chimney, cow catcher had uneven ones);
  the track's sleepers are outlined evenly and sit clear of its strip; the hamster tube is outlined.
- Every prop and every bit of floor clutter is outlined the same way: one even line round the
  whole thing, never crossing over it. Standing things have an open foot (their outline runs down
  their sides to the floor, with no line where they stand, so they read as standing on it); low
  things lying on the floor are outlined all round. The catapult's base stands on its little feet,
  outlined like the rest. Toy cars' wheels are charcoal with a
  light hub (as dark as the outline, they read as blobs). Ice blocks, mittens, marbles, sleds and the picnic table's hem got theirs; props
  tucked under a roof don't show through it.
- The rest outlined the same way: seesaw, sprinkler, robot vacuum, lawnmower, snowplow, the
  gallery's ducks, the present piñata and air strike drops; igloos are outlined round their dome,
  foot and tunnel; the pool's rim has a line along its inner edge.
- Wall pieces that meet (a corner of two cardboard walls, a fort's walls and towers, a row of
  blocks) share one outline round them, with no dark block where one's outline crossed the other.
- Buried treasure mounds (and the pile once dug) are outlined all round, with a line along their
  foot; the sandbox's pebbles and shells stay off them.

## Neon loot rings (2026-11-19)

- The circle under loot (and round a ready toy) is a raised glossy plastic hoop with an outline,
  in full neon rarity colors: the glow now sits under it instead of washing it out to pastel.
  Epic is violet rather than pink.
- The light beam over Limited Edition loot and up is a soft shaft fading upward, not a
  see-through tube.
- Umbrellas have a clear dark outline round their rim (it was a hairline over the top only).
- Outlines on the toy drums and sand buckets (one even line round the whole bucket, down its sides
  too) and on the roofs' chimneys.
- Outlines on the picnic table's plates and cake (now with a strawberry), and snug ones on the
  shooting gallery's boards (no dark blocks past their ends).
- The garden tap is one brass fixture: a plate on the wall, a valve with a red spoked wheel on
  its stem, and a spout down into a green coupling the hose comes out of.
- The piñata's rope is tied to its branch (it hung a little below it, with a gap).
- Snowy Park: the frozen pond has one smooth bank of snow, outlined on both sides (its separate
  lumps hid each other's outlines); snow walls are plain outlined blocks (no bumps on top); the cabin chimney's
  snow cap is outlined.
- The pool's water reaches in under its rim (a strip of lawn and outline showed between them).
- A toy that's ready to use glows (gold, breathing, with light on the floor under it) instead
  of showing a full ring; while it recharges it keeps its flat ring.

## Catapults, more floors (2026-11-19)

- Catapults, one on each side of every map (throwing toward its middle): press E by one and
  you're flung high, your umbrella opens, and you steer as you glide down (no shooting or looting,
  but you can be hit; Jump folds it). Each is a spring launcher (a pink spring under a wooden
  platform with an arrow showing where it throws), squashed down when ready; it throws again 20 s
  later. The camera pulls back quickly from the moment you're thrown, and shadows reach as far
  as it sees (they no longer pop in at the edge while you glide). Protocol 15.
- Each area gets its own ground: a paved patio round the house, gravel round the tool shed, wood
  chips under the treehouse and clover meadows on the lawn (Backyard); a shaggy carpet by the bed,
  a foam puzzle mat in Toy Corner and a big crayon drawing by the desk (Bedroom); pine needles in
  the forest, cobbles under the Gift Market and the snowplow's cleared lane (Snowy Park).
- Natural grounds (dirt, wood chips, clover, gravel, pine needles, cobbles, plowed snow) fade into
  the lawn or snow over a ragged edge; laid-down ones (floors, patio, blanket, rugs, mat, drawing)
  keep a crisp edge. Meadows take on the lawn's light and shade so they blend in.
- The patio is wider on the north, a terrace the trampoline stands on. The shooting gallery moved
  west, away from the house (and a book out of its way).
- The round rugs in the Bedroom are braided (a generated image instead of drawn rings); the log
  cabin has a wooden floor (no snow indoors); the pine needles are smaller; floor clutter (toy
  cars...) stays off the chests and the hideouts. Bushes, laundry piles and pines no longer sit on
  props or chests (a few moved a little).
- Push buttons: the hazard stripes are the plate's top face (a sheet just above it flickered).
- Long poles and logs: their outline no longer pokes out past their ends as a dark cap (it hid the
  logs' rings); the king of the hill pole's outline is a little bolder.
- Bushes and laundry piles: one outline round the whole heap, down to the floor, without stray
  slivers of outline across the balls. Blocks, crates, books and walls: thinner outlines that hug
  them down to the floor, with no broken steps where one touches the next. Heaps' lower balls sit
  on the floor (no strip of floor between them and their outline). The bed's pillows are plump
  and outlined, like its turned-down sheet; slides have rounded rails and board with snug
  outlines (no dark blocks past their ends).
- The garden hose's outline follows the hose (it lay off across the lawn by the pool), and the hose
  no longer dips under the ground by the tap.

## Robot vacuum, lawnmower, snowplow (2026-11-19)

- Things that move about: a robot vacuum in the Bedroom (bumps you aside, sucks up loot and spits it
  out later), a lawnmower in the Backyard (bonks whoever is in its way) and a snowplow in the Snowy
  Park (shoves you along), the last two sent off with a push button.
- Pressing an air strike, the mower or the plow shows everyone a short red message; the strike's
  falling whistle is heard all over the map.
- All push buttons look alike: the dots round them fill as they recharge (no floating icons or glow).
- Slides: only the board stops shots and plushies; walk under the high end, and it fades while
  you're there. The sled run lost its red sled; the snowy run and the presents got textures.
- Knocked out by anything but a plush: a broken heart on the card. Shorter hamster tube (clear of
  the chest). Protocol 14.

## Bigger rooms (2026-11-19)

- Online rooms take up to 16 plushies (was 10), like solo; the lobby starts full of bots.

## Slides, zip line, trampoline and mini-games (2026-11-19)

- Getting around: a trampoline (onto the house roof) and a seesaw in the Backyard; slides off the
  treehouse and the bed (walk up them, solid from the sides); a sled hill with a little jump in
  the Snowy Park; a two-way zip line between the treehouse and the house roof; a solid hamster
  tube across the Bedroom floor (you're hidden inside).
- Mini-games with prizes: buried treasure (Backyard sandbox, Snowman Garden), a shooting gallery
  (five ducks in a row), bowling (Bedroom), king of the hill (castle keep, fort tower), and the
  beach-ball goals now drop a weapon.
- Map toys show a gold ring filling up while they recharge and the loot glow when ready.
- Roofs no longer flicker (or hide you) while you jump up onto them.
- Knocked out: "Vypárali tě!". Protocol 13.

## Air strikes, piñatas and map toys (2026-11-18)

- An air strike button on every map (a red push button on a hazard-striped box): water balloons
  in the Backyard (soak: slower, seen in bushes), toy blocks in the Bedroom, snowballs in the
  Snowy Park (knock you flying). Each drop is marked two seconds ahead; a roof keeps you safe.
- A piñata on every map: a paper donkey hanging from its own little tree in the Backyard, a big
  pink present in the Bedroom and the Gift Market. Shoot or whack it open for two rare-or-better
  weapons, two items and a part.
- A big toy on every map: a jack-in-the-box that launches everyone around it, a garden sprinkler
  whose turning spray pushes and soaks, and an ice drill that breaks the frozen pond open.
- Riding the toy train online no longer jitters: it's predicted and drawn at the right moment.
- New sounds for all of it. Protocol 11.

## Czech, roof chests, see-through roofs, smoother crowds (2026-11-18)

- The game's words are in Czech (buttons, results, area names); `?lang=en` switches to English.
- A chest on every roof you can climb (house, shed, treehouse, picnic table, bed, desk,
  dollhouse, log cabin): opened only from up there, its loot stays on the roof. Protocol 10.
- Roofs fade to a faint ghost while you're inside instead of vanishing; whatever is on that roof
  (loot, a chest, a plush) fades out with it, so nothing seems to float in the room.
- Softer shadow edges. No more flickering shadow under a plush standing in the pool.
- Phones and tablets draw plushies with about half the triangles and only their soft blob
  shadow, so a crowd on screen stays smooth (`?detail=low` / `?detail=high`).
- Online, your shots from the rubber band rifle, marble launcher and glitter bomb start at your
  muzzle while you run, instead of off to the side.
- The options gear hides while the Wardrobe is open (it covered its close button on phones).
- Server: a late input no longer repeats putting on a part from the bag.

## Smoother grey Rinse, roomier igloos (2026-11-18)

- The grey Rinse no longer draws the whole scene twice: every surface greys itself past the
  edge as it's drawn (about a third of the frame cost it had, near the edge). Fixes the lag on
  older iPads.
- Igloos: a wider doorway and a taller entrance tunnel; inside, the dome fades to a ghost and a
  smooth low wall of snow bricks stays round you. Pine trees and bushes (and laundry piles) no
  longer flicker when you stand in them.

## Ten more animals and the Snowy Park (2026-11-18)

- Ten new animals (thirty in all): Mouse and Sheep (common), Raccoon and Bee (rare), Flamingo,
  Giraffe and Sloth (epic), Dragon, Phoenix and Yeti (legendary), each with five parts, a fabric,
  a set glow, a trail and a knockout burst. Legendary parts are rarer per animal (weight 1).
- A new map, the Snowy Park: a slippery frozen pond, pine trees, snow walls and a snow fort, a
  log cabin, gift stacks, snowmen, lamp posts, igloos to hide in, sleds and lost mittens, and
  falling snow. New generated textures: snow, ice, log walls and gift wrap.
- Look-alikes told apart: the Dragon is crimson (not green like the Dino), the Yeti wears
  earmuffs (not a red hat like the Penguin), the Axolotl is coral, the Flamingo hot pink, the
  Mouse tan and the Sloth olive. The Yeti and Flamingo were reworked (a blue yeti face and shaggy
  fur; a black-tipped beak and wing tips).
- Protocol version 9.

## Back to the lobby (2026-11-18)

- After a room match, the host gets a Lobby button: everyone goes back to the same room's lobby
  (same code, same seats) to change the map, bots, teams or bot level before the next match.
  Protocol version 8.
- Gallery: tapping an animal's card puts on every part of it you own and goes back to the
  Wardrobe.
- Glitter also slows plushies down (to 70% speed) while they sparkle.

## Glitter that gives you away (2026-11-18)

- The Glitter Bomb no longer blinds: everyone in the burst is covered in glitter for 8 s, a
  swirl of sparkles seen through bushes and roofs, and can't hide anywhere while it lasts.
- The Bubble Wand traps for 2 s (was 1.5); more bubbles bounce off someone already trapped, so a
  trap can't be stretched out.
- The Marble Launcher hits harder: 38 per marble (was 30).
- Fixed: a teammate's arrow could point the wrong way when they were far below the screen.
- Fixed: starting a room match with the lobby's Start button always played the Backyard with
  normal bots, whatever map and bot level were picked.
- Protocol version 7.

## Shorter matches (2026-11-18)

- The Rinse still waits a minute, then closes in over 5 minutes (was 9): a match lasts at most
  6 minutes.
- The parts you take home show in round circles on the results card (a long row wraps instead
  of squeezing them into ovals), with bigger pictures.

## A patchwork blimp and plush parasols (2026-11-18)

- The Toss blimp is sewn patchwork (dotted, striped and checked panels with stitched seams),
  with rounded corduroy fins, a wicker basket with a padded rim, ropes, sandbags and a glossy
  propeller.
- Gliding down, plushies hold a domed plush parasol with pompoms and a hooked handle.
- The Foam Dart SMG is a simple classic foam blaster again; the Pillow Hammer is soft cloth (no
  plastic shine).

## Textures, a grey Rinse, and a livelier backyard (2026-11-18)

- Generated textures (OpenAI images, `pnpm textures`): animals wear knit, corduroy or minky-dot
  plush (with weave you can see in the light); wooden floors, a felt lawn, sand, soil, bricks,
  roof tiles, crates, cardboard, a patchwork quilt, wicker, and woven picnic and tablecloth
  checks. Toy plastic (weapons, toy blocks, the train, lacquered chests, beach balls, button
  eyes) has a glint.
- The Rinse drains the color out of everything in it, behind a shiny rainbow-edged line; out in
  it, a grey-heart badge pulses faster the more it hurts (no more number). No countdown or
  call-outs.
- Bushes of felt leaves, some flowering or with berries; knitted laundry piles; a wooden rain
  barrel; a sandcastle with windows and a door; a spade in the bucket; shells and pebbles on the
  sand; books with labels and a bookmark; a striped inflatable pool with rippling water.
- The pool's rim is solid: jump over it (or onto it). The rubber duck can be pushed about the
  pool. Protocol version 6.
- Shots leave colored streaks, hard hits knock stars loose, goal nets sag, the lawn darkens
  past the map's edge. Shadows no longer shimmer as the camera moves; a bush you stand in is an
  even see-through green.
- A rebuilt Foam Dart SMG; a bigger part picture in the pickup prompt; a brighter new-part
  sparkle.

## Animal touch-ups (2026-11-18)

- Fixed: the octopus's tentacles all came out on one side, and the hedgehog's back spikes sat on
  its left side. Both now go evenly round (the octopus) and across the back (the hedgehog).
- The unicorn has a muzzle with nostrils and a smile; the chicken's comb shows (its eggshell
  sits tipped to one side); the owl is darker, with a pale heart-shaped face; the octopus's
  anchor is bigger.
- Softer shapes: a smooth curled cat tail and a fox tail that shows from behind; puffy frog feet
  with toes, rounded shark flippers, a puffy lily pad, and a chunky frog crown with gems.
- The hedgehog carries an apple (instead of a toadstool) and the pig wears a muddy splash.
- Hats sit on top of the octopus's tall head instead of sinking in; mittens are closer to the
  body's color.

## A tidier HUD, and new looks for items (2026-11-18)

- Desktop: the stuffing bar keeps one length and stays centered, with your health by the heart
  and buttons after it; the bag moved to the bottom left; every gap matches the item slots'.
- Phones: health and buttons share a pill in the top left, the bag (as big as the item slots)
  sits under it, and the players-left count beside it.
- No Rinse countdown or "Rinse!"/"Flood!" call-outs: the rising foam shows it coming. The
  players-left count is a plain number at the top.
- Buttons are yellow: a sewing-button icon as big as the heart, a yellow coat on the bar and a
  yellow count. Stuffing (and re-stitching a teammate) is a plain red heart.
- The part prompt reads hand | part | bag (E and Q on a keyboard), with the part in the middle.
- New looks: the Cotton Puff is a sticking plaster, the Big Stuffing Bag an open first-aid box,
  the Juice Box a blue carton with an orange on it, and the Button Pack and Pile scattered
  sewing buttons. The Pillow Hammer is bigger; the Glitter Bomb and Bubble Wand are redone.
- The sparkle over new parts glows, and only shows on the ground.

## A bigger bag, and new parts sparkle (2026-11-18)

- The part bag holds three (was one), shown next to your stuffing; tap a slot to wear that part.
  Knocked out, the parts you wear are kept but the bagged ones drop for others. A found part you
  replace by wearing a new one goes into the bag (instead of onto the ground).
- Parts you haven't collected yet sparkle: a gold star floats over them on the ground. Protocol version 5.
- The Sewing Kit looks like one: a ball of pink wool with two knitting needles through it.

## Chest tweaks (2026-11-18)

- Chests rarely give the starting Cork Popper (about 1 in 15 instead of 1 in 5), and never a
  plain Hand-me-down one: a chest gun is always better than the one you start with.
- Fixed: after a match ended, its last moment (the final knockout and hits) replayed every
  frame in solo, piling up a huge cotton cloud and damage numbers.
- The Bouncy Ball is replaced by the Button Pile: +50 buttons in 4 s (the big armor, as the
  Sewing Kit is to the Cotton Puff). The Cotton Puff now heals up to full (was up to 75).
- Lighter knockout burst (no cotton cloud hiding whoever's near); "Watch" and "Again" as words
  on the results card.

## Music, smoother start, smarter bots (2026-11-17)

- Background music: a music-box tune on the menu and in the lobby, a bouncier toy-band tune in
  matches, with its own on/off (the note) in the options. Made with Web Audio; generated tracks
  in public/music are used instead when present (`pnpm music`, ElevenLabs music permission).
- The train toots as it's about to reach you, so you see it coming. Bots step off the rails in
  time (train bumps in a bots-only match went from 42 to 1 in two minutes).
- The menu shows sooner: the hundred part pictures are drawn in idle moments after it's up
  (about 2.6 s to 1.8 s on a slowed-down CPU). Switching maps frees the old map's GPU memory.
- Online: loot goes out as changes (new, moved, gone) instead of the whole list.

## Twenty animals (2026-11-17)

- Turtle (common: shell with hexagon plates, red bandana), Hedgehog (rare: spikes, an apple
  on top), Koala (rare: fluffy ears, big nose, a sleepy nightcap) and Octopus (epic: a domed
  head, eight wiggly tentacles, sailor hat). Each with its set glow, trail and knockout burst.

## The Bedroom (2026-11-17)

- A second map, 112 x 112: a kid's bedroom on wooden floorboards. The Bed (hide underneath or
  climb on from the toy box), the Desk (climb up by the chair), a Block Castle with a keep in
  the middle, the Toy Corner with a big open toy box, the Bookshelf, and the Rug with beach
  balls. Laundry piles are the hiding spots.
- A map button (a tree or a bed) on the title menu next to Solo and Room, and in the lobby for
  the host; remembered on the device. The menu's backdrop switches to the chosen map.
- Hiding in a bush (or laundry pile) looks cleaner: one even see-through layer, no inner rings.
- A fuller Bedroom: a train set (a track loop with a three-car train) between the bed and the
  desk, a dollhouse to hide in (its roof a lookout, up from a toy drum), a nightstand, and
  blocks, books, drums and boxes across the floor; plus clutter just for looks (crayons,
  drawings, socks, puzzle pieces, marbles, toy cars).
- Solo, Room and Start are plain words (no icons).
- The toy train drives: a four-car train (an engine puffing steam and wagons of blocks) runs
  round a big oval track across the whole Bedroom all match. The cars are solid: they shove
  plushies off the rails (with a toot), stop shots and knock beach balls along. Where it is
  comes from the match clock alone, so it needs no network data.
- Ride the train: the wagons are flat decks (height 1.2) a jump lands on; whoever stands on one
  is carried round the track, turning with it, and steps or jumps off to leave. The engine is
  taller (its cab) and can't be stood on. Wagons no longer carry cubes.
- Part rarity shows the same everywhere: the E prompt and the stash slot are ringed in the
  animal's rarity color (like weapons); the legendary gallery card is gold like its ring, and a
  finished set gets a spinning rainbow border instead.
- The train pushes loot lying on the rails aside, like a snowplough, instead of running
  through it (the loot glides out of the way).

## Beach ball goals (2026-11-17)

- Two goals by the Kiddie Pool (north and south, opening toward it), with nets and a floating
  scoreboard each. Roll a beach ball in: confetti, a cheer, the score pops up, and the ball goes
  back to where it started. Scores are match state (sent online when they change).

## Bot difficulty (2026-11-17)

- Every button on the cards, options and spectate bar makes the soft click (once), and so do
  the Enter and arrow-key shortcuts.
- Easy, normal or hard bots (one, two or three bars), on the title menu for solo and in a room's
  lobby for the host; remembered on the device. Easy bots react slower, aim wider, lead less,
  pause longer between bursts and look for fights closer by; hard bots the other way.

## Polish (2026-11-17)

- Dino back plates stand out of the back; the cat's tabby stripes lie on the body.
- Results card: Wardrobe and Menu in the top corners, Again (and Watch, equal width) across the
  bottom; no stray focus ring. Lobby: Share and Leave in the top corners.
- One card at a time: opening the Wardrobe from the menu, lobby or results card hides that card
  until the Wardrobe closes (no more stacked cards).
- Leaving from the options (home) asks first: a home and a question mark, ✓ leaves, ✕ stays.
- Splashes when walking through water (the pool or the Rinse): white spray, a ripple and a soft
  splash sound with every step or so.

## Teammate arrows and re-stitching (2026-11-17)

- Off-screen teammates show as a badge with their head at the screen edge, pointing to them.
- A knocked-out teammate can be re-stitched for 30 s: hold E beside their pink ring and heart
  for 3 s and they're back where they fell (50 stuffing, starting weapon). Their badge pulses
  pink meanwhile. Online, parts they carry after coming back are saved again when they next go
  out.

## Team mode (2026-11-17)

- Online rooms: a team button in the lobby (on by default) puts every real player on one team
  against the bots. No friendly fire (shots, bursts and pillow swings pass through teammates),
  teammates always visible with a blue ring under them, and the team wins together ("Team
  wins!", also for teammates already out). Knocked out, you watch a teammate first. Shot hints
  and touch aim assist ignore teammates. Player.team, GameState.winnerTeam; protocol v4.

## Players-left count fixed online; HUD fits phones (2026-11-17)

- Online, the players-left count counted only the plushies in sight; it now counts everyone
  still in (the roster minus the knocked out). The same for the count while spectating.
- The knockout card names whoever got you even if they were hidden from you (in a bush).
- The top HUD is one row with every center on one line: on touch screens stuffing, the Rinse
  timer and players-left count (one pill now), items, weapons and the gear; on desktop the pill
  lines up with the gear.
- On touch screens the stuffing bar is gone: just the number (red and pulsing when low), the
  buttons and the stash.
- Wardrobe: the part picker is only as big as the parts you own (no empty box), and the
  recovery code hides behind a key button in the corner.
- The knockout card shows just a picture of the weapon that got you (no rarity underline).
- Opening a chest shows just the progress bar over it (no chest picture next to it).
- The Rinse water no longer blinks out during the Toss: its "is any water on screen" check
  now grows with the zoomed-out camera.
- Spectating: a ✕ next to the switcher goes back to your results card (Again); when only
  watching, to the menu.
- Shots fired indoors no longer climb toward the roof overhead (aiming took the roof as the
  surface to aim above); they stay level unless the aimed-at spot is outside or up on something.
- Beach balls roll: run into one and it rolls off (you bounce back a little, with a boing, and
  it squashes); a gentle bump nudges it along and shots knock it too. They bounce off walls,
  chests, plushies and each other, slow down on the grass and faster in the pool. They're part
  of the match state now (online: sent when they move; protocol version 4), and bots path
  through where they started.

## Wardrobe picker, plushier sounds (2026-11-17)

- Wardrobe: no more arrows. Tap a slot, then pick from a grid of every part you own for it
  (commonest first, a rarity strip on each). In the gallery, tap an owned part to wear it, or a
  complete set to wear all five.
- Softer, plush sounds for hits, knockouts, jumps, landings, pickups, swaps, menu clicks and
  chests; the chest rattle stops as soon as the opening does.

## Smoother Toss (2026-11-17)

- Plush parts, held weapons, chests and ground loot are baked into one mesh per material when
  built (moving pieces like leg hips and chest lids stay separate). A chest went from about 45
  draw calls to 10, a plush part from up to a dozen to a few. With the camera pulled back
  during the Toss, draw calls dropped from about 1000 to 500-650 a frame, and frames stay at
  60 fps on a 4x slowed CPU (they dipped to 30 before).

## Panda, Pig, Lion, Elephant; animal rarity (2026-11-17)

- Four more animals (16 in all): Panda (eye patches, shoulder band, bamboo sprig), Pig (snout,
  floppy ears, curly tail, coin slot, apple), Lion (mane, tufted tail, chest fluff, crown) and
  Elephant (big ears, trunk, tusks, circus blanket, fez). Two new body shapes (broad, bell);
  set glows, trails (bamboo leaves, mud splats, gold sparkles, trunk spray) and knockout bursts.
- Animals have a rarity: common, rare, epic, legendary (Unicorn). Chest parts roll animals by
  it (6 : 4 : 3 : 2; a Unicorn part about 1 in 35), the ring under a part on the ground shows it, and the gallery sorts by it
  with stars and tinted cards. New profiles start in common animals.

## Keep every part (2026-11-17)

- Knocked out, you keep every part you carried (worn finds and the stash); only weapons and
  items drop. No more keep rolls, win or lose. Bots still drop their parts for others to take.
- Wardrobe: a gallery of all 12 animals in full, with the parts you own lit up and a count;
  a finished set turns gold.

## Twelve animals, no part rarity, smoother online (2026-11-17)

- Bunny, Unicorn, Cat and Fox join (12 animals). Every body has its own shape now (round, pear,
  tapered, egg, chunky, barrel, plump, pin) with a detail or two, still fitting any head, legs and
  arms. Thicker thin legs; the bear wears a felt bow.
- Parts have no rarity: a knocked-out player keeps each part with a flat 50% chance (the rest
  drop); bots wear parts that build toward a set.
- Online: lag compensation (shots are checked against where the target was on the shooter's
  screen, up to a third of a second back); 30 updates per second (was 15) and others drawn
  3 ticks behind (was 4); your instant shots stop on what you see. Protocol version 3.
- Weaker bots; a players-left counter by the Rinse timer; the touch jump hint is a plain round
  button.

## Four more animals (2026-11-17)

- Dino (crest, toothy snout, back plates, stompy clawed feet, spiky tail), Owl (ear tufts, big
  eyes, round glasses, talons, folded wings), Axolotl (frilly gills, smile, spots, finned tail,
  starfish clip) and Penguin (white face and tummy, bow tie, orange feet, beanie). 40 parts in
  all. Each has its own set glow, walking trail (dust stomps, feathers, bubbles, snowflakes) and
  knockout burst. New profiles and bots can get any of the eight.

## Keep or drop, never both; dropping things; bots that don't spin (2026-11-17)

- Knocked out: each part you carried is rolled once by its keep chance; kept ones go to your
  collection, the rest drop for others. (Before, everything dropped and you could also keep a
  copy.) Bots keep nothing.
- Online: kept parts are saved and shown the moment you're knocked out, and a match ends once no
  real player is left (no waiting for the bots).
- Drop things: long press (or right-click) a weapon, item or stash slot; G drops your weapon. You
  can't take something back for 2 s; others can.
- Touch: a Stash button next to Grab while a part is in reach; the part prompt reads
  hand | part | bag.
- Bots: pathfinding around buildings and in through doors; no more spinning at walls, at roof
  edges (they chase where an enemy was for a moment) or at the water's edge.
- Online: fewer snap-backs (the server keeps up to 15 queued inputs; small corrections slide).

## Online feel and hints (2026-11-17)

- Phones: grass is cut into patches that are skipped when off screen, and phones get about half
  as much; triangles per frame in a typical view dropped from about 134k to 45-52k.
- Fixed: online, your plush could jitter while riding the Toss blimp (it was predicted along
  the line from each new snapshot); it's now drawn like everyone else's until you drop.

- Your own shots show the moment you fire online (Cork Popper, Foam Dart SMG, Super Soaker,
  Bubble Wand): drawn here until they hit something, while the server's copies are hidden; the
  muzzle puff and sound play at once too. Damage still comes from the server. Snapshots now say
  who fired each projectile.
- Shots fired within 24 units of you show a softer amber arc toward the shooter (seen or not);
  hits on you keep the red one.
- Gliding plushies leave a trail of cotton puffs and sparkles. Bear paw prints point the way the
  bear walks.

## Zone names and set trails (2026-11-17)

- Walking into a zone shows its name for a moment under the Rinse timer.
- Wearing a set (3+ parts of one animal) leaves a trail as you walk: bear paw prints, frog
  splashes, shark ripples or chicken feathers; and a knockout bursts in that animal's style.

## Step 4.4: The Toss (2026-11-17)

- Matches start on a giant toy blimp crossing the yard on a random line. Press Jump (or the jump
  button) to drop off, then glide down under a paper umbrella, steering to your landing spot;
  anyone still aboard at the end of the line drops automatically. Riders are hidden; gliders
  can't shoot or be hurt. The camera pulls back while you ride and glide. Bots drop at a random
  point and steer toward a chest.

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
