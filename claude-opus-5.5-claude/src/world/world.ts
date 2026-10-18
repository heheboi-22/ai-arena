import * as THREE from 'three';
import type { Quality } from '../core/quality';
import { HeightField, SurfaceKind, type SurfaceHit } from '../env/heightField';
import { buildClouds } from './clouds';
import { buildHouse } from './house';
import { buildIsland } from './island';
import { POND } from './layout';
import { createMaterials } from './materials';
import { buildPond } from './pond';
import { buildProps } from './props';
import { groundHeight, insideIsland, pondQ } from './terrain';
import { buildTrees } from './trees';
import { buildWindmill } from './windmill';

/** Builds every static piece of the diorama and the collision surface for rain. */
export function buildWorld(quality: Quality) {
  const materials = createMaterials();
  const island = buildIsland(materials);
  const house = buildHouse(materials);
  const windmill = buildWindmill(materials);
  const trees = buildTrees(materials);
  const pond = buildPond(materials);
  const props = buildProps(materials, quality.grassTufts);
  const clouds = buildClouds();

  // Everything that floats together. Clouds stay outside so the island drifts past them.
  const root = new THREE.Group();
  root.name = 'island-root';
  root.add(island.group, house.group, windmill.group, trees, pond.group, props);

  const probe = (x: number, z: number): SurfaceHit => {
    if (!insideIsland(x, z, 1.015)) return { height: 0, kind: SurfaceKind.None };
    let height = groundHeight(x, z);
    let kind: SurfaceKind = SurfaceKind.Ground;
    if (pondQ(x, z) < 1) {
      height = POND.waterY;
      kind = SurfaceKind.Water;
    }
    const roof = Math.max(house.roofHeightAt(x, z), windmill.topHeightAt(x, z));
    if (roof > height) {
      height = roof;
      kind = SurfaceKind.Structure;
    }
    return { height, kind };
  };
  const surface = new HeightField(5.9, 168, probe);

  return { root, island, house, windmill, trees, pond, props, clouds, surface, materials };
}

export type World = ReturnType<typeof buildWorld>;
