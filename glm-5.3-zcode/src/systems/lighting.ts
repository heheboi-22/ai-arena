import * as THREE from 'three';
import { sunDirection, nightFactor, type EnvLighting } from '../palette';

export interface Lighting {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  moon: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  /** tint multiplying unlit water shaders so they follow the sky */
  waterTint: THREE.Color;
  update: (env: EnvLighting, hour: number, rain: number) => void;
}

export function createLighting(shadowMapSize: number): Lighting {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 6;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  group.add(sun, sun.target);

  // the moon relights the scene softly at night and takes over the shadows
  const moon = new THREE.DirectionalLight(0x9fb6e8, 0);
  moon.castShadow = false;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -9;
  moon.shadow.camera.right = 9;
  moon.shadow.camera.top = 9;
  moon.shadow.camera.bottom = -9;
  moon.shadow.camera.near = 6;
  moon.shadow.camera.far = 60;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.03;
  group.add(moon, moon.target);

  const hemi = new THREE.HemisphereLight(0xbfd7ee, 0x4a4038, 0.75);
  group.add(hemi);

  // keeps deep night readable without flattening the mood
  const ambient = new THREE.AmbientLight(0x8fa3c8, 0.2);
  group.add(ambient);

  const waterTint = new THREE.Color(0xffffff);
  const dir = new THREE.Vector3();

  return {
    group,
    sun,
    moon,
    hemi,
    ambient,
    waterTint,
    update(env, hour, rain) {
      sunDirection(hour, dir);
      sun.position.copy(dir).multiplyScalar(28);
      sun.target.position.set(0, 0, 0);
      sun.color.copy(env.sunColor);
      sun.intensity = env.sunIntensity;

      moon.position.copy(dir).multiplyScalar(-28);
      moon.target.position.set(0, 0, 0);
      const night = nightFactor(hour);
      moon.intensity = night * (1 - rain * 0.7) * 0.55;
      // hand the shadow map to the moon only once the sun is truly gone
      const moonShadows = night > 0.55;
      if (moon.castShadow !== moonShadows) moon.castShadow = moonShadows;
      sun.castShadow = !moonShadows;

      hemi.color.copy(env.hemiSky);
      hemi.groundColor.copy(env.hemiGround);
      hemi.intensity = Math.min(env.hemiIntensity * 1.15, 1.05);
      ambient.intensity = env.ambientIntensity;

      // unlit water follows the sky brightness (white = neutral)
      const brightness = 0.3 + 0.7 * Math.min(1, env.hemiIntensity / 0.8 + night * 0.15);
      waterTint.setRGB(brightness, brightness, Math.min(1, brightness * 1.04));
    },
  };
}
