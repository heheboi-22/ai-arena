import * as THREE from 'three';
import { ISLAND_RADIUS, POND, RAIN_COUNT, WIND } from '../config';
import { edgeFactor, mulberry32 } from '../utils';

/**
 * Pooled rain: every drop is one short line segment whose tail sits
 * behind the head along the wind-slanted fall velocity. Drops die at
 * ground level over the island (so nothing rains *through* it) and
 * respawn at the top of the volume. The active count follows a
 * smoothed `amount`, so weather toggles fade in and out instead of
 * popping, and no geometry is ever allocated at runtime.
 */
export class RainSystem {
  readonly object: THREE.LineSegments;

  /** Smoothed intensity 0..1 — also read by sky/pond systems. */
  amount = 0;

  /** Fired when a drop lands inside the pond (pond-local coords). */
  onSplash: ((x: number, z: number) => void) | null = null;

  private readonly count: number;
  private readonly positions: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly speed: Float32Array;
  private readonly attribute: THREE.BufferAttribute;
  private readonly material: THREE.LineBasicMaterial;
  private readonly rand: () => number;

  constructor(quality: 'high' | 'low') {
    this.count = quality === 'high' ? RAIN_COUNT.high : RAIN_COUNT.low;
    this.rand = mulberry32(2024);

    this.positions = new Float32Array(this.count * 2 * 3);
    this.px = new Float32Array(this.count);
    this.py = new Float32Array(this.count);
    this.pz = new Float32Array(this.count);
    this.speed = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      this.px[i] = (this.rand() * 2 - 1) * 13;
      this.py[i] = this.rand() * 16 - 6;
      this.pz[i] = (this.rand() * 2 - 1) * 13;
      this.speed[i] = 9 + this.rand() * 4.5;
    }

    const geometry = new THREE.BufferGeometry();
    this.attribute = new THREE.BufferAttribute(this.positions, 3);
    this.attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.attribute);
    geometry.setDrawRange(0, 0);

    this.material = new THREE.LineBasicMaterial({
      color: '#b9d2e4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.object = new THREE.LineSegments(geometry, this.material);
    this.object.frustumCulled = false;
    this.object.name = 'rain';
  }

  update(dt: number, wind: number, target: number): void {
    // interruptible ease toward the weather target
    this.amount += (target - this.amount) * Math.min(1, dt * 2.4);
    if (this.amount < 0.003 && target === 0) this.amount = 0;

    const active = Math.floor(this.amount * this.count);
    this.object.geometry.setDrawRange(0, active * 2);
    this.material.opacity = 0.55 * this.amount;
    if (active === 0) return;

    const vx = wind * WIND.rainSlant;
    const vz = wind * WIND.rainSlant * 0.3;
    const pos = this.positions;

    for (let i = 0; i < active; i++) {
      const v = this.speed[i];
      let x = this.px[i] + vx * dt;
      let y = this.py[i] - v * dt;
      let z = this.pz[i] + vz * dt;

      const r = Math.hypot(x, z);
      const ground = Math.atan2(z, x);
      const floor = r < ISLAND_RADIUS * edgeFactor(ground) * 0.985 ? 0.05 : -6.4;

      if (y < floor || Math.abs(x) > 14 || Math.abs(z) > 14) {
        if (
          floor > 0 &&
          this.amount > 0.5 &&
          this.onSplash &&
          Math.hypot(x - POND.x, z - POND.z) < POND.radius &&
          this.rand() < 0.35
        ) {
          this.onSplash(x - POND.x, z - POND.z);
        }
        x = (this.rand() * 2 - 1) * 13;
        y = 7 + this.rand() * 4.5;
        z = (this.rand() * 2 - 1) * 13;
      }

      this.px[i] = x;
      this.py[i] = y;
      this.pz[i] = z;

      // streak tail behind the head along the velocity direction
      const inv = 1 / Math.hypot(vx, v, vz);
      const len = 0.34 + v * 0.035;
      const j = i * 6;
      pos[j] = x;
      pos[j + 1] = y;
      pos[j + 2] = z;
      pos[j + 3] = x - vx * inv * len;
      pos[j + 4] = y + v * inv * len;
      pos[j + 5] = z - vz * inv * len;
    }

    this.attribute.needsUpdate = true;
  }
}
