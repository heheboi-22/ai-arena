import * as THREE from 'three';
import { WINDMILL } from '../config';

export interface WindmillRefs {
  group: THREE.Group;
  /** Blade assembly — rotate around local z for spinning. */
  blades: THREE.Group;
  /** Smoothed angular speed, updated by the main loop. */
  speed: number;
}

/**
 * A stubby stone-and-cream windmill with a four-sail rotor. The blade
 * group's local z axis is the axle, so `blades.rotation.z -= speed*dt`
 * spins it; speed itself is eased toward wind-derived targets so the
 * rotor never snaps when the wind slider changes.
 */
export function createWindmill(): WindmillRefs {
  const group = new THREE.Group();
  group.name = 'windmill';

  const towerMat = new THREE.MeshStandardMaterial({
    color: '#e8dcc0',
    roughness: 0.92,
    flatShading: true,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: '#c9664a',
    roughness: 0.85,
    flatShading: true,
  });
  const sailMat = new THREE.MeshStandardMaterial({
    color: '#f3ead6',
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#8a6a44',
    roughness: 0.85,
  });

  // tapered tower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.55, 2.6, 10), towerMat);
  tower.position.y = 1.3;
  group.add(tower);

  // cap roof
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.6, 10), roofMat);
  cap.position.y = 2.9;
  group.add(cap);

  // door + tiny loft window
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.06), frameMat);
  door.position.set(0, 0.3, 0.52);
  group.add(door);
  const loft = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.05),
    new THREE.MeshStandardMaterial({ color: '#4c4437', roughness: 0.6 }),
  );
  loft.position.set(0.01, 1.75, 0.42);
  loft.rotation.x = -0.08;
  group.add(loft);

  // axle pointing forward (+z)
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), frameMat);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, 2.55, 0.55);
  group.add(axle);

  // rotor
  const blades = new THREE.Group();
  blades.position.set(0, 2.55, 0.72);

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), frameMat);
  blades.add(hub);

  const armGeo = new THREE.BoxGeometry(0.07, 1.55, 0.045);
  const sailGeo = new THREE.BoxGeometry(0.5, 1.05, 0.025);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const spar = new THREE.Mesh(armGeo, frameMat);
    spar.position.y = 0.82;
    arm.add(spar);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.17, 1.05, 0);
    sail.rotation.z = 0.06;
    arm.add(sail);
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
  }
  group.add(blades);

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  group.position.copy(WINDMILL.position);
  group.rotation.y = WINDMILL.rotationY;

  return { group, blades, speed: 0 };
}
