import * as THREE from 'three';
import { POND, RIPPLE_COUNT } from '../config';
import { mulberry32 } from '../utils';

export interface Ripple {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  strength: number;
  active: boolean;
}

export interface LakeRefs {
  group: THREE.Group;
  waterMaterial: THREE.MeshStandardMaterial;
  ripples: Ripple[];
  /** Spawn a ripple at pond-local x/z (clamped inside the shore). */
  splash: (x: number, z: number, strength: number) => void;
  /** Advance ripple animation; spawn ambient/rain ripples. */
  update: (dt: number, rainAmount: number) => void;
}

/**
 * A small pond with a sandy shoreline and a pooled set of expanding
 * ripple rings. Ripples are pre-allocated once and recycled — nothing
 * is created per frame.
 */
export function createLake(): LakeRefs {
  const group = new THREE.Group();
  group.name = 'lake';
  group.position.set(POND.x, 0, POND.z);

  const R = POND.radius;

  // dark basin
  const basin = new THREE.Mesh(
    new THREE.CircleGeometry(R, 48),
    new THREE.MeshStandardMaterial({ color: '#26424c', roughness: 1 }),
  );
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = 0.012;
  basin.receiveShadow = true;
  group.add(basin);

  // sandy shore ring
  const shore = new THREE.Mesh(
    new THREE.RingGeometry(R - 0.06, R + 0.34, 56),
    new THREE.MeshStandardMaterial({ color: '#d9c9a4', roughness: 0.95, flatShading: true }),
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = 0.018;
  shore.receiveShadow = true;
  group.add(shore);

  // water surface
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: '#4d9cc2',
    roughness: 0.14,
    metalness: 0.05,
    transparent: true,
    opacity: 0.86,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 48), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.045;
  group.add(water);

  // ripple pool
  const rippleGeo = new THREE.RingGeometry(0.44, 0.5, 32);
  rippleGeo.rotateX(-Math.PI / 2);
  const ripples: Ripple[] = [];
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: '#d8eef8',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(rippleGeo, material);
    mesh.position.y = 0.055;
    mesh.visible = false;
    group.add(mesh);
    ripples.push({ mesh, material, age: 0, life: 1, strength: 1, active: false });
  }

  const rand = mulberry32(99);
  let cursor = 0;
  let ambientTimer = 1.2;

  const splash = (x: number, z: number, strength: number): void => {
    const rp = ripples[cursor];
    cursor = (cursor + 1) % ripples.length;
    const d = Math.hypot(x, z);
    const maxR = R - 0.3;
    const k = d > maxR ? maxR / d : 1;
    rp.mesh.position.x = x * k;
    rp.mesh.position.z = z * k;
    rp.age = 0;
    rp.life = 0.9 + rand() * 0.5;
    rp.strength = strength;
    rp.active = true;
    rp.mesh.visible = true;
  };

  const update = (dt: number, rainAmount: number): void => {
    // ambient / rain-driven spawning
    ambientTimer -= dt;
    if (ambientTimer <= 0) {
      if (rainAmount > 0.4) {
        ambientTimer = 0.05 + rand() * 0.09;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * (R - 0.35);
        splash(Math.cos(a) * r, Math.sin(a) * r, 0.55 + rainAmount * 0.45);
      } else {
        ambientTimer = 1.6 + rand() * 1.4;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * (R - 0.35);
        splash(Math.cos(a) * r, Math.sin(a) * r, 0.4);
      }
    }

    for (const rp of ripples) {
      if (!rp.active) continue;
      rp.age += dt;
      const f = rp.age / rp.life;
      if (f >= 1) {
        rp.active = false;
        rp.mesh.visible = false;
        rp.material.opacity = 0;
        continue;
      }
      const s = 0.22 + f * 1.7;
      rp.mesh.scale.setScalar(s);
      rp.material.opacity = rp.strength * (1 - f) * (1 - f) * 0.6;
    }
  };

  return { group, waterMaterial, ripples, splash, update };
}
