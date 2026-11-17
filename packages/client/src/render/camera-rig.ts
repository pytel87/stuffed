import * as THREE from 'three';
import type { Vec2 } from '@stuffed/sim';

export const CAMERA = {
  /** Angle above the ground (90 = straight down). The design doc asks for about 60. */
  pitchDegrees: 60,
  distance: 20,
  fov: 35,
  /** Share of the player-to-cursor distance the camera leans toward. */
  leanFactor: 0.25,
  maxLean: 3,
  /** Follow smoothing (1/s); higher = tighter. */
  followRate: 8,
  /** Phones and tablets: closer in, since the screen is small. */
  handheldZoom: 0.8,
};

const handheld = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Top-down follow camera that leans toward where the player is aiming. */
export class CameraRig {
  readonly target = new THREE.Vector3();
  private initialized = false;
  private readonly desired = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    camera.fov = CAMERA.fov;
    camera.updateProjectionMatrix();
  }

  /** Snap to the next target instead of gliding there (new match). */
  reset(): void {
    this.initialized = false;
  }

  /**
   * `aimOffset` is the vector from the player to the cursor's ground point; `groundY` the
   * height of the surface the player stands over (the camera rises with it, not with jumps).
   */
  /** Extra distance factor (the Toss zooms out); eased toward. */
  private zoom = 1;

  update(player: Vec2, aimOffset: Vec2, dt: number, groundY = 0, zoomTarget = 1): void {
    this.zoom += (zoomTarget - this.zoom) * (1 - Math.exp(-2.5 * dt));
    const len = Math.hypot(aimOffset.x, aimOffset.y);
    const lean = Math.min(len * CAMERA.leanFactor, CAMERA.maxLean);
    const lx = len > 1e-6 ? (aimOffset.x / len) * lean : 0;
    const ly = len > 1e-6 ? (aimOffset.y / len) * lean : 0;
    this.desired.set(player.x + lx, groundY, player.y + ly);

    if (!this.initialized) {
      this.target.copy(this.desired);
      this.initialized = true;
    } else {
      this.target.lerp(this.desired, 1 - Math.exp(-CAMERA.followRate * dt));
    }

    const pitch = THREE.MathUtils.degToRad(CAMERA.pitchDegrees);
    // Narrower than 16:9 (tablets, portrait): back off so you see as far to the sides.
    const distance =
      CAMERA.distance * Math.max(1, Math.sqrt(16 / 9 / this.camera.aspect)) * this.zoom * (handheld ? CAMERA.handheldZoom : 1);
    this.camera.position.set(
      this.target.x,
      this.target.y + Math.sin(pitch) * distance,
      this.target.z + Math.cos(pitch) * distance,
    );
    this.camera.lookAt(this.target);
  }
}
