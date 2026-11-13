import * as THREE from 'three';
import { ProceduralTextures } from '../textures';
import { getIslandSurfaceHeight } from '../terrain';

export interface DetailsAssetHandle {
  group: THREE.Group;
  update(timeSec: number, windFactor: number, reducedMotion: boolean): void;
  dispose(): void;
}

export function createDetails(textures: ProceduralTextures): DetailsAssetHandle {
  const group = new THREE.Group();
  group.name = 'island-details';

  const disposables: Array<{ dispose(): void }> = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // 1. Stepping-stone path winding from cottage front step toward pond dock
  const pathStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#a89f93',
      map: textures.stoneMap,
      roughness: 0.92,
      flatShading: true,
    })
  );
  const pathStoneGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 7));

  const pathPoints: Array<[number, number, number]> = [
    [-0.45, 0.56, 1.0],
    [-0.18, 0.72, 0.92],
    [0.08, 0.84, 0.86],
    [0.34, 0.94, 0.95],
    [0.58, 1.02, 0.82],
  ];
  pathPoints.forEach(([px, pz, scale], idx) => {
    const stone = new THREE.Mesh(pathStoneGeo, pathStoneMat);
    const py = getIslandSurfaceHeight(px, pz);
    stone.position.set(px, py + 0.015, pz);
    stone.scale.set(scale, 1, scale * 0.85);
    stone.rotation.y = idx * 0.75;
    stone.receiveShadow = true;
    stone.castShadow = true;
    group.add(stone);
  });

  // 2. Handmade split-rail wooden fence along left garden curve
  const fenceWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#8c5e3a',
      map: textures.woodMap,
      roughness: 0.88,
    })
  );
  const postGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.038, 0.38, 6));
  const fencePts: Array<[number, number]> = [
    [-2.52, -0.05],
    [-2.48, 0.55],
    [-2.35, 1.14],
    [-2.05, 1.65],
    [-1.58, 2.02],
  ];

  fencePts.forEach(([fx, fz], idx) => {
    const fy = getIslandSurfaceHeight(fx, fz);
    const post = new THREE.Mesh(postGeo, fenceWoodMat);
    post.position.set(fx, fy + 0.15, fz);
    post.rotation.z = ((idx % 3) - 1) * 0.04;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);

    if (idx < fencePts.length - 1) {
      const [nx, nz] = fencePts[idx + 1];
      const ny = getIslandSurfaceHeight(nx, nz);
      const dx = nx - fx;
      const dz = nz - fz;
      const dy = ny - fy;
      const segLen = Math.hypot(dx, dy, dz) + 0.03;
      const yaw = Math.atan2(dx, dz);

      const railGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.036, segLen));
      for (const railHeight of [0.14, 0.27]) {
        const rail = new THREE.Mesh(railGeo, fenceWoodMat);
        rail.position.set((fx + nx) * 0.5, (fy + ny) * 0.5 + railHeight, (fz + nz) * 0.5);
        rail.rotation.y = yaw;
        rail.castShadow = true;
        group.add(rail);
      }
    }
  });

  // 3. Sculpted mossy meadow boulders
  const boulderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#7c746e',
      map: textures.stoneMap,
      roughness: 0.93,
      flatShading: true,
    })
  );
  const boulderGeo = trackGeo(new THREE.DodecahedronGeometry(1, 0));
  const boulders: Array<{ x: number; z: number; scale: [number, number, number]; rotY: number }> = [
    { x: 0.72, z: -2.65, scale: [0.34, 0.22, 0.28], rotY: 0.4 },
    { x: 1.02, z: -2.42, scale: [0.18, 0.14, 0.17], rotY: 1.2 },
    { x: -2.25, z: -1.85, scale: [0.28, 0.18, 0.24], rotY: 2.0 },
    { x: 3.15, z: 2.35, scale: [0.26, 0.18, 0.22], rotY: 0.8 },
    { x: -1.15, z: 2.55, scale: [0.24, 0.16, 0.2], rotY: 1.7 },
    { x: -2.4, z: 2.7, scale: [0.2, 0.13, 0.18], rotY: 0.9 },
    { x: 3.55, z: -0.62, scale: [0.22, 0.15, 0.2], rotY: 2.6 },
  ];

  for (const b of boulders) {
    const by = getIslandSurfaceHeight(b.x, b.z);
    const mesh = new THREE.Mesh(boulderGeo, boulderMat);
    mesh.scale.set(b.scale[0], b.scale[1], b.scale[2]);
    mesh.position.set(b.x, by + b.scale[1] * 0.38, b.z);
    mesh.rotation.set(0.12, b.rotY, -0.08);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 4. Wildflower & grass tuft clusters (gentle breeze sway)
  const stemMat = trackMat(new THREE.MeshStandardMaterial({ color: '#5d9148', roughness: 0.9 }));
  const petalColors = ['#f6efe1', '#f3cb57', '#e58374', '#d8b4e2'];
  const petalMats = petalColors.map((c) =>
    trackMat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.78 }))
  );
  const stemGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.012, 0.14, 4));
  const petalGeo = trackGeo(new THREE.IcosahedronGeometry(0.032, 0));

  const flowerCoords: Array<[number, number]> = [
    [-1.92, 0.68],
    [-1.75, 0.85],
    [-1.62, 1.38],
    [-1.4, 1.56],
    [-0.12, 1.48],
    [0.12, 1.62],
    [1.05, -0.78],
    [1.22, -0.92],
    [2.75, -0.95],
    [2.92, -0.78],
    [-2.35, -0.75],
    [-2.5, -0.58],
    [0.52, 2.55],
    [0.72, 2.62],
    [-2.12, 2.58],
    [-1.95, 2.75],
    [-0.78, 3.05],
    [-0.58, 3.16],
  ];

  const swayTufts: Array<{ pivot: THREE.Group; phase: number }> = [];
  flowerCoords.forEach(([fx, fz], idx) => {
    const fy = getIslandSurfaceHeight(fx, fz);
    const pivot = new THREE.Group();
    pivot.position.set(fx, fy - 0.01, fz);

    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.065;
    pivot.add(stem);

    const blossom = new THREE.Mesh(petalGeo, petalMats[idx % petalMats.length]);
    blossom.position.y = 0.14;
    blossom.scale.set(1.1, 0.75, 1.1);
    pivot.add(blossom);

    group.add(pivot);
    swayTufts.push({ pivot, phase: idx * 0.85 });
  });

  return {
    group,
    update(timeSec, windFactor, reducedMotion) {
      const w = Math.max(0, Math.min(1, windFactor));
      for (const tuft of swayTufts) {
        if (w <= 0.001 || reducedMotion) {
          tuft.pivot.rotation.z = -w * 0.09;
          tuft.pivot.rotation.x = w * 0.04;
        } else {
          tuft.pivot.rotation.z = -w * 0.09 + Math.sin(timeSec * 3.1 + tuft.phase) * 0.075 * w;
          tuft.pivot.rotation.x = Math.cos(timeSec * 2.4 + tuft.phase) * 0.045 * w;
        }
      }
    },
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
