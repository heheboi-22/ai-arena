import * as THREE from 'three';
import { M } from './materials';
import { LAYOUT } from './layout';
import type { Frame } from '../lib/frame';
import type { Island } from './island';

export interface Windmill {
  group: THREE.Group;
  update(f: Frame): void;
}

/** Stone windmill on its own mound; blade speed follows the shared wind state. */
export function makeWindmill(island: Island): Windmill {
  const group = new THREE.Group();
  const { x, z } = LAYOUT.windmill;
  group.position.set(x, island.topY(x, z) - 0.05, z);
  group.rotation.y = 0.6; // face the blades toward the pond / default camera

  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  add(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.95, 0.4, 10), M.stoneDark)).position.y = 0.2;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.5, 10), M.stone)).position.y = 1.55;

  const cap = add(new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.55, 10), M.roofDark));
  cap.position.y = 3.05;

  const gallery = add(new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 6, 18), M.woodDark));
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = 2.2;

  const door = add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.08), M.woodDark));
  door.position.set(0, 0.62, 0.56);
  const winFrame = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.04), M.woodDark));
  winFrame.position.set(0, 1.7, 0.47);
  const win = add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.05), M.glass));
  win.position.set(0, 1.7, 0.5);

  // --- hub + four sails --------------------------------------------------------
  const head = new THREE.Group();
  head.position.y = 2.78;
  group.add(head);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 8), M.metal);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.1;
  shaft.castShadow = true;
  head.add(shaft);

  const blades = new THREE.Group();
  blades.position.z = 0.28;
  head.add(blades);

  const plankGeo = new THREE.BoxGeometry(0.1, 1.2, 0.05);
  const sailGeo = new THREE.BoxGeometry(0.3, 0.95, 0.02);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;

    const plank = new THREE.Mesh(plankGeo, M.woodDark);
    plank.position.y = 0.68;
    plank.castShadow = true;
    const sail = new THREE.Mesh(sailGeo, M.wall);
    sail.position.set(0.2, 0.74, 0.02);
    sail.rotation.y = 0.32;
    sail.castShadow = true;

    arm.add(plank, sail);
    blades.add(arm);
  }

  let spin = 0;

  return {
    group,
    update(f: Frame) {
      // Stops completely at zero wind; a light breeze just turns it lazily.
      spin += f.dt * f.wind * 4.6 * (f.reducedMotion ? 0.55 : 1);
      blades.rotation.z = spin;
    },
  };
}
