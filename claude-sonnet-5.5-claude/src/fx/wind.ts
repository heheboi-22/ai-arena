import * as THREE from 'three';
import { clamp, damp } from '../util/math';

/**
 * The single wind the whole island shares. The windmill, the trees, the grass,
 * the clouds, the chimney smoke and the rain all read their numbers from here,
 * so one slider moves them together.
 */
export class Wind {
  /** Smoothed strength, 0 to 1. Follows the slider with a little inertia. */
  strength = 0;
  /** A slow, irregular factor around 1 that makes the wind feel alive. */
  gust = 1;
  /** Horizontal unit vector the wind blows toward: across the default view, left to right. */
  readonly dir = new THREE.Vector3(0.86, 0, 0.5).normalize();

  update(target: number, time: number, dt: number): void {
    this.strength = damp(this.strength, clamp(target), 3.2, dt);
    this.gust = 1 + 0.2 * Math.sin(time * 0.7 + 1.3) + 0.12 * Math.sin(time * 1.9 + 4.1) + 0.06 * Math.sin(time * 4.3);
  }

  /** Strength including gusts. Exactly 0 when the slider is at 0. */
  get effective(): number {
    return this.strength * this.gust;
  }
}
