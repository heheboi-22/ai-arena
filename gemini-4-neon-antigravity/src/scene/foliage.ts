import * as THREE from 'three';
import type { WorldMaterials } from './materials';
import { getTerrainHeight } from './terrainMath';

export interface FoliageBundle {
  group: THREE.Group;
  update: (
    elapsed: number,
    windStrength: number,
    windDirX: number,
    windDirZ: number,
    reducedMotion: boolean,
  ) => void;
  getSampleTilt: () => number;
  dispose: () => void;
}

interface AnimatedTree {
  swayPivot: THREE.Group;
  flexibility: number;
  phase: number;
  freq: number;
}

interface TreePlacement {
  kind: 'pine' | 'broadleaf';
  x: number;
  z: number;
  scale: number;
  yaw: number;
  variant: number;
}

const TREE_PLACEMENTS: TreePlacement[] = [
  // Framing backdrop behind cottage
  { kind: 'pine', x: -3.35, z: -1.65, scale: 1.12, yaw: 0.4, variant: 0 },
  { kind: 'pine', x: -2.35, z: -3.05, scale: 0.94, yaw: 1.9, variant: 1 },
  { kind: 'broadleaf', x: -0.42, z: -3.18, scale: 0.96, yaw: 2.5, variant: 0 },
  // Flanking behind windmill without obstructing rotating blades
  { kind: 'pine', x: 3.68, z: -2.28, scale: 1.04, yaw: 0.9, variant: 2 },
  { kind: 'broadleaf', x: 0.95, z: -3.45, scale: 0.84, yaw: 4.1, variant: 1 },
  // Cozy left garden silhouette balancing the pond on the right
  { kind: 'broadleaf', x: -3.62, z: 0.58, scale: 1.02, yaw: 1.1, variant: 2 },
  { kind: 'pine', x: -3.82, z: -0.58, scale: 0.74, yaw: 3.2, variant: 0 },
  { kind: 'broadleaf', x: -2.52, z: 2.28, scale: 0.8, yaw: 5.0, variant: 0 },
  // Right outer flank framing the pond & windmill
  { kind: 'broadleaf', x: 3.85, z: 0.16, scale: 0.86, yaw: 2.8, variant: 1 },
];

