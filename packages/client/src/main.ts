import './style.css';
import { canSee, config, createWorld, muzzlePosition, TEST_MAP, zoneSecondsLeft } from '@stuffed/sim';
import { parseRoomCode } from '@stuffed/sim/net';
import type { EntityId, GameState, Player, Rarity, Vec2, WeaponKind, WeaponSpec } from '@stuffed/sim';
import { GameAudio } from './audio/game-audio.ts';
import { Sound } from './audio/sound.ts';
import { KeyboardMouseInput } from './input/keyboard-mouse.ts';
import { TouchControls } from './input/touch-controls.ts';
import { GameRenderer } from './render/game-renderer.ts';
import { LocalSession } from './session/local-session.ts';
import { createRoom, RoomClient } from './session/room-client.ts';
import type { GameSession } from './session/session.ts';
import { DebugOverlay } from './ui/debug-overlay.ts';
import { EndScreen, type EndView } from './ui/end-screen.ts';
import { escapeHtml } from './ui/escape.ts';
import { FloatingNumbers } from './ui/floating-numbers.ts';
import { Help } from './ui/help.ts';
import { Hud } from './ui/hud.ts';
import { icon } from './ui/icons.ts';
import { LobbyScreen } from './ui/lobby-screen.ts';
import { MenuScreen } from './ui/menu-screen.ts';
import { Options } from './ui/options.ts';
import { ZoneHud } from './ui/zone-hud.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hudEl = document.querySelector<HTMLElement>('#hud')!;
const spectateEl = document.querySelector<HTMLElement>('#spectating')!;

const input = new KeyboardMouseInput(canvas);
const touch = new TouchControls(input);
/** For touch aim assist (who can be seen); the map is the same in every match. */
const world = createWorld(TEST_MAP);
const params = new URLSearchParams(location.search);
const loadout = loadoutFromUrl();
// ?zonescale=0.1 runs the Rinse 10x faster for testing.
const zoneTimeScale = Number(params.get('zonescale')) || 1;
// ?seed=123 replays the same spawns and cosmetics, handy for reproducing bugs (first match only).
let seed = Number(params.get('seed')) || Date.now() >>> 0;

const newSolo = () => new LocalSession(input, { seed, zoneTimeScale, ...(loadout ? { loadout } : {}) });
/** Bots only, behind the title menu and the lobby. */
const newBackdrop = () => new LocalSession(input, { seed: (Math.random() * 2 ** 32) >>> 0, botCount: 9, watchOnly: true });
/** What the player is doing: at the title menu, a solo match, or in an online room. */
let mode: 'menu' | 'solo' | 'online' = 'menu';
/** The match being shown: solo (in the browser), online (from the server) or the menu backdrop. */
let session: GameSession | null = null;
/** Set when playing online. */
let room: RoomClient | null = null;
let lobbyScreen: LobbyScreen | null = null;
// ?quality=high keeps full resolution even if the frame rate drops.
const renderer = new GameRenderer(canvas, newSolo().map, params.get('quality') === 'high');
const debug = new DebugOverlay(document.querySelector<HTMLElement>('#debug')!, (on) => renderer.setDebug(on));
const hud = new Hud(hudEl, input);
const numbers = new FloatingNumbers(document.querySelector<HTMLElement>('#floaters')!);
const zoneHud = new ZoneHud(hudEl);
const endScreen = new EndScreen(document.body, playAgain, spectate, showMenu);
const menu = new MenuScreen(document.body, playerName(), {
  solo: (name) => {
    saveName(name);
    mode = 'solo';
    menu.hide();
    beginMatch(newSolo());
  },
  create: (name) => {
    saveName(name);
    menu.setBusy(true);
    createRoom()
      .then((code) => joinRoom(code))
      .catch((err: unknown) => menu.showError(`Couldn't reach the game server. ${err instanceof Error ? err.message : ''}`));
  },
  join: (name, code) => {
    saveName(name);
    joinRoom(code);
  },
});
const sound = new Sound(import.meta.env.BASE_URL);
const audio = new GameAudio(sound);
const help = new Help();
const options = new Options({
  toggleSound: () => sound.toggleMute(),
  isMuted: () => sound.isMuted,
  help: () => help.show(),
  leave: showMenu,
});
document.querySelector<HTMLElement>('.rotate')!.innerHTML = icon('rotate', 'icon big');

/** playing → out (card shown) → spectating (card hidden) → over (match ended), or playing → won. */
let phase: 'playing' | 'out' | 'spectating' | 'over' = 'playing';
let followId: EntityId = -1;
/** Who knocked you out and with what, captured when it happened. */
let knockedOutBy = '';

let last = performance.now();
const aimOffset = { x: 0, y: 0 };
let me: Player | undefined;
/** The state drawn last frame (touch aim assist looks for targets in it). */
let shown: GameState | null = null;

