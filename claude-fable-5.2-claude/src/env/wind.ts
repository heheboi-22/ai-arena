import * as THREE from 'three';
import { damp } from '../core/math';

/**
 * The one shared wind. The windmill, trees, clouds, rain and smoke all read
 * from this object, so they speed up, gust and stop together.
 */
export class Wind {
  /** Eased strength, 0..1. */
  strength = 0.3;
  /** Horizontal direction the wind blows towards (x, z). */
  readonly dir = new THREE.Vector2(0.95, -0.31).normalize();
  /** -1..1 slow gust wave. */
  gustiness = 0;
  /** Strength including gusts. */
  speed = 0.3;
  /** Oscillator phase; advances faster in stronger wind, never jumps. */
  phase = 0;
  /** Integral of speed over time: "how much air has passed". */
  travel = 0;

  update(dt: number, target: number): void {
    this.strength = damp(this.strength, target, 2.6, dt);
    if (target === 0 && this.strength < 0.002) this.strength = 0;
    this.phase += dt * (0.45 + 1.35 * this.strength);
    this.gustiness =
      Math.sin(this.phase * 0.83) * 0.6 + Math.sin(this.phase * 2.17 + 1.7) * 0.4;
    this.speed = this.strength * (1 + 0.2 * this.gustiness);
    this.travel += dt * this.speed;
  }
}
