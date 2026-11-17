// Twin-stick touch controls. Touching anywhere on the left half drops a movement stick under
// the thumb; on the right half an aim stick (a short drag aims, a longer one also fires).
// Jump and Grab buttons sit above the right thumb. Everything feeds KeyboardMouseInput's
// virtual side, so the game sees one input either way.
import { Btn } from '@stuffed/sim';
import type { Vec2 } from '@stuffed/sim';
import { icon } from '../ui/icons.ts';
import type { KeyboardMouseInput } from './keyboard-mouse.ts';

/** Stick travel in CSS pixels for full deflection. */
const STICK_RADIUS = 56;
const MOVE_DEAD_ZONE = 0.15;
const AIM_DEAD_ZONE = 0.2;
/** Beyond this deflection the aim stick also fires. */
const FIRE_AT = 0.55;

interface Stick {
  id: number;
  origin: Vec2;
  value: Vec2;
  base: HTMLElement;
  knob: HTMLElement;
}

export class TouchControls {
  /** Aim direction from the right stick (screen axes = world axes from the top-down camera), or null. */
  aim: Vec2 | null = null;
  private move: Stick | null = null;
  private look: Stick | null = null;
  private readonly root: HTMLElement;
  private readonly grab: HTMLElement;

  constructor(private readonly input: KeyboardMouseInput) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="touch off" aria-hidden="true">
         <div class="touch-zone touch-left"></div>
         <div class="touch-zone touch-right"></div>
         <button type="button" class="touch-btn touch-jump">${icon('jump')}</button>
         <button type="button" class="touch-btn touch-grab">${icon('hand')}</button>
       </div>`,
    );
    this.root = document.querySelector<HTMLElement>('.touch')!;
    this.grab = this.root.querySelector<HTMLElement>('.touch-grab')!;
    const left = this.root.querySelector<HTMLElement>('.touch-left')!;
    const right = this.root.querySelector<HTMLElement>('.touch-right')!;

    left.addEventListener('pointerdown', (e) => (this.move ??= this.startStick(e, left)));
    right.addEventListener('pointerdown', (e) => (this.look ??= this.startStick(e, right)));
    window.addEventListener('pointermove', (e) => {
      this.moveStick(this.move, e);
      this.moveStick(this.look, e);
      this.apply();
    });
    const end = (e: PointerEvent) => {
      if (this.move?.id === e.pointerId) this.move = this.endStick(this.move);
      if (this.look?.id === e.pointerId) this.look = this.endStick(this.look);
      this.apply();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    this.hold(this.root.querySelector<HTMLElement>('.touch-jump')!, Btn.Jump);
    this.hold(this.grab, Btn.Interact);

    // Touch mode turns on with the first touch and off when a real mouse moves.
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') document.body.classList.add('touch-mode');
    }, { capture: true });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && (e.movementX !== 0 || e.movementY !== 0)) document.body.classList.remove('touch-mode');
    });
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch-mode');
  }

  /** Shown only while you're playing (not on menus, cards or while spectating). */
  setActive(active: boolean): void {
    if (this.root.classList.contains('off') !== active) return;
    this.root.classList.toggle('off', !active);
    if (!active) {
      if (this.move) this.move = this.endStick(this.move);
      if (this.look) this.look = this.endStick(this.look);
      this.input.virtualButtons = 0;
      this.apply();
    }
  }

  /** Lights up Grab when there is something to pick up or open. */
  setGrabReady(ready: boolean): void {
    this.grab.classList.toggle('ready', ready);
  }

  private hold(button: HTMLElement, bit: number): void {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      button.classList.add('down');
      this.input.virtualButtons |= bit;
    });
    const release = () => {
      button.classList.remove('down');
      this.input.virtualButtons &= ~bit;
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  private startStick(e: PointerEvent, zone: HTMLElement): Stick {
    e.preventDefault();
    const base = document.createElement('div');
    base.className = 'stick';
    const knob = document.createElement('div');
    knob.className = 'stick-knob';
    base.appendChild(knob);
    base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    zone.parentElement!.appendChild(base);
    return { id: e.pointerId, origin: { x: e.clientX, y: e.clientY }, value: { x: 0, y: 0 }, base, knob };
  }

  private moveStick(stick: Stick | null, e: PointerEvent): void {
    if (!stick || stick.id !== e.pointerId) return;
    let dx = e.clientX - stick.origin.x;
    let dy = e.clientY - stick.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    stick.value = { x: dx / STICK_RADIUS, y: dy / STICK_RADIUS };
    stick.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  private endStick(stick: Stick): null {
    stick.base.remove();
    return null;
  }

  private apply(): void {
    const m = this.move?.value ?? { x: 0, y: 0 };
    const mLen = Math.hypot(m.x, m.y);
    this.input.virtualMove.x = mLen > MOVE_DEAD_ZONE ? m.x : 0;
    this.input.virtualMove.y = mLen > MOVE_DEAD_ZONE ? m.y : 0;

    const a = this.look?.value ?? { x: 0, y: 0 };
    const aLen = Math.hypot(a.x, a.y);
    this.aim = aLen > AIM_DEAD_ZONE ? { x: a.x / aLen, y: a.y / aLen } : null;
    if (aLen > FIRE_AT) this.input.virtualButtons |= Btn.Fire;
    else this.input.virtualButtons &= ~Btn.Fire;
  }
}
