import * as THREE from 'three';
import { batchMeshes, beam, box, leafGeometry, material, mesh, pebbleGeometry, random } from './primitives';
import { inPond, onIsland, POND, pondPoint } from './terrain';

export interface Tree { pivot: THREE.Group; phase: number; }
export function createNature(parent: THREE.Group) {
  const rand = random(332);
  const trunk = material('#7a6950');
  const leaves = [material('#718a54'), material('#8ca260'), material('#577d59'), material('#a0ae6a')];
  const trees: Tree[] = [];
  const treeSpecs = [
    [2.5, -1.55, 1.12, 0], [3.45, -0.4, 0.8, 2], [1.1, -2.8, 0.85, 1],
    [-1.5, -2.65, 0.88, 2], [-3.65, 0.65, 0.9, 1], [-2.75, 2.0, 0.65, 0],
    [3.72, 1.4, 0.67, 2], [0.2, -2.9, 0.6, 3],
  ];
  for (const [x, z, size, variant] of treeSpecs) {
    const pivot = new THREE.Group(); parent.add(pivot); pivot.position.set(x, 0.28, z); pivot.scale.setScalar(size);
    mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.3, 6), trunk, pivot, 0, 0.65, 0);
    if (variant === 2) {
      for (let i = 0; i < 3; i++) {
        const canopy = mesh(new THREE.ConeGeometry(0.76 - i * 0.15, 1.4 - i * 0.18, 7), leaves[variant], pivot, 0, 1.35 + i * 0.46, 0);
        canopy.rotation.y = i * 0.42;
      }
    } else {
      beam(pivot, trunk, new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(-0.38, 1.55, 0.06), 0.07);
      beam(pivot, trunk, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.38, 1.5, -0.1), 0.065);
      const clusters = [[0, 1.97, 0, 0.79], [-0.48, 1.63, 0.13, 0.62], [0.45, 1.65, -0.06, 0.63], [0.08, 1.65, 0.4, 0.59]];
      for (const [cx, cy, cz, radius] of clusters) {
        const canopy = mesh(leafGeometry, leaves[variant], pivot, cx, cy, cz);
        canopy.scale.set(radius, radius * (variant === 1 ? 1.2 : 1.06), radius * 0.91);
        canopy.rotation.set(rand() * 0.5, rand() * 3, rand() * 0.4);
      }
    }
    batchMeshes(pivot);
    trees.push({ pivot, phase: rand() * 7 });
  }

  const rockMats = [material('#aaa992'), material('#c3bfa2'), material('#90967f')];
  for (let i = 0; i < 26; i++) {
    const angle = rand() * Math.PI * 2;
    let x: number, z: number;
    if (i < 15) { const p = pondPoint(angle, 1.18); x = p.x; z = p.y; }
    else { x = Math.cos(angle) * (4.6 + rand() * 0.3); z = Math.sin(angle) * (3.25 + rand() * 0.3); }
    const stone = mesh(pebbleGeometry, rockMats[i % 3], parent, x, 0.31, z);
    const size = i < 15 ? 0.07 + rand() * 0.12 : 0.19 + rand() * 0.22;
    stone.scale.set(size * 1.6, size * 0.8, size);
    stone.rotation.set(rand(), rand() * 5, rand());
  }

  const pathMat = material('#d1c4a0');
  for (let i = 0; i < 9; i++) {
    const z = 0.91 + i * 0.265;
    const x = -0.76 - 0.4 * Math.sin(i / 8 * 2.1);
    const stone = mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.055, 7), pathMat, parent, x, 0.307, z);
    stone.scale.set(1.1, 1, 0.7); stone.rotation.y = rand() * 2;
  }

  const fence = new THREE.Group(); fence.position.set(-1.9, 0.28, 2.88); parent.add(fence);
  const fenceMat = material('#bba078');
  for (let i = 0; i < 4; i++) {
    box(fence, fenceMat, [0.095, 0.56, 0.095], [-i * 0.51, 0.28, -i * 0.13]);
    if (i < 3) for (const y of [0.2, 0.43]) {
      const rail = box(fence, fenceMat, [0.57, 0.065, 0.055], [-i * 0.51 - 0.255, y, -i * 0.13 - 0.065]); rail.rotation.y = -0.25;
    }
  }

  const dock = new THREE.Group(); parent.add(dock); dock.position.set(0.42, 0.36, 1.44); dock.rotation.y = -0.14;
  const dockWood = material('#b5976c'), dockDark = material('#80694e');
  for (let i = 0; i < 8; i++) box(dock, i % 3 === 0 ? dockDark : dockWood, [0.16, 0.075, 0.58], [i * 0.18, 0, 0]);
  for (const x of [0.15, 1.15]) for (const z of [-0.25, 0.25]) {
    mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.4, 6), dockDark, dock, x, -0.075, z);
  }
  const reedMat = material('#788352'), reedHead = material('#877450');
  for (let i = 0; i < 14; i++) {
    const angle = 0.9 + rand() * 1.5;
    const p = pondPoint(angle, 1.07);
    const h = 0.16 + rand() * 0.25;
    const reed = mesh(new THREE.CylinderGeometry(0.012, 0.016, h, 4), reedMat, parent, p.x, 0.28 + h / 2, p.y);
    reed.rotation.z = (rand() - 0.5) * 0.3;
    mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.085, 5), reedHead, parent, p.x, 0.28 + h, p.y);
  }
  const lilyMat = material('#7f9d68');
  for (const [x, z, r] of [[2.65, 1.28, 0.15], [2.86, 1.47, 0.11], [2.6, 1.6, 0.095]]) {
    const lily = mesh(new THREE.CircleGeometry(r, 18, 0.16, Math.PI * 2 - 0.32), lilyMat, parent, x, POND.y + 0.018, z);
    lily.rotation.x = -Math.PI / 2;
  }

  const tuftGeometry = new THREE.BufferGeometry();
  tuftGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.055, 0, 0, 0.015, 0.18, 0, 0.035, 0, 0,
    0, 0, -0.05, 0, 0.14, 0.045, 0, 0, 0.05,
  ], 3));
  tuftGeometry.computeVertexNormals();
  const grass = new THREE.InstancedMesh(tuftGeometry, material('#789557', { side: THREE.DoubleSide }), 170);
  const flowerGeo = new THREE.IcosahedronGeometry(0.047, 0);
  const flowers = new THREE.InstancedMesh(flowerGeo, material('#ece0ad'), 70);
  const pinkFlowers = new THREE.InstancedMesh(flowerGeo, material('#ca977c'), 35);
  const dummy = new THREE.Object3D();
  let grassIndex = 0, flowerIndex = 0, pinkIndex = 0;
  for (let i = 0; i < 1600 && grassIndex < 170; i++) {
    const x = (rand() - 0.5) * 10, z = (rand() - 0.5) * 7.2;
    if (!onIsland(x, z) || inPond(x, z, 1.3) || (Math.abs(x + 0.45) < 1.5 && z > -1.7 && z < 1.05) || (Math.abs(x + 1) < 0.5 && z > 0.6) || (x < -2.35 && z < -0.7)) continue;
    dummy.position.set(x, 0.285, z); dummy.rotation.y = rand() * 6.28; dummy.scale.setScalar(0.7 + rand() * 0.8); dummy.updateMatrix();
    grass.setMatrixAt(grassIndex++, dummy.matrix);
    if (flowerIndex < 70 && rand() > 0.4) {
      dummy.position.y += 0.14; dummy.scale.setScalar(0.7 + rand() * 0.8); dummy.updateMatrix(); flowers.setMatrixAt(flowerIndex++, dummy.matrix);
    } else if (pinkIndex < 35) {
      dummy.position.y += 0.12; dummy.updateMatrix(); pinkFlowers.setMatrixAt(pinkIndex++, dummy.matrix);
    }
  }
  grass.count = grassIndex; flowers.count = flowerIndex; pinkFlowers.count = pinkIndex;
  parent.add(grass, flowers, pinkFlowers);
  return trees;
}
