import './style.css';
import { ANIMAL_RARITY, ANIMALS, BACKYARD, Btn, BUTTONS, PART_SLOTS, canSee, completeSets, config, missingPieces, createWorld, getMap, muzzlePosition, layoutOf, trainCars, trainCircles, zoneSecondsLeft } from '@stuffed/sim';
import { parseRoomCode } from '@stuffed/sim/net';
import type { Animal, EntityId, GameState, KnockoutCause, MapData, Part, PartSlot, Player, Rarity, Vec2, WeaponKind, WeaponSpec } from '@stuffed/sim';
import { GameAudio } from './audio/game-audio.ts';
import { Music } from './audio/music.ts';
import { Sound } from './audio/sound.ts';
import { KeyboardMouseInput } from './input/keyboard-mouse.ts';
import { TouchControls } from './input/touch-controls.ts';
import { GameRenderer } from './render/game-renderer.ts';
import { renderModelIcons } from './render/model-icons.ts';
import { LocalSession } from './session/local-session.ts';
import { ProfileStore } from './session/profile.ts';
import { leaveForNewAddress } from './session/hand-over.ts';
import { installErrorReports, reportError } from './session/report.ts';
import { createRoom, createSoloRoom, findPublicRoom, RoomClient } from './session/room-client.ts';
import type { GameSession } from './session/session.ts';
import { DebugOverlay } from './ui/debug-overlay.ts';
import { EndScreen, type EndView } from './ui/end-screen.ts';
import { escapeHtml } from './ui/escape.ts';
import { FloatingNumbers } from './ui/floating-numbers.ts';
import { Help } from './ui/help.ts';
import { HitDirection } from './ui/hit-direction.ts';
import { TeammateArrows } from './ui/teammate-arrows.ts';
import { savedBotLevel } from './ui/bot-level.ts';
import { savedMap } from './ui/map-choice.ts';
import { Hud } from './ui/hud.ts';
import { icon, setModelPictures } from './ui/icons.ts';
import { LobbyScreen } from './ui/lobby-screen.ts';
import { installTooltips } from './ui/tooltips.ts';
import { MenuScreen } from './ui/menu-screen.ts';
import { Options } from './ui/options.ts';
import { Wardrobe } from './ui/wardrobe.ts';
import { ProfileCard } from './ui/profile-card.ts';
import { ZoneHud } from './ui/zone-hud.ts';
import { ZoneNames } from './ui/zone-names.ts';
import { Toast } from './ui/toast.ts';
import { Tips } from './ui/tips.ts';
import { UpdateBanner } from './ui/update-banner.ts';
import { NameTags } from './ui/name-tags.ts';
import { tr } from './i18n.ts';

// Crashes on players' devices get reported (see report.ts), from the very start.
installErrorReports();
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
// The graphics card gave up (a phone short of memory, a driver reset): worth knowing about.
canvas.addEventListener('webglcontextlost', () => reportError('webgl', 'context lost'));
const hudEl = document.querySelector<HTMLElement>('#hud')!;
const spectateEl = document.querySelector<HTMLElement>('#spectating')!;
/** "Jump to drop" while riding the Toss blimp. */
const tossHint = document.querySelector<HTMLElement>('#toss-hint')!;

const input = new KeyboardMouseInput(canvas);
const touch = new TouchControls(input);
/** For touch aim assist (who can be seen); rebuilt when a match is on another map. */
/** The current map's world (touch aim assist checks sight with it). */
let world = createWorld(BACKYARD);
const params = new URLSearchParams(location.search);
const loadout = loadoutFromUrl();
// ?animal=mermaid starts a solo match dressed head to tail as that animal (for trying new ones).
const testAnimal = ANIMALS.find((a) => a === params.get('animal'));
/** Test runs (?seed, ?loadout, ?animal) play solo right here, offline: nothing they find is kept. */
const localTest = params.has('seed') || params.has('loadout') || !!testAnimal;
// ?zonescale=0.1 runs the Rinse 10x faster for testing.
const zoneTimeScale = Number(params.get('zonescale')) || 1;
// ?seed=123 replays the same spawns and cosmetics, handy for reproducing bugs (first match only).
let seed = Number(params.get('seed')) || Date.now() >>> 0;

/** This device's profile: your collection and the look you start in. */
const profiles = new ProfileStore();
const newSolo = () =>
  new LocalSession(input, {
    seed, zoneTimeScale, map: savedMap(), botLevel: savedBotLevel(), ...(loadout ? { loadout } : {}),
    ...(profiles.profile ? { look: profiles.profile.look, holoAnimals: completeSets(profiles.profile.parts), missingParts: missingPieces(profiles.profile.parts) } : {}),
    ...(testAnimal ? { look: Object.fromEntries(PART_SLOTS.map((slot) => [slot, testAnimal])) } : {}),
  });
/** Bots only, behind the title menu and the lobby (a few: it runs on the player's device the whole time). */
/**
 * Behind the menu (and a room's lobby until its warm-up starts): the map, still, from above its middle. Nobody plays on it:
 * it's drawn for a moment (the camera settling), then left as it is until something changes (the
 * map, the window's size), so the menu costs a phone nothing.
 */
const newBackdrop = () => {
  backdropSeconds = 0;
  return new LocalSession(input, { seed: (Math.random() * 2 ** 32) >>> 0, botCount: 0, watchOnly: true, still: true, map: savedMap() });
};
/** Seconds the still backdrop has been drawn for; past BACKDROP_SECONDS it isn't drawn again
 *  (the time textures still loading need to show up). */
let backdropSeconds = 0;
const BACKDROP_SECONDS = 1.2;
/** How far back the backdrop's camera is, against play's. */
const BACKDROP_ZOOM = 3.6;
addEventListener('resize', () => (backdropSeconds = 0));

