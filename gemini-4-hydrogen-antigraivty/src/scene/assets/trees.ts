import * as THREE from 'three';
import { WindVector } from '../../state/worldState';
import { ProceduralTextures } from '../textures';
import { getIslandSurfaceHeight } from '../terrain';

export type TreeKind = 'pine' | 'broadleaf';

export interface TreePlacement {
  x: number;
  z: number;
  scale: number;
  kind: TreeKind;
  rotationY: number;
  clearanceRadius: number;
  phase: number;
}

export const TREE_PLACEMENTS: ReadonlyArray<TreePlacement> = Object.freeze([
  { x: -3.25, z: -2.0, scale: 1.08, kind: 'pine', rotationY: 0.4, clearanceRadius: 0.72, phase: 0.2 },
  { x: -3.65, z: -0.1, scale: 1.02, kind: 'broadleaf', rotationY: 1.1, clearanceRadius: 0.75, phase: 1.5 },
  { x: -2.5, z: -3.55, scale: 0.9, kind: 'pine', rotationY: 2.1, clearanceRadius: 0.68, phase: 2.6 },
  { x: -3.15, z: 1.85, scale: 0.94, kind: 'broadleaf', rotationY: -0.7, clearanceRadius: 0.72, phase: 3.4 },
  { x: -0.35, z: -3.55, scale: 1.12, kind: 'pine', rotationY: 0.9, clearanceRadius: 0.68, phase: 4.3 },
  { x: 4.05, z: -1.45, scale: 0.98, kind: 'broadleaf', rotationY: -1.8, clearanceRadius: 0.72, phase: 5.1 },
  { x: 4.05, z: 0.42, scale: 0.88, kind: 'pine', rotationY: 2.7, clearanceRadius: 0.66, phase: 5.9 },
]);

export interface TreesAssetHandle {
  group: THREE.Group;
  update(timeSec: number, windFactor: number, windDir: WindVector, reducedMotion: boolean): void;
  getCurrentTilts(): Array<{ x: number; z: number }>;
  dispose(): void;
}

export function createTrees(textures: ProceduralTextures): TreesAssetHandle {
  const group = new THREE.Group();
  group.name = 'island-trees';

  const disposables: Array<{ dispose(): void }> = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#7c5033',
      map: textures.woodMap,
      roughness: 0.9,
    })
  );
  const pineColors = ['#53844b', '#629456', '#4a7644'].map((c) =>
    trackMat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, flatShading: true }))
  );
  const oakColors = ['#699c52', '#7cad5f', '#5c8d49'].map((c) =>
    trackMat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, flatShading: true }))
  );

  // Shared base geometries
  const pineTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.11, 0.62, 7));
  const pineTierGeos = [
    trackGeo(new THREE.ConeGeometry(0.56, 0.76, 8)),
    trackGeo(new THREE.ConeGeometry(0.44, 0.66, 8)),
    trackGeo(new THREE.ConeGeometry(0.32, 0.54, 8)),
  ];

  const oakTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.075, 0.13, 0.82, 7));
  const oakBranchGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.055, 0.38, 6));
  const oakPuffGeo = trackGeo(new THREE.IcosahedronGeometry(0.36, 1));

  const rigs: Array<{ pivot: THREE.Group; phase: number; stiffness: number }> = [];

  TREE_PLACEMENTS.forEach((placement, idx) => {
    const pivot = new THREE.Group();
    const y = getIslandSurfaceHeight(placement.x, placement.z);
    pivot.position.set(placement.x, y - 0.05, placement.z);

    const treeModel = new THREE.Group();
    treeModel.rotation.y = placement.rotationY;
    treeModel.scale.setScalar(placement.scale);

    if (placement.kind === 'pine') {
      const trunk = new THREE.Mesh(pineTrunkGeo, trunkMat);
      trunk.position.y = 0.28;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeModel.add(trunk);

      const heights = [0.78, 1.18, 1.54];
      for (let t = 0; t < 3; t++) {
        const cone = new THREE.Mesh(pineTierGeos[t], pineColors[(idx + t) % pineColors.length]);
        cone.position.set((t === 1 ? 0.03 : 0), heights[t], (t === 2 ? -0.02 : 0));
        cone.rotation.y = t * 0.45;
        cone.castShadow = true;
        cone.receiveShadow = true;
        treeModel.add(cone);
      }
    } else {
      const trunk = new THREE.Mesh(oakTrunkGeo, trunkMat);
      trunk.position.y = 0.38;
      trunk.rotation.z = 0.05;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeModel.add(trunk);

      const branch = new THREE.Mesh(oakBranchGeo, trunkMat);
      branch.position.set(0.11, 0.62, 0.03);
      branch.rotation.z = -0.62;
      branch.castShadow = true;
      treeModel.add(branch);

      const puffSpecs = [
        { pos: [0, 1.08, 0], scale: [1.18, 0.96, 1.12] },
        { pos: [0.27, 0.94, 0.14], scale: [0.88, 0.78, 0.85] },
        { pos: [-0.24, 0.92, -0.11], scale: [0.85, 0.76, 0.88] },
        { pos: [0.06, 0.98, -0.25], scale: [0.78, 0.72, 0.78] },
        { pos: [-0.04, 1.28, 0.05], scale: [0.74, 0.7, 0.74] },
      ];

      puffSpecs.forEach((p, pIdx) => {
        const puff = new THREE.Mesh(oakPuffGeo, oakColors[(idx + pIdx) % oakColors.length]);
        puff.position.set(p.pos[0], p.pos[1], p.pos[2]);
        puff.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        puff.castShadow = true;
        puff.receiveShadow = true;
        treeModel.add(puff);
      });
    }

    pivot.add(treeModel);
    group.add(pivot);
    rigs.push({
      pivot,
      phase: placement.phase,
      stiffness: placement.kind === 'pine' ? 1.0 : 0.86,
    });
  });

  return {
    group,
    update(timeSec, windFactor, windDir, reducedMotion) {
      const w = Math.max(0, Math.min(1, windFactor));
      if (w <= 0.0001) {
        for (const rig of rigs) {
          rig.pivot.rotation.x = 0;
          rig.pivot.rotation.z = 0;
        }
        return;
      }

      for (const rig of rigs) {
        const steadyLean = 0.058 * w * rig.stiffness;
        const gust = reducedMotion
          ? 0
          : Math.sin(timeSec * (1.7 + w * 2.1) + rig.phase) * 0.036 * w +
            Math.sin(timeSec * (3.1 + w * 1.4) + rig.phase * 1.7) * 0.012 * w;
        const totalTilt = Math.max(-0.14, Math.min(0.14, steadyLean + gust));

        // Leaning along windDir (+X tilts around -Z, +Z tilts around +X)
        rig.pivot.rotation.z = -windDir.x * totalTilt;
        rig.pivot.rotation.x = windDir.z * totalTilt;
      }
    },
    getCurrentTilts() {
      return rigs.map((rig) => ({ x: rig.pivot.rotation.x, z: rig.pivot.rotation.z }));
    },
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
