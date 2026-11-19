import * as THREE from 'three';
import type { SmoothedEnvironment } from '../state/transitions';
import { createAtmosphere, type AtmosphereBundle, type AtmosphereSample } from './atmosphere';
import { createClouds, type CloudsBundle } from './clouds';
import { createEnvironmentDetails, type DetailsBundle } from './details';
import { createFoliage, type FoliageBundle } from './foliage';
import { createHouse, type HouseBundle } from './house';
import { createIsland, type IslandBundle } from './island';
import { createWorldMaterials, type WorldMaterials } from './materials';
import { createWeatherSystem, type WeatherBundle } from './weather';
import { createWindmill, type WindmillBundle } from './windmill';

export interface SceneMetricsSnapshot {
  bladeAngle: number;
  treeTilt: number;
  cloudPos: { x: number; z: number };
  activeDrops: number;
  activeRipples: number;
  rainTiltAngle: number;
  nightFactor: number;
  sunsetFactor: number;
  windowEmissiveIntensity: number;
}

export class PocketWorldScene {
  readonly scene: THREE.Scene;
  readonly houseHitRoot: THREE.Group;

  private readonly materials: WorldMaterials;
  private readonly atmosphere: AtmosphereBundle;
  private readonly island: IslandBundle;
  private readonly house: HouseBundle;
  private readonly windmill: WindmillBundle;
  private readonly foliage: FoliageBundle;
  private readonly details: DetailsBundle;
  private readonly clouds: CloudsBundle;
  private readonly weather: WeatherBundle;

  private elapsed = 0;
  private lastSample: AtmosphereSample | null = null;

  constructor(isCompactDevice: boolean) {
    this.scene = new THREE.Scene();

    const shadowMapSize = isCompactDevice ? 1024 : 2048;
    this.materials = createWorldMaterials();
    this.atmosphere = createAtmosphere(this.scene, shadowMapSize);
    this.island = createIsland(this.materials);
    this.house = createHouse(this.materials);
    this.windmill = createWindmill(this.materials);
    this.foliage = createFoliage(this.materials);
    this.details = createEnvironmentDetails(this.materials);
    this.clouds = createClouds(this.materials);
    this.weather = createWeatherSystem(this.materials, isCompactDevice);

    this.houseHitRoot = this.house.hitRoot;

    this.scene.add(
      this.atmosphere.group,
      this.island.group,
      this.house.group,
      this.windmill.group,
      this.foliage.group,
      this.details.group,
      this.clouds.group,
      this.weather.group,
    );
  }

  update(
    dt: number,
    env: Readonly<SmoothedEnvironment>,
    reducedMotion: boolean,
  ): AtmosphereSample {
    this.elapsed += dt;

    const sample = this.atmosphere.update(
      env.timeMinutes,
      env.rainAmount,
      this.elapsed,
      reducedMotion,
    );
    this.lastSample = sample;

    this.island.update(
      dt,
      this.elapsed,
      env.windStrength,
      env.rainAmount,
      sample.nightFactor,
      sample.sunsetFactor,
      reducedMotion,
    );

    this.house.update(
      dt,
      env.houseLightsAmount,
      sample.nightFactor,
      sample.sunsetFactor,
      env.windStrength,
      env.windDirX,
      env.windDirZ,
      reducedMotion,
    );

    this.windmill.update(dt, env.windStrength, reducedMotion);

    this.foliage.update(
      this.elapsed,
      env.windStrength,
      env.windDirX,
      env.windDirZ,
      reducedMotion,
    );

    this.details.update(
      this.elapsed,
      env.windStrength,
      env.windDirX,
      env.windDirZ,
      reducedMotion,
    );

    this.clouds.update(
      dt,
      env.windStrength,
      env.windDirX,
      env.windDirZ,
      env.rainAmount,
      sample.nightFactor,
      sample.sunsetFactor,
      reducedMotion,
    );

    this.weather.update(
      dt,
      env.rainAmount,
      env.windStrength,
      env.windDirX,
      env.windDirZ,
      sample.nightFactor,
      reducedMotion,
    );

    return sample;
  }

  getMetricsSnapshot(): SceneMetricsSnapshot {
    const weatherStats = this.weather.getActiveStats();
    return {
      bladeAngle: this.windmill.getBladeAngle(),
      treeTilt: this.foliage.getSampleTilt(),
      cloudPos: this.clouds.getSampleCloudPosition(),
      activeDrops: weatherStats.activeDrops,
      activeRipples: weatherStats.activeRipples,
      rainTiltAngle: weatherStats.rainTiltAngle,
      nightFactor: this.lastSample?.nightFactor ?? 0,
      sunsetFactor: this.lastSample?.sunsetFactor ?? 0,
      windowEmissiveIntensity: this.materials.windowGlass.emissiveIntensity,
    };
  }

  dispose(): void {
    this.atmosphere.dispose();
    this.island.dispose();
    this.house.dispose();
    this.windmill.dispose();
    this.foliage.dispose();
    this.details.dispose();
    this.clouds.dispose();
    this.weather.dispose();
    this.materials.dispose();
  }
}