const sceneFade = document.querySelector<HTMLElement>('#scene-fade')!;
/** How long the veil takes to fall over the scene (ms; as in the CSS). */
const FADE_OUT_MS = 220;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let swapping = 0;
/** Frames drawn of the scene behind the veil since it changed; null when the veil is up anyway. */
let veiledFrames: number | null = null;
/** At most this long behind the veil (a scene that never draws mustn't keep the screen dark). */
const VEIL_MAX_MS = 4000;
/** Frames of a new match drawn behind the veil before it lifts. */
const VEIL_FRAMES = 8;
let veilTimer: ReturnType<typeof setTimeout> | null = null;

/** The veil falls over the scene (smoothly), e.g. as soon as Solo or Online is pressed. */
function veilDown(): void {
  sceneFade.classList.add('on');
  if (veilTimer) clearTimeout(veilTimer);
  veilTimer = setTimeout(liftVeil, VEIL_MAX_MS);
}

/**
 * A new scene (beginMatch): straight behind the veil (at once, if it isn't down already), and it
 * lifts once the scene is drawn and settled (textures in, the still backdrop done), so nothing
 * flickers or pops in on the way.
 */
function veilUntilSettled(): void {
  if (!sceneFade.classList.contains('on')) {
    sceneFade.classList.add('start', 'on');
    requestAnimationFrame(() => sceneFade.classList.remove('start'));
  }
  veiledFrames = 0;
  if (veilTimer) clearTimeout(veilTimer);
  veilTimer = setTimeout(liftVeil, VEIL_MAX_MS);
}

function liftVeil(): void {
  veiledFrames = null;
  if (veilTimer) clearTimeout(veilTimer);
  veilTimer = null;
  sceneFade.classList.remove('on', 'start');
}

/** Another map picked on the menu: the veil falls, the map is swapped behind it, and it lifts. */
async function swapBackdrop(): Promise<void> {
  const turn = ++swapping;
  veilDown();
  await wait(FADE_OUT_MS);
  if (turn !== swapping || mode !== 'menu') return;
  beginMatch(newBackdrop());
}

// The page opens behind the veil: the first picture comes in when it's ready.
sceneFade.classList.add('on', 'start');
/** What the player is doing: at the title menu, a solo match, or in an online room. */
let mode: 'menu' | 'solo' | 'online' = 'menu';
/** The match being shown: solo (in the browser), online (from the server) or the menu backdrop. */
let session: GameSession | null = null;
/** Set when playing online. */
let room: RoomClient | null = null;
let lobbyScreen: LobbyScreen | null = null;
// ?quality=high keeps full resolution even if the frame rate drops.
const renderer = new GameRenderer(canvas, newSolo().map, params.get('quality') === 'high');
/** Names over the plushies in a lobby's warm-up (who has joined). */
const nameTags = new NameTags(document.querySelector<HTMLElement>('#floaters')!);
// Pictures of the weapon, item and chest models for the HUD (before anything draws an icon).
// Weapons, items and chests now; the skin parts a few at a time once the menu is up.
renderModelIcons(setModelPictures);
const debug = new DebugOverlay(document.querySelector<HTMLElement>('#debug')!, (on) => renderer.setDebug(on));
const hud = new Hud(hudEl, input);
const numbers = new FloatingNumbers(document.querySelector<HTMLElement>('#floaters')!);
const hitDirection = new HitDirection(document.querySelector<HTMLElement>('#floaters')!);
const mateArrows = new TeammateArrows(document.querySelector<HTMLElement>('#floaters')!);
const zoneHud = new ZoneHud(hudEl);
const zoneNames = new ZoneNames(hudEl);
const toast = new Toast(hudEl);
const endScreen = new EndScreen(
  document.body,
  playAgain,
  spectate,
  // Online, the room is lost on the way out (solo, there's nothing to lose).
  () => (room ? options.askToLeave() : showMenu()),
  () =>
    // Back to the results card, unless the next match started meanwhile.
    openWardrobe(endScreen, () => {
      if (phase === 'over' || phase === 'out') endScreen.reopen();
    }),
  () => room?.toLobby(),
  () => !!room?.isHost && !room.isSolo && room.lobby?.phase === 'ended',
);
const menu = new MenuScreen(document.body, playerName(), {
  solo: (name) => {
    saveName(name);
    menu.setBusy(true);
    playSolo();
  },
  online: (name) => {
    saveName(name);
    menu.setBusy(true);
    playOnline();
  },
  create: (name) => {
    saveName(name);
    menu.setBusy(true);
    createRoom()
      .then((code) => joinRoom(code))
      .catch((err: unknown) => menu.showError(`${tr("Couldn't reach the game server.")} ${err instanceof Error ? err.message : ''}`));
  },
  join: (name, code) => {
    saveName(name);
    joinRoom(code);
  },
  mapChanged: () => {
    if (mode === 'menu') void swapBackdrop();
  },
  wardrobe: () => openWardrobe(menu, () => {
    if (mode === 'menu') menu.show();
  }),
  profile: () => {
    menu.hide();
    profileCard.onClosed = () => {
      if (mode === 'menu') menu.show();
    };
    profileCard.show();
  },
});
const wardrobe = new Wardrobe(profiles);
const profileCard = new ProfileCard(profiles);
/** A newer game deployed while this page is open: offers a reload between matches. */
const updates = new UpdateBanner(document.body);

/** One card at a time: the card the Wardrobe opens from steps aside until it closes. */
function openWardrobe(from: { hide(): void }, back: () => void): void {
  from.hide();
  wardrobe.onClosed = back;
  wardrobe.show();
}
profiles.onChange = () => {
  menu.setWardrobe(!!profiles.profile);
  menu.setSignedIn(!!profiles.profile?.account);
  menu.setButtons(profiles.profile?.buttons ?? null);
  endScreen.setWardrobe(!!profiles.profile);
  lobbyScreen?.setWardrobe(!!profiles.profile);
};
// A new look in the Wardrobe: an online room starts you in it from the next match.
wardrobe.onLookChanged = () => room?.lookChanged();
// On an old address, off to the game's own one first (taking the profile along); see hand-over.ts.
const profileLoaded = leaveForNewAddress().then((leaving) => (leaving ? undefined : profiles.load()));
/**
 * The first menu waits for your profile (or a moment and a half at most): shown before it, the
 * card came up without the Wardrobe, Profil and Buttons, and they popped in after, resizing it.
 */
