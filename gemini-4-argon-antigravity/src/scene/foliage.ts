import * as THREE from 'three';
import {
  POND_CENTER,
  POND_RADIUS,
  getIslandSurfaceHeight,
} from './island';

interface SwayNode {
  pivot: THREE.Object3D;
  crown?: THREE.Object3D;
  baseRotX: number;
  baseRotZ: number;
  phase: number;
  flexibility: number;
}

export interface FoliageComponents {
  root: THREE.Group;
  update: (
    dt: number,
    windFactor: number,
    reducedMotion: boolean
  ) => void;
}

export function createFoliage(): FoliageComponents {
  const root = new THREE.Group();
  root.name = 'FoliageRoot';

  const swayNodes: SwayNode[] = [];

  // Shared Palette Materials for Foliage
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x785035,
    roughness: 0.88,
    flatShading: true,
  });
  const birchTrunkMat = new THREE.MeshStandardMaterial({
    color: 0xd9cfc1,
    roughness: 0.82,
    flatShading: true,
  });

  const pineDarkMat = new THREE.MeshStandardMaterial({
    color: 0x3f7548,
    roughness: 0.82,
    flatShading: true,
  });
  const pineMidMat = new THREE.MeshStandardMaterial({
    color: 0x4f8a54,
    roughness: 0.8,
    flatShading: true,
  });
  const oakGreenMat = new THREE.MeshStandardMaterial({
    color: 0x629e53,
    roughness: 0.78,
    flatShading: true,
  });
  const oakLightMat = new THREE.MeshStandardMaterial({
    color: 0x7cb560,
    roughness: 0.78,
    flatShading: true,
  });
  const warmAutumnMat = new THREE.MeshStandardMaterial({
    color: 0xd98a46,
    roughness: 0.78,
    flatShading: true,
  });

  // 1. Diverse Trees around the Island
  const treeSpecs: Array<{
    type: 'pine' | 'oak' | 'birch';
    x: number;
    z: number;
    scale: number;
    phase: number;
    flex: number;
  }> = [
    // Northwest grove behind the house
    { type: 'pine', x: -3.25, z: -2.15, scale: 1.22, phase: 0.2, flex: 0.9 },
    { type: 'oak', x: -2.35, z: -3.15, scale: 1.1, phase: 1.4, flex: 1.0 },
    { type: 'pine', x: -4.05, z: -0.75, scale: 0.95, phase: 2.7, flex: 1.1 },
    // North ridge between house and windmill
    { type: 'birch', x: 0.35, z: -3.35, scale: 1.05, phase: 0.9, flex: 1.05 },
    // East of windmill
    { type: 'pine', x: 3.85, z: -0.95, scale: 1.0, phase: 3.5, flex: 0.95 },
    { type: 'pine', x: 3.35, z: -2.85, scale: 0.78, phase: 4.2, flex: 1.15 },
    // Lakeside trees (Southeast & Southwest)
    { type: 'oak', x: 3.15, z: 1.35, scale: 1.08, phase: 1.9, flex: 1.0 },
    { type: 'birch', x: -2.85, z: 2.25, scale: 0.92, phase: 5.1, flex: 1.1 },
    { type: 'pine', x: -1.65, z: 3.25, scale: 0.82, phase: 2.2, flex: 1.15 },
  ];

  for (const spec of treeSpecs) {
    const y = getIslandSurfaceHeight(spec.x, spec.z);
    let treeObj: { group: THREE.Group; crown: THREE.Object3D };

    if (spec.type === 'pine') {
      treeObj = buildPineTree(trunkMat, pineDarkMat, pineMidMat, spec.scale);
    } else if (spec.type === 'oak') {
      treeObj = buildOakTree(trunkMat, oakGreenMat, oakLightMat, spec.scale);
    } else {
      treeObj = buildBirchTree(birchTrunkMat, warmAutumnMat, oakLightMat, spec.scale);
    }

    treeObj.group.position.set(spec.x, y - 0.03, spec.z);
    treeObj.group.rotation.y = spec.phase * 1.7;
    root.add(treeObj.group);

    swayNodes.push({
      pivot: treeObj.group,
      crown: treeObj.crown,
      baseRotX: 0,
      baseRotZ: 0,
      phase: spec.phase,
      flexibility: spec.flex,
    });
  }

  // 2. Rounded Bushes & Shrubs
  const bushGeo = new THREE.DodecahedronGeometry(0.24, 1);
  const bushPositions: Array<[number, number, number, boolean]> = [
    [-2.45, -0.35, 1.0, false],
    [-2.65, -0.05, 0.75, true],
    [-0.25, -1.75, 0.9, false],
    [1.45, -2.55, 0.85, true],
    [2.85, 0.45, 0.95, false],
    [2.65, 2.35, 0.8, true],
    [-0.95, 2.75, 0.9, false],
  ];

  bushPositions.forEach(([bx, bz, s, light], idx) => {
    const by = getIslandSurfaceHeight(bx, bz);
    const bush = new THREE.Mesh(bushGeo, light ? oakLightMat : oakGreenMat);
    bush.position.set(bx, by + 0.12 * s, bz);
    bush.scale.set(s * 1.15, s * 0.82, s);
    bush.rotation.y = idx * 1.1;
    bush.castShadow = true;
    bush.receiveShadow = true;
    root.add(bush);
  });

  // 3. Shoreline Reeds / Cattails around the Pond
  const reedStemMat = new THREE.MeshStandardMaterial({
    color: 0x5c8c46,
    roughness: 0.8,
  });
  const cattailTopMat = new THREE.MeshStandardMaterial({
    color: 0x6b442a,
    roughness: 0.9,
  });
  const stemGeo = new THREE.CylinderGeometry(0.014, 0.02, 0.42, 5);
  stemGeo.translate(0, 0.21, 0);
  const headGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.11, 6);
  headGeo.translate(0, 0.36, 0);

  const reedAngles = [0.2, 0.35, 0.48, 2.15, 2.3, 2.45, 4.85, 5.0];
  reedAngles.forEach((angle, idx) => {
    const r = POND_RADIUS - 0.08 + (idx % 2) * 0.08;
    const rx = POND_CENTER.x + Math.cos(angle) * r;
    const rz = POND_CENTER.y + Math.sin(angle) * r;
    const ry = getIslandSurfaceHeight(rx, rz);

    const reedCluster = new THREE.Group();
    reedCluster.position.set(rx, ry, rz);

    for (let j = 0; j < 3; j++) {
      const stalk = new THREE.Group();
      stalk.position.set((j - 1) * 0.06, 0, ((j % 2) - 0.5) * 0.05);
      const tiltX = (j - 1) * 0.08;
      const tiltZ = ((j % 2) - 0.5) * 0.08;
      stalk.rotation.set(tiltX, j * 1.2, tiltZ);

      const sScale = 0.85 + (j % 3) * 0.15;
      stalk.scale.setScalar(sScale);

      const stem = new THREE.Mesh(stemGeo, reedStemMat);
      stem.castShadow = true;
      stalk.add(stem);

      if (j !== 1) {
        const head = new THREE.Mesh(headGeo, cattailTopMat);
        stalk.add(head);
      }

      reedCluster.add(stalk);
    }

    root.add(reedCluster);
    swayNodes.push({
      pivot: reedCluster,
      baseRotX: 0,
      baseRotZ: 0,
      phase: idx * 0.8,
      flexibility: 1.65,
    });
  });

  // 4. Wildflower Clusters along the Path & Meadow
  const flowerColors = [0xf7d052, 0xf27d8e, 0xa58cf5, 0xfff5d6];
  const flowerMats = flowerColors.map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.65,
        flatShading: true,
      })
  );
  const petalGeo = new THREE.OctahedronGeometry(0.05, 0);
  const flowerSpots: Array<[number, number]> = [
    [-1.65, 0.65],
    [-1.85, 0.92],
    [-0.15, 0.95],
    [0.25, -0.75],
    [0.85, -1.25],
    [1.65, -0.55],
    [-2.15, -1.45],
    [2.15, 2.75],
  ];

  flowerSpots.forEach(([fx, fz], idx) => {
    const fy = getIslandSurfaceHeight(fx, fz);
    const patch = new THREE.Group();
    patch.position.set(fx, fy, fz);

    for (let k = 0; k < 4; k++) {
      const angle = (k / 4) * Math.PI * 2 + idx;
      const dist = 0.06 + (k % 2) * 0.07;
      const ox = Math.cos(angle) * dist;
      const oz = Math.sin(angle) * dist;

      const blossom = new THREE.Mesh(
        petalGeo,
        flowerMats[(idx + k) % flowerMats.length]
      );
      blossom.position.set(ox, 0.05 + (k % 2) * 0.02, oz);
      blossom.scale.set(1, 0.65, 1);
      blossom.castShadow = true;
      patch.add(blossom);
    }

    root.add(patch);
    swayNodes.push({
      pivot: patch,
      baseRotX: 0,
      baseRotZ: 0,
      phase: idx * 1.1,
      flexibility: 1.2,
    });
  });

  let windTime = 0;

  const update = (
    dt: number,
    windFactor: number,
    reducedMotion: boolean
  ) => {
    // Advance wind wave phase proportional to wind strength
    const motionScale = reducedMotion ? 0.35 : 1.0;
    windTime += dt * (0.8 + windFactor * 3.6) * motionScale;

    for (const node of swayNodes) {
      if (windFactor < 0.002) {
        node.pivot.rotation.x = THREE.MathUtils.lerp(
          node.pivot.rotation.x,
          node.baseRotX,
          Math.min(1, dt * 6)
        );
        node.pivot.rotation.z = THREE.MathUtils.lerp(
          node.pivot.rotation.z,
          node.baseRotZ,
          Math.min(1, dt * 6)
        );
        if (node.crown) {
          node.crown.rotation.z = THREE.MathUtils.lerp(
            node.crown.rotation.z,
            0,
            Math.min(1, dt * 6)
          );
        }
        continue;
      }

      // Steady wind lean + multi-frequency gusting oscillation
      const gust =
        Math.sin(windTime + node.phase) * 0.65 +
        Math.sin(windTime * 2.1 + node.phase * 1.7) * 0.35;

      const maxBend = 0.16 * node.flexibility * motionScale;
      const steadyLeanZ = -windFactor * maxBend * 0.85;
      const oscZ = gust * windFactor * maxBend * 0.55;
      const oscX =
        Math.cos(windTime * 0.85 + node.phase) *
        windFactor *
        maxBend *
        0.3;

      node.pivot.rotation.z = node.baseRotZ + steadyLeanZ + oscZ;
      node.pivot.rotation.x = node.baseRotX + oscX;

      if (node.crown) {
        node.crown.rotation.z = (steadyLeanZ + oscZ) * 0.65;
      }
    }
  };

  return { root, update };
}

