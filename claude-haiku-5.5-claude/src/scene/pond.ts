import { CircleGeometry, DodecahedronGeometry, Group, InstancedMesh, Mesh, Object3D } from 'three';
import { createRng } from '../util/math';
import { POND, WATER_LEVEL, terrainHeight } from './terrain';
import type { SharedMaterials } from './materials';

export interface Pond {
  group: Group;
}

/**
 * The basin itself lives in terrainHeight(); this adds the water surface and a
 * ring of stones along the shore so the waterline reads at a glance.
 */
export function createPond(mats: SharedMaterials): Pond {
  const group = new Group();
  group.name = 'pond';

  // Slightly larger than the shoreline: the terrain rises above the water past the contour, hiding the overlap.
  const waterGeometry = new CircleGeometry(POND.radius * 0.95, 56);
  waterGeometry.rotateX(-Math.PI / 2);
  const water = new Mesh(waterGeometry, mats.pond);
  water.position.set(POND.x, WATER_LEVEL, POND.z);
  water.receiveShadow = true;
  water.name = 'pond-water';
  group.add(water);

  const rng = createRng(73);
  const stoneCount = 20;
  const stoneGeometry = new DodecahedronGeometry(1, 0);
  const stones = new InstancedMesh(stoneGeometry, mats.stone, stoneCount);
  stones.castShadow = true;
  stones.receiveShadow = true;
  stones.name = 'pond-shore-stones';

  const dummy = new Object3D();
  for (let i = 0; i < stoneCount; i++) {
    const a = (i / stoneCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const ring = POND.radius * (0.96 + (rng() - 0.5) * 0.12);
    const x = POND.x + Math.cos(a) * ring;
    const z = POND.z + Math.sin(a) * ring;
    const s = 0.1 + rng() * 0.09;
    dummy.position.set(x, Math.max(terrainHeight(x, z), WATER_LEVEL) + s * 0.25, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s * (1.1 + rng() * 0.4), s * 0.7, s * (1 + rng() * 0.3));
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
  }
  stones.instanceMatrix.needsUpdate = true;
  group.add(stones);

  return { group };
}
