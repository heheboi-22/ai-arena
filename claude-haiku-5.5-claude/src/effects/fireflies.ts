import { InstancedMesh, MeshBasicMaterial, Object3D, SphereGeometry } from 'three';
import { isClear } from '../scene/layout';
import { terrainHeight } from '../scene/terrain';
import { createRng } from '../util/math';

export interface Fireflies {
  mesh: InstancedMesh;
  /** `night` is 0..1. At daytime the fireflies are hidden and their matrices are not rewritten. */
  update(elapsed: number, night: number, reducedMotion: boolean): void;
}

const COUNT = 14;

/** A few warm specks that drift and pulse around the island after dark. */
export function createFireflies(): Fireflies {
  const rng = createRng(31);
  const mesh = new InstancedMesh(
    new SphereGeometry(0.035, 6, 5),
    new MeshBasicMaterial({ color: 0xffe08a }),
    COUNT,
  );
  mesh.name = 'fireflies';
  mesh.frustumCulled = false;
  mesh.castShadow = false;

  const home = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  let placed = 0;
  for (let tries = 0; placed < COUNT && tries < 400; tries++) {
    const x = (rng() * 2 - 1) * 4.6;
    const z = (rng() * 2 - 1) * 4.6;
    if (!isClear(x, z, 0.3)) continue;
    const o = placed * 3;
    home[o] = x;
    home[o + 1] = terrainHeight(x, z) + 0.7 + rng() * 1.6;
    home[o + 2] = z;
    phase[placed] = rng() * Math.PI * 2;
    placed++;
  }
  mesh.count = placed;

  const dummy = new Object3D();
  return {
    mesh,
    update(elapsed, night, reducedMotion) {
      if (night < 0.01) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const drift = reducedMotion ? 0.3 : 1;
      for (let i = 0; i < placed; i++) {
        const o = i * 3;
        const t = elapsed * 0.4 + phase[i];
        dummy.position.set(
          home[o] + Math.sin(t * 0.9) * 0.22 * drift,
          home[o + 1] + Math.sin(t * 1.3) * 0.14 * drift,
          home[o + 2] + Math.cos(t * 0.7) * 0.22 * drift,
        );
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.6 + phase[i] * 2);
        dummy.scale.setScalar(night * (0.4 + 0.6 * pulse));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