function buildPineTree(
  trunkMat: THREE.Material,
  darkMat: THREE.Material,
  midMat: THREE.Material,
  scale: number
): { group: THREE.Group; crown: THREE.Object3D } {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.65, 7);
  trunkGeo.translate(0, 0.32, 0);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 0.52;

  const tiers = [
    { r: 0.62, h: 0.72, y: 0.28, mat: darkMat },
    { r: 0.5, h: 0.66, y: 0.68, mat: midMat },
    { r: 0.36, h: 0.58, y: 1.04, mat: darkMat },
    { r: 0.22, h: 0.44, y: 1.34, mat: midMat },
  ];

  tiers.forEach((t, idx) => {
    const coneGeo = new THREE.ConeGeometry(t.r, t.h, 7);
    const mesh = new THREE.Mesh(coneGeo, t.mat);
    mesh.position.y = t.y;
    mesh.rotation.y = idx * 0.45;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  });

  group.add(crown);
  return { group, crown };
}

function buildOakTree(
  trunkMat: THREE.Material,
  greenMat: THREE.Material,
  lightMat: THREE.Material,
  scale: number
): { group: THREE.Group; crown: THREE.Object3D } {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.72, 7);
  trunkGeo.translate(0, 0.36, 0);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 0.72;

  const puffGeo = new THREE.DodecahedronGeometry(0.45, 1);
  const puffs = [
    { x: 0, y: 0.32, z: 0, sx: 1.2, sy: 1.0, sz: 1.15, mat: greenMat },
    { x: -0.28, y: 0.18, z: 0.18, sx: 0.85, sy: 0.78, sz: 0.85, mat: lightMat },
    { x: 0.3, y: 0.22, z: -0.15, sx: 0.9, sy: 0.8, sz: 0.85, mat: lightMat },
    { x: 0.08, y: 0.55, z: 0.1, sx: 0.82, sy: 0.75, sz: 0.82, mat: lightMat },
    { x: -0.15, y: 0.2, z: -0.26, sx: 0.8, sy: 0.72, sz: 0.8, mat: greenMat },
  ];

  for (const p of puffs) {
    const mesh = new THREE.Mesh(puffGeo, p.mat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.scale.set(p.sx, p.sy, p.sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  }

  group.add(crown);
  return { group, crown };
}

function buildBirchTree(
  trunkMat: THREE.Material,
  warmMat: THREE.Material,
  lightMat: THREE.Material,
  scale: number
): { group: THREE.Group; crown: THREE.Object3D } {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.11, 0.78, 7);
  trunkGeo.translate(0, 0.39, 0);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 0.75;

  const puffGeo = new THREE.IcosahedronGeometry(0.38, 1);
  const puffs = [
    { x: 0, y: 0.28, z: 0, sx: 1.05, sy: 1.15, sz: 1.05, mat: warmMat },
    { x: 0.24, y: 0.12, z: 0.16, sx: 0.78, sy: 0.75, sz: 0.78, mat: lightMat },
    { x: -0.22, y: 0.42, z: -0.12, sx: 0.75, sy: 0.82, sz: 0.75, mat: warmMat },
  ];

  for (const p of puffs) {
    const mesh = new THREE.Mesh(puffGeo, p.mat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.scale.set(p.sx, p.sy, p.sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  }

  group.add(crown);
  return { group, crown };
}

