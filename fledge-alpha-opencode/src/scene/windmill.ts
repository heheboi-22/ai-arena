import * as THREE from 'three';

export class Windmill {
  readonly group = new THREE.Group();
  readonly rotor = new THREE.Group();

  constructor() {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.85 });

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.52, 2.5, 10), towerMat);
    tower.position.y = 1.25;
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.group.add(tower);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xa85a42, roughness: 0.85 }));
    cap.position.y = 2.75;
    cap.castShadow = true;
    this.group.add(cap);

    // door
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 0.05), woodMat);
    door.position.set(0, 0.22, 0.48);
    this.group.add(door);

    // blades
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf5ead2, roughness: 0.8 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x9a6a44, roughness: 0.85 });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.15, 0.035), bladeMat);
      panel.position.y = 0.72;
      panel.castShadow = true;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.05), edgeMat);
      spar.position.y = 0.6;
      blade.add(panel, spar);
      blade.rotation.z = (i * Math.PI) / 2;
      blade.rotation.y = 0.16; // slight pitch
      this.rotor.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), woodMat);
    this.rotor.add(hub);
    this.rotor.position.set(0, 2.5, 0.55);
    this.group.add(this.rotor);
  }

  update(wind: number, dt: number) {
    this.rotor.rotation.z += wind * 4.2 * dt;
  }
}
