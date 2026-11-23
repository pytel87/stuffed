// Names over the plushies in the lobby's warm-up, so you can see who has joined and who's who.
// DOM labels (crisp at any zoom) placed over each plush's head every frame.
import * as THREE from 'three';
import type { EntityId, GameState } from '@stuffed/sim';
import type { GameRenderer } from '../render/game-renderer.ts';

/** How high over a plush's feet its name sits (world units: just above its head). */
const ABOVE = 2.25;

export class NameTags {
  private readonly layer: HTMLElement;
  private readonly tags = new Map<EntityId, HTMLElement>();
  private readonly v = new THREE.Vector3();

  constructor(root: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'name-tags';
    root.append(this.layer);
  }

  /** `on`: shown (the warm-up); off, every label goes. `me` gets its own color. */
  update(on: boolean, state: GameState | null, me: EntityId, renderer: GameRenderer, camera: THREE.Camera, width: number, height: number): void {
    const seen = new Set<EntityId>();
    if (on && state) {
      for (const p of state.players) {
        if (!p.alive) continue;
        const at = renderer.plushAt(p.id);
        if (!at) continue;
        this.v.set(at.x, at.y + ABOVE, at.z).project(camera);
        if (this.v.z > 1) continue;
        let tag = this.tags.get(p.id);
        if (!tag) {
          tag = document.createElement('div');
          tag.className = 'name-tag';
          this.layer.append(tag);
          this.tags.set(p.id, tag);
        }
        if (tag.textContent !== p.name) tag.textContent = p.name;
        tag.classList.toggle('me', p.id === me);
        tag.style.transform = `translate(${((this.v.x * 0.5 + 0.5) * width).toFixed(1)}px, ${((-this.v.y * 0.5 + 0.5) * height).toFixed(1)}px) translate(-50%, -100%)`;
        seen.add(p.id);
      }
    }
    for (const [id, tag] of this.tags) {
      if (seen.has(id)) continue;
      tag.remove();
      this.tags.delete(id);
    }
  }
}
