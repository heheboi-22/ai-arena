import * as THREE from 'three';
import { damp } from '../lib/math';
import { WORLD } from '../palette';
import { WINDMILL } from './layout';
import type { SharedMaterials } from './materials';

export interface Windmill {
  group: THREE.Group;
  update: (dt: number, wind: number) => void;
}

export function createWindmill(
  mats: SharedMaterials,
  groundY: (x: number, z: number) => number,
): Windmill {
  const group = new THREE.Group();
  group.position.set(WINDMILL.x, groundY(WINDMILL.x, WINDMILL.z) - 0.02, WINDMILL.z);
  group.rotation.y = WINDMILL.rot;

  const towerMat = new THREE.MeshStandardMaterial({ color: WORLD.creamShade, roughness: 0.92 });

  // tapered stone tower with a wooden gallery ring
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 1.7, 10), towerMat);
  tower.position.y = 0.85;
  tower.castShadow = tower.receiveShadow = true;
  group.add(tower);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.09, 10), mats.woodDark);
  ring.position.y = 0.36;
  ring.castShadow = true;
  group.add(ring);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 10), mats.woodDark);
  cap.position.y = 1.93;
  cap.castShadow = true;
  group.add(cap);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.05), mats.wood);
  door.position.set(0, 0.35, 0.43);
  group.add(door);

  // hub + four slightly pitched blades, spinning on the local z axis
  const hubGroup = new THREE.Group();
  hubGroup.position.set(0, 1.62, 0.4);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), mats.woodDark);
  axle.rotation.x = Math.PI / 2;
  axle.position.z = -0.1;
  hubGroup.add(axle);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mats.woodDark);
  hubGroup.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.16, 1.05, 0.03);
  for (let i = 0; i < 4; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI) / 2;
    const blade = new THREE.Mesh(bladeGeo, mats.wood);
    blade.position.y = 0.6;
    blade.rotation.y = 0.42; // pitch so the blades read as sails
    blade.castShadow = true;
    holder.add(blade);
    hubGroup.add(holder);
  }
  group.add(hubGroup);

  let speed = 0;
  let angle = 0;

  return {
    group,
    update(dt, wind) {
      // blades spin up and wind down with inertia instead of snapping
      speed = damp(speed, wind * 2.6, 1.4, dt);
      angle += speed * dt;
      hubGroup.rotation.z = angle;
    },
  };
}