let firstMenu: Promise<unknown> | null = Promise.race([profileLoaded, new Promise((r) => setTimeout(r, 1500))]);
const sound = new Sound(import.meta.env.BASE_URL);
/**
 * A part is new to you if it's in neither your collection nor what you carry this match (worn or
 * in the bag): a sparkle floats over it on the ground. A holo part counts apart from the plain one.
 */
function isNewPart(slot: PartSlot, animal: Animal, holo = false): boolean {
  const same = (p: { animal: Animal; holo?: boolean }) => p.animal === animal && !!p.holo === holo;
  const owned = profiles.profile?.parts ?? [];
  if (owned.some((p) => p.slot === slot && same(p))) return false;
  if (me && (me.stash.some((p) => p.slot === slot && same(p)) || (same(me.parts[slot]) && me.parts[slot].found))) return false;
  return true;
}
renderer.isNewPart = isNewPart;
const audio = new GameAudio(sound);
const music = new Music(sound, import.meta.env.BASE_URL);
/** The soft button click. */
// Menu icon buttons name themselves on a long hover or press (installed before the click sound below).
installTooltips();
const uiClick = () => sound.play('click', { pitchSpread: 0, volume: 0.45 });
// Every button on the cards, the options and the spectate bar clicks (not the in-match HUD).
document.addEventListener(
  'click',
  (e) => {
    const button = (e.target as Element | null)?.closest?.('button');
    if (button && !button.disabled && button.closest('.overlay, .sheet, .gear, #spectating')) uiClick();
  },
  true,
);
// Splashing through water: soft for your own steps, softer for others nearby.
renderer.onWaterStep = (at, id) => sound.play('splash', { at, volume: id === session?.localPlayerId ? 0.1 : 0.04, pitchSpread: 0.3 });
renderer.onStep = (at, id) => audio.step(at, id === session?.localPlayerId);
const help = new Help();
/** First-time tips (and the controls card on your first match). */
const tips = new Tips(
  (text, seconds) => toast.announce(text, seconds),
  () => help.show(),
);
const options = new Options({
  toggleSound: () => sound.toggleMute(),
  toggleMusic: () => music.toggle(),
  isMusicOn: () => music.isOn,
  isMuted: () => sound.isMuted,
  help: () => help.show(),
  leave: showMenu,
  // Online between matches (lobby, results, watching), leaving gives up your seat in the room.
  leaveQuestion: () => tr(room && !room.isSolo && (phase !== 'playing' || room.inWarmup) ? 'Leave the room?' : 'Leave the match?'),
});
document.querySelector<HTMLElement>('.rotate')!.innerHTML = icon('rotate', 'icon large');
tossHint.innerHTML = `${icon('jump', 'icon large')}<kbd>${tr('Space')}</kbd>`;
// The hint is a button too: tapping (or clicking) it drops you off the blimp.
tossHint.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tossHint.setPointerCapture(e.pointerId);
  input.virtualButtons |= Btn.Jump;
});
const releaseTossHint = () => (input.virtualButtons &= ~Btn.Jump);
tossHint.addEventListener('pointerup', releaseTossHint);
tossHint.addEventListener('pointercancel', releaseTossHint);
tossHint.addEventListener('lostpointercapture', releaseTossHint);

/** playing → out (card shown) → spectating (card hidden) → over (match ended), or playing → won. */
let phase: 'playing' | 'out' | 'spectating' | 'over' = 'playing';
let followId: EntityId = -1;
/** Who knocked you out and with what, captured when it happened. */
/** The winner of this match has been celebrated (the victory lap is on). */
let celebrated = false;
let knockedOutBy = '';
/** Solo: the match result went to the server already (which parts you keep). */

let last = performance.now();
const aimOffset = { x: 0, y: 0 };
let me: Player | undefined;
/** The state drawn last frame (touch aim assist looks for targets in it). */
let shown: GameState | null = null;

// Spectating: ◀ name ▶ switches between the plushies still in the match; ✕ goes back to the
// results card (Again), or to the menu when only watching.
spectateEl.innerHTML = `<button type="button" class="round small spec-prev" aria-label="${tr('Previous')}">${icon('arrow', 'icon flip')}</button>
  <span class="spec-label"></span>
  <button type="button" class="round small spec-next" aria-label="${tr('Next')}">${icon('arrow')}</button>
  <button type="button" class="round small spec-menu" aria-label="${tr('Back')}">${icon('close')}</button>`;
const spectateLabel = spectateEl.querySelector<HTMLElement>('.spec-label')!;
spectateEl.querySelector('.spec-prev')!.addEventListener('click', () => switchWatched(-1));
spectateEl.querySelector('.spec-next')!.addEventListener('click', () => switchWatched(1));
spectateEl.querySelector('.spec-menu')!.addEventListener('click', () => stopSpectating());

/** Follow the next (or previous) plush still in the match, in a stable order. */
function switchWatched(step: 1 | -1): void {
  if (!shown || spectateEl.hidden) return;
  const alive = shown.players.filter((p) => p.alive && p.id !== session?.localPlayerId).sort((a, b) => a.id - b.id);
  if (alive.length === 0) return;
  const at = alive.findIndex((p) => p.id === followId);
  followId = alive[(at + step + alive.length) % alive.length]!.id;
}

