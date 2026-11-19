import * as THREE from 'three';
import type { WorldMaterials } from './materials';
import { smoothstep } from './terrainMath';

export interface CloudsBundle {
  group: THREE.Group;
  update: (
    dt: number,
    windStrength: number,
    windDirX: number,
    windDirZ: number,
    rainAmount: number,
    nightFactor: number,
    sunsetFactor: number,
    reducedMotion: boolean,
  ) => void;
  getSampleCloudPosition: () => { x: number; z: number };
  dispose: () => void;
}

interface CloudInstance {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  /** Position along the shared wind axis in [-SPAN, +SPAN]. */
  along: number;
  /** Perpendicular offset across the sky. */
  across: number;
  baseY: number;
  speedMul: number;
  baseScale: number;
}

const CLOUD_WRAP_SPAN = 12.5;
const MAX_CLOUD_SPEED = 2.4;

export function createClouds(materials: WorldMaterials): CloudsBundle {
  const group = new THREE.Group();
  group.name = 'floating-clouds';

  const puffGeo = new THREE.IcosahedronGeometry(0.68, 2);
  const clouds: CloudInstance[] = [];
  const cloudMaterials: THREE.MeshStandardMaterial[] = [];

  // With windDir ≈ (+0.89, -0.46), perp ≈ (+0.46, +0.89), negative `across` floats behind the island!
  const cloudLayouts = [
    { along: -5.2, across: -4.8, y: 4.1, scale: 1.04, speedMul: 0.95 },
    { along: 0.2, across: -5.6, y: 4.65, scale: 1.18, speedMul: 1.04 },
    { along: 4.8, across: -4.1, y: 3.9, scale: 0.92, speedMul: 0.9 },
    { along: -2.4, across: -2.6, y: 4.95, scale: 0.84, speedMul: 1.1 },
    { along: 8.4, across: -5.2, y: 4.35, scale: 0.96, speedMul: 0.98 },
  ];

  const puffPatterns = [
    [
      [0, 0.16, 0, 1.15, 0.72, 0.92],
      [-0.78, -0.02, 0.12, 0.85, 0.56, 0.78],
      [0.82, 0.0, -0.1, 0.92, 0.58, 0.82],
      [-0.25, 0.36, -0.22, 0.72, 0.58, 0.7],
      [0.36, 0.3, 0.25, 0.68, 0.52, 0.68],
    ],
    [
      [0, 0.18, 0, 1.24, 0.74, 0.96],
      [-0.86, 0.0, -0.14, 0.82, 0.54, 0.78],
      [0.92, -0.02, 0.16, 0.78, 0.52, 0.74],
      [0.2, 0.38, -0.18, 0.78, 0.6, 0.72],
      [-0.4, 0.26, 0.28, 0.66, 0.5, 0.64],
      [0.58, 0.22, -0.28, 0.62, 0.48, 0.62],
    ],
  ];

  cloudLayouts.forEach((layout, idx) => {
    const cloudMat = materials.cloud.clone();
    cloudMaterials.push(cloudMat);

    const cloudGroup = new THREE.Group();
    const pattern = puffPatterns[idx % puffPatterns.length];

    for (const [px, py, pz, sx, sy, sz] of pattern) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(px, py, pz);
      puff.scale.set(sx, sy, sz);
      puff.castShadow = false;
      puff.receiveShadow = false;
      cloudGroup.add(puff);
    }

    cloudGroup.rotation.y = idx * 0.65;
    group.add(cloudGroup);

    clouds.push({
      group: cloudGroup,
      material: cloudMat,
      along: layout.along,
      across: layout.across,
      baseY: layout.y,
      speedMul: layout.speedMul,
      baseScale: layout.scale,
    });
  });

  const dayClearColor = new THREE.Color(0xfcf7ee);
  const sunsetClearColor = new THREE.Color(0xf8c39f);
  const nightClearColor = new THREE.Color(0x637699);
  const dayRainColor = new THREE.Color(0x7c8a9b);
  const sunsetRainColor = new THREE.Color(0x7e7685);
  const nightRainColor = new THREE.Color(0x415069);
  const clearTint = new THREE.Color();
  const rainTint = new THREE.Color();
  const finalTint = new THREE.Color();
  const emissiveTint = new THREE.Color();

  const update: CloudsBundle['update'] = (
    dt,
    windStrength,
    windDirX,
    windDirZ,
    rainAmount,
    nightFactor,
    sunsetFactor,
    reducedMotion,
  ) => {
    const perpX = -windDirZ;
    const perpZ = windDirX;
    const motionScale = reducedMotion ? 0.35 : 1.0;

    // Compute weather & time-of-day cloud tint
    clearTint.copy(dayClearColor).lerp(sunsetClearColor, sunsetFactor * 0.78);
    clearTint.lerp(nightClearColor, nightFactor * 0.9);

    rainTint.copy(dayRainColor).lerp(sunsetRainColor, sunsetFactor * 0.65);
    rainTint.lerp(nightRainColor, nightFactor * 0.9);

    finalTint.copy(clearTint).lerp(rainTint, rainAmount);
    emissiveTint.copy(finalTint).multiplyScalar(0.32 + nightFactor * 0.14);

    for (const c of clouds) {
      // Drift strictly along shared wind direction; stops cleanly at zero wind
      c.along += windStrength * MAX_CLOUD_SPEED * c.speedMul * motionScale * dt;
      if (c.along > CLOUD_WRAP_SPAN) {
        c.along -= CLOUD_WRAP_SPAN * 2;
      }

      // Smooth fade & shrink near wrap boundaries so clouds never pop in or out
      const edgeFade = 1 - smoothstep(CLOUD_WRAP_SPAN - 2.6, CLOUD_WRAP_SPAN, Math.abs(c.along));

      // In rain weather, clouds gather gently closer and fuller over the island
      const weatherScale = 1 + rainAmount * 0.22;
      const weatherDrop = rainAmount * 0.55;
      const acrossPull = 1 - rainAmount * 0.28;

      const x = windDirX * c.along + perpX * (c.across * acrossPull);
      const z = windDirZ * c.along + perpZ * (c.across * acrossPull);
      const y = c.baseY - weatherDrop;

      c.group.position.set(x, y, z);
      const s = c.baseScale * weatherScale * (0.35 + 0.65 * edgeFade);
      c.group.scale.setScalar(s);

      c.material.color.copy(finalTint);
      c.material.emissive.copy(emissiveTint);
      c.material.emissiveIntensity = 0.72;
      c.material.opacity = (0.88 + rainAmount * 0.08) * edgeFade;
      c.group.visible = edgeFade > 0.01;
    }
  };

  return {
    group,
    update,
    getSampleCloudPosition: () => ({
      x: clouds[0].group.position.x,
      z: clouds[0].group.position.z,
    }),
    dispose: () => {
      puffGeo.dispose();
      for (const m of cloudMaterials) {
        m.dispose();
      }
    },
  };
}
