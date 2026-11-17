// Where did that come from? When you're hit, a red arc around your plush points toward the shot
// (or burst, or swing), fading out; handy when the shooter is hidden in a bush or offscreen.
import * as THREE from 'three';
import type { Vec2 } from '@stuffed/sim';

const LIFE = 1.2;
const MAX = 4;

interface Hint {
  el: HTMLElement;
  from: Vec2;
  age: number;
}

export class HitDirection {
  private readonly hints: Hint[] = [];
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();

  constructor(private readonly layer: HTMLElement) {}

  add(from: Vec2): void {
    if (this.hints.length >= MAX) this.hints.shift()!.el.remove();
    const el = document.createElement('div');
    el.className = 'hit-arc';
    this.layer.appendChild(el);
    this.hints.push({ el, from: { ...from }, age: 0 });
  }

  clear(): void {
    for (const h of this.hints) h.el.remove();
    this.hints.length = 0;
  }

  /** `me` is your plush's drawn position; arcs sit around it on screen. */
  update(dt: number, camera: THREE.Camera, width: number, height: number, me: Vec2, meZ: number): void {
    for (let i = this.hints.length - 1; i >= 0; i--) {
      const h = this.hints[i]!;
      h.age += dt;
      if (h.age >= LIFE) {
        h.el.remove();
        this.hints.splice(i, 1);
        continue;
      }
      this.a.set(me.x, meZ + 0.8, me.y).project(camera);
      this.b.set(h.from.x, meZ + 0.8, h.from.y).project(camera);
      const ax = (this.a.x * 0.5 + 0.5) * width;
      const ay = (-this.a.y * 0.5 + 0.5) * height;
      const angle = Math.atan2(-(this.b.y - this.a.y) * height, (this.b.x - this.a.x) * width);
      h.el.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -50%) rotate(${(angle + Math.PI / 2).toFixed(3)}rad)`;
      h.el.style.opacity = String(Math.min(1, (LIFE - h.age) / 0.5));
    }
  }
}
