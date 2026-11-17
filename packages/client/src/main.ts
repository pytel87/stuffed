import './style.css';
import { config, muzzlePosition, zoneSecondsLeft } from '@stuffed/sim';
import type { Player, Rarity, WeaponKind, WeaponSpec } from '@stuffed/sim';
import { KeyboardMouseInput } from './input/keyboard-mouse.ts';
import { GameRenderer } from './render/game-renderer.ts';
import { LocalSession } from './session/local-session.ts';
import { DebugOverlay } from './ui/debug-overlay.ts';
import { FloatingNumbers } from './ui/floating-numbers.ts';
import { Hud } from './ui/hud.ts';
import { ZoneHud } from './ui/zone-hud.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const debugEl = document.querySelector<HTMLElement>('#debug')!;

const input = new KeyboardMouseInput(canvas);
const params = new URLSearchParams(location.search);
// ?seed=123 replays the same spawns and cosmetics, handy for reproducing bugs.
const seed = Number(params.get('seed')) || Date.now() >>> 0;
const loadout = loadoutFromUrl();
// ?zonescale=0.1 runs the Rinse 10x faster for testing.
const zoneTimeScale = Number(params.get('zonescale')) || 1;
const session = new LocalSession(input, { seed, zoneTimeScale, ...(loadout ? { loadout } : {}) });
const renderer = new GameRenderer(canvas, session.map);
const debug = new DebugOverlay(debugEl, (on) => renderer.setDebug(on));
const hud = new Hud(document.querySelector<HTMLElement>('#hud')!);
const numbers = new FloatingNumbers(document.querySelector<HTMLElement>('#floaters')!);
const zoneHud = new ZoneHud(document.querySelector<HTMLElement>('#hud')!);

let last = performance.now();
const aimOffset = { x: 0, y: 0 };
let me: Player | undefined;

function frame(now: number): void {
  // The first rAF timestamp can be earlier than performance.now() at startup: never go negative.
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;

  if (input.pointer) {
    const cursor = renderer.screenToWorld(input.pointer.x, input.pointer.y);
    if (cursor) {
      const center = renderer.localPlayerPos;
      aimOffset.x = cursor.x - center.x;
      aimOffset.y = cursor.y - center.y;
      input.setAim(aimOffset.x, aimOffset.y);
      // The gun is held off-center, so aim from its barrel tip: shots then cross the cursor.
      // Very close to the plush that would swing the aim wildly, so keep the center aim there.
      const weapon = me?.weapons[me.activeSlot];
      if (weapon && Math.hypot(aimOffset.x, aimOffset.y) > config.weapons[weapon.kind].barrelLength + 0.5) {
        const tip = muzzlePosition(center, input.currentAim, weapon.kind);
        input.setAim(cursor.x - tip.x, cursor.y - tip.y);
      }
    }
  }

  session.advance(dt);
  const f = session.frame();
  const events = session.takeEvents();
  renderer.playEvents(events, f.curr);
  zoneHud.events(events);
  for (const e of events) {
    if (e.type !== 'hit' || e.sourceId !== session.localPlayerId) continue;
    const target = f.curr.players.find((p) => p.id === e.targetId);
    if (!target) continue;
    if (e.armorDamage > 0) numbers.add(target.pos.x, target.pos.y, String(Math.round(e.armorDamage)), 'armor');
    if (e.damage > 0) numbers.add(target.pos.x, target.pos.y, String(Math.round(e.damage)), 'stuffing');
  }

  renderer.render(f, {
    localPlayerId: session.localPlayerId,
    localAim: input.currentAim,
    aimOffset,
    dt,
    time: now / 1000,
  });
  numbers.update(dt, renderer.camera, canvas.clientWidth, canvas.clientHeight);

  me = f.curr.players.find((p) => p.id === session.localPlayerId);
  hud.update(f.curr, me, f.alpha);
  zoneHud.update(f.curr, me, renderer.localPlayerPos, dt);
  debug.update(dt, {
    seed,
    tick: f.curr.tick,
    pos: me ? `${me.pos.x.toFixed(1)}, ${me.pos.y.toFixed(1)}` : '-',
    speed: me ? Math.hypot(me.vel.x, me.vel.y).toFixed(2) : '-',
    alive: f.curr.players.filter((p) => p.alive).length,
    bush: me?.inBush ? 'hidden' : '-',
    roof: me && me.building !== -1 ? `building ${me.building}` : '-',
    proj: f.curr.projectiles.length,
    loot: `${f.curr.loot.length} on ground, ${f.curr.chests.filter((c) => !c.opened).length} chests closed`,
    zone: `phase ${f.curr.zone.phase + 1} ${f.curr.zone.stage} ${zoneSecondsLeft(f.curr.zone, f.curr.tick).toFixed(1)}s r=${f.curr.zone.current.radius.toFixed(1)}`,
    soggy: me?.soggy ? 'yes' : '-',
  });

  requestAnimationFrame(frame);
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

requestAnimationFrame(frame);