window.addEventListener('keydown', (e) => {
  // Typing a name or code: no hotkeys.
  const active = document.activeElement;
  if (active instanceof HTMLInputElement) return;
  if (e.code === 'KeyM' && !e.repeat) sound.toggleMute();
  // Spectating: arrows (or A / D) switch who you watch.
  if (!spectateEl.hidden && !e.repeat) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') switchWatched(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') switchWatched(1);
    if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) uiClick();
  }
  // A focused button (Play again / Spectate / Start) handles its own Enter.
  if (e.code !== 'Enter' || active instanceof HTMLButtonElement || mode === 'menu') return;
  uiClick();
  if (lobbyScreen?.visible) {
    // (A public room starts by itself.)
    if (!room?.isPublic) room?.start(lobbyScreen.bots, lobbyScreen.teams, savedBotLevel(), savedMap().id);
  } else if (phase !== 'playing') playAgain();
});

/** The bots-only match behind the menu and lobby: no HUD, no result cards, loops forever. */
function isBackdrop(s: GameSession | null): boolean {
  return s instanceof LocalSession && s.localPlayerId === -1;
}

/** Shows a new match: solo, online, or the bots-only backdrop. */
function beginMatch(next: GameSession): void {
  session = next;
  veilUntilSettled();
  updates.setPlaying(!isBackdrop(next));
  renderer.setMap(next.map);
  world = createWorld(next.map);
  hudEl.classList.toggle('idle', isBackdrop(next));
  // The music-box tune behind the menu and lobby; the bouncier one in a match.
  music.play(isBackdrop(next) ? 'menu' : 'match', next.map.theme ?? 'backyard');
  audio.reset();
  audio.setMap(next.map);
  renderer.reset();
  endScreen.hide();
  // (Not for the room's warm-up: the lobby card stays up, not hidden and popped in again.)
  if (!(room?.inWarmup && next === room.match)) lobbyScreen?.hide();
  knockedOutBy = '';
  celebrated = false;
  hitDirection.clear();
  zoneNames.reset();
  toast.reset();
  endScreen.setKept(null);
  endScreen.setButtons(null);
  // An offline practice match: its card says nothing it found is kept.
  endScreen.setPractice(mode === 'solo' && !isBackdrop(next));
  me = undefined;
  hudEl.classList.remove('out');
  const watching = next.localPlayerId === -1;
  if (!watching) tips.matchStarted();
  phase = watching ? 'spectating' : 'playing';
  followId = next.localPlayerId;
  spectateEl.hidden = !watching || isBackdrop(next);
  options.setCanLeave(mode !== 'menu');
}

/** Back to the title menu: leave any room, watch bots in the background. */
function showMenu(): void {
  document.body.classList.remove('warmup');
  room?.close();
  room = null;
  lobbyScreen?.remove();
  lobbyScreen = null;
  history.replaceState(null, '', location.pathname);
  mode = 'menu';
  beginMatch(newBackdrop());
  help.hide();
  if (firstMenu) {
    void firstMenu.then(() => mode === 'menu' && menu.show());
    firstMenu = null;
  } else menu.show();
  void updates.check();
}

/**
 * Solo: played on the server (a room for you and bots, started at once), so what it earns counts.
 * Offline (or the server can't), an offline practice match here instead: it counts for nothing.
 */
function playSolo(): void {
  veilDown();
  createSoloRoom(savedBotLevel(), savedMap().id)
    .then((code) => joinRoom(code, 'solo'))
    .catch(() => practiceSolo());
}

/** A solo match played here, offline: the same game, but nothing found is kept. */
function practiceSolo(): void {
  mode = 'solo';
  menu.hide();
  beginMatch(newSolo());
}

/** "Play online": into the public room that's filling up (from the menu, or again after a match). */
function playOnline(): void {
  veilDown();
  findPublicRoom()
    .then((code) => joinRoom(code, 'public'))
    .catch((err: unknown) => {
      showMenu();
      menu.showError(`${tr("Couldn't find a match.")} ${err instanceof Error ? err.message : ''}`);
    });
}

/** Out of the current room (without going back to the menu). */
function leaveRoom(): void {
  document.body.classList.remove('warmup');
  room?.close();
  room = null;
  lobbyScreen?.remove();
  lobbyScreen = null;
}

function playAgain(): void {
  // A public or solo match is played once: again means a new one.
  if (room?.isPublic || room?.isSolo) {
    const solo = room.isSolo;
    leaveRoom();
    endScreen.hide();
    if (solo) playSolo();
    else playOnline();
    return;
  }
  if (room) {
    if (room.isHost) room.start(lobbyScreen?.bots ?? 7, lobbyScreen?.teams ?? true, savedBotLevel(), savedMap().id);
    return;
  }
  // Offline practice: try for a real solo again (back online?), except in test runs (?seed, ?animal…).
  seed = (seed * 1664525 + 1013904223) >>> 0;
  if (localTest) beginMatch(newSolo());
  else playSolo();
}

