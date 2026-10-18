import * as THREE from 'three';
import { damp } from '../core/math';
import { noise2 } from '../core/noise';
import { WIND_DIR } from '../world/layout';
import { windUniforms } from '../world/materials';

/**
 * The single wind state everything reads: windmill, trees, grass, clouds, rain and smoke.
 * `strength` eases toward the slider value; `gusting` adds a slow variation on top that
 * scales with strength, so at zero wind every wind-driven motion stops.
 */
export class Wind {
  readonly direction = WIND_DIR.clone();
  strength = 0;
  /** Strength including gusts. This is what consumers should use. */
  gusting = 0;
  /** Accumulated oscillation phase; it speeds up with strength without ever jumping. */
  phase = 0;
  private readonly velocity = new THREE.Vector3();

  constructor(initial: number) {
    this.strength = initial;
    this.gusting = initial;
    windUniforms.uWindDir.value.copy(this.direction);
  }

  update(dt: number, target: number, elapsed: number, motion: number): void {
    this.strength = damp(this.strength, target, 2.4, dt);
    const gust = 0.5 + 0.5 * noise2(elapsed * 0.35, 4.2);
    this.gusting = this.strength * (0.85 + 0.35 * gust);
    this.phase += dt * (0.9 + 2.6 * this.strength);

    windUniforms.uWindBend.value = 0.034 * this.gusting;
    windUniforms.uWindFlutter.value = (0.009 + 0.006 * this.strength) * this.gusting * (0.3 + 0.7 * motion);
    windUniforms.uWindPhase.value = this.phase;
  }

  /** Horizontal air velocity in world units per second, scaled by `speed`. */
  vector(speed: number, out = this.velocity): THREE.Vector3 {
    return out.copy(this.direction).multiplyScalar(this.gusting * speed);
  }
}
