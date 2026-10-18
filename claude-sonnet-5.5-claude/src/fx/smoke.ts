import * as THREE from 'three';
import { clamp, mulberry32, smoothstep } from '../util/math';
import { puffTexture } from '../util/textures';
import type { Environment } from './environment';
import { ParticlePool } from './particles';
import type { Wind } from './wind';

const COUNT = 26;
const LIFE = 5.2;

interface Puff {
  age: number;
  seed: number;
  x: number;
  y: number;
  z: number;
}

/** Chimney smoke: a small pool of soft puffs that rise, widen and lean downwind. */
export class Smoke {
  readonly pool: ParticlePool;
  private readonly puffs: Puff[] = [];
  private readonly map = puffTexture();
  private readonly rng = mulberry32(5150);
  private timer = 0;
  private readonly tint = new THREE.Color();

  constructor(private readonly origin: THREE.Vector3) {
    this.pool = new ParticlePool(COUNT, this.map);
    this.pool.points.renderOrder = 8;
    this.pool.points.name = 'chimney-smoke';
    for (let i = 0; i < COUNT; i++) this.puffs.push({ age: 1, seed: this.rng(), x: 0, y: 0, z: 0 });
  }

  update(dt: number, time: number, wind: Wind, env: Environment, lights: number, reducedMotion: boolean): void {
    // More smoke when someone is home; under reduced motion it thins to a faint, slow wisp.
    const rate = (reducedMotion ? 0.5 : 1.1) + (reducedMotion ? 0.6 : 2.2) * lights;
    this.timer += dt * rate;
    while (this.timer >= 1) {
      this.timer -= 1;
      const free = this.puffs.find((p) => p.age >= 1);
      if (!free) break;
      free.age = 0;
      free.seed = this.rng();
      free.x = this.origin.x + (this.rng() - 0.5) * 0.06;
      free.y = this.origin.y;
      free.z = this.origin.z + (this.rng() - 0.5) * 0.06;
    }

    const speed = reducedMotion ? 0.4 : 1;
    const { positions, sizes, alphas, rotations } = this.pool;
    for (let i = 0; i < COUNT; i++) {
      const p = this.puffs[i];
      if (p.age >= 1) {
        alphas[i] = 0;
        continue;
      }
      p.age = Math.min(1, p.age + (dt / LIFE) * speed);
      const a = p.age;
      // Rises steadily; the sideways drift grows with both the wind and the puff's age.
      p.y += dt * speed * (0.32 + 0.1 * p.seed);
      const drift = (0.08 + 1.9 * wind.effective) * (0.25 + a) * speed;
      p.x += dt * (wind.dir.x * drift + Math.sin(time * 0.9 + p.seed * 20) * 0.03 * speed);
      p.z += dt * (wind.dir.z * drift + Math.cos(time * 0.8 + p.seed * 17) * 0.03 * speed);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      sizes[i] = 0.16 + 0.62 * Math.sqrt(a) * (0.8 + 0.4 * p.seed);
      alphas[i] = smoothstep(0, 0.12, a) * (1 - smoothstep(0.5, 1, a)) * 0.5 * (1 - 0.5 * env.rain);
      rotations[i] = p.seed * 6.28 + a * 0.6;
    }
    // Lit by the sky by day, by the window light and moon at night.
    this.tint.copy(env.hemiSky).lerp(env.keyColor, 0.35).multiplyScalar(clamp(0.5 + env.daylight * 0.7));
    this.tint.multiplyScalar(0.9).addScalar(0.08 * env.night);
    this.pool.color.copy(this.tint);
    this.pool.commit();
  }

  dispose(): void {
    this.pool.dispose();
    this.map.dispose();
  }
}
