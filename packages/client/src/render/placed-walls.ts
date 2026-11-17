// Cardboard Walls put up during the match: they pop up, wobble when hit, flicker when about to
// fold away, and burst into cardboard bits when shot down (see Effects.cardboard).
import * as THREE from 'three';
import { DT } from '@stuffed/sim';
import type { EntityId, GameState, PlacedWall } from '@stuffed/sim';
import { buildWall } from './props.ts';

const POP_SECONDS = 0.2;
/** Starts flickering this long before it folds away. */
const WARN_SECONDS = 3;

interface View {
  obj: THREE.Object3D;
  age: number;
  health: number;
  shake: number;
}

export class PlacedWallViews {
  private readonly views = new Map<EntityId, View>();

  constructor(private readonly scene: THREE.Scene) {}

  clear(): void {
    for (const v of this.views.values()) v.obj.removeFromParent();
    this.views.clear();
  }

  /** Returns the walls that disappeared this frame (for an effect where they stood). */
  update(state: GameState, dt: number, time: number): PlacedWall[] {
    const seen = new Set<EntityId>();
    for (const wall of state.placedWalls) {
      seen.add(wall.id);
      let view = this.views.get(wall.id);
      if (!view) {
        view = { obj: buildWall(wall, wall.id), age: 0, health: wall.health, shake: 0 };
        view.obj.userData.wall = wall;
        this.views.set(wall.id, view);
        this.scene.add(view.obj);
      }
      view.obj.userData.wall = wall;
      view.age += dt;
      if (wall.health < view.health) view.shake = 1;
      view.health = wall.health;
      view.shake = Math.max(0, view.shake - dt * 5);
      const pop = Math.min(1, view.age / POP_SECONDS);
      view.obj.scale.set(1, pop, 1);
      view.obj.rotation.z = Math.sin(time * 60) * 0.03 * view.shake;
      const left = (wall.expireTick - state.tick) * DT;
      view.obj.visible = left > WARN_SECONDS || Math.sin(time * 18) > -0.3;
    }
    const gone: PlacedWall[] = [];
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      gone.push(view.obj.userData.wall as PlacedWall);
      view.obj.removeFromParent();
      this.views.delete(id);
    }
    return gone;
  }
}
