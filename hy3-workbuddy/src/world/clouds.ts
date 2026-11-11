import * as THREE from 'three';
import { reducedMotion } from '../config';

export interface Clouds {
  group: THREE.Group;
  /** Tint applied by the environment each frame. */
  material: THREE.MeshBasicMaterial;
  update: (dt: number, wind: number) => void;
}

function makeCloudMesh(mat: THREE.MeshBasicMaterial): THREE.Group {
  const g = new THREE.Group();
  const puffs = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < puffs; i++) {
    const r = 0.34 + Math.random() * 0.42;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    puff.position.set(
      (i - puffs / 2) * 0.62 + (Math.random() - 0.5) * 0.22,
      (Math.random() - 0.5) * 0.22,
      (Math.random() - 0.5) * 0.4
    );
    puff.castShadow = false;
    g.add(puff);
  }
  g.scale.y = 0.62; // flatten into a cloud shape
  return g;
}

export function createClouds(): Clouds {
  const group = new THREE.Group();
  // Unlit material: the environment tints it directly so clouds stay legible
  // against the sky at every hour instead of turning into dark silhouettes.
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    fog: false,
  });

  const drifters: { mesh: THREE.Group }[] = [];
  const COUNT = 7;
  // Hand-placed so they frame the island instead of covering it. The lowest
  // pair sit just inside the top of the default frame — any higher and they
  // read as clipped slivers rather than clouds.
  const spots: [number, number, number][] = [
    [-8.2, 4.2, -1.0],
    [-6.4, 5.6, 3.8],
    [7.0, 4.4, 1.0],
    [8.6, 6.4, -3.6],
    [-9.4, 6.8, 5.2],
    [5.0, 7.4, -6.2],
    [0.5, 8.0, 6.2],
  ];
  for (let i = 0; i < COUNT; i++) {
    const cloud = makeCloudMesh(material);
    cloud.position.set(spots[i][0], spots[i][1], spots[i][2]);
    group.add(cloud);
    drifters.push({ mesh: cloud });
  }

  const motion = reducedMotion ? 0.25 : 1.0;

  const update = (dt: number, wind: number): void => {
    for (const d of drifters) {
      // Mostly wind-driven; a faint drift remains so it isn't frozen.
      d.mesh.position.x += (0.05 + wind * 2.0) * dt * motion;
      if (d.mesh.position.x > 12) {
        d.mesh.position.x = -12;
      }
    }
  };

  return { group, material, update };
}