/** Online: connect to a room, show its lobby, and switch to each match the host starts. */
function joinRoom(code: string, kind: 'friends' | 'public' | 'solo' = 'friends'): void {
  mode = 'online';
  menu.hide();
  // The scene goes dark while the room connects; its warm-up (or the match) comes in when drawn.
  veilDown();
  // (A friend's room can be shared by its link; a public or solo one is just for now.)
  history.replaceState(null, '', kind === 'friends' ? `?room=${code}` : location.pathname);
  // Bots play in the background until the host starts.
  if (!isBackdrop(session)) beginMatch(newBackdrop());
  hudEl.classList.add('idle');
  // ?lag=150 fakes 150 ms of network round trip (to try prediction on localhost).
  room = new RoomClient(code, playerName(), input, Number(params.get('lag')) || 0, profiles.roomToken);
  room.onKept = (parts) => {
    endScreen.setKept(parts);
    void profiles.refresh().then(() => tips.collection(profiles.profile?.parts ?? []));
  };
  room.onButtons = (award, balance) => {
    endScreen.setButtons(award);
    profiles.setButtons(balance);
  };
  lobbyScreen = new LobbyScreen(
    document.body,
    room,
    () => options.askToLeave(),
    (name) => {
      saveName(name);
      room?.rename(name);
    },
    // (Always wired: the profile may only arrive after the lobby opens; shown once it has.)
    () => {
      if (!profiles.profile) return;
      openWardrobe(lobbyScreen!, () => {
        if (room?.lobby?.phase === 'lobby' && !room.match) lobbyScreen?.show();
      });
    },
  );
  lobbyScreen.setWardrobe(!!profiles.profile);
  // (A solo match has no lobby: it starts as soon as you're in.)
  if (kind !== 'solo') lobbyScreen.show();
  room.onLobby = () => {
    if (!room || !lobbyScreen) return;
    // Turned away for being an older version than the server's: reloading is the only way in.
    if (room.error === 'version') updates.markOutdated(true);
    if (room.isSolo) return endScreen.refreshLobby();
    // (Not over the Wardrobe: the lobby comes back when it closes.)
    if (room.lobby?.phase === 'lobby' && (!room.match || room.inWarmup) && !wardrobe.visible) lobbyScreen.show();
    else lobbyScreen.render();
    endScreen.refreshLobby();
  };
  room.onMatch = (match) => {
    beginMatch(match);
    // The warm-up: play around with the lobby docked to the side; the real match hides it.
    document.body.classList.toggle('warmup', !!room?.inWarmup);
    if (room?.inWarmup) {
      hudEl.classList.remove('idle');
      endScreen.hide();
      if (!wardrobe.visible) lobbyScreen?.show();
    } else lobbyScreen?.hide();
  };
  // The host took everyone back to the lobby: bots play in the background again until the next start.
  room.onBackToLobby = () => {
    endScreen.hide();
    spectateEl.hidden = true;
    beginMatch(newBackdrop());
    hudEl.classList.add('idle');
  };
}

function playerName(): string {
  const fromUrl = params.get('name');
  try {
    return fromUrl ?? localStorage.getItem('stuffed.name') ?? `${tr('Plush')} ${100 + Math.floor(Math.random() * 900)}`;
  } catch {
    return fromUrl ?? tr('Plush');
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem('stuffed.name', name);
  } catch {
    // not remembered; fine
  }
}

function spectate(): void {
  endScreen.hide();
  phase = 'spectating';
  spectateEl.hidden = false;
}

/** Leaves spectating: back to your results card, or to the menu if you were only watching. */
function stopSpectating(): void {
  if (!me) {
    showMenu();
    return;
  }
  spectateEl.hidden = true;
  phase = 'out';
  endScreen.reopen();
}

