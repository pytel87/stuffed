import './style.css';
import { config, muzzlePosition, zoneSecondsLeft } from '@stuffed/sim';
import { parseRoomCode } from '@stuffed/sim/net';
import type { EntityId, GameState, Player, Rarity, WeaponKind, WeaponSpec } from '@stuffed/sim';
import { GameAudio } from './audio/game-audio.ts';
import { Sound } from './audio/sound.ts';
import { KeyboardMouseInput } from './input/keyboard-mouse.ts';
import { GameRenderer } from './render/game-renderer.ts';
import { LocalSession } from './session/local-session.ts';
import { createRoom, RoomClient } from './session/room-client.ts';
import type { GameSession } from './session/session.ts';
import { DebugOverlay } from './ui/debug-overlay.ts';
import { EndScreen, type EndView } from './ui/end-screen.ts';
import { FloatingNumbers } from './ui/floating-numbers.ts';
import { Hud } from './ui/hud.ts';
import { LobbyScreen } from './ui/lobby-screen.ts';
import { ZoneHud } from './ui/zone-hud.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hudEl = document.querySelector<HTMLElement>('#hud')!;
const spectateEl = document.querySelector<HTMLElement>('#spectating')!;

const input = new KeyboardMouseInput(canvas);
const params = new URLSearchParams(location.search);
const loadout = loadoutFromUrl();
// ?zonescale=0.1 runs the Rinse 10x faster for testing.
const zoneTimeScale = Number(params.get('zonescale')) || 1;
// ?seed=123 replays the same spawns and cosmetics, handy for reproducing bugs (first match only).
let seed = Number(params.get('seed')) || Date.now() >>> 0;

const newSolo = () => new LocalSession(input, { seed, zoneTimeScale, ...(loadout ? { loadout } : {}) });
/** The match being shown: solo (in the browser) or online (from the server). */
let session: GameSession | null = null;
/** Set when playing online. */
let room: RoomClient | null = null;
let lobbyScreen: LobbyScreen | null = null;
const renderer = new GameRenderer(canvas, newSolo().map);
const debug = new DebugOverlay(document.querySelector<HTMLElement>('#debug')!, (on) => renderer.setDebug(on));
const hud = new Hud(hudEl);
const numbers = new FloatingNumbers(document.querySelector<HTMLElement>('#floaters')!);
const zoneHud = new ZoneHud(hudEl);
const endScreen = new EndScreen(document.body, playAgain, spectate);
const sound = new Sound(import.meta.env.BASE_URL);
const audio = new GameAudio(sound);

/** playing → out (card shown) → spectating (card hidden) → over (match ended), or playing → won. */
let phase: 'playing' | 'out' | 'spectating' | 'over' = 'playing';
let followId: EntityId = -1;
/** Who knocked you out and with what, captured when it happened. */
let knockedOutBy = '';

let last = performance.now();
const aimOffset = { x: 0, y: 0 };
let me: Player | undefined;

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) sound.toggleMute();
  // A focused button (Play again / Spectate / Start) handles its own Enter.
  if (e.code !== 'Enter' || document.activeElement instanceof HTMLButtonElement) return;
  if (lobbyScreen?.visible) room?.start(lobbyScreen.bots);
  else if (phase !== 'playing') playAgain();
});

/** Shows a new match, solo or online. */
function beginMatch(next: GameSession): void {
  session = next;
  hudEl.classList.remove('idle');
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
  spectateEl.hidden = !watching;
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
  hudEl.classList.add('idle');
  // ?lag=150 fakes 150 ms of network round trip (to try prediction on localhost).
  room = new RoomClient(code, playerName(), input, Number(params.get('lag')) || 0);
  lobbyScreen = new LobbyScreen(document.body, room);
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
    const name = fromUrl ?? localStorage.getItem('stuffed.name') ?? `Plush ${100 + Math.floor(Math.random() * 900)}`;
    localStorage.setItem('stuffed.name', name);
    return name;
  } catch {
    return fromUrl ?? 'Plush';
  }
}

