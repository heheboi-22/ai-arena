import * as THREE from 'three';
import { Atmosphere } from '../fx/atmosphere';
import { Fireflies } from '../fx/fireflies';
import { type Environment, computeEnvironment, createEnvironment } from '../fx/environment';
import { Rain } from '../fx/rain';
import { Smoke } from '../fx/smoke';
import { Wind } from '../fx/wind';
import type { Quality } from '../util/quality';
import { Clouds } from './clouds';
import { House } from './house';
import { type Island, buildIsland } from './island';
import { type Materials, createMaterials } from './materials';
import { Pond } from './pond';
import { Props } from './props';
import { SurfaceMap } from './surfaces';
import { Trees } from './trees';
import { Windmill } from './windmill';

/** What the scene needs to know about this frame. All values are already smoothed. */
export interface FrameInput {
  dt: number;
  time: number;
  hour: number;
  rain: number;
  windTarget: number;
  lights: number;
  reducedMotion: boolean;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

/**
 * Builds the island and everything on it, and moves the lot each frame.
 * Nothing in here reads the DOM or the store: it is a function of `FrameInput`.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly env: Environment = createEnvironment();
  readonly wind = new Wind();

  readonly materials: Materials;
  readonly surfaces = new SurfaceMap();
  readonly atmosphere: Atmosphere;
  readonly island: Island;
  readonly house: House;
  readonly windmill: Windmill;
  readonly trees: Trees;
  readonly pond: Pond;
  readonly props: Props;
  readonly clouds: Clouds;
  readonly rain: Rain;
  readonly smoke: Smoke;
  readonly fireflies: Fireflies;

  /** Every texture the scene uses, so they can be uploaded before the first frame. */
  get textures(): THREE.Texture[] {
    const found = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const m of ([] as THREE.Material[]).concat(material ?? [])) {
        const maps = m as unknown as Record<string, unknown>;
        for (const key of ['map', 'bumpMap']) {
          if (maps[key] instanceof THREE.Texture) found.add(maps[key] as THREE.Texture);
        }
      }
    });
    return [...found];
  }

  /** Everything a click could land on: the house, plus whatever may stand in front of it. */
  readonly pickables: THREE.Object3D[] = [];

  constructor(quality: Quality) {
    this.materials = createMaterials(quality);
    this.atmosphere = new Atmosphere(this.scene, quality);

    this.island = buildIsland(this.materials);
    this.scene.add(this.island.group);

    this.house = new House(this.materials, this.surfaces);
    this.windmill = new Windmill(this.materials, this.surfaces);
    this.trees = new Trees(this.materials, this.surfaces);
    this.pond = new Pond(this.materials);
    this.props = new Props(this.materials, this.surfaces, quality);
    this.clouds = new Clouds(quality);
    this.rain = new Rain(quality.rainDrops, this.surfaces, this.pond);
    this.smoke = new Smoke(this.house.smokeOrigin);
    this.fireflies = new Fireflies();

    const g = this.island.group;
    g.add(this.house.group, this.windmill.group, this.trees.group, this.pond.group, this.props.group, this.rain.group, this.smoke.pool.points, this.fireflies.pool.points);
    this.scene.add(this.clouds.group);

    // Raycasting is limited to solid things; it skips the particles and the water.
    this.pickables.push(...this.house.pickTargets);
    for (const root of [this.island.group.children[0], this.windmill.group, this.trees.group]) {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) this.pickables.push(o);
      });
    }
  }

  update(f: FrameInput): void {
    const { dt, time } = f;
    computeEnvironment(f.hour, f.rain, this.env);
    this.wind.update(f.windTarget, time, dt);

    const wu = this.materials.wind;
    wu.uTime.value = time;
    wu.uWind.value = this.wind.effective;
    this.materials.setWetness(this.env.rain);

    this.atmosphere.apply(this.env, f.renderer, f.camera, time);
    this.island.update(time, f.reducedMotion);
    this.house.update(dt, time, f.lights, this.env, f.reducedMotion);
    this.windmill.update(dt, this.wind);
    this.trees.update(time, this.wind);
    this.pond.update(dt, time, this.env);
    this.clouds.update(dt, time, this.wind, this.env, f.reducedMotion, f.camera.position);
    this.smoke.update(dt, time, this.wind, this.env, f.lights, f.reducedMotion);
    this.rain.update(dt, this.wind, this.env);
    this.fireflies.update(time, this.env, f.reducedMotion);
  }

  /** Called when the canvas size or camera field of view changes. */
  setPointScale(pixelsPerUnit: number): void {
    this.smoke.pool.setScale(pixelsPerUnit);
    this.fireflies.pool.setScale(pixelsPerUnit);
    this.rain.setScale(pixelsPerUnit);
  }

  dispose(): void {
    this.atmosphere.dispose();
    this.island.dispose();
    this.house.dispose();
    this.windmill.dispose();
    this.trees.dispose();
    this.pond.dispose();
    this.props.dispose();
    this.clouds.dispose();
    this.rain.dispose();
    this.smoke.dispose();
    this.fireflies.dispose();
    this.materials.dispose();
  }
}
