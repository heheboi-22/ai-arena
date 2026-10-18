import * as THREE from 'three';
import { smoothstep } from '../core/math';
import type { Wind } from './wind';

interface Puff {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  age: number;
  life: number;
  drift: THREE.Vector3;
}

/** A thin ribbon of chimney smoke. It rises and leans downwind with the shared wind. */
export function createSmoke(origin: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = 'smoke';
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const puffs: Puff[] = [];
  const COUNT = 18;
  for (let i = 0; i < COUNT; i++) {
    const material = new THREE.MeshStandardMaterial({
      color: '#ece7df',
      roughness: 1,
      flatShading: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.raycast = () => {};
    mesh.visible = false;
    group.add(mesh);
    puffs.push({ mesh, material, age: 1, life: 3.6, drift: new THREE.Vector3() });
  }

  const wv = new THREE.Vector3();
  let timer = 0;
  let next = 0;

  return {
    group,
    update(dt: number, wind: Wind, color: THREE.Color, enabled: boolean) {
      if (enabled) {
        timer += dt;
        // Stronger wind stretches the plume, so puffs come faster and fade sooner to stay joined.
        if (timer > 0.34 / (1 + 1.2 * wind.gusting)) {
          timer = 0;
          const p = puffs[next];
          next = (next + 1) % COUNT;
          p.age = 0;
          p.life = (3.2 + Math.random() * 0.8) / (1 + 0.6 * wind.gusting);
          p.mesh.position.copy(origin);
          p.drift.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06);
          p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        }
      }
      wind.vector(1.15, wv);
      for (const p of puffs) {
        if (p.age >= 1) {
          p.mesh.visible = false;
          continue;
        }
        p.age = Math.min(1, p.age + dt / p.life);
        const t = p.age;
        p.mesh.visible = true;
        p.mesh.position.x += (wv.x * (0.3 + t) + p.drift.x) * dt;
        p.mesh.position.z += (wv.z * (0.3 + t) + p.drift.z) * dt;
        p.mesh.position.y += (0.42 - 0.18 * t) * dt;
        p.mesh.scale.setScalar(0.055 + t * 0.2);
        p.material.opacity = smoothstep(0, 0.12, t) * (1 - smoothstep(0.45, 1, t)) * 0.6;
        p.material.color.copy(color);
      }
    },
  };
}
