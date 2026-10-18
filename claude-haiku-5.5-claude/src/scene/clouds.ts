import { Group, Mesh, SphereGeometry } from 'three';
import type { SharedMaterials } from './materials';
import { createRng } from '../util/math';

export interface Cloud {
  group: Group;
  /** Position on the wrap track before wind travel is added. */
  baseX: number;
}

/** Clouds wrap along a track this long, so none can drift out of frame and pop back in. */
export const CLOUD_TRACK = 72;

/** Builds a few puffy clouds above and behind the island. They sit high and back so they never cover the house. */
export function createClouds(mats: SharedMaterials): { group: Group; clouds: Cloud[] } {
  const group = new Group();
  group.name = 'clouds';
  const rng = createRng(606);
  const puffGeometry = new SphereGeometry(1, 14, 10);
  const clouds: Cloud[] = [];
  const count = 7;

  for (let i = 0; i < count; i++) {
    const cloud = new Group();
    const puffs = 4 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new Mesh(puffGeometry, mats.cloud);
      const r = 0.8 + rng() * 0.9;
      // Squashed vertically so each cloud has a flat, soft underside.
      puff.scale.set(r * 1.3, r * 0.72, r);
      puff.position.set((p - puffs / 2) * 0.9 + (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.8);
      cloud.add(puff);
    }

    const baseX = -CLOUD_TRACK / 2 + (i / count) * CLOUD_TRACK + (rng() - 0.5) * 4;
    cloud.position.set(baseX, 6.2 + rng() * 3.2, -7 - rng() * 12);
    cloud.scale.setScalar(0.85 + rng() * 0.5);
    cloud.name = 'cloud';
    group.add(cloud);
    clouds.push({ group: cloud, baseX });
  }

  return { group, clouds };
}

/** Moves every cloud by the same shared travel distance, wrapping along the track. */
export function updateClouds(clouds: Cloud[], travel: number): void {
  for (const cloud of clouds) {
    const wrapped = ((cloud.baseX + travel + CLOUD_TRACK / 2) % CLOUD_TRACK + CLOUD_TRACK) % CLOUD_TRACK;
    cloud.group.position.x = wrapped - CLOUD_TRACK / 2;
  }
}