function frame(now: number): void {
  const frameStart = performance.now();
  // The first rAF timestamp can be earlier than performance.now() at startup: never go negative.
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;

  const touchMode = document.body.classList.contains('touch-mode');
  if (touchMode && me?.alive && shown) aimByTouch(shown, me);
  else if (input.pointer && me?.alive) {
    const cursor = renderer.screenToWorld(input.pointer.x, input.pointer.y);
    if (cursor) {
      const center = renderer.localPlayerPos;
      aimOffset.x = cursor.x - center.x;
      aimOffset.y = cursor.y - center.y;
      input.setAim(aimOffset.x, aimOffset.y);
      // The gun is held off-center, so aim from its barrel tip: shots then cross the cursor.
      // Very close to the plush that would swing the aim wildly, so keep the center aim there.
      const weapon = me.weapons[me.activeSlot];
      if (weapon && Math.hypot(aimOffset.x, aimOffset.y) > config.weapons[weapon.kind].barrelLength + 0.5) {
        const tip = muzzlePosition(center, input.currentAim, weapon.kind);
        input.setAim(cursor.x - tip.x, cursor.y - tip.y);
      }
    }
  }

  if (!session) {
    requestAnimationFrame(frame);
    return;
  }
  // The still backdrop, settled: nothing to draw.
  if (isBackdrop(session)) {
    if (backdropSeconds >= BACKDROP_SECONDS) {
      // The still picture is done: show it.
      if (veiledFrames !== null) liftVeil();
      requestAnimationFrame(frame);
      return;
    }
    backdropSeconds += Math.max(dt, 1 / 60);
    // The middle of the map, pulled well back: a good part of it in the picture.
    renderer.lookAt({ x: session.map.width / 2, y: session.map.height / 2 }, BACKDROP_ZOOM);
  }
  // (The still backdrop's clock doesn't run: the toy train, the mower and the rest stay put. It's
  // drawn a few frames only so textures still loading show up.)
  else session.advance(dt);
  if (!session.ready) {
    requestAnimationFrame(frame);
    return;
  }
  const f = session.frame();
  const state = f.curr;
  shown = state;
  const events = session.takeEvents();
  renderer.playEvents(events, state);
  toast.events(events);
  const localId = session.localPlayerId;
  for (const e of events) {
    if (e.type === 'hit' && e.sourceId === session.localPlayerId) {
      const target = state.players.find((p) => p.id === e.targetId);
      if (!target) continue;
      if (e.armorDamage > 0) numbers.add(target.pos.x, target.pos.y, String(Math.round(e.armorDamage)), 'armor');
      if (e.damage > 0) numbers.add(target.pos.x, target.pos.y, String(Math.round(e.damage)), 'stuffing');
    }
    if (e.type === 'buttonsFound' && e.playerId === localId) numbers.add(e.pos.x, e.pos.y, '', 'buttons', `${icon('button')}<b>+${e.amount}</b>`);
    // Your knockout: its Buttons pop up where they went down (counted at the end, up to the cap).
    if (e.type === 'eliminated' && e.byId === localId && e.playerId !== localId) {
      const out = state.players.find((p) => p.id === e.playerId);
      const mine = state.players.find((p) => p.id === localId);
      if (out && (mine?.knockouts ?? 0) <= BUTTONS.maxKnockouts) numbers.add(out.pos.x, out.pos.y, '', 'buttons', `${icon('button')}<b>+${BUTTONS.knockout}</b>`);
    }
    if (e.type === 'eliminated' && e.playerId === session.localPlayerId) knockedOutBy = describeKiller(session, state, e.byId, e.cause);
    // Hit by someone else: point toward where it came from.
    if (e.type === 'hit' && e.targetId === session.localPlayerId && e.from && e.sourceId !== session.localPlayerId) hitDirection.add(e.from);
    // Someone firing nearby (seen or not, not a teammate): a softer arc toward them.
    const mine = state.players.find((p) => p.id === localId);
    const shooterTeam = e.type === 'shot' ? (state.players.find((p) => p.id === e.playerId)?.team ?? 0) : 0;
    const mate = !!mine && mine.team !== 0 && shooterTeam === mine.team;
    if (e.type === 'shot' && mine?.alive && !mine.drop && !mate && e.playerId !== mine.id && Math.hypot(e.pos.x - mine.pos.x, e.pos.y - mine.pos.y) <= SHOT_HINT_RANGE) {
      hitDirection.addShot(e.pos, e.playerId);
    }
  }

  me = state.players.find((p) => p.id === localId);
  updatePhase(state);
  sound.listener.x = renderer.cameraFocus.x;
  sound.listener.y = renderer.cameraFocus.y;
  audio.update(events, state, session.localPlayerId);

  renderer.render(f, {
    localPlayerId: session.localPlayerId,
    followId,
    localAim: input.currentAim,
    aimOffset,
    // (The still backdrop: a long step, so the camera is where it's going at once, no glide.)
    dt: isBackdrop(session) ? 30 : dt,
    time: now / 1000,
  });
  numbers.update(dt, renderer.camera, canvas.clientWidth, canvas.clientHeight);
  nameTags.update(!!room?.inWarmup && !isBackdrop(session), f.curr, session.localPlayerId, renderer, renderer.camera, canvas.clientWidth, canvas.clientHeight);
  // Jump to drop: off the blimp, or to let go of a zip line.
  const onZip = !!me?.ride && session.map.rides?.[me.ride.index]?.kind === 'zip';
  tossHint.hidden = (me?.drop !== 'riding' && !onZip) || isBackdrop(session);
  hitDirection.update(dt, renderer.camera, canvas.clientWidth, canvas.clientHeight, renderer.localPlayerPos, me?.z ?? 0);
  tootIfTrainComing(state, dt);
  mateArrows.update(isBackdrop(session) ? null : state, state.players.find((p) => p.id === followId), renderer.camera, canvas.clientWidth, canvas.clientHeight);

  hud.update(state, me, f.alpha, world);
  touch.setActive(phase === 'playing' && !!me?.alive && !isBackdrop(session));
  if (me) input.heldSlot = me.activeSlot;
  touch.setGrabReady(hud.grabReady);
  touch.setStashReady(hud.stashReady);
  hud.place(renderer.camera, canvas.clientWidth, canvas.clientHeight, renderer.localPlayerPos);
  zoneHud.update(state, me, renderer.localPlayerPos, session.playersLeft());
  zoneNames.update(session.map, me, renderer.localPlayerPos, dt);
  toast.update(dt);
  if (!isBackdrop(session)) tips.update(dt, state, me, world, events, document.body.classList.contains('touch-mode'));
  debug.update(dt, {
    seed,
    tick: state.tick,
    pos: me ? `${me.pos.x.toFixed(1)}, ${me.pos.y.toFixed(1)}` : '-',
    speed: me ? Math.hypot(me.vel.x, me.vel.y).toFixed(2) : '-',
    z: me ? `${me.z.toFixed(2)}${me.vz !== 0 ? ` (vz ${me.vz.toFixed(1)})` : ''}` : '-',
    alive: state.players.filter((p) => p.alive).length,
    bush: me?.inBush ? 'hidden' : '-',
    roof: me && me.building !== -1 ? `building ${me.building}` : '-',
    proj: state.projectiles.length,
    loot: `${state.loot.length} on ground, ${state.chests.filter((c) => !c.opened).length} chests closed`,
    zone: `${state.zone.stage} ${zoneSecondsLeft(state.zone, state.tick).toFixed(1)}s r=${state.zone.current.radius.toFixed(1)}`,
    soggy: me?.soggy ? 'yes' : '-',
    phase,
    gpu: `${renderer.stats.calls} calls, ${(renderer.stats.triangles / 1000).toFixed(0)}k tris, x${renderer.stats.pixelRatio}, ${renderer.stats.programs} shaders`,
    cpu: `${(performance.now() - frameStart).toFixed(1)} ms/frame`,
  });

  const spent = performance.now() - frameStart;
  if (spent > 100 && debug.visible) {
    // Which settings differ between the newest shader and the closest older one of its kind?
    const keys = renderer.programNames.map((k) => k.split(','));
    const newest = keys.at(-1) ?? [];
    const diffs = keys.slice(0, -1).filter((k) => k[0] === newest[0] && k.length === newest.length)
      .map((k) => newest.map((v, i) => (v !== k[i] ? `#${i}:${k[i]}->${v}` : '')).filter(Boolean).join(' '))
      .sort((a, b) => a.length - b.length);
    console.warn(`slow frame: ${spent.toFixed(0)} ms, newest shader differs: ${diffs[0] ?? newest.slice(0, 8).join(',')}`);
  }
  requestAnimationFrame(frame);
}

