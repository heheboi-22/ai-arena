import * as THREE from 'three';
import type { Environment } from '../env/environment';
import { Rain } from '../env/rain';
import type { Wind } from '../env/wind';
import { Fireflies, Smoke } from './ambient';
import { Clouds } from './clouds';
import { Floaters, createDetails } from './details';
import { createHouse, type House } from './house';
import { createIsland } from './island';
import { Pond } from './pond';
import { HOUSE, MILL, POND, groundHeight, islandRho } from './terrain';
import { TREE_SPECS, Trees } from './trees';
import { createWindmill, type Windmill } from './windmill';

export interface WorldOptions {
  rainCount: number;
}

/**
 * Everything that lives on (or around) the island. The island group bobs very
 * slightly as one piece; rain and ripples are children of it, so they always
 * agree with the ground they land on.
 */
export class World {
  readonly root = new THREE.Group();
  /** The floating island and everything attached to it. */
  readonly island = new THREE.Group();
  readonly house: House;
  readonly pickables: THREE.Object3D[];

  private readonly mill: Windmill;
  private readonly trees: Trees;
  private readonly pond = new Pond();
  private readonly clouds: Clouds;
  private readonly floaters = new Floaters();
  private readonly smoke: Smoke;
  private readonly fireflies: Fireflies;
  readonly rain: Rain;

  constructor(wind: Wind, opts: WorldOptions) {
    const terrain = createIsland();
    const details = createDetails();

    this.house = createHouse();
    this.house.group.position.set(HOUSE.x, HOUSE.y, HOUSE.z);
    this.house.group.rotation.y = HOUSE.rot;

    this.mill = createWindmill();
    this.mill.group.position.set(MILL.x, groundHeight(MILL.x, MILL.z) - 0.06, MILL.z);
    this.mill.group.rotation.y = MILL.rot;

    this.trees = new Trees(wind.dir);
    this.clouds = new Clouds(wind.dir);

    this.house.group.updateMatrix();
    const chimney = this.house.chimney.clone().applyMatrix4(this.house.group.matrix);
    this.smoke = new Smoke(chimney);

    this.fireflies = new Fireflies([
      [POND.x - 0.3, 0.1, POND.z + 0.2],
      [-3.4, 0.2, 3.0],
      [0.4, 0.3, -2.6],
      [-3.4, 0.4, -1.0],
      [3.9, 0.2, 0.6],
    ]);

    this.rain = new Rain({
      count: opts.rainCount,
      surface: (x, z) => this.surface(x, z),
      isWater: (x, z) => this.pond.contains(x, z),
      onRipple: (x, z) => this.pond.spawnRipple(x, z, 0.2 + Math.random() * 0.16),
    });

    this.island.add(
      terrain,
      details,
      this.pond.group,
      this.house.group,
      this.mill.group,
      this.trees.group,
      this.smoke.group,
      this.fireflies.points,
      this.rain.group,
    );
    this.root.add(this.island, this.clouds.group, this.floaters.group);
    this.pickables = [terrain, details, this.house.group, this.mill.group, this.trees.group, this.pond.group];
  }

  /** Height of the first solid thing under the sky at (x, z), in island space. */
  private surface(x: number, z: number): number {
    if (islandRho(x, z) > 1.02) return -Infinity;
    let h = groundHeight(x, z);

    // House: walls plus the pitched roof.
    const c = Math.cos(HOUSE.rot), s = Math.sin(HOUSE.rot);
    const dx = x - HOUSE.x, dz = z - HOUSE.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < 1.6 && Math.abs(lz) < 1.3) {
      h = Math.max(h, HOUSE.y + 1.62 + (1.3 - Math.abs(lz)) * 0.9 + 0.1);
    }
    // Windmill tower and cap.
    const dm = Math.hypot(x - MILL.x, z - MILL.z);
    if (dm < 0.95) h = Math.max(h, groundHeight(MILL.x, MILL.z) + 1.3 + (1 - dm / 0.95) * 2.7);
    // Tree crowns, as rough domes.
    for (const t of TREE_SPECS) {
      const r = (t.kind === 'pine' ? 0.6 : t.kind === 'birch' ? 0.45 : 0.85) * t.scale;
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < r) {
        const top = (t.kind === 'round' ? 2.3 : 2.5) * t.scale;
        h = Math.max(h, groundHeight(t.x, t.z) + top * (1 - 0.6 * (d / r) ** 2));
      }
    }
    return h;
  }

  setViewport(heightPx: number, fovDeg: number): void {
    this.rain.setViewport(heightPx, fovDeg);
    this.fireflies.setViewport(heightPx, fovDeg);
  }

  /**
   * @param motion 1 normally; 0 when the user asked for reduced motion
   *               (decorative movement stops, functional movement stays).
   */
  update(dt: number, time: number, wind: Wind, env: Environment, motion: number): void {
    const night = env.frame.night;
    this.island.position.y = Math.sin(time * 0.55) * 0.07 * motion;
    this.island.rotation.z = Math.sin(time * 0.31) * 0.004 * motion;

    this.mill.blades.rotation.z = -wind.travel * 2.5;
    this.trees.update(wind, 0.35 + 0.65 * motion);
    this.clouds.update(time, wind, env.rain, night, motion);
    this.floaters.update(time, motion);
    this.pond.update(dt, wind.phase, env.rain, motion);
    this.house.setLight(env.lights, env.glowProminence);
    this.smoke.update(dt, env.lights, wind, motion);
    this.fireflies.update(time, night, env.rain, motion);
    this.rain.update(dt, env.rain, wind, night);
  }
}
