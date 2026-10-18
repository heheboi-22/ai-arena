import {
  BoxGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { insideIsland, terrainHeight } from '../scene/terrain';
import { clamp, createRng, smoothstep } from '../util/math';

export interface Rain {
  mesh: InstancedMesh;
  /**
   * `amount` is 0..1 and decides how many pooled drops are visible; `wind` slants them.
   * Drops that reach the island or leave it are recycled to the top of the column.
   */
  update(dt: number, amount: number, wind: number): void;
}

const FALL_SPEED = 8.6;
const DROP_LENGTH = 0.42;
const TOP_Y = 10;
const SPAWN_RADIUS = 5.5;
const UP = new Vector3(0, 1, 0);

/**
 * Pooled rain streaks. One InstancedMesh and a fixed number of drops, so the
 * number of objects never changes after startup. Each drop has a fixed rank:
 * the first `amount * count` drops are visible, which keeps the fade smooth.
 */
export function createRain(count: number): Rain {
  const rng = createRng(2025);
  const geometry = new BoxGeometry(0.012, DROP_LENGTH, 0.012);
  const material = new MeshBasicMaterial({ color: 0xd9e8f3, transparent: true, opacity: 0.5, depthWrite: false });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = 'rain';
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // Instances move every frame, so their bounds are stale; always draw them.
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const speed = new Float32Array(count);

  const spawnAt = (i: number, staggered: boolean): void => {
    // Spawn inside a disc that sits within the rim, so drops start over the island.
    for (let tries = 0; tries < 6; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * SPAWN_RADIUS;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      if (insideIsland(px, pz, 0.2)) {
        x[i] = px;
        z[i] = pz;
        break;
      }
      x[i] = 0;
      z[i] = 0;
    }
    y[i] = staggered ? TOP_Y * (0.1 + rng() * 0.9) : TOP_Y + rng() * 0.6;
    speed[i] = FALL_SPEED * (0.85 + rng() * 0.3);
  };

  for (let i = 0; i < count; i++) spawnAt(i, true);

  const dummy = new Object3D();
  const dir = new Vector3();
  const tilt = new Quaternion();

  return {
    mesh,
    update(dt, amount, wind) {
      // Wind slants the fall. At zero wind the rain falls straight down.
      const drift = clamp(wind, 0, 1) * 2.4;
      dir.set(drift, -FALL_SPEED, 0).normalize();
      tilt.setFromUnitVectors(UP, dir);

      for (let i = 0; i < count; i++) {
        const v = speed[i];
        x[i] += drift * (v / FALL_SPEED) * dt;
        y[i] -= v * dt;

        // Recycle on landing (grass or pond), or when a drop slides off the island.
        if (y[i] < 0.6) {
          const ground = terrainHeight(x[i], z[i]);
          if (y[i] <= ground) spawnAt(i, false);
        }
        if (!insideIsland(x[i], z[i], 0.0)) spawnAt(i, false);

        // A drop is visible once `amount` passes its rank. The fade width keeps the change gradual.
        const rank = i / count;
        const visible = smoothstep(0, 0.02, amount - rank);

        dummy.position.set(x[i], y[i], z[i]);
        dummy.quaternion.copy(tilt);
        dummy.scale.set(1, visible, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