/** Moves between playing, knocked out, spectating and the end of the match. */
function updatePhase(state: GameState): void {
  if (!session) return;
  // The language switch reloads the page: not while you're playing a match.
  options.setCanSwitchLang(isBackdrop(session) || phase === 'over' || phase === 'out');
  // A match behind the veil: a few frames drawn (shaders linked, textures in), then it lifts.
  if (veiledFrames !== null && !isBackdrop(session) && ++veiledFrames >= VEIL_FRAMES) liftVeil();
  const total = state.players.length;
  if (isBackdrop(session)) return;
  if (!me) {
    // Watching a match you're not in: keep following someone; show the result at the end.
    if (!isAlive(state, followId)) followId = nextAlive(state, { x: 40, y: 40 });
    const watched = state.players.find((p) => p.id === followId);
    spectateLabel.innerHTML = spectateBar(session, watched);
    if (phase !== 'over' && state.status === 'ended') {
      phase = 'over';
      spectateEl.hidden = true;
      endScreen.show({
        tone: 'lose',
        title: tr('Over'),
        subtitleHtml: winnerLine(state),
        placement: `${total}`,
        stats: [],
        canSpectate: false,
        waitingForHost: !!room && !room.isPublic && !room.isHost,
      });
    }
    return;
  }

  // Re-stitched by a teammate: back in the game.
  if ((phase === 'out' || phase === 'spectating') && me.alive && state.status === 'playing') {
    phase = 'playing';
    endScreen.hide();
    spectateEl.hidden = true;
    hudEl.classList.remove('out');
    followId = me.id;
    knockedOutBy = '';
    return;
  }

  const teamWon = state.winnerTeam !== null && state.winnerTeam === me.team;
  // The winner is decided: celebrate right away, then a victory lap to loot (and dance) before the end.
  if (!celebrated && state.victoryUntil !== null) {
    celebrated = true;
    const lap = Math.max(1, (state.victoryUntil - state.tick) / config.tickRate);
    if (state.winnerId === me.id || teamWon) {
      if (me.alive) renderer.celebrate(me.id, state);
      sound.play('win', { pitchSpread: 0 });
      toast.announce(tr(teamWon ? 'Your team wins! Grab the loot!' : 'You win! Grab the loot!'), lap);
    } else {
      const winner = state.players.find((p) => p.id === state.winnerId);
      if (winner) toast.announce(tr('{name} wins!').replace('{name}', winner.name), lap);
    }
  }
  if (phase === 'playing' && state.status === 'ended' && (state.winnerId === me.id || teamWon)) {
    phase = 'over';
    endScreen.show({ ...resultView(state, me, 'win', tr(teamWon ? 'Team wins!' : 'Winner!'), winnerLine(state), false), waitingForHost: !!room && !room.isPublic && !room.isHost });
    updates.setPlaying(false);
    void updates.check();
    return;
  }

  if (phase === 'playing' && !me.alive) {
    phase = 'out';
    hudEl.classList.add('out');
    sound.play('lose', { volume: 0.8, pitchSpread: 0 });
    // Watch a teammate still in it; otherwise whoever got you.
    const mate = nextAlive(state, me.pos, me.team);
    followId = me.team !== 0 && state.players.find((p) => p.id === mate)?.team === me.team ? mate : me.eliminatedBy !== null && isAlive(state, me.eliminatedBy) ? me.eliminatedBy : nextAlive(state, me.pos);
    endScreen.show(resultView(state, me, 'lose', tr('Unstitched!'), knockedOutBy, state.status === 'playing'));
    updates.setPlaying(false);
    void updates.check();
    return;
  }

  if ((phase === 'out' || phase === 'spectating') && state.status === 'ended') {
    phase = 'over';
    spectateEl.hidden = true;
    // (Out, but your team won: the win sound played when it was decided.)
    endScreen.show({ ...resultView(state, me, teamWon ? 'win' : 'lose', tr(teamWon ? 'Team wins!' : 'Over'), winnerLine(state), false), waitingForHost: !!room && !room.isPublic && !room.isHost });
    updates.setPlaying(false);
    void updates.check();
    return;
  }

  // Spectating: if the plush we watch goes down, follow whoever got them, else the nearest one left.
  if (phase !== 'playing' && !isAlive(state, followId)) {
    const watched = state.players.find((p) => p.id === followId);
    const mate = nextAlive(state, watched?.pos ?? me.pos, me.team);
    followId =
      me.team !== 0 && state.players.find((p) => p.id === mate)?.team === me.team
        ? mate
        : watched?.eliminatedBy != null && isAlive(state, watched.eliminatedBy)
          ? watched.eliminatedBy
          : nextAlive(state, watched?.pos ?? me.pos);
  }
  if (phase === 'spectating') {
    const watched = state.players.find((p) => p.id === followId);
    spectateLabel.innerHTML = spectateBar(session, watched);
  }
}

function resultView(state: GameState, me: Player, tone: 'win' | 'lose', title: string, subtitleHtml: string, canSpectate: boolean): EndView {
  const until = me.eliminatedTick ?? state.tick;
  return {
    tone,
    title,
    subtitleHtml,
    placement: `#${me.placement ?? 1}`,
    stats: [
      ['knockout', String(me.knockouts)],
      // Damage dealt: a broken heart (a plain one would read as your own health).
      ['broken', String(Math.round(me.damageDealt))],
      ['timer', clock(until / config.tickRate)],
    ],
    canSpectate,
  };
}

/**
 * Who knocked you out: a picture of their weapon and their name; anything else (the Rinse, an air
 * strike, a map toy, the mower) is a broken heart.
 * Online, a hidden attacker (in a bush, say) isn't in your state: their name still shows.
 */
function describeKiller(s: GameSession, state: GameState, byId: EntityId | null, cause?: KnockoutCause): string {
  if (cause || byId === null) return icon('broken');
  const killer = state.players.find((p) => p.id === byId);
  const weapon = killer?.weapons[killer.activeSlot];
  const art = weapon ? icon(weapon.kind, 'icon killer-weapon') : '';
  return `${art}<span>${escapeHtml(s.playerName(byId))}</span>`;
}

function spectateBar(s: GameSession, watched: Player | undefined): string {
  const left = s.playersLeft();
  return `${icon('eye')}<span>${escapeHtml(watched?.name ?? '…')}</span>${icon('person')}<b>${left}</b>`;
}

/** Shots fired within this distance of you show a hint arc toward the shooter. */
const SHOT_HINT_RANGE = 24;

