import * as THREE from 'three';
import type { SceneContext } from '../environment/runtime';
import { WINDMILL, windmillGround } from './layout';
import type { WorldMaterials } from './materials';

const castShadows = (group: THREE.Object3D): void => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
};

export class Windmill {
  readonly group = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly blades = new THREE.Group();

  constructor(materials: WorldMaterials) {
    this.group.name = 'windmill';
    this.group.position.set(WINDMILL.x, windmillGround - 0.02, WINDMILL.z);
    this.group.rotation.y = WINDMILL.rotation;
    this.group.scale.setScalar(0.9);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.58, 0.48, 8),
      materials.stone
    );
    base.position.y = 0.22;
    this.group.add(base);

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.73, 0.78, 0.09, 8), materials.wood);
    deck.position.y = 0.06;
    this.group.add(deck);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.45, 1.6, 8),
      materials.plaster
    );
    body.position.y = 1.24;
    this.group.add(body);

    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 1.55, 0.05),
        materials.darkWood
      );
      rib.position.set(Math.cos(angle) * 0.35, 1.24, Math.sin(angle) * 0.35);
      rib.rotation.y = -angle;
      this.group.add(rib);
    }

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.385, 0.385, 0.08, 8),
      materials.darkWood
    );
    band.position.y = 1.72;
    this.group.add(band);
    const bandLower = band.clone();
    bandLower.geometry = new THREE.CylinderGeometry(0.455, 0.455, 0.07, 8);
    bandLower.position.y = 1.06;
    this.group.add(bandLower);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 0.05), materials.darkWood);
    door.position.set(-0.02, 0.64, 0.4);
    door.rotation.x = -0.045;
    this.group.add(door);

    const window = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.04), materials.darkWood);
    window.position.set(0.06, 1.36, 0.385);
    this.group.add(window);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.07), materials.wood);
    sill.position.set(0.06, 1.25, 0.39);
    this.group.add(sill);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.48, 8), materials.darkWood);
    cap.position.y = 2.23;
    this.group.add(cap);
    const capTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), materials.metal);
    capTip.position.y = 2.5;
    this.group.add(capTip);

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.35, 8), materials.metal);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(0, 2.0, 0.48);
    this.group.add(axle);

    this.rotor.position.set(0, 2.0, 0.64);
    this.group.add(this.rotor);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.16, 8), materials.darkWood);
    hub.rotation.x = Math.PI / 2;
    this.rotor.add(hub);
    this.rotor.add(this.blades);

    for (let i = 0; i < 4; i += 1) {
      const blade = new THREE.Group();
      blade.rotation.z = (i / 4) * Math.PI * 2 + 0.2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.28, 0.04), materials.darkWood);
      spar.position.set(0, 0.72, 0.03);
      blade.add(spar);

      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.98, 0.012), materials.sail);
      cloth.position.set(0.2, 0.68, 0.012);
      cloth.castShadow = true;
      blade.add(cloth);

      for (let bar = 0; bar < 4; bar += 1) {
        const lattice = new THREE.Mesh(
          new THREE.BoxGeometry(0.37, 0.018, 0.025),
          materials.darkWood
        );
        lattice.position.set(0.19, 0.28 + bar * 0.27, 0.03);
        blade.add(lattice);
      }
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 1.0, 0.03),
        materials.darkWood
      );
      edge.position.set(0.375, 0.68, 0.03);
      blade.add(edge);

      this.blades.add(blade);
    }

    castShadows(this.group);
  }

  update(ctx: SceneContext): void {
    this.rotor.rotation.z -= ctx.delta * ctx.wind * 2.7;
  }
}
