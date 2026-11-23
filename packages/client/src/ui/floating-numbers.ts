import * as THREE from 'three';

interface Floater {
  el: HTMLElement;
  world: THREE.Vector3;
  age: number;
}

const LIFE = 0.8;
const RISE = 0.9;

/** Damage numbers that pop above a plush and drift up. DOM text stays crisp at any zoom. */
export class FloatingNumbers {
  private readonly items: Floater[] = [];
  private readonly v = new THREE.Vector3();

  constructor(private readonly layer: HTMLElement) {}

  /** `kind` 'buttons': Buttons (the currency) found, with the button picture (`html`, trusted). */
  add(x: number, z: number, text: string, kind: 'stuffing' | 'armor' | 'buttons', html?: string): void {
    const el = document.createElement('div');
    el.className = `floater ${kind}`;
    if (html) el.innerHTML = html;
    else el.textContent = text;
    this.layer.appendChild(el);
    // (Found Buttons stay up a little longer, and come out of the chest rather than off a plush.)
    const jitter = kind === 'buttons' ? 0 : (Math.random() - 0.5) * 0.5;
    this.items.push({ el, world: new THREE.Vector3(x + jitter, kind === 'buttons' ? 1.3 : 1.9, z), age: kind === 'buttons' ? -0.4 : 0 });
  }

  update(dt: number, camera: THREE.Camera, width: number, height: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i]!;
      f.age += dt;
      if (f.age >= LIFE) {
        f.el.remove();
        this.items.splice(i, 1);
        continue;
      }
      const t = Math.max(0, f.age) / LIFE;
      this.v.copy(f.world).setY(f.world.y + RISE * t).project(camera);
      const sx = (this.v.x * 0.5 + 0.5) * width;
      const sy = (-this.v.y * 0.5 + 0.5) * height;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - (t - 0.15) * 0.3;
      f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
      f.el.style.opacity = String(t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
    }
  }
}
