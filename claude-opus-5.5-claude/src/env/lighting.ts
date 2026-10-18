import * as THREE from 'three';
import type { Quality } from '../core/quality';
import { VIEW_AZIMUTH } from '../world/layout';
import type { EnvSample } from './timeOfDay';

const MIN_ELEVATION = THREE.MathUtils.degToRad(7);

/**
 * One shadow-casting key light that is the sun by day and the moon by night, a hemisphere
 * light for sky fill, and a weak front fill that keeps the faceted underside readable.
 */
export function createLighting(scene: THREE.Scene, quality: Quality) {
  const key = new THREE.DirectionalLight('#ffffff', 2);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  const cam = key.shadow.camera;
  cam.left = -6.5;
  cam.right = 6.5;
  cam.top = 6.5;
  cam.bottom = -6.5;
  cam.near = 1;
  cam.far = 40;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 2.5;
  key.target.position.set(0, -0.5, 0);
  scene.add(key, key.target);

  const hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
  scene.add(hemi);

  const fill = new THREE.DirectionalLight('#ffffff', 0.3);
  fill.position.set(Math.sin(VIEW_AZIMUTH - 0.4) * 10, -4, Math.cos(VIEW_AZIMUTH - 0.4) * 10);
  scene.add(fill);

  const dir = new THREE.Vector3();

  return {
    apply(env: EnvSample, keyDir: THREE.Vector3, rain: number) {
      dir.copy(keyDir);
      // Keep the light a little above the horizon so low sun still grazes the island
      // instead of lighting it from underneath; its intensity is already near zero there.
      const flat = Math.hypot(dir.x, dir.z) || 1;
      const elevation = Math.max(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), MIN_ELEVATION);
      dir.set((dir.x / flat) * Math.cos(elevation), Math.sin(elevation), (dir.z / flat) * Math.cos(elevation));
      key.position.copy(key.target.position).addScaledVector(dir, 20);
      key.color.copy(env.key);
      key.intensity = env.keyIntensity;
      key.shadow.intensity = 0.85 * (1 - 0.55 * rain);
      key.shadow.radius = 2.5 + rain * 3;

      hemi.color.copy(env.hemiSky);
      hemi.groundColor.copy(env.hemiGround).lerp(env.skyBottom, 0.35);
      hemi.intensity = env.hemiIntensity;

      fill.color.copy(env.skyHorizon);
      fill.intensity = 0.45 + 0.35 * (1 - env.night);
    },
  };
}
