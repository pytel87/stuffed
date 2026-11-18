// Team mode: a round badge with each off-screen teammate's head, at the screen edge, with a
// pointer toward them. A knocked-out teammate who can still be re-stitched gets a pink, pulsing
// badge (go help!).
import * as THREE from 'three';
import { revivable } from '@stuffed/sim';
import type { EntityId, GameState, Player } from '@stuffed/sim';
import { partIcon } from './icons.ts';

/** Keep the badge this far (px) from the screen edges. */
const INSET = 46;
/** A teammate this far inside the edges counts as on screen. */
const ON_SCREEN = 24;

interface Arrow {
  el: HTMLElement;
  pointer: HTMLElement;
  animal: string;
}

export class TeammateArrows {
  private readonly arrows = new Map<EntityId, Arrow>();
  private readonly v = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();

  constructor(private readonly layer: HTMLElement) {}

  /** `viewer`: whoever the camera follows (you, or the teammate you watch). */
  update(state: GameState | null, viewer: Player | undefined, camera: THREE.Camera, width: number, height: number): void {
    const seen = new Set<EntityId>();
    if (state && viewer && viewer.team !== 0 && state.status === 'playing') {
      for (const p of state.players) {
        if (p.id === viewer.id || p.team !== viewer.team || p.drop === 'riding') continue;
        const down = !p.alive;
        if (down && !revivable(state, p)) continue;
        // On screen? (A point behind the camera projects mirrored, so it never counts as on screen.)
        this.v.set(p.pos.x, p.z + 1, p.pos.y).project(camera);
        const sx = (this.v.x * 0.5 + 0.5) * width;
        const sy = (-this.v.y * 0.5 + 0.5) * height;
        if (this.v.z < 1 && sx > ON_SCREEN && sx < width - ON_SCREEN && sy > ON_SCREEN && sy < height - ON_SCREEN) continue;
        seen.add(p.id);
        const a = this.arrows.get(p.id) ?? this.create(p.id);
        if (a.animal !== p.parts.head.animal) {
          a.animal = p.parts.head.animal;
          a.el.querySelector('.head')!.innerHTML = partIcon('head', p.parts.head.animal);
        }
        a.el.classList.toggle('down', down);
        // Which way on screen: project a point a couple of steps from the viewer toward them (it's
        // always in front of the camera, unlike the teammate themselves when far below the
        // screen, whose projection comes out mirrored).
        const wx = p.pos.x - viewer.pos.x;
        const wz = p.pos.y - viewer.pos.y;
        const len = Math.hypot(wx, wz) || 1;
        this.from.set(viewer.pos.x, viewer.z + 1, viewer.pos.y).project(camera);
        this.toward.set(viewer.pos.x + (wx / len) * 2, viewer.z + 1, viewer.pos.y + (wz / len) * 2).project(camera);
        const dx = (this.toward.x - this.from.x) * width;
        const dy = -(this.toward.y - this.from.y) * height;
        // Clamp that direction from the screen center onto the inset edge.
        const cx = width / 2;
        const cy = height / 2;
        const scale = Math.min((cx - INSET) / Math.max(1e-3, Math.abs(dx)), (cy - INSET) / Math.max(1e-3, Math.abs(dy)));
        const x = cx + dx * scale;
        const y = cy + dy * scale;
        a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        a.pointer.style.transform = `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
      }
    }
    for (const [id, a] of this.arrows) {
      if (seen.has(id)) {
        a.el.hidden = false;
        continue;
      }
      a.el.hidden = true;
    }
  }

  private create(id: EntityId): Arrow {
    const el = document.createElement('div');
    el.className = 'mate-arrow';
    el.innerHTML = '<span class="pointer"></span><span class="head"></span>';
    this.layer.append(el);
    const arrow = { el, pointer: el.querySelector<HTMLElement>('.pointer')!, animal: '' };
    this.arrows.set(id, arrow);
    return arrow;
  }
}
