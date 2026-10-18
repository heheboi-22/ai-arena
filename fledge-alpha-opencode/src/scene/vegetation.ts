import * as THREE from 'three';
import { groundY } from './island';

export interface Swaying {
  group: THREE.Group;
  update(t: number, wind: number): void;
}

export function makePine(scale: number, tint: number): Swaying {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.12 * scale, 0.6 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x8a6244, roughness: 0.9 })
  );
  trunk.position.y = 0.3 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, flatShading: true });
  const layers = [
    { r: 0.55 * scale, h: 0.7 * scale, y: 0.7 * scale },
    { r: 0.4 * scale, h: 0.6 * scale, y: 1.15 * scale },
    { r: 0.26 * scale, h: 0.5 * scale, y: 1.55 * scale },
  ];
  const crown = new THREE.Group();
  for (const l of layers) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(l.r, l.h, 8), leafMat);
    cone.position.y = l.y;
    cone.castShadow = true;
    crown.add(cone);
  }
  group.add(crown);
  const phase = Math.random() * Math.PI * 2;
  return {
    group,
    update(t, wind) {
      crown.rotation.z = Math.sin(t * 1.7 + phase) * 0.06 * wind;
      crown.rotation.x = Math.cos(t * 1.25 + phase) * 0.045 * wind;
    },
  };
}

export function makeBroadleaf(scale: number, tint: number): Swaying {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.13 * scale, 0.7 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x7d5a40, roughness: 0.9 })
  );
  trunk.position.y = 0.35 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, flatShading: true });
  const crown = new THREE.Group();
  const blobs = [
    { p: [0, 1.0, 0], s: 0.55 },
    { p: [0.32, 0.85, 0.12], s: 0.38 },
    { p: [-0.26, 0.9, -0.14], s: 0.34 },
    { p: [0.05, 1.3, 0.08], s: 0.3 },
  ];
  for (const b of blobs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b.s * scale, 1), leafMat);
    m.position.set(b.p[0] * scale, b.p[1] * scale, b.p[2] * scale);
    m.castShadow = true;
    crown.add(m);
  }
  group.add(crown);
  const phase = Math.random() * Math.PI * 2;
  return {
    group,
    update(t, wind) {
      crown.rotation.z = Math.sin(t * 1.4 + phase) * 0.07 * wind;
      crown.rotation.x = Math.cos(t * 1.1 + phase) * 0.05 * wind;
    },
  };
}

export interface TreeSpec {
  make(): Swaying;
  x: number;
  z: number;
  rotY: number;
}

export function placeTrees(world: THREE.Group): Swaying[] {
  const specs: TreeSpec[] = [
    { make: () => makePine(1.25, 0x4f7d4f), x: -3.8, z: 1.8, rotY: 0.4 },
    { make: () => makePine(0.95, 0x5d8a55), x: -0.9, z: -3.9, rotY: 1.2 },
    { make: () => makePine(0.7, 0x557f52), x: -4.2, z: -1.8, rotY: 2.1 },
    { make: () => makeBroadleaf(1.15, 0x6fa35c), x: 1.6, z: -4.3, rotY: 0.8 },
    { make: () => makeBroadleaf(0.85, 0x7fae62), x: -2.9, z: -3.4, rotY: 1.9 },
    { make: () => makeBroadleaf(0.6, 0x8ab56a), x: -0.5, z: 4.3, rotY: 2.7 },
  ];
  const swayers: Swaying[] = [];
  for (const s of specs) {
    const tree = s.make();
    tree.group.position.set(s.x, groundY(s.x, s.z) - 0.05, s.z);
    tree.group.rotation.y = s.rotY;
    world.add(tree.group);
    swayers.push(tree);
  }
  return swayers;
}
