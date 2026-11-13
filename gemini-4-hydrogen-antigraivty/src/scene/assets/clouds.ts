import * as THREE from 'three';
import { WindVector } from '../../state/worldState';
import { AtmosphereSample } from '../palette';

export interface CloudInstance {
  group: THREE.Group;
  x: number;
  baseY: number;
  z: number;
  speedMultiplier: number;
  baseScale: number;
  phase: number;
}

export interface CloudsAssetHandle {
  group: THREE.Group;
  update(
    dt: number,
    windFactor: number,
    windDir: WindVector,
    rainFactor: number,
    atmosphere: AtmosphereSample,
    reducedMotion: boolean
  ): void;
  getCloudPositions(): Array<{ x: number; y: number; z: number }>;
  dispose(): void;
}

const X_BOUND = 10.5;
const Z_MIN = -8.2;
const Z_MAX = -2.4;
const Z_SPAN = Z_MAX - Z_MIN;

export function createClouds(): CloudsAssetHandle {
  const group = new THREE.Group();
  group.name = 'island-clouds';

  const disposables: Array<{ dispose(): void }> = [];
  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#f9f1e4',
    emissive: new THREE.Color('#f9f1e4'),
    emissiveIntensity: 0.28,
    roughness: 0.96,
    metalness: 0.0,
    flatShading: false,
    transparent: true,
    opacity: 0.94,
  });
  disposables.push(puffGeo, cloudMat);

  const cloudSpecs = [
    { x: -4.4, y: 3.95, z: -4.6, scale: 0.86, speedMultiplier: 1.0, phase: 0.2 },
    { x: 4.1, y: 4.15, z: -5.0, scale: 0.94, speedMultiplier: 0.85, phase: 1.7 },
    { x: -0.6, y: 4.4, z: -6.4, scale: 0.76, speedMultiplier: 1.15, phase: 3.1 },
    { x: 5.2, y: 3.7, z: -3.4, scale: 0.68, speedMultiplier: 0.95, phase: 4.5 },
  ];

  const puffOffsets: Array<[number, number, number, number, number, number]> = [
    [0, 0, 0, 1.0, 0.62, 0.78],
    [-0.78, -0.08, 0.08, 0.72, 0.48, 0.62],
    [0.82, -0.06, -0.06, 0.76, 0.5, 0.64],
    [0.24, 0.24, 0.14, 0.66, 0.46, 0.56],
    [-0.3, 0.18, -0.14, 0.58, 0.44, 0.52],
  ];

  const clouds: CloudInstance[] = [];

  for (const spec of cloudSpecs) {
    const cloudGroup = new THREE.Group();
    cloudGroup.position.set(spec.x, spec.y, spec.z);
    cloudGroup.scale.setScalar(spec.scale);

    for (const [ox, oy, oz, sx, sy, sz] of puffOffsets) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(ox, oy, oz);
      puff.scale.set(sx, sy, sz);
      puff.castShadow = true;
      puff.receiveShadow = true;
      cloudGroup.add(puff);
    }

    group.add(cloudGroup);
    clouds.push({
      group: cloudGroup,
      x: spec.x,
      baseY: spec.y,
      z: spec.z,
      speedMultiplier: spec.speedMultiplier,
      baseScale: spec.scale,
      phase: spec.phase,
    });
  }

  let elapsedSec = 0;

  return {
    group,
    update(dt, windFactor, windDir, rainFactor, atmosphere, reducedMotion) {
      const w = Math.max(0, Math.min(1, windFactor));
      if (w > 0 && dt > 0) {
        elapsedSec += dt;
      }

      cloudMat.color.set(atmosphere.cloudColor);
      cloudMat.emissive.set(atmosphere.cloudColor);
      cloudMat.emissiveIntensity = 0.24 + rainFactor * 0.1;
      cloudMat.opacity = 0.92 + rainFactor * 0.06;

      for (const cloud of clouds) {
        if (w > 0 && dt > 0) {
          const driftSpeed = w * 1.45 * cloud.speedMultiplier;
          cloud.x += windDir.x * driftSpeed * dt;
          cloud.z += windDir.z * driftSpeed * dt;

          // Wrap smoothly within the upper-sky backdrop zone so clouds never cross in front of the island
          if (cloud.x > X_BOUND) cloud.x -= X_BOUND * 2;
          if (cloud.x < -X_BOUND) cloud.x += X_BOUND * 2;
          if (cloud.z > Z_MAX) cloud.z -= Z_SPAN;
          if (cloud.z < Z_MIN) cloud.z += Z_SPAN;
        }

        const xFade = Math.max(0.05, Math.min(1, (X_BOUND - Math.abs(cloud.x)) / 2.2));
        const zMargin = Math.min(cloud.z - Z_MIN, Z_MAX - cloud.z);
        const zFade = Math.max(0.05, Math.min(1, zMargin / 1.1));
        const edgeFade = Math.min(xFade, zFade);
        const bob =
          w > 0 && !reducedMotion
            ? Math.sin(elapsedSec * 0.9 + cloud.phase) * 0.08 * w
            : 0;
        const rainSink = rainFactor * 0.35;

        cloud.group.position.set(cloud.x, cloud.baseY - rainSink + bob, cloud.z);
        cloud.group.scale.setScalar(cloud.baseScale * edgeFade * (1 + rainFactor * 0.14));
      }
    },
    getCloudPositions() {
      return clouds.map((c) => ({
        x: c.group.position.x,
        y: c.group.position.y,
        z: c.group.position.z,
      }));
    },
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
