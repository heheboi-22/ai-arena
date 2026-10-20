import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { SceneMaterials } from './palette';

export interface Windmill {
  group: Group;
  update(dt: number, wind: number, reducedMotion: boolean): void;
}

export function createWindmill(materials: SceneMaterials): Windmill {
  const group = new Group();
  group.name = 'windmill';

  const base = new Mesh(new CylinderGeometry(0.68, 0.84, 0.3, 10), materials.stone);
  base.position.y = 0.15;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const towerHeight = 2.05;
  const tower = new Mesh(
    new CylinderGeometry(0.37, 0.56, towerHeight, 9),
    materials.plaster,
  );
  tower.position.y = 0.3 + towerHeight / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Timber rings hold the tower together.
  for (const [radius, y] of [
    [0.55, 0.42],
    [0.44, 1.3],
    [0.385, 2.28],
  ] as const) {
    const ring = new Mesh(new TorusGeometry(radius, 0.026, 4, 18), materials.woodDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    ring.castShadow = true;
    group.add(ring);
  }

  const door = new Mesh(new BoxGeometry(0.33, 0.62, 0.06), materials.wood);
  door.position.set(0, 0.62, 0.5);
  door.rotation.x = -0.12;
  door.castShadow = true;
  group.add(door);

  const lintel = new Mesh(new BoxGeometry(0.42, 0.06, 0.09), materials.woodDark);
  lintel.position.set(0, 0.96, 0.5);
  lintel.castShadow = true;
  group.add(lintel);

  const windmillWindowMaterial = new MeshStandardMaterial({
    color: new Color('#2f3a3a'),
    roughness: 0.25,
    metalness: 0.2,
    emissive: new Color('#8a7553'),
    emissiveIntensity: 0.08,
  });
  const window = new Mesh(new BoxGeometry(0.18, 0.22, 0.05), windmillWindowMaterial);
  window.position.set(0.05, 1.62, 0.46);
  group.add(window);
  const windowFrame = new Mesh(new BoxGeometry(0.25, 0.29, 0.035), materials.woodDark);
  windowFrame.position.set(0.05, 1.62, 0.435);
  group.add(windowFrame);

  // A small gallery gives the silhouette something to read.
  const deck = new Mesh(new CylinderGeometry(0.65, 0.65, 0.055, 12), materials.woodDark);
  deck.position.y = 1.15;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  const rail = new Mesh(new TorusGeometry(0.62, 0.018, 4, 24), materials.wood);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 1.4;
  group.add(rail);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const post = new Mesh(new BoxGeometry(0.028, 0.26, 0.028), materials.wood);
    post.position.set(Math.cos(angle) * 0.62, 1.27, Math.sin(angle) * 0.62);
    post.castShadow = true;
    group.add(post);
  }

  const cap = new Mesh(new ConeGeometry(0.52, 0.65, 9), materials.wood);
  cap.position.y = 2.66;
  cap.rotation.y = 0.25;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);
  const capFinial = new Mesh(new SphereGeometry(0.07, 8, 6), materials.woodDark);
  capFinial.position.y = 3.0;
  group.add(capFinial);

  const rotor = new Group();
  rotor.name = 'windmill-rotor';
  rotor.position.set(0, 2.48, 0.58);
  group.add(rotor);

  const hub = new Mesh(new CylinderGeometry(0.13, 0.13, 0.2, 10), materials.woodDark);
  hub.rotation.x = Math.PI / 2;
  hub.castShadow = true;
  rotor.add(hub);
  const hubCap = new Mesh(new SphereGeometry(0.075, 10, 8), materials.brass);
  hubCap.position.z = 0.14;
  rotor.add(hubCap);

  const sparGeometry = new BoxGeometry(0.055, 1.36, 0.045);
  const railGeometry = new BoxGeometry(0.025, 1.02, 0.025);
  const slatGeometry = new BoxGeometry(0.32, 0.045, 0.02);

  for (let bladeIndex = 0; bladeIndex < 4; bladeIndex += 1) {
    const blade = new Group();
    blade.rotation.z = (bladeIndex * Math.PI) / 2;

    const spar = new Mesh(sparGeometry, materials.woodDark);
    spar.position.set(0, 0.76, 0);
    spar.castShadow = true;
    blade.add(spar);

    for (const side of [-1, 1] as const) {
      const rail = new Mesh(railGeometry, materials.woodDark);
      rail.position.set(side * 0.16, 0.87, 0.02);
      rail.castShadow = true;
      blade.add(rail);
    }

    for (let slat = 0; slat < 5; slat += 1) {
      const sail = new Mesh(slatGeometry, materials.cream);
      sail.position.set(0, 0.43 + slat * 0.21, 0.026);
      sail.castShadow = true;
      sail.receiveShadow = true;
      blade.add(sail);
    }

    rotor.add(blade);
  }

  let angle = 0;
  const update = (dt: number, wind: number, reducedMotion: boolean): void => {
    const speed = wind * 2.4 * (reducedMotion ? 0.55 : 1);
    angle += speed * dt;
    if (angle > Math.PI * 2) angle -= Math.PI * 2;
    rotor.rotation.z = angle;
  };

  return { group, update };
}