/** Aim assist reach for touch: enemies within this angle and distance pull the aim onto them. */
const ASSIST_ANGLE = (15 * Math.PI) / 180;
const ASSIST_RANGE = 16;
/** How far ahead a touch aim points when nobody is targeted (sets the shot's drop). */
const TOUCH_AIM_DISTANCE = 8;
const lastTouchAim: Vec2 = { x: 1, y: 0 };

/**
 * Touch aim: the right stick, or the walking direction when it's idle. With the stick held,
 * the aim snaps to the nearest visible enemy close to where it points.
 */
function aimByTouch(state: GameState, me: Player): void {
  const stick = touch.aim;
  const moving = Math.hypot(input.virtualMove.x, input.virtualMove.y) > 0;
  if (stick) Object.assign(lastTouchAim, stick);
  else if (moving) Object.assign(lastTouchAim, { x: input.virtualMove.x, y: input.virtualMove.y });
  const len = Math.hypot(lastTouchAim.x, lastTouchAim.y) || 1;
  let dir = { x: lastTouchAim.x / len, y: lastTouchAim.y / len };
  let distance = TOUCH_AIM_DISTANCE;
  if (stick) {
    let best = ASSIST_ANGLE;
    for (const p of state.players) {
      if (p.id === me.id || !p.alive || (me.team !== 0 && p.team === me.team) || !canSee(world, state, me, p)) continue;
      const dx = p.pos.x - me.pos.x;
      const dy = p.pos.y - me.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > ASSIST_RANGE || d < 1e-3) continue;
      const off = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dy * dir.y) / d)));
      if (off < best) {
        best = off;
        dir = { x: dx / d, y: dy / d };
        distance = d;
      }
    }
  }
  input.setAim(dir.x * distance, dir.y * distance);
  // The camera leans toward where the stick points, like it does toward the cursor.
  aimOffset.x = stick ? dir.x * distance : 0;
  aimOffset.y = stick ? dir.y * distance : 0;
}

function isAlive(state: GameState, id: EntityId): boolean {
  return state.players.some((p) => p.id === id && p.alive);
}

/** The nearest plush still in the match; with `team`, a teammate if any is left. */
function nextAlive(state: GameState, near: { x: number; y: number }, team = 0): EntityId {
  let best: Player | undefined;
  let bestD = Infinity;
  const mates = team !== 0 && state.players.some((p) => p.alive && p.team === team);
  for (const p of state.players) {
    if (!p.alive || (mates && p.team !== team)) continue;
    const d = Math.hypot(p.pos.x - near.x, p.pos.y - near.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best?.id ?? -1;
}

/** Seconds until the train may toot at you again. */
let tootWait = 0;

/** The toy train toots (the pirate ship rings its bell) when it's about to run into you, so you see it coming. */
function tootIfTrainComing(state: GameState, dt: number): void {
  tootWait = Math.max(0, tootWait - dt);
  const track = session?.map.track;
  if (!track || !me?.alive || me.drop || tootWait > 0 || me.z >= layoutOf(track).deckHeight - 0.05) return;
  const pos = renderer.localPlayerPos;
  for (const ahead of [0.6, 1.2, 1.8]) {
    const near = trainCircles(track, state.tick + ahead * config.tickRate).some((c) => c.shoves && Math.hypot(pos.x - c.x, pos.y - c.y) < c.r + 0.9);
    if (near) {
      const now = trainCars(track, state.tick)[0]!;
      sound.play(track.style === 'ship' ? 'ship_bell' : 'train_toot', { at: now.pos, volume: 0.9, pitchSpread: 0 });
      tootWait = 4;
      return;
    }
  }
}

/** Who won, for the results card: a crown and the winner's name (or the whole team's), or a broken heart. */
function winnerLine(state: GameState): string {
  if (state.winnerTeam !== null) {
    const names = state.players.filter((p) => p.team === state.winnerTeam).map((p) => escapeHtml(p.name));
    return `${icon('crown')}<span>${names.join(', ')}</span>`;
  }
  const winner = state.players.find((p) => p.id === state.winnerId);
  return winner ? `${icon('crown')}<span>${escapeHtml(winner.name)}</span>` : icon('broken');
}

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Everyone starts with the sim's starting loadout. To test a weapon without finding it,
 * use ?loadout=foam_dart_smg:2,super_soaker:4 (kind:rarity, rarity 0-4).
 */
function loadoutFromUrl(): WeaponSpec[] | undefined {
  const param = params.get('loadout');
  if (!param) return undefined;
  return param
    .split(',')
    .slice(0, 2)
    .map((part) => part.split(':'))
    .filter(([kind]) => kind !== undefined && kind in config.weapons)
    .map(([kind, rarity]) => ({
      kind: kind as WeaponKind,
      rarity: Math.min(4, Math.max(0, Number(rarity) || 0)) as Rarity,
    }));
}

// An invite link (?room=CODE) goes straight to that room's lobby; ?online creates a room;
// ?solo (or ?animal) starts a solo match; otherwise the title menu.
const roomCode = parseRoomCode(params.get('room') ?? '');
if (roomCode) {
  joinRoom(roomCode);
} else if (params.has('online')) {
  createRoom()
    .then((code) => joinRoom(code))
    .catch((err: unknown) => {
      showMenu();
      menu.showError(`${tr("Couldn't reach the game server.")} ${err instanceof Error ? err.message : ''}`);
    });
} else if (localTest) {
  mode = 'solo';
  beginMatch(newSolo());
} else if (params.has('solo')) {
  playSolo();
} else {
  showMenu();
}

// Dev builds only: lets test scripts reach the running match (window.stuffed.session), and the
// profile with the animals (to preview, say, the Wardrobe with everything owned).
if (import.meta.env.DEV) Object.assign(window, { stuffed: { renderer, profiles, ANIMALS, PART_SLOTS, ANIMAL_RARITY, get session() { return session; } } });

requestAnimationFrame(frame);
