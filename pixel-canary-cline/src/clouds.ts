import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRandom } from './noise';

export interface CloudsHandle {
  group: THREE.Group;
  update: (dt: number, wind: number, rain: number, tint: THREE.Color, lit: number) => void;
}

interface Cloud {
  mesh: THREE.Mesh;
  radius: number;
  baseY: number;
  drift: number;
}

function cloudGeometry(rand: () => number, radius: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const puffs = 6 + Math.floor(rand() * 4);
  for (let i = 0; i < puffs; i += 1) {
    const puff = new THREE.SphereGeometry(radius * (0.45 + rand() * 0.55), 8, 6);
    const a = rand() * Math.PI * 2;
    puff.translate(
      Math.cos(a) * radius * rand() * 0.9,
      (rand() - 0.4) * radius * 0.45,
      Math.sin(a) * radius * rand() * 0.5,
    );
    puff.scale(1, 0.62 + rand() * 0.25, 0.9);
    parts.push(puff);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Six low clouds that circle the island; wind decides how fast they travel. */
export function buildClouds(): CloudsHandle {
  const group = new THREE.Group();
  group.name = 'clouds';
  const rand = makeRandom(52561);
  const clouds: Cloud[] = [];
  const material = new THREE.MeshStandardMaterial({
    color: '#f6f7f4',
    roughness: 1,
    metalness: 0,
    flatShading: true,
    transparent: true,
    opacity: 0.95,
  });

  for (let i = 0; i < 6; i += 1) {
    const radius = 0.6 + rand() * 0.7;
    const mesh = new THREE.Mesh(cloudGeometry(rand, radius), material);
    const angle = (i / 6) * Math.PI * 2 + rand() * 0.6;
    const distance = 6.2 + rand() * 3.4;
    const baseY = 3.0 + rand() * 2.6;
    mesh.position.set(Math.cos(angle) * distance, baseY, Math.sin(angle) * distance);
    mesh.rotation.y = rand() * Math.PI;
    mesh.castShadow = false;
    group.add(mesh);
    clouds.push({ mesh, radius, baseY, drift: angle });
  }

  return {
    group,
    update(dt, wind, rain, tint, lit) {
      material.color.copy(tint).lerp(new THREE.Color('#8f959d'), rain * 0.75);
      material.opacity = 0.92;
      for (const cloud of clouds) {
        // Angular drift keeps clouds on a ring so they never wander off-screen.
        cloud.drift += (dt * (0.018 + wind * 0.115)) / Math.max(1, cloud.radius * 1.6);
        const distance = 6.2 + (cloud.baseY - 3) * 0.9;
        cloud.mesh.position.x = Math.cos(cloud.drift) * distance;
        cloud.mesh.position.z = Math.sin(cloud.drift) * distance;
        cloud.mesh.position.y =
          cloud.baseY + Math.sin(cloud.drift * 3 + cloud.radius * 9) * 0.12 - rain * 0.9;
        cloud.mesh.rotation.y += dt * 0.02;
        cloud.mesh.scale.setScalar(1 + lit * 0.06);
      }
    },
  };
}