window.addEventListener('keydown', (e) => {
  // Typing a name or code: no hotkeys.
  const active = document.activeElement;
  if (active instanceof HTMLInputElement) return;
  if (e.code === 'KeyM' && !e.repeat) sound.toggleMute();
  // A focused button (Play again / Spectate / Start) handles its own Enter.
  if (e.code !== 'Enter' || active instanceof HTMLButtonElement || mode === 'menu') return;
  if (lobbyScreen?.visible) room?.start(lobbyScreen.bots);
  else if (phase !== 'playing') playAgain();
});

/** The bots-only match behind the menu and lobby: no HUD, no result cards, loops forever. */
function isBackdrop(s: GameSession | null): boolean {
  return s instanceof LocalSession && s.localPlayerId === -1;
}

/** Shows a new match: solo, online, or the bots-only backdrop. */
function beginMatch(next: GameSession): void {
  session = next;
  hudEl.classList.toggle('idle', isBackdrop(next));
  audio.reset();
  renderer.reset();
  endScreen.hide();
  lobbyScreen?.hide();
  knockedOutBy = '';
  me = undefined;
  hudEl.classList.remove('out');
  const watching = next.localPlayerId === -1;
  phase = watching ? 'spectating' : 'playing';
  followId = next.localPlayerId;
  spectateEl.hidden = !watching || isBackdrop(next);
  options.setCanLeave(mode !== 'menu');
}

/** Back to the title menu: leave any room, watch bots in the background. */
function showMenu(): void {
  sound.play('click', { pitchSpread: 0 });
  room?.close();
  room = null;
  lobbyScreen?.remove();
  lobbyScreen = null;
  history.replaceState(null, '', location.pathname);
  mode = 'menu';
  beginMatch(newBackdrop());
  help.hide();
  menu.show();
}

function playAgain(): void {
  sound.play('click', { pitchSpread: 0 });
  if (room) {
    if (room.isHost) room.start(lobbyScreen?.bots ?? 7);
    return;
  }
  seed = (seed * 1664525 + 1013904223) >>> 0;
  beginMatch(newSolo());
}

/** Online: connect to a room, show its lobby, and switch to each match the host starts. */
function joinRoom(code: string): void {
  mode = 'online';
  menu.hide();
  history.replaceState(null, '', `?room=${code}`);
  // Bots play in the background until the host starts.
  if (!isBackdrop(session)) beginMatch(newBackdrop());
  hudEl.classList.add('idle');
  // ?lag=150 fakes 150 ms of network round trip (to try prediction on localhost).
  room = new RoomClient(code, playerName(), input, Number(params.get('lag')) || 0);
  lobbyScreen = new LobbyScreen(document.body, room, showMenu, (name) => {
    saveName(name);
    room?.rename(name);
  });
  lobbyScreen.show();
  room.onLobby = () => {
    if (!room || !lobbyScreen) return;
    if (room.lobby?.phase === 'lobby' && !room.match) lobbyScreen.show();
    else lobbyScreen.render();
  };
  room.onMatch = (match) => beginMatch(match);
}

