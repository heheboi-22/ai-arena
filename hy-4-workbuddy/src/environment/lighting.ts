import * as THREE from 'three';
import { PAL } from '../world/palette';
import type { Atmosphere } from '../world/palette';

export interface Lighting {
  group: THREE.Group;
  update(atm: Atmosphere): void;
}

export function createLighting(lowCost: boolean): Lighting {
  const group = new THREE.Group();
  group.name = 'lighting';

  const hemi = new THREE.HemisphereLight('#dce9e0', PAL.soilDark.clone(), 1);
  group.add(hemi);

  const sun = new THREE.DirectionalLight('#fff3da', 2.2);
  sun.castShadow = true;
  const size = lowCost ? 1024 : 2048;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 42;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = lowCost ? 2 : 3;
  sun.target.position.set(0, 0, 0);
  group.add(sun, sun.target);

  // A cool fill from the camera side keeps the island readable after dark
  // without washing out the warm windows.
  const fill = new THREE.DirectionalLight('#8fa9c8', 0.35);
  fill.position.set(-7, 6, 10);
  group.add(fill);

  const groundBounce = new THREE.DirectionalLight('#c3a486', 0.42);
  groundBounce.position.set(-2, -9, 4);
  group.add(groundBounce);

  return {
    group,
    update(atm) {
      sun.position.copy(atm.sunDir).multiplyScalar(20);
      sun.color.copy(atm.sunColor);
      sun.intensity = atm.sunPower;
      hemi.color.copy(atm.horizon).lerp(atm.top, 0.25);
      hemi.groundColor.copy(PAL.soil);
      hemi.intensity = atm.fill * 1.05;
      fill.intensity = 0.22 + atm.night * 0.62;
      fill.color.set('#8fa9c8').lerp(new THREE.Color('#e2c9a6'), atm.golden * 0.35);
      groundBounce.intensity = 0.32 + atm.day * 0.22;
    },
  };
}
