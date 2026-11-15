import * as THREE from "three";
import {
  createRng,
  groundHeightAt,
  HOUSE_CENTER,
  islandRadiusAt,
  pondNormalizedRadius,
  WATER_LEVEL,
  WINDMILL_CENTER,
} from "../util/math";

export interface RainRig {
  group: THREE.Group;
  update: (
    dt: number,
    rainMix: number,
    windStrength: number,
    daylight: number,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

interface DropState {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
}

const _dummy = new THREE.Object3D();
const _dayRain = new THREE.Color("#c8deed");
const _nightRain = new THREE.Color("#6b85a8");

export function createRain(): RainRig {
  const group = new THREE.Group();
  group.name = "RainSystem";

  const COUNT = 420;
  const rng = createRng(31415);

  const dropGeo = new THREE.CylinderGeometry(0.008, 0.013, 0.46, 4);
  const dropMat = new THREE.MeshBasicMaterial({
    color: "#c8deed",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(dropGeo, dropMat, COUNT);
  mesh.frustumCulled = false;
  mesh.visible = false;
  group.add(mesh);

  const drops: DropState[] = [];
  const CLOUD_MIN_Y = 5.6;
  const CLOUD_MAX_Y = 9.4;

  function resetDrop(d: DropState, randomY = false) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 8.2;
    d.x = Math.cos(angle) * rad;
    d.z = Math.sin(angle) * rad;
    d.y = randomY
      ? 0.2 + rng() * (CLOUD_MAX_Y - 0.2)
      : CLOUD_MIN_Y + rng() * (CLOUD_MAX_Y - CLOUD_MIN_Y);
    d.speed = 9.5 + rng() * 3.8;
    d.len = 0.78 + rng() * 0.55;
  }

  for (let i = 0; i < COUNT; i++) {
    const d: DropState = { x: 0, y: 0, z: 0, speed: 10, len: 1 };
    resetDrop(d, true);
    drops.push(d);
  }

  const update = (
    dt: number,
    rainMix: number,
    windStrength: number,
    daylight: number,
    reducedMotion: boolean
  ) => {
    if (rainMix <= 0.01) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    dropMat.color.copy(_nightRain).lerp(_dayRain, daylight);
    dropMat.opacity = rainMix * 0.58;

    // Shared wind tilts rain smoothly; at 0% wind rain falls straight down
    const windVelX = windStrength * 4.8;
    const windVelZ = windStrength * 1.4;
    const tiltZ = Math.atan2(windVelX, 11.0);
    const tiltX = -Math.atan2(windVelZ, 11.0);
    const motionFactor = reducedMotion ? 0.55 : 1;

    for (let i = 0; i < COUNT; i++) {
      const d = drops[i];
      d.x += windVelX * dt * motionFactor;
      d.z += windVelZ * dt * motionFactor;
      d.y -= d.speed * dt * motionFactor;

      const r = Math.hypot(d.x, d.z);
      const angle = Math.atan2(d.z, d.x);
      const maxR = islandRadiusAt(angle);

      let shouldRecycle = false;
      const hitsHouse =
        Math.abs(d.x - HOUSE_CENTER.x) < 1.32 &&
        Math.abs(d.z - HOUSE_CENTER.z) < 1.05 &&
        d.y <= 2.3;
      const hitsWindmill =
        Math.hypot(d.x - WINDMILL_CENTER.x, d.z - WINDMILL_CENTER.z) < 0.85 &&
        d.y <= 3.15;
      if (hitsHouse || hitsWindmill) {
        shouldRecycle = true;
      } else if (r <= maxR * 0.99) {
        const surfaceY =
          pondNormalizedRadius(d.x, d.z) < 1.0
            ? WATER_LEVEL
            : groundHeightAt(d.x, d.z);
        if (d.y <= surfaceY + 0.12) {
          shouldRecycle = true;
        }
      } else if (d.y < -2.4 || r > 10.5) {
        shouldRecycle = true;
      }

      if (shouldRecycle) {
        resetDrop(d, false);
      }

      _dummy.position.set(d.x, d.y, d.z);
      _dummy.rotation.set(tiltX, 0, tiltZ);
      _dummy.scale.set(1, d.len * rainMix, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    dropGeo.dispose();
    dropMat.dispose();
  };

  return {
    group,
    update,
    dispose,
  };
}