function playerName(): string {
  const fromUrl = params.get('name');
  try {
    return fromUrl ?? localStorage.getItem('stuffed.name') ?? `Plush ${100 + Math.floor(Math.random() * 900)}`;
  } catch {
    return fromUrl ?? 'Plush';
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
  sound.play('click', { pitchSpread: 0 });
  endScreen.hide();
  phase = 'spectating';
  spectateEl.hidden = false;
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
  session.advance(dt);
  if (!session.ready) {
    requestAnimationFrame(frame);
    return;
  }
  const f = session.frame();
  const state = f.curr;
  shown = state;
  const events = session.takeEvents();
  renderer.playEvents(events, state);
  zoneHud.events(events);
  for (const e of events) {
    if (e.type === 'hit' && e.sourceId === session.localPlayerId) {
      const target = state.players.find((p) => p.id === e.targetId);
      if (!target) continue;
      if (e.armorDamage > 0) numbers.add(target.pos.x, target.pos.y, String(Math.round(e.armorDamage)), 'armor');
      if (e.damage > 0) numbers.add(target.pos.x, target.pos.y, String(Math.round(e.damage)), 'stuffing');
    }
    if (e.type === 'eliminated' && e.playerId === session.localPlayerId) knockedOutBy = describeKiller(state, e.byId);
  }

  const localId = session.localPlayerId;
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
    dt,
    time: now / 1000,
  });
  numbers.update(dt, renderer.camera, canvas.clientWidth, canvas.clientHeight);

  hud.update(state, me, f.alpha);
  touch.setActive(phase === 'playing' && !!me?.alive && !isBackdrop(session));
  touch.setGrabReady(hud.grabReady);
  hud.place(renderer.camera, canvas.clientWidth, canvas.clientHeight, renderer.localPlayerPos);
  zoneHud.update(state, me, renderer.localPlayerPos, dt);
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
  const total = state.players.length;
  if (isBackdrop(session)) {
    if (!isAlive(state, followId)) followId = nextAlive(state, { x: 40, y: 40 });
    if (state.status === 'ended') beginMatch(newBackdrop());
    return;
  }
  if (!me) {
    // Watching a match you're not in: keep following someone; show the result at the end.
    if (!isAlive(state, followId)) followId = nextAlive(state, { x: 40, y: 40 });
    const watched = state.players.find((p) => p.id === followId);
    spectateEl.innerHTML = spectateBar(state, watched);
    if (phase !== 'over' && state.status === 'ended') {
      phase = 'over';
      spectateEl.hidden = true;
      const winner = state.players.find((p) => p.id === state.winnerId);
      endScreen.show({
        tone: 'lose',
        title: 'Over',
        subtitleHtml: winner ? `${icon('crown')}<span>${escapeHtml(winner.name)}</span>` : icon('water'),
        placement: `${total}`,
        stats: [],
        canSpectate: false,
        waitingForHost: !!room && !room.isHost,
      });
    }
    return;
  }

  if (phase === 'playing' && state.status === 'ended' && state.winnerId === me.id) {
    phase = 'over';
    renderer.celebrate(me.id, state);
    sound.play('win', { pitchSpread: 0 });
    endScreen.show({ ...resultView(state, me, 'win', 'Winner!', `${icon('crown')}<span>${escapeHtml(me.name)}</span>`, false), waitingForHost: !!room && !room.isHost });
    return;
  }

  if (phase === 'playing' && !me.alive) {
    phase = 'out';
    hudEl.classList.add('out');
    sound.play('lose', { volume: 0.8, pitchSpread: 0 });
    followId = me.eliminatedBy !== null && isAlive(state, me.eliminatedBy) ? me.eliminatedBy : nextAlive(state, me.pos);
    endScreen.show(resultView(state, me, 'lose', 'Unstitched!', knockedOutBy, state.status === 'playing'));
    return;
  }

  if ((phase === 'out' || phase === 'spectating') && state.status === 'ended') {
    phase = 'over';
    spectateEl.hidden = true;
    const winner = state.players.find((p) => p.id === state.winnerId);
    const subtitle = winner ? `${icon('crown')}<span>${escapeHtml(winner.name)}</span>` : icon('water');
    endScreen.show({ ...resultView(state, me, 'lose', 'Over', subtitle, false), waitingForHost: !!room && !room.isHost });
    return;
  }

  // Spectating: if the plush we watch goes down, follow whoever got them, else the nearest one left.
  if (phase !== 'playing' && !isAlive(state, followId)) {
    const watched = state.players.find((p) => p.id === followId);
    followId = watched?.eliminatedBy != null && isAlive(state, watched.eliminatedBy) ? watched.eliminatedBy : nextAlive(state, watched?.pos ?? me.pos);
  }
  if (phase === 'spectating') {
    const watched = state.players.find((p) => p.id === followId);
    spectateEl.innerHTML = spectateBar(state, watched);
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
      ['damage', String(Math.round(me.damageDealt))],
      ['timer', clock(until / config.tickRate)],
    ],
    canSpectate,
  };
}

/** Who knocked you out, as icons: their weapon (in its rarity color) and name, or the water. */
function describeKiller(state: GameState, byId: EntityId | null): string {
  if (byId === null) return icon('water');
  const killer = state.players.find((p) => p.id === byId);
  if (!killer) return '';
  const weapon = killer.weapons[killer.activeSlot];
  const art = weapon ? `<span class="rarity" style="--rarity:${config.rarity[weapon.rarity].color}">${icon(weapon.kind)}</span>` : '';
  return `${art}<span>${escapeHtml(killer.name)}</span>`;
}

function spectateBar(state: GameState, watched: Player | undefined): string {
  const left = state.players.filter((p) => p.alive).length;
  return `${icon('eye')}<span>${escapeHtml(watched?.name ?? '…')}</span>${icon('person')}<b>${left}</b>`;
}

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
      if (p.id === me.id || !p.alive || !canSee(world, state, me, p)) continue;
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

function nextAlive(state: GameState, near: { x: number; y: number }): EntityId {
  let best: Player | undefined;
  let bestD = Infinity;
  for (const p of state.players) {
    if (!p.alive) continue;
    const d = Math.hypot(p.pos.x - near.x, p.pos.y - near.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best?.id ?? -1;
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
// ?solo starts a solo match; otherwise the title menu.
const roomCode = parseRoomCode(params.get('room') ?? '');
if (roomCode) {
  joinRoom(roomCode);
} else if (params.has('online')) {
  createRoom()
    .then((code) => joinRoom(code))
    .catch((err: unknown) => {
      showMenu();
      menu.showError(`Couldn't reach the game server. ${err instanceof Error ? err.message : ''}`);
    });
} else if (params.has('solo') || params.has('seed') || params.has('loadout')) {
  mode = 'solo';
  beginMatch(newSolo());
} else {
  showMenu();
}

// Dev builds only: lets test scripts reach the running match (window.stuffed.session).
if (import.meta.env.DEV) Object.assign(window, { stuffed: { renderer, get session() { return session; } } });

requestAnimationFrame(frame);