function spectate(): void {
  sound.play('click', { pitchSpread: 0 });
  endScreen.hide();
  phase = 'spectating';
  spectateEl.hidden = false;
}

function frame(now: number): void {
  // The first rAF timestamp can be earlier than performance.now() at startup: never go negative.
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;

  if (input.pointer && me?.alive) {
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
  });

  requestAnimationFrame(frame);
}

/** Moves between playing, knocked out, spectating and the end of the match. */
function updatePhase(state: GameState): void {
  const total = state.players.length;
  if (!me) {
    // Watching a match you're not in: keep following someone; show the result at the end.
    if (!isAlive(state, followId)) followId = nextAlive(state, { x: 40, y: 40 });
    const watched = state.players.find((p) => p.id === followId);
    spectateEl.textContent = `Watching ${watched?.name ?? '…'} · ${state.players.filter((p) => p.alive).length} left`;
    if (phase !== 'over' && state.status === 'ended') {
      phase = 'over';
      spectateEl.hidden = true;
      const winner = state.players.find((p) => p.id === state.winnerId);
      endScreen.show({
        tone: 'lose',
        title: 'Match over',
        subtitle: winner ? `${winner.name} is the last plush standing.` : 'Nobody made it.',
        placement: `${total} plushies`,
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
    endScreen.show({ ...resultView(state, me, 'win', 'Last plush standing!', `You outlasted ${total - 1} other plushies.`, false), waitingForHost: !!room && !room.isHost });
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
    const subtitle = winner ? `${winner.name} is the last plush standing. ${knockedOutBy}` : `Nobody made it. ${knockedOutBy}`;
    endScreen.show({ ...resultView(state, me, 'lose', 'Match over', subtitle, false), waitingForHost: !!room && !room.isHost });
    return;
  }

  // Spectating: if the plush we watch goes down, follow whoever got them, else the nearest one left.
  if (phase !== 'playing' && !isAlive(state, followId)) {
    const watched = state.players.find((p) => p.id === followId);
    followId = watched?.eliminatedBy != null && isAlive(state, watched.eliminatedBy) ? watched.eliminatedBy : nextAlive(state, watched?.pos ?? me.pos);
  }
  if (phase === 'spectating') {
    const watched = state.players.find((p) => p.id === followId);
    spectateEl.textContent = `Spectating ${watched?.name ?? '…'} · ${state.players.filter((p) => p.alive).length} left · Enter to play again`;
  }
}

function resultView(state: GameState, me: Player, tone: 'win' | 'lose', title: string, subtitle: string, canSpectate: boolean): EndView {
  const until = me.eliminatedTick ?? state.tick;
  return {
    tone,
    title,
    subtitle,
    placement: `#${me.placement ?? 1} of ${state.players.length}`,
    stats: [
      ['Knockouts', String(me.knockouts)],
      ['Damage dealt', String(Math.round(me.damageDealt))],
      ['Survived', clock(until / config.tickRate)],
    ],
    canSpectate,
  };
}

function describeKiller(state: GameState, byId: EntityId | null): string {
  if (byId === null) return 'The Rinse washed you out.';
  const killer = state.players.find((p) => p.id === byId);
  if (!killer) return '';
  const weapon = killer.weapons[killer.activeSlot];
  const how = weapon ? ` with a ${config.rarity[weapon.rarity].name} ${config.weapons[weapon.kind].name}` : '';
  return `Knocked out by ${killer.name}${how}.`;
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

// ?room=CODE joins an online room; ?online creates one; otherwise play solo against bots.
const roomCode = parseRoomCode(params.get('room') ?? '');
if (roomCode) {
  joinRoom(roomCode);
} else if (params.has('online')) {
  createRoom()
    .then((code) => {
      history.replaceState(null, '', `?room=${code}`);
      joinRoom(code);
    })
    .catch((err: unknown) => {
      spectateEl.hidden = false;
      spectateEl.textContent = `Couldn't reach the game server: ${err instanceof Error ? err.message : String(err)}`;
    });
} else {
  beginMatch(newSolo());
}

requestAnimationFrame(frame);
