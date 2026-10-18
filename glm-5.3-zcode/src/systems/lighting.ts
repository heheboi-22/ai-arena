import * as THREE from 'three';
import { smoothstep } from '../lib/math';
import { moonDirection, sunDirection, type PaletteSample } from '../palette';
import type { Frame } from '../lib/frame';

export interface Lighting {
  update(palette: PaletteSample, f: Frame): void;
}

const MOON_COLOR = new THREE.Color(0xa9c2e8);

/**
 * One shadow-casting directional light plays both sun and moon (they never
 * appear together), plus a hemisphere fill that keeps nights readable.
 */
export function makeLighting(scene: THREE.Scene, shadowMapSize: number): Lighting {
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  const cam = key.shadow.camera;
  cam.left = -11;
  cam.right = 11;
  cam.top = 11;
  cam.bottom = -11;
  cam.near = 1;
  cam.far = 60;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);

  const hemi = new THREE.HemisphereLight(0xbdd9ea, 0x77695a, 0.8);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambient);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const lightDir = new THREE.Vector3();

  return {
    update(palette, f) {
      sunDirection(f.hour, sunDir);
      moonDirection(f.hour, moonDir);

      const sunI = palette.sunIntensity * (1 - 0.62 * f.rain);
      // The moon fades in as the sun leaves the sky, so exactly one source wins.
      const day = smoothstep(sunDir.y / 0.3);
      const moonI = 0.42 * (1 - day) * (1 - 0.5 * f.rain);

      if (sunI >= moonI) {
        // After sunset the keyed sun intensity lingers; keep its rays above the horizon.
        lightDir.copy(sunDir);
        lightDir.y = Math.max(lightDir.y, 0.16);
        lightDir.normalize();
        key.color.copy(palette.sunColor);
        key.intensity = sunI;
      } else {
        lightDir.copy(moonDir);
        key.color.copy(MOON_COLOR);
        key.intensity = moonI;
      }
      key.position.copy(lightDir).multiplyScalar(20);
      key.target.position.set(0, 0, 0);

      hemi.color.copy(palette.hemiSky);
      hemi.groundColor.copy(palette.hemiGround);
      hemi.intensity = palette.hemiIntensity * (1 - 0.35 * f.rain);
      ambient.intensity = 0.08 + 0.05 * palette.dayFactor;
    },
  };
}
