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
  /**
   * Rising onto (or down from) a roof, a crate: much gentler (1/s), so the view widens out over a
   * second or so instead of jolting on landing.
   */
  heightRate: 1.6,
  /** Phones and tablets: closer in, since the screen is small. */
  handheldZoom: 0.9,
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
   * height of the surface the player stands over (the camera rises with it, slowly, not with jumps).
   */
  /** Extra distance factor (the Toss and catapults zoom out); eased toward, out quickly and back in gently. */
  private zoom = 1;
  /** The height the camera's risen to (easing toward the surface under the plush). */
  private height = 0;

  /** How high it's risen now (easing toward the surface under the plush). */
  get risen(): number {
    return this.height;
  }

  /** How far out it's zoomed now (1: normal). */
  get zoomedOut(): number {
    return this.zoom;
  }

  update(player: Vec2, aimOffset: Vec2, dt: number, groundY = 0, zoomTarget = 1): void {
    this.zoom += (zoomTarget - this.zoom) * (1 - Math.exp(-(zoomTarget > this.zoom ? 6 : 2.5) * dt));
    const len = Math.hypot(aimOffset.x, aimOffset.y);
    const lean = Math.min(len * CAMERA.leanFactor, CAMERA.maxLean);
    const lx = len > 1e-6 ? (aimOffset.x / len) * lean : 0;
    const ly = len > 1e-6 ? (aimOffset.y / len) * lean : 0;
    this.desired.set(player.x + lx, 0, player.y + ly);

    if (!this.initialized) {
      this.target.copy(this.desired);
      this.height = groundY;
      this.initialized = true;
    } else {
      this.target.lerp(this.desired, 1 - Math.exp(-CAMERA.followRate * dt));
      this.height += (groundY - this.height) * (1 - Math.exp(-CAMERA.heightRate * dt));
    }
    this.target.y = this.height;

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
