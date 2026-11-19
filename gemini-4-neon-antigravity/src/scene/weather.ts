import * as THREE from 'three';
import type { WorldMaterials } from './materials';
import {
  POND_ANCHOR,
  WATER_LEVEL,
  getPondNormalizedDist,
  getRainCollision,
} from './terrainMath';

export interface WeatherBundle {
  group: THREE.Group;
  update: (
    dt: number,
    rainAmount: number,
    windStrength: number,
    windDirX: number,
    windDirZ: number,
    nightFactor: number,
    reducedMotion: boolean,
  ) => void;
  getActiveStats: () => {
    activeDrops: number;
    activeRipples: number;
    rainTiltAngle: number;
  };
  dispose: () => void;
}

interface RippleSlot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  duration: number;
  maxScale: number;
}

const RAIN_COLUMN_RADIUS = 6.2;
const RAIN_SPAWN_MIN_Y = 4.9;
const RAIN_SPAWN_MAX_Y = 9.0;
const BASE_FALL_SPEED = 13.4;
const WIND_DRIFT_SPEED = 6.8;
const RIPPLE_POOL_SIZE = 24;

export function createWeatherSystem(
  materials: WorldMaterials,
  isCompactDevice: boolean,
): WeatherBundle {
  const group = new THREE.Group();
  group.name = 'weather-effects';

  const poolSize = isCompactDevice ? 240 : 420;

  // --- 1. Pooled 3D Rain Streaks (InstancedMesh: zero per-frame object creation) ---
  const dropGeo = new THREE.CylinderGeometry(0.008, 0.0105, 0.48, 4, 1, false);
  const dropMat = new THREE.MeshBasicMaterial({
    color: 0xd4e4f2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const rainMesh = new THREE.InstancedMesh(dropGeo, dropMat, poolSize);
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  group.add(rainMesh);

  // Flat typed arrays for rain particle state
  const posX = new Float32Array(poolSize);
  const posY = new Float32Array(poolSize);
  const posZ = new Float32Array(poolSize);
  const speedMul = new Float32Array(poolSize);

  let rngSeed = 48271;
  const nextRand = () => {
    rngSeed = (rngSeed * 16807) % 2147483647;
    return (rngSeed - 1) / 2147483646;
  };

  const respawnDrop = (
    idx: number,
    windStrength: number,
    windDirX: number,
    windDirZ: number,
    randomHeight: boolean,
  ) => {
    const angle = nextRand() * Math.PI * 2;
    const radius = Math.sqrt(nextRand()) * RAIN_COLUMN_RADIUS;
    // Offset spawn slightly upwind so slanted rain naturally drapes across the island
    const upwindOffset = windStrength * 2.1;
    posX[idx] = Math.cos(angle) * radius - windDirX * upwindOffset;
    posZ[idx] = Math.sin(angle) * radius - windDirZ * upwindOffset;
    posY[idx] = randomHeight
      ? 0.2 + nextRand() * (RAIN_SPAWN_MAX_Y - 0.2)
      : RAIN_SPAWN_MIN_Y + nextRand() * (RAIN_SPAWN_MAX_Y - RAIN_SPAWN_MIN_Y);
    speedMul[idx] = 0.86 + nextRand() * 0.28;
  };

  for (let i = 0; i < poolSize; i++) {
    respawnDrop(i, 0.3, 0.86, 0.5, true);
  }

  // --- 2. Pooled Pond Ripples ---
  const rippleGeo = new THREE.PlaneGeometry(1, 1);
  rippleGeo.rotateX(-Math.PI / 2);

  const ripples: RippleSlot[] = [];
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: materials.textures.ripple,
      color: 0xdceef7,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.position.y = WATER_LEVEL + 0.018;
    mesh.visible = false;
    group.add(mesh);

    ripples.push({
      mesh,
      material: mat,
      active: false,
      age: 0,
      duration: 0.72,
      maxScale: 0.56,
    });
  }

  let nextRippleCursor = 0;
  let rippleSpawnTimer = 0;

  const spawnRippleAt = (x: number, z: number) => {
    // Only spawn ripples well inside the visible pond water area
    if (getPondNormalizedDist(x, z) > 0.8) return;

    for (let attempt = 0; attempt < RIPPLE_POOL_SIZE; attempt++) {
      const idx = (nextRippleCursor + attempt) % RIPPLE_POOL_SIZE;
      const slot = ripples[idx];
      if (!slot.active) {
        slot.active = true;
        slot.age = 0;
        slot.duration = 0.58 + nextRand() * 0.28;
        slot.maxScale = 0.42 + nextRand() * 0.28;
        slot.mesh.position.set(x, WATER_LEVEL + 0.018, z);
        slot.mesh.scale.setScalar(0.08);
        slot.mesh.visible = true;
        nextRippleCursor = (idx + 1) % RIPPLE_POOL_SIZE;
        return;
      }
    }
  };

  const spawnRandomPondRipple = () => {
    const cos = Math.cos(POND_ANCHOR.rotation);
    const sin = Math.sin(POND_ANCHOR.rotation);
    const a = nextRand() * Math.PI * 2;
    const r = Math.sqrt(nextRand()) * 0.76;
    const lx = Math.cos(a) * POND_ANCHOR.rx * r;
    const lz = Math.sin(a) * POND_ANCHOR.rz * r;
    const wx = POND_ANCHOR.x + lx * cos - lz * sin;
    const wz = POND_ANCHOR.z + lx * sin + lz * cos;
    spawnRippleAt(wx, wz);
  };

  // Reusable math temporaries (zero per-frame allocations)
  const upAxis = new THREE.Vector3(0, 1, 0);
  const velDir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3(1, 1, 1);
  const zeroScale = new THREE.Vector3(0, 0, 0);
  const posVec = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();

  const dayDropColor = new THREE.Color(0xdbe8f4);
  const nightDropColor = new THREE.Color(0x8eb0d6);
  const dayRippleColor = new THREE.Color(0xe6f3fa);
  const nightRippleColor = new THREE.Color(0x95b6d8);
  const rippleTint = new THREE.Color();

  let activeDropsCount = 0;
  let activeRipplesCount = 0;
  let currentTiltAngle = 0;

  const update: WeatherBundle['update'] = (
    dt,
    rainAmount,
    windStrength,
    windDirX,
    windDirZ,
    nightFactor,
    reducedMotion,
  ) => {
    const activeDrops = rainAmount > 0.005 ? Math.round(poolSize * rainAmount) : 0;
    activeDropsCount = activeDrops;

    // Velocity vector: at wind=0, rain falls straight down; wind tilts rain consistently
    const vx = windDirX * windStrength * WIND_DRIFT_SPEED;
    const vz = windDirZ * windStrength * WIND_DRIFT_SPEED;
    const fallScale = reducedMotion ? 0.62 : 1.0;

    velDir.set(vx, -BASE_FALL_SPEED, vz).normalize();
    currentTiltAngle = Math.atan2(Math.hypot(vx, vz), BASE_FALL_SPEED);
    quat.setFromUnitVectors(upAxis, velDir);

    // Rain visibility & tint readable in both bright daylight and dark night
    dropMat.color.copy(dayDropColor).lerp(nightDropColor, nightFactor * 0.78);
    dropMat.opacity = Math.min(0.46, rainAmount * (0.38 + nightFactor * 0.08));

    if (activeDrops === 0) {
      rainMesh.visible = false;
    } else {
      rainMesh.visible = true;
      for (let i = 0; i < poolSize; i++) {
        if (i >= activeDrops) {
          posVec.set(0, -50, 0);
          mat4.compose(posVec, quat, zeroScale);
          rainMesh.setMatrixAt(i, mat4);
          continue;
        }

        const sMul = speedMul[i] * fallScale;
        posX[i] += vx * sMul * dt;
        posY[i] -= BASE_FALL_SPEED * sMul * dt;
        posZ[i] += vz * sMul * dt;

        // Surface-aware collision: rain stops at roofs, grass, pond, or finite air floor
        const collision = getRainCollision(posX[i], posZ[i]);
        if (posY[i] <= collision.floorY) {
          if (collision.hitPond && rainAmount > 0.15) {
            spawnRippleAt(posX[i], posZ[i]);
          }
          respawnDrop(i, windStrength, windDirX, windDirZ, false);
        }

        // Smooth fade-in near cloud bottom so raindrops appear gracefully
        const topFade = Math.min(1, Math.max(0, (RAIN_SPAWN_MAX_Y - posY[i]) / 1.4));
        const bottomFade = collision.hitIsland
          ? 1
          : Math.min(1, Math.max(0, (posY[i] - collision.floorY) / 1.2));
        const dropScale = Math.min(topFade, bottomFade) * (0.65 + 0.35 * rainAmount);

        posVec.set(posX[i], posY[i], posZ[i]);
        scaleVec.set(1, 0.85 + 0.35 * windStrength, 1).multiplyScalar(dropScale);
        mat4.compose(posVec, quat, scaleVec);
        rainMesh.setMatrixAt(i, mat4);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
    }

    // Supplement pond impact ripples with a steady rain-proportional cadence
    if (rainAmount > 0.08) {
      rippleSpawnTimer += dt * (4.5 + rainAmount * 11.5) * (reducedMotion ? 0.55 : 1.0);
      while (rippleSpawnTimer >= 1) {
        rippleSpawnTimer -= 1;
        spawnRandomPondRipple();
      }
    } else {
      rippleSpawnTimer = 0;
    }

    // Update active pooled pond ripples and cleanly recycle finished rings
    let liveRipples = 0;
    rippleTint.copy(dayRippleColor).lerp(nightRippleColor, nightFactor * 0.85);
    for (const slot of ripples) {
      if (!slot.active) continue;
      slot.age += dt;
      if (slot.age >= slot.duration) {
        slot.active = false;
        slot.mesh.visible = false;
        continue;
      }
      liveRipples++;
      const p = slot.age / slot.duration;
      const easedScale = 0.08 + (1 - Math.pow(1 - p, 2)) * slot.maxScale;
      slot.mesh.scale.setScalar(easedScale);
      slot.material.color.copy(rippleTint);
      const fadeIn = Math.min(1, p * 5);
      const fadeOut = Math.pow(1 - p, 1.35);
      slot.material.opacity = fadeIn * fadeOut * (0.68 + rainAmount * 0.25);
    }
    activeRipplesCount = liveRipples;
  };

  return {
    group,
    update,
    getActiveStats: () => ({
      activeDrops: activeDropsCount,
      activeRipples: activeRipplesCount,
      rainTiltAngle: currentTiltAngle,
    }),
    dispose: () => {
      dropGeo.dispose();
      dropMat.dispose();
      rippleGeo.dispose();
      for (const slot of ripples) {
        slot.material.dispose();
      }
    },
  };
}
