import * as THREE from 'three';
import { M } from './materials';
import { LAYOUT } from './layout';
import { mulberry32 } from '../lib/math';
import type { Frame } from '../lib/frame';
import type { Island } from './island';

export interface Vegetation {
  group: THREE.Group;
  update(f: Frame): void;
}

interface SwayTarget {
  crown: THREE.Group;
  phase: number;
}

/** Trees with varied silhouettes; their crowds sway on the shared wind state. */
export function makeVegetation(island: Island): Vegetation {
  const group = new THREE.Group();
  const rand = mulberry32(1234);
  const sways: SwayTarget[] = [];

  // Shared geometries - every tree of a type reuses the same buffers.
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 0.95, 7);
  const blobGeo = new THREE.IcosahedronGeometry(0.62, 0);
  const coneGeo = new THREE.ConeGeometry(0.55, 0.85, 8);
  const leafMats = [M.leafA, M.leafB, M.leafC];

  for (const spot of LAYOUT.trees) {
    const tree = new THREE.Group();
    tree.position.set(spot.x, island.topY(spot.x, spot.z) - 0.03, spot.z);
    tree.scale.setScalar(spot.scale);
    const rotY = rand() * Math.PI * 2;

    const trunk = new THREE.Mesh(trunkGeo, M.trunk);
    trunk.position.y = 0.45;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const crown = new THREE.Group();
    crown.position.y = 0.85;
    crown.rotation.y = rotY;

    if (spot.type === 'round') {
      const mat = leafMats[Math.floor(rand() * leafMats.length)];
      const big = new THREE.Mesh(blobGeo, mat);
      big.position.y = 0.35;
      big.scale.set(1, 0.88, 1);
      const small = new THREE.Mesh(blobGeo, mat);
      small.position.set(0.34, 0.78, 0.22);
      small.scale.setScalar(0.6);
      const small2 = new THREE.Mesh(blobGeo, mat);
      small2.position.set(-0.3, 0.62, -0.24);
      small2.scale.setScalar(0.48);
      for (const m of [big, small, small2]) {
        m.castShadow = true;
        m.receiveShadow = true;
        crown.add(m);
      }
    } else {
      const heights = [0.42, 1.0, 1.52];
      const scales = [1.05, 0.8, 0.55];
      heights.forEach((h, i) => {
        const cone = new THREE.Mesh(coneGeo, M.conifer);
        cone.position.y = h;
        cone.scale.setScalar(scales[i]);
        cone.castShadow = true;
        cone.receiveShadow = true;
        crown.add(cone);
      });
    }

    tree.add(crown);
    sways.push({ crown, phase: rand() * Math.PI * 2 });
    group.add(tree);
  }

  return {
    group,
    update(f: Frame) {
      const amp = (0.018 + f.wind * 0.055) * (f.reducedMotion ? 0.3 : 1);
      const speed = f.reducedMotion ? 0.5 : 1;
      for (const s of sways) {
        s.crown.rotation.x = Math.sin(f.time * 1.25 * speed + s.phase) * amp;
        s.crown.rotation.z = Math.cos(f.time * 1.05 * speed + s.phase * 1.3) * amp * 0.8;
      }
    },
  };
}
