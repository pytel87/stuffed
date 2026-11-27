import { Btn } from '@stuffed/sim';
import type { Input, Vec2 } from '@stuffed/sim';
import type { InputSource } from '../session/session.ts';

/**
 * Keyboard + mouse, plus a "virtual" side that on-screen controls write into (touch sticks
 * and buttons, tappable HUD slots). Held keys are read at each sim tick; one-shot presses
 * (weapon slot, item use, wheel, reload tap) are latched until the next sample() so a short
 * tap is never lost.
 */
/** Keys that can swallow other keys' key-ups (see the keydown handler). */
const MODIFIERS = new Set(['Meta', 'Control', 'Alt', 'Fn', 'FnLock']);

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
  private dropSlot = -1;
  private wearBagSlot = -1;
  /** On-screen stick movement, -1..1 per axis. */
  readonly virtualMove: Vec2 = { x: 0, y: 0 };
  /** On-screen buttons currently held (Btn bits). */
  virtualButtons = 0;
  /** Buttons pressed for exactly one tick (e.g. a reload tap). */
  private tapButtons = 0;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      // Typing in a field (your name in the lobby, a code) doesn't walk your plush.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') e.preventDefault(); // no page scroll
      // A modifier (Cmd, Ctrl, Option, the Globe key: shortcuts, switching the keyboard's language)
      // can keep a key-up from coming: on a Mac, none for keys let go while Cmd is down. The plush
      // walked on by itself, one way (W only stopped it). Let go of everything; a shortcut isn't a
      // move.
      if (MODIFIERS.has(e.key) || e.metaKey || e.ctrlKey || e.altKey) {
        this.releaseAll();
        return;
      }
      // Still held after that: the key's own repeats bring it back.
      if (e.repeat) {
        this.keys.add(e.code);
        return;
      }
      this.keys.add(e.code);
      if (e.code === 'Digit1') this.weaponSlot = 0;
      if (e.code === 'Digit2') this.weaponSlot = 1;
      if (e.code === 'Digit3') this.useItemSlot = 0;
      if (e.code === 'Digit4') this.useItemSlot = 1;
      if (e.code === 'Digit5') this.useItemSlot = 2;
      // G drops the weapon in your hand.
      if (e.code === 'KeyG' && !e.repeat) this.dropSlot = this.heldSlot;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (MODIFIERS.has(e.key)) this.releaseAll();
    });
    // Away from the game (another window, another tab): its key-ups go elsewhere.
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    target.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
    });
    target.addEventListener('pointerdown', (e) => {
      // Touches go through the on-screen controls, not "click to shoot".
      if (e.button === 0 && e.pointerType !== 'touch') this.fireHeld = true;
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

  /** Nothing held any more (keys whose key-ups may never come). */
  private releaseAll(): void {
    this.keys.clear();
    this.fireHeld = false;
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

  selectWeapon(slot: 0 | 1): void {
    this.weaponSlot = slot;
  }

  useItem(slot: 0 | 1 | 2): void {
    this.useItemSlot = slot;
  }

  /** Put on the part in bag slot 0-2. */
  wearBag(slot: number): void {
    this.wearBagSlot = slot;
  }

  /** Drop a weapon (slot 0-1), an item stack (2-4) or a bagged part (5-7). */
  drop(slot: number): void {
    this.dropSlot = slot;
  }

  /** Which weapon slot you hold, as last told by the game (for G). */
  heldSlot: 0 | 1 = 0;

  reload(): void {
    this.tapButtons |= Btn.Reload;
  }

  /** Bag the part in reach, or put on the first bagged part (Q). */
  stash(): void {
    this.tapButtons |= Btn.Stash;
  }

  sample(): Input {
    const k = this.keys;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const moveX = clamp((k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.virtualMove.x);
    const moveY = clamp((k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0) + this.virtualMove.y);
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
        (k.has('KeyQ') ? Btn.Stash : 0) |
        (k.has('Space') ? Btn.Jump : 0) |
        (k.has('KeyB') ? Btn.Dance : 0) |
        this.virtualButtons |
        this.tapButtons,
      weaponSlot: this.weaponSlot,
      cycleWeapon: this.cycleWeapon,
      useItemSlot: this.useItemSlot,
      dropSlot: this.dropSlot,
      wearBagSlot: this.wearBagSlot,
    };
    this.weaponSlot = -1;
    this.cycleWeapon = false;
    this.useItemSlot = -1;
    this.dropSlot = -1;
    this.wearBagSlot = -1;
    this.tapButtons = 0;
    return input;
  }
}
