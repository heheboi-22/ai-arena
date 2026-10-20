import { Group, Vector3 } from 'three';
import type { EnvironmentFrame } from '../environment/environment';
import type { TextureSet } from '../lib/textures';
import { createAmbient, type AmbientLayer } from './ambient';
import { createClouds, type CloudLayer } from './clouds';
import { createDetails, type DetailSet } from './details';
import { createHouse, type House } from './house';
import {
  HOUSE_CENTER,
  WINDMILL_CENTER,
  boundaryRadius,
  createIsland,
  isOnIsland,
  terrainHeight,
  type Island,
} from './island';
import { createPond, type Pond } from './pond';
import { createTrees, type TreeSet } from './trees';
import { createWindmill, type Windmill } from './windmill';
import type { SceneMaterials } from './palette';

export class World {
  readonly group = new Group();
  readonly island: Island;
  readonly house: House;
  readonly pond: Pond;
  private readonly trees: TreeSet;
  private readonly windmill: Windmill;
  private readonly clouds: CloudLayer;
  private readonly details: DetailSet;
  private readonly ambient: AmbientLayer;
  private readonly chimney = new Vector3();

  constructor(materials: SceneMaterials, textures: TextureSet, quality: 'high' | 'low') {
    this.group.name = 'pocket-world';
    this.island = createIsland(materials, quality);
    this.group.add(this.island.group);

    this.house = createHouse(materials);
    this.house.group.position.set(
      HOUSE_CENTER.x,
      terrainHeight(HOUSE_CENTER.x, HOUSE_CENTER.z) - 0.035,
      HOUSE_CENTER.z,
    );
    this.house.group.rotation.y = 0.42;
    this.group.add(this.house.group);

    this.windmill = createWindmill(materials);
    this.windmill.group.position.set(
      WINDMILL_CENTER.x,
      terrainHeight(WINDMILL_CENTER.x, WINDMILL_CENTER.z) - 0.12,
      WINDMILL_CENTER.z,
    );
    this.windmill.group.rotation.y = 0.74;
    this.group.add(this.windmill.group);

    this.pond = createPond(materials);
    this.group.add(this.pond.group);

    this.trees = createTrees(materials, [
      { variant: 'broadleaf', x: 3.5, z: -1.2, scale: 1.06, seed: 21 },
      { variant: 'pine', x: -1.35, z: -3.95, scale: 1.12, seed: 22 },
      { variant: 'birch', x: -4.12, z: -0.72, scale: 0.94, seed: 23 },
      { variant: 'blossom', x: -3.45, z: 2.4, scale: 0.82, seed: 24 },
      { variant: 'broadleaf', x: 0.32, z: -4.12, scale: 0.84, seed: 25 },
      { variant: 'pine', x: 4.02, z: 1.6, scale: 0.62, seed: 26 },
    ]);
    this.group.add(this.trees.group);

    this.clouds = createClouds(materials);
    this.group.add(this.clouds.group);

    this.house.group.updateWorldMatrix(true, false);
    const doorPoint = new Vector3(0, 0, 1.05).applyMatrix4(this.house.group.matrixWorld);
    this.details = createDetails(materials, doorPoint);
    this.group.add(this.details.group);

    this.house.smokeOrigin.getWorldPosition(this.chimney);
    this.ambient = createAmbient(textures.softDot, this.chimney);
    this.group.add(this.ambient.group);
  }

  update(
    dt: number,
    elapsed: number,
    frame: EnvironmentFrame,
    reducedMotion: boolean,
  ): void {
    this.house.setLightLevel(frame.lights, frame.night);
    this.windmill.update(dt, frame.wind, reducedMotion);
    this.trees.update(elapsed, frame.wind, reducedMotion);
    this.clouds.update(dt, elapsed, frame.wind, frame, reducedMotion);
    this.pond.update(elapsed, frame.wind, frame, reducedMotion);
    this.details.update(elapsed, frame.wind, reducedMotion);
    this.ambient.update(dt, elapsed, frame.wind, frame, reducedMotion);
  }

  resetDecorative(): void {
    this.clouds.reset();
  }

  isOnIsland = (x: number, z: number, margin?: number): boolean =>
    isOnIsland(x, z, margin);

  terrainHeight = (x: number, z: number): number => terrainHeight(x, z);

  boundaryRadius = (angle: number): number => boundaryRadius(angle);
}
