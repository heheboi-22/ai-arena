import * as THREE from 'three';
import { mulberry32 } from '../utils';

export interface CloudsRefs {
  group: THREE.Group;
  /** Shared material — sky system tints it for night/rain. */
  material: THREE.MeshStandardMaterial;
  update: (dt: number, t: number, wind: number, motionScale: number) => void;
}

const CLOUD_SPOTS: Array<{ x: number; y: number; z: number; s: number; speed: number }> = [
  { x: 3.2, y: 4.7, z: -2.2, s: 1.25, speed: 1.0 },
  { x: -4.6, y: 5.5, z: 1.6, s: 1.55, speed: 0.75 },
  { x: 0.6, y: 6.3, z: -4.8, s: 1.0, speed: 1.2 },
  { x: -2.2, y: -2.3, z: 3.6, s: 0.9, speed: 0.6 },
  { x: 5.2, y: -1.3, z: 4.1, s: 0.65, speed: 1.35 },
];

const WRAP_X = 15;

/**
 * A handful of puffy clouds drifting on the shared wind. Two of them
 * float *below* the island, which sells the floating-world illusion.
 * Clouds wrap around horizontally so they never leave the scene.
 */
export function createClouds(): CloudsRefs {
  const group = new THREE.Group();
  group.name = 'clouds';

  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    metalness: 0,
  });

  const rand = mulberry32(5);
  const puffGeo = new THREE.SphereGeometry(1, 14, 10);
  const clouds: THREE.Group[] = [];

  for (const spot of CLOUD_SPOTS) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < puffs; i++) {
      const puff = new THREE.Mesh(puffGeo, material);
      const px = (i - (puffs - 1) / 2) * 0.85 + (rand() - 0.5) * 0.3;
      const pr = spot.s * (0.55 + rand() * 0.45) * (1 - Math.abs(px) * 0.12);
      puff.position.set(px * spot.s, (rand() - 0.5) * 0.22 * spot.s, (rand() - 0.5) * 0.4 * spot.s);
      puff.scale.set(pr * 1.25, pr * 0.62, pr);
      puff.castShadow = true;
      cloud.add(puff);
    }
    cloud.position.set(spot.x, spot.y, spot.z);
    group.add(cloud);
    clouds.push(cloud);
  }

  const update = (dt: number, t: number, wind: number, motionScale: number): void => {
    const drift = Math.max(wind, 0.04);
    for (let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i];
      const spot = CLOUD_SPOTS[i];
      cloud.position.x += drift * spot.speed * dt;
      if (cloud.position.x > WRAP_X) cloud.position.x = -WRAP_X;
      cloud.position.y = spot.y + Math.sin(t * 0.5 + i * 1.7) * 0.12 * motionScale;
    }
  };

  return { group, material, update };
}
