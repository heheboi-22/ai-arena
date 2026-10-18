import * as THREE from 'three';
import { clamp, mulberry32, range, TAU } from '../util/math';
import { dotTexture } from '../util/textures';
import { pondPoint, terrainHeight } from '../world/layout';
import type { Environment } from './environment';
import { ParticlePool } from './particles';

const COUNT = 22;

interface Fly {
  x: number;
  y: number;
  z: number;
  phase: number;
  reach: number;
  speed: number;
}

/** A few fireflies that drift above the pond and the meadow once it is properly dark. */
export class Fireflies {
  readonly pool: ParticlePool;
  private readonly flies: Fly[] = [];
  private readonly map = dotTexture();

  constructor() {
    this.pool = new ParticlePool(COUNT, this.map, THREE.AdditiveBlending);
    this.pool.points.renderOrder = 7;
    this.pool.points.name = 'fireflies';
    this.pool.color.set('#d6ff7a');

    const rng = mulberry32(1313);
    for (let i = 0; i < COUNT; i++) {
      const nearPond = i < 14;
      let x: number;
      let z: number;
      if (nearPond) {
        const p = pondPoint(rng() * TAU, range(rng, 1.15, 2.1));
        x = p.x;
        z = p.z;
      } else {
        const a = rng() * TAU;
        const d = range(rng, 1.2, 4.2);
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
      }
      this.flies.push({
        x,
        y: terrainHeight(x, z) + range(rng, 0.25, 1.1),
        z,
        phase: rng() * TAU,
        reach: range(rng, 0.2, 0.5),
        speed: range(rng, 0.25, 0.5),
      });
    }
  }

  update(time: number, env: Environment, reducedMotion: boolean): void {
    // Only on clear, dark nights.
    const presence = clamp((env.night - 0.55) / 0.35) * (1 - env.rain);
    this.pool.points.visible = presence > 0.01;
    if (!this.pool.points.visible) return;

    const { positions, sizes, alphas } = this.pool;
    for (let i = 0; i < COUNT; i++) {
      const f = this.flies[i];
      const t = time * f.speed + f.phase;
      const sway = reducedMotion ? 0 : 1;
      positions[i * 3] = f.x + Math.sin(t * 1.3) * f.reach * sway;
      positions[i * 3 + 1] = f.y + Math.sin(t * 1.9 + 1.2) * 0.12 * sway;
      positions[i * 3 + 2] = f.z + Math.cos(t * 1.1) * f.reach * sway;
      // A slow blink; with reduced motion they simply glow.
      const blink = reducedMotion ? 0.8 : 0.15 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(time * (1.1 + f.speed) + f.phase * 3), 2);
      sizes[i] = 0.12;
      alphas[i] = blink * presence * 0.9;
    }
    this.pool.commit();
  }

  dispose(): void {
    this.pool.dispose();
    this.map.dispose();
  }
}
