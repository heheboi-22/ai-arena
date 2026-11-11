import * as THREE from 'three';
import { createRng, lerp } from '../utils/math';
import { getRainImpactHeight, isPointInWater } from './terrainMath';

export interface WeatherRig {
  group: THREE.Group;
  update: (
    dt: number,
    rainAmount: number,
    wind: number,
    dayFactor: number,
    reducedMotion: boolean
  ) => void;
}

interface RainDrop {
  x: number;
  y: number;
  z: number;
  speedMul: number;
  lengthMul: number;
  active: boolean;
}

export function createWeatherSystem(
  onWaterHit: (x: number, z: number, strength?: number) => void,
  isCompactDevice = false
): WeatherRig {
  const group = new THREE.Group();
  group.name = 'WeatherRainGroup';
  const rng = createRng(4099);

  const poolCount = isCompactDevice ? 320 : 520;

  // Crisp elongated 3D raindrop streak aligned with +Y in local space
  const streakGeo = new THREE.CylinderGeometry(0.006, 0.011, 0.42, 4, 1, true);
  const streakMat = new THREE.MeshBasicMaterial({
    color: 0xcfe6fa,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const instanced = new THREE.InstancedMesh(streakGeo, streakMat, poolCount);
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instanced.frustumCulled = false;
  instanced.visible = false;
  group.add(instanced);

  const drops: RainDrop[] = [];
  const dummyMat = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyQuat = new THREE.Quaternion();
  const dummyScale = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const streakDir = new THREE.Vector3(0, 1, 0);

  function respawnDrop(drop: RainDrop, windX: number, windZ: number, randomHeight: boolean): void {
    // Spawn across cylindrical volume covering island + slight surrounding open air
    const radius = Math.sqrt(rng()) * 6.15;
    const theta = rng() * Math.PI * 2;
    const y = randomHeight ? 0.5 + rng() * 7.5 : 4.7 + rng() * 3.6;

    // Shift spawn slightly upwind so slanted rain continues to blanket the island center
    drop.x = Math.cos(theta) * radius - windX * 0.42;
    drop.y = y;
    drop.z = Math.sin(theta) * radius - windZ * 0.42;
    drop.speedMul = 0.84 + rng() * 0.34;
    drop.lengthMul = 0.8 + rng() * 0.45;
    drop.active = true;
  }

  for (let i = 0; i < poolCount; i++) {
    const d: RainDrop = {
      x: 0,
      y: 6,
      z: 0,
      speedMul: 1,
      lengthMul: 1,
      active: false,
    };
    drops.push(d);
    dummyScale.set(0, 0, 0);
    dummyMat.compose(dummyPos, dummyQuat, dummyScale);
    instanced.setMatrixAt(i, dummyMat);
  }
  instanced.instanceMatrix.needsUpdate = true;

  // Shared wind direction (+0.88 X, +0.47 Z)
  const windDirX = 0.88;
  const windDirZ = 0.47;

  let anyAliveLastFrame = false;

  return {
    group,
    update(dt, rainAmount, wind, dayFactor, reducedMotion) {
      const targetActiveCount = rainAmount > 0.01 ? Math.round(poolCount * rainAmount) : 0;

      // Fast exit when weather is completely clear and all drops have recycled
      if (targetActiveCount === 0 && !anyAliveLastFrame) {
        if (instanced.visible) {
          instanced.visible = false;
        }
        return;
      }

      instanced.visible = true;

      // Adapt rain streak brightness so rain stays legible day and night without overwhelming the miniature
      streakMat.color.copy(_cNightRain).lerp(_cDayRain, dayFactor);
      streakMat.opacity = Math.min(1, rainAmount * 1.15) * lerp(0.36, 0.52, dayFactor);

      // Gravity always pulls rain downward even at 0% wind; wind adds horizontal slant
      const motionRate = reducedMotion ? 0.62 : 1.0;
      const baseFallSpeed = 9.2 * motionRate;
      const horizWindSpeed = wind * 4.6 * motionRate;
      const vxBase = windDirX * horizWindSpeed;
      const vzBase = windDirZ * horizWindSpeed;

      // Orient 3D rain streaks along exact velocity vector
      streakDir.set(-vxBase, baseFallSpeed, -vzBase).normalize();
      dummyQuat.setFromUnitVectors(upAxis, streakDir);

      let aliveCount = 0;

      for (let i = 0; i < poolCount; i++) {
        const drop = drops[i];

        // Activate pooled drops smoothly up to targetActiveCount
        if (!drop.active) {
          if (i < targetActiveCount) {
            respawnDrop(drop, vxBase, vzBase, true);
          } else {
            continue;
          }
        }

        const speed = drop.speedMul;
        drop.x += vxBase * speed * dt;
        drop.y -= baseFallSpeed * speed * dt;
        drop.z += vzBase * speed * dt;

        // Obstacle-aware 3D stop/recycle height (terrain, pond surface, cottage roof, windmill cap)
        const impactY = getRainImpactHeight(drop.x, drop.z);
        const minRecycleY = impactY !== null ? impactY + 0.16 : -3.35;

        if (drop.y <= minRecycleY) {
          // Trigger occasional pond ripple right where a 3D drop strikes the water
          if (impactY !== null && isPointInWater(drop.x, drop.z) && rng() < 0.16) {
            onWaterHit(drop.x, drop.z, 0.7 + rainAmount * 0.4);
          }

          if (i < targetActiveCount) {
            respawnDrop(drop, vxBase, vzBase, false);
          } else {
            // Smoothly retire excess drops when transitioning back to Clear weather
            drop.active = false;
            dummyScale.set(0, 0, 0);
            dummyMat.compose(dummyPos, dummyQuat, dummyScale);
            instanced.setMatrixAt(i, dummyMat);
            continue;
          }
        }

        aliveCount++;
        dummyPos.set(drop.x, drop.y, drop.z);
        dummyScale.set(1, drop.lengthMul * (0.85 + wind * 0.25), 1);
        dummyMat.compose(dummyPos, dummyQuat, dummyScale);
        instanced.setMatrixAt(i, dummyMat);
      }

      anyAliveLastFrame = aliveCount > 0;
      instanced.instanceMatrix.needsUpdate = true;

      if (!anyAliveLastFrame) {
        instanced.visible = false;
      }
    },
  };
}

const _cDayRain = new THREE.Color(0xd6ebfc);
const _cNightRain = new THREE.Color(0x8fb2d4);