export function createFoliage(materials: WorldMaterials): FoliageBundle {
  const group = new THREE.Group();
  group.name = 'island-trees';

  const geometries: THREE.BufferGeometry[] = [];
  const registerGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // Shared reusable geometries for pines & broadleaf canopies
  const pineTrunkGeo = registerGeo(new THREE.CylinderGeometry(0.065, 0.125, 0.92, 7));
  const pineTier1Geo = registerGeo(new THREE.ConeGeometry(0.68, 0.92, 7));
  const pineTier2Geo = registerGeo(new THREE.ConeGeometry(0.54, 0.84, 7));
  const pineTier3Geo = registerGeo(new THREE.ConeGeometry(0.39, 0.72, 7));
  const pineTier4Geo = registerGeo(new THREE.ConeGeometry(0.24, 0.54, 7));

  const broadTrunkGeo = registerGeo(new THREE.CylinderGeometry(0.08, 0.15, 0.95, 7));
  const branchGeo = registerGeo(new THREE.CylinderGeometry(0.035, 0.065, 0.48, 6));
  const puffGeo = registerGeo(new THREE.IcosahedronGeometry(0.46, 1));

  const pinePalette = [materials.pineDark, materials.pineMid, materials.pineLight];
  const leafPalette = [materials.leafSage, materials.leafOlive, materials.leafMoss];

  const trees: AnimatedTree[] = [];

  TREE_PLACEMENTS.forEach((spec, idx) => {
    const root = new THREE.Group();
    const groundY = getTerrainHeight(spec.x, spec.z);
    root.position.set(spec.x, groundY - 0.08, spec.z);
    root.scale.setScalar(spec.scale);

    // Lower rooted trunk stub (stays anchored in soil)
    const baseStub = new THREE.Mesh(
      spec.kind === 'pine' ? pineTrunkGeo : broadTrunkGeo,
      materials.bark,
    );
    baseStub.position.y = 0.42;
    baseStub.castShadow = true;
    baseStub.receiveShadow = true;
    root.add(baseStub);

    // Upper swaying pivot (oriented in world XZ so wind direction bends every tree identically)
    const swayPivot = new THREE.Group();
    swayPivot.position.y = 0.34;
    root.add(swayPivot);

    // Local rotated foliage assembly inside swayPivot
    const crown = new THREE.Group();
    crown.rotation.y = spec.yaw;
    swayPivot.add(crown);

    if (spec.kind === 'pine') {
      const matA = pinePalette[spec.variant % pinePalette.length];
      const matB = pinePalette[(spec.variant + 1) % pinePalette.length];

      const tiers = [
        { geo: pineTier1Geo, y: 0.62, mat: matA, rot: 0.1 },
        { geo: pineTier2Geo, y: 1.08, mat: matB, rot: 0.55 },
        { geo: pineTier3Geo, y: 1.48, mat: matA, rot: 1.05 },
        { geo: pineTier4Geo, y: 1.82, mat: matB, rot: 1.6 },
      ];

      for (const tier of tiers) {
        const cone = new THREE.Mesh(tier.geo, tier.mat);
        cone.position.y = tier.y;
        cone.rotation.y = tier.rot;
        cone.castShadow = true;
        cone.receiveShadow = true;
        crown.add(cone);
      }
    } else {
      // Forked miniature branches
      const b1 = new THREE.Mesh(branchGeo, materials.bark);
      b1.position.set(0.14, 0.62, 0.05);
      b1.rotation.z = -0.55;
      b1.castShadow = true;
      crown.add(b1);

      const b2 = new THREE.Mesh(branchGeo, materials.bark);
      b2.position.set(-0.12, 0.58, -0.08);
      b2.rotation.z = 0.48;
      b2.rotation.x = -0.35;
      b2.castShadow = true;
      crown.add(b2);

      // Sculpted layered storybook foliage puffs with warm/cool moss tonal variation
      const puffSpecs = [
        { pos: [0.0, 1.18, 0.0], scale: [1.08, 0.94, 1.04], matIdx: 0 },
        { pos: [0.36, 0.96, 0.18], scale: [0.82, 0.74, 0.8], matIdx: 1 },
        { pos: [-0.35, 0.98, -0.16], scale: [0.84, 0.78, 0.82], matIdx: 0 },
        { pos: [0.08, 0.95, -0.34], scale: [0.76, 0.7, 0.76], matIdx: 2 },
        { pos: [-0.12, 1.02, 0.34], scale: [0.78, 0.72, 0.76], matIdx: 1 },
        { pos: [0.04, 1.44, 0.06], scale: [0.68, 0.6, 0.66], matIdx: 2 },
      ];

      for (const p of puffSpecs) {
        const mat = leafPalette[(spec.variant + p.matIdx) % leafPalette.length];
        const puff = new THREE.Mesh(puffGeo, mat);
        puff.position.set(p.pos[0], p.pos[1], p.pos[2]);
        puff.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        puff.castShadow = true;
        puff.receiveShadow = true;
        crown.add(puff);
      }
    }

    group.add(root);
    trees.push({
      swayPivot,
      flexibility: (spec.kind === 'pine' ? 1.08 : 0.86) * (0.9 + (idx % 3) * 0.08),
      phase: idx * 1.17 + 0.3,
      freq: 1.85 + (idx % 4) * 0.24,
    });
  });

  let lastSampleTilt = 0;

  const update: FoliageBundle['update'] = (
    elapsed,
    windStrength,
    windDirX,
    windDirZ,
    reducedMotion,
  ) => {
    // At zero wind, bend and sway stop cleanly. At strong wind, clear tasteful bend without extremes.
    const gustScale = reducedMotion ? 0.25 : 1.0;

    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      if (windStrength <= 0.0005) {
        tree.swayPivot.rotation.x = 0;
        tree.swayPivot.rotation.z = 0;
        if (i === 0) lastSampleTilt = 0;
        continue;
      }

      const steadyLean = windStrength * 0.115 * tree.flexibility;
      const gust =
        windStrength *
        gustScale *
        tree.flexibility *
        (0.042 * Math.sin(elapsed * (tree.freq + windStrength * 1.6) + tree.phase) +
          0.018 * Math.sin(elapsed * (tree.freq * 1.85 + windStrength * 2.1) + tree.phase * 1.7));

      // Keep bend plausibly bounded (max ~0.18 rad ≈ 10 deg)
      const totalBend = Math.max(-0.04, Math.min(0.18, steadyLean + gust));

      // Right-hand rule: leaning +Y toward (windDirX, windDirZ) => rotZ = -windDirX * bend, rotX = +windDirZ * bend
      tree.swayPivot.rotation.z = -windDirX * totalBend;
      tree.swayPivot.rotation.x = windDirZ * totalBend;

      if (i === 0) {
        lastSampleTilt = totalBend;
      }
    }
  };

  return {
    group,
    update,
    getSampleTilt: () => lastSampleTilt,
    dispose: () => {
      for (const geo of geometries) {
        geo.dispose();
      }
    },
  };
}
