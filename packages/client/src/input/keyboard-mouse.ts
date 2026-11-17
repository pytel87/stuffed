import { Btn } from '@stuffed/sim';
import type { Input, Vec2 } from '@stuffed/sim';
import type { InputSource } from '../session/session.ts';

/**
 * Keyboard + mouse. Held keys are read at each sim tick; one-shot presses (weapon slot,
 * item use, wheel) are latched until the next sample() so a short tap is never lost.
 */
export class KeyboardMouseInput implements InputSource {
  /** Cursor position in client pixels, or null before the mouse has moved over the canvas. */
  pointer: Vec2 | null = null;
  private readonly keys = new Set<string>();
  private fireHeld = false;
  /** Unit aim direction, for facing. */
  private aim: Vec2 = { x: 1, y: 0 };
  /** Distance to the aimed-at point; sent as the aim vector's length so shots can angle. */
  private aimDistance = 0;
  private seq = 0;
  private weaponSlot: Input['weaponSlot'] = -1;
  private cycleWeapon = false;
  private useItemSlot: Input['useItemSlot'] = -1;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault(); // no page scroll
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Digit1') this.weaponSlot = 0;
      if (e.code === 'Digit2') this.weaponSlot = 1;
      if (e.code === 'Digit3') this.useItemSlot = 0;
      if (e.code === 'Digit4') this.useItemSlot = 1;
      if (e.code === 'Digit5') this.useItemSlot = 2;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.fireHeld = false;
    });
    target.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
    });
    target.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.fireHeld = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.fireHeld = false;
    });
    target.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY !== 0) this.cycleWeapon = true;
    }, { passive: false });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Vector from the plush (or its barrel tip) to the cursor's point in the world. */
  setAim(x: number, y: number): void {
    const len = Math.hypot(x, y);
    if (len > 1e-6) {
      this.aim = { x: x / len, y: y / len };
      this.aimDistance = len;
    }
  }

  get currentAim(): Vec2 {
    return this.aim;
  }

  sample(): Input {
    const k = this.keys;
    const moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const moveY = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
    const input: Input = {
      seq: this.seq++,
      moveX,
      moveY,
      aimX: this.aim.x * this.aimDistance,
      aimY: this.aim.y * this.aimDistance,
      buttons:
        (this.fireHeld ? Btn.Fire : 0) |
        (k.has('KeyE') ? Btn.Interact : 0) |
        (k.has('KeyR') ? Btn.Reload : 0) |
        (k.has('Space') ? Btn.Jump : 0),
      weaponSlot: this.weaponSlot,
      cycleWeapon: this.cycleWeapon,
      useItemSlot: this.useItemSlot,
    };
    this.weaponSlot = -1;
    this.cycleWeapon = false;
    this.useItemSlot = -1;
    return input;
  }
}
