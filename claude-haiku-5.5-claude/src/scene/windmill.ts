import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh } from 'three';
import { WINDMILL, terrainHeight } from './terrain';
import type { SharedMaterials } from './materials';

export interface Windmill {
  group: Group;
  /** Spins around its local z axis. The world sets the speed from the shared wind value. */
  rotor: Group;
}

const HUB_Y = 2.25;
const HUB_Z = 0.62;
const BLADE_COUNT = 4;

function place(parent: Group, mesh: Mesh, x: number, y: number, z: number): void {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function createWindmill(mats: SharedMaterials): Windmill {
  const group = new Group();
  group.name = 'windmill';
  group.position.set(WINDMILL.x, terrainHeight(WINDMILL.x, WINDMILL.z), WINDMILL.z);
  group.rotation.y = 0.5;

  // Plinth, tapered tower and a conical cap.
  place(group, new Mesh(new CylinderGeometry(0.46, 0.5, 0.22, 12), mats.stone), 0, 0.11, 0);
  place(group, new Mesh(new CylinderGeometry(0.3, 0.42, 2.0, 12), mats.windmillWall), 0, 1.22, 0);
  place(group, new Mesh(new ConeGeometry(0.44, 0.7, 12), mats.windmillCap), 0, 2.57, 0);

  // Door at the base and a small window above it, both on the front (+z).
  place(group, new Mesh(new BoxGeometry(0.2, 0.4, 0.04), mats.door), 0, 0.42, 0.43);
  place(group, new Mesh(new BoxGeometry(0.16, 0.2, 0.03), mats.woodDark), 0, 1.2, 0.36);

  // Head housing behind the rotor.
  place(group, new Mesh(new BoxGeometry(0.5, 0.42, 0.42), mats.windmillWall), 0, HUB_Y, 0.25);

  const rotor = new Group();
  rotor.name = 'windmill-rotor';
  rotor.position.set(0, HUB_Y, HUB_Z);
  group.add(rotor);

  const hub = new Mesh(new CylinderGeometry(0.11, 0.11, 0.16, 10), mats.woodDark);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 0, 0.05);
  hub.castShadow = true;
  rotor.add(hub);

  // Each blade is a spar with a canvas sail on one side and laths across it.
  const sparGeometry = new BoxGeometry(0.07, 1.22, 0.04);
  const sailGeometry = new BoxGeometry(0.46, 1.0, 0.02);
  const lathGeometry = new BoxGeometry(0.46, 0.025, 0.03);
  for (let k = 0; k < BLADE_COUNT; k++) {
    const blade = new Group();
    blade.rotation.z = (k * Math.PI * 2) / BLADE_COUNT;
    rotor.add(blade);

    place(blade, new Mesh(sparGeometry, mats.wood), 0, 0.66, 0.04);
    place(blade, new Mesh(sailGeometry, mats.blade), 0.25, 0.64, 0.05);
    for (const y of [0.3, 0.55, 0.8, 1.05]) {
      place(blade, new Mesh(lathGeometry, mats.wood), 0.25, y, 0.07);
    }
  }

  return { group, rotor };
}
