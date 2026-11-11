import * as THREE from 'three';
import { GROUND_Y } from '../config';

export interface Windmill {
  group: THREE.Group;
  blades: THREE.Group; // rotate this around Z to spin
}

function makeBlade(): THREE.Group {
  const blade = new THREE.Group();
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.42, 0.06),
    new THREE.MeshStandardMaterial({ color: '#caa46a', roughness: 0.8 })
  );
  arm.position.y = 0.71; // extend outward from hub
  arm.castShadow = true;
  blade.add(arm);
  // a slatted sail for charm
  const sail = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 1.14, 0.03),
    new THREE.MeshStandardMaterial({
      color: '#f7efd8',
      roughness: 0.85,
      // slight self-illumination so the blades stay legible when backlit
      emissive: new THREE.Color('#4a4132'),
      emissiveIntensity: 0.55,
    })
  );
  sail.position.set(0.21, 0.69, 0.02);
  sail.castShadow = true;
  blade.add(sail);
  return blade;
}

/** A small windmill: tapered tower, cap, and four clearly visible blades. */
export function createWindmill(): Windmill {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.7, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: '#9a8d72', roughness: 0.95 })
  );
  base.position.y = GROUND_Y + 0.15;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const towerH = 2.8;
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.52, towerH, 18),
    new THREE.MeshStandardMaterial({ color: '#e7dcc0', roughness: 0.85 })
  );
  tower.position.y = GROUND_Y + 0.3 + towerH / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.5, 18),
    new THREE.MeshStandardMaterial({ color: '#b9563b', roughness: 0.8 })
  );
  cap.position.y = GROUND_Y + 0.3 + towerH + 0.2;
  cap.castShadow = true;
  group.add(cap);

  // Support arm + hub at the front of the tower.
  const hubY = GROUND_Y + 0.3 + towerH - 0.2;
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: '#6e4a2e', roughness: 0.9 })
  );
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, hubY, 0.25);
  group.add(arm);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.18, 14),
    new THREE.MeshStandardMaterial({ color: '#5b3d24', roughness: 0.85 })
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, hubY, 0.5);
  group.add(hub);

  const blades = new THREE.Group();
  blades.position.set(0, hubY, 0.56);
  for (let i = 0; i < 4; i++) {
    const b = makeBlade();
    b.rotation.z = (i * Math.PI) / 2;
    blades.add(b);
  }
  blades.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  group.add(blades);

  return { group, blades };
}
