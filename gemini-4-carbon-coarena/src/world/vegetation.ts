import * as THREE from 'three';
import { createRng, fbm3D, lerp } from '../utils/math';
import {
  getIslandSurfaceHeight,
  getNormalizedIslandRadius,
  isNearPath,
  isPointInWater,
  LANDMARKS,
} from './terrainMath';

export interface VegetationRig {
  group: THREE.Group;
  update: (
    elapsed: number,
    wind: number,
    rainAmount: number,
    reducedMotion: boolean
  ) => void;
}

type TreeKind = 'spruce' | 'broadleaf' | 'cypress';

interface SwayItem {
  pivot: THREE.Group;
  crown?: THREE.Group;
  phase: number;
  flexibility: number;
}

export function createVegetation(): VegetationRig {
  const group = new THREE.Group();
  group.name = 'VegetationGroup';
  const rng = createRng(3817);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6f4b32,
    roughness: 0.92,
    flatShading: true,
  });

  const foliageMats = {
    spruceDeep: new THREE.MeshStandardMaterial({
      color: 0x3f7348,
      roughness: 0.86,
      flatShading: true,
    }),
    spruceMid: new THREE.MeshStandardMaterial({
      color: 0x518954,
      roughness: 0.85,
      flatShading: true,
    }),
    oakRich: new THREE.MeshStandardMaterial({
      color: 0x689f52,
      roughness: 0.84,
      flatShading: true,
    }),
    oakWarm: new THREE.MeshStandardMaterial({
      color: 0x82b35d,
      roughness: 0.84,
      flatShading: true,
    }),
    cypressSage: new THREE.MeshStandardMaterial({
      color: 0x4b8058,
      roughness: 0.86,
      flatShading: true,
    }),
  };

  // Curated tree placements: frames woodland back-right, windmill knoll, and pond flank without blocking sightlines
  const treeSpecs: ReadonlyArray<{
    x: number;
    z: number;
    kind: TreeKind;
    scale: number;
    tint: number;
  }> = [
    { x: 2.45, z: -2.65, kind: 'spruce', scale: 1.18, tint: 0 },
    { x: 1.45, z: -3.15, kind: 'broadleaf', scale: 1.12, tint: 1 },
    { x: 3.35, z: -1.85, kind: 'spruce', scale: 0.94, tint: 1 },
    { x: 0.35, z: -3.45, kind: 'cypress', scale: 1.08, tint: 0 },
    { x: -0.62, z: -3.22, kind: 'broadleaf', scale: 0.92, tint: 0 },
    { x: -3.55, z: -2.25, kind: 'spruce', scale: 1.04, tint: 0 },
    { x: -3.88, z: -0.85, kind: 'broadleaf', scale: 0.84, tint: 1 },
    { x: -1.65, z: -3.35, kind: 'cypress', scale: 0.96, tint: 0 },
    { x: 3.72, z: 0.45, kind: 'broadleaf', scale: 0.94, tint: 0 },
    { x: 3.45, z: 1.75, kind: 'spruce', scale: 0.8, tint: 1 },
    { x: -3.42, z: 1.45, kind: 'broadleaf', scale: 0.9, tint: 1 },
    { x: -3.65, z: 0.22, kind: 'cypress', scale: 0.82, tint: 0 },
  ];

  const swayTrees: SwayItem[] = [];

  for (const spec of treeSpecs) {
    const groundY = getIslandSurfaceHeight(spec.x, spec.z);
    const rootHolder = new THREE.Group();
    rootHolder.position.set(spec.x, groundY - 0.04, spec.z);

    const swayPivot = new THREE.Group();
    swayPivot.scale.setScalar(spec.scale);
    swayPivot.rotation.y = rng() * Math.PI * 2;

    let crown: THREE.Group | undefined;
    if (spec.kind === 'spruce') {
      crown = buildSpruceTree(
        swayPivot,
        trunkMat,
        spec.tint === 0 ? foliageMats.spruceDeep : foliageMats.spruceMid,
        rng
      );
    } else if (spec.kind === 'broadleaf') {
      crown = buildBroadleafTree(
        swayPivot,
        trunkMat,
        spec.tint === 0 ? foliageMats.oakRich : foliageMats.oakWarm,
        rng
      );
    } else {
      crown = buildCypressTree(swayPivot, trunkMat, foliageMats.cypressSage, rng);
    }

    rootHolder.add(swayPivot);
    group.add(rootHolder);

    swayTrees.push({
      pivot: swayPivot,
      crown,
      phase: rng() * Math.PI * 2,
      flexibility:
        spec.kind === 'cypress'
          ? 1.18
          : spec.kind === 'spruce'
          ? 0.92
          : 0.84,
    });
  }

  // Soft low shrubs near cottage corners, woodland base, and mill knoll
  const shrubSpots: ReadonlyArray<readonly [number, number, number]> = [
    [2.48, -0.15, 0.95],
    [0.62, -1.32, 0.82],
    [2.05, -2.02, 1.05],
    [-1.42, -2.35, 0.88],
    [-2.92, -0.95, 0.85],
    [-0.18, 2.28, 0.78],
    [2.18, 1.62, 0.85],
  ];

  for (const [sx, sz, sScale] of shrubSpots) {
    const sy = getIslandSurfaceHeight(sx, sz);
    const bushPivot = new THREE.Group();
    bushPivot.position.set(sx, sy - 0.02, sz);
    bushPivot.scale.setScalar(sScale);

    const mat = rng() > 0.5 ? foliageMats.oakRich : foliageMats.spruceMid;
    for (let k = 0; k < 3; k++) {
      const r = 0.16 + rng() * 0.08;
      const puffGeo = sculptFoliageSphere(r, rng);
      const puff = new THREE.Mesh(puffGeo, mat);
      puff.position.set((rng() - 0.5) * 0.22, r * 0.65, (rng() - 0.5) * 0.22);
      puff.castShadow = true;
      puff.receiveShadow = true;
      bushPivot.add(puff);
    }

    group.add(bushPivot);
    swayTrees.push({
      pivot: bushPivot,
      phase: rng() * Math.PI * 2,
      flexibility: 0.55,
    });
  }

  // Instanced miniature grass blade tufts scattered across open meadow
  const grassRig = createGrassTufts(group, rng);

  const allLeafMats = Object.values(foliageMats);

  // Shared world wind vector (+0.88 X, +0.47 Z)
  const windDirX = 0.88;
  const windDirZ = 0.47;

  return {
    group,
    update(elapsed, wind, rainAmount, reducedMotion) {
      for (const m of allLeafMats) {
        m.roughness = lerp(0.85, 0.58, rainAmount);
      }

      const motionScale = reducedMotion ? 0.22 : 1.0;

      // Tree sway driven by shared wind: 0 sway at wind === 0, natural lean + rustle at strong wind
      for (const item of swayTrees) {
        if (wind < 0.001) {
          item.pivot.rotation.x = 0;
          item.pivot.rotation.z = 0;
          if (item.crown) {
            item.crown.rotation.z = 0;
          }
          continue;
        }

        const gustFreq = 1.65 + wind * 2.35;
        const primaryGust = Math.sin(elapsed * gustFreq + item.phase) * 0.042 * wind * motionScale;
        const secondaryRustle =
          Math.sin(elapsed * (gustFreq * 2.1) + item.phase * 1.7) * 0.016 * wind * motionScale;

        // Steady aerodynamic bend capped so trees never bend implausibly
        const steadyLean = Math.pow(wind, 1.1) * 0.095;
        const totalBend = (steadyLean + primaryGust + secondaryRustle) * item.flexibility;

        // Rotate in world-aligned directions (note: swayPivot has random Y rotation, so project world wind into pivot's parent frame or counter-rotate)
        const cosY = Math.cos(item.pivot.rotation.y);
        const sinY = Math.sin(item.pivot.rotation.y);
        const localWX = windDirX * cosY - windDirZ * sinY;
        const localWZ = windDirX * sinY + windDirZ * cosY;

        item.pivot.rotation.z = -localWX * totalBend;
        item.pivot.rotation.x = localWZ * totalBend;

        if (item.crown) {
          item.crown.rotation.z = -localWX * (primaryGust + secondaryRustle) * 1.15;
        }
      }

      grassRig.update(elapsed, wind, rainAmount, motionScale);
    },
  };
}

function buildSpruceTree(
  parent: THREE.Group,
  trunkMat: THREE.Material,
  leafMat: THREE.Material,
  rng: () => number
): THREE.Group {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.11, 0.62, 7), trunkMat);
  trunk.position.y = 0.28;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  parent.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 0.48;

  const tiers = [
    { r: 0.56, h: 0.64, y: 0.24 },
    { r: 0.45, h: 0.58, y: 0.62 },
    { r: 0.33, h: 0.52, y: 0.96 },
    { r: 0.2, h: 0.42, y: 1.26 },
  ];

  for (const tier of tiers) {
    const coneGeo = new THREE.ConeGeometry(tier.r, tier.h, 9, 2);
    const pos = coneGeo.attributes.position;
    // Gently scallop lower rim vertices for handcrafted miniature charm
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      if (vy < 0) {
        const ang = Math.atan2(vz, vx);
        const wave = Math.sin(ang * 5 + tier.y * 3) * 0.035;
        pos.setY(i, vy + wave);
      }
    }
    coneGeo.computeVertexNormals();

    const mesh = new THREE.Mesh(coneGeo, leafMat);
    mesh.position.y = tier.y;
    mesh.rotation.y = rng() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  }

  parent.add(crown);
  return crown;
}

function buildBroadleafTree(
  parent: THREE.Group,
  trunkMat: THREE.Material,
  leafMat: THREE.Material,
  rng: () => number
): THREE.Group {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.13, 0.78, 7), trunkMat);
  trunk.position.y = 0.36;
  trunk.rotation.z = (rng() - 0.5) * 0.08;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  parent.add(trunk);

  // Two small Y-fork limbs
  for (const dir of [-1, 1]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.38, 6), trunkMat);
    branch.position.set(dir * 0.12, 0.76, (rng() - 0.5) * 0.08);
    branch.rotation.z = -dir * 0.52;
    branch.castShadow = true;
    parent.add(branch);
  }

  const crown = new THREE.Group();
  crown.position.y = 0.92;

  const puffs = [
    { x: 0, y: 0.16, z: 0, r: 0.44 },
    { x: -0.26, y: 0.02, z: 0.12, r: 0.33 },
    { x: 0.27, y: 0.04, z: -0.08, r: 0.34 },
    { x: 0.04, y: 0.0, z: -0.24, r: 0.3 },
    { x: -0.06, y: 0.06, z: 0.24, r: 0.29 },
  ];

  for (const p of puffs) {
    const geo = sculptFoliageSphere(p.r, rng);
    const mesh = new THREE.Mesh(geo, leafMat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  }

  parent.add(crown);
  return crown;
}

function buildCypressTree(
  parent: THREE.Group,
  trunkMat: THREE.Material,
  leafMat: THREE.Material,
  rng: () => number
): THREE.Group {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.088, 0.48, 6), trunkMat);
  trunk.position.y = 0.22;
  trunk.castShadow = true;
  parent.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 0.42;

  const spireGeo = new THREE.IcosahedronGeometry(0.32, 2);
  const pos = spireGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);
    const normY = (vy + 0.32) / 0.64; // 0..1
    const taper = Math.sin(Math.pow(normY, 0.72) * Math.PI) * 0.95 + 0.12;
    const bump = 1 + fbm3D(vx * 4 + 1.2, vy * 4, vz * 4, 2) * 0.12;
    vx *= taper * bump;
    vz *= taper * bump;
    vy = normY * 1.48;
    pos.setXYZ(i, vx, vy, vz);
  }
  spireGeo.computeVertexNormals();

  const spire = new THREE.Mesh(spireGeo, leafMat);
  spire.rotation.y = rng() * Math.PI;
  spire.castShadow = true;
  spire.receiveShadow = true;
  crown.add(spire);

  parent.add(crown);
  return crown;
}

function sculptFoliageSphere(radius: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  const seed = rng() * 10;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n = 0.9 + (fbm3D(vx * 3.5 + seed, vy * 3.5, vz * 3.5 - seed, 2) * 0.5 + 0.5) * 0.22;
    pos.setXYZ(i, vx * n, vy * n * 0.88, vz * n);
  }
  geo.computeVertexNormals();
  return geo;
}

function createGrassTufts(
  parent: THREE.Group,
  rng: () => number
): {
  update: (elapsed: number, wind: number, rainAmount: number, motionScale: number) => void;
} {
  // Build a single 3-blade miniature grass tuft geometry anchored at y=0
  const blade1 = new THREE.ConeGeometry(0.024, 0.16, 4);
  blade1.translate(0, 0.08, 0);

  const blade2 = new THREE.ConeGeometry(0.02, 0.13, 4);
  blade2.translate(0, 0.065, 0);
  blade2.rotateZ(0.28);
  blade2.translate(0.025, 0, 0.01);

  const blade3 = new THREE.ConeGeometry(0.02, 0.14, 4);
  blade3.translate(0, 0.07, 0);
  blade3.rotateZ(-0.26);
  blade3.rotateY(1.1);
  blade3.translate(-0.02, 0, -0.015);

  const mergedGeo = mergeSimpleGeometries([blade1, blade2, blade3]);

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x76ae56,
    roughness: 0.86,
  });

  const placements: Array<{ x: number; y: number; z: number; rotY: number; scale: number; phase: number }> = [];
  let attempts = 0;
  while (placements.length < 185 && attempts < 1200) {
    attempts++;
    const x = (rng() * 2 - 1) * 4.9;
    const z = (rng() * 2 - 1) * 4.9;
    if (getNormalizedIslandRadius(x, z) > 0.88) continue;
    if (isPointInWater(x, z)) continue;
    if (isNearPath(x, z, 0.36)) continue;

    // Keep off cottage & windmill plinths
    if (Math.hypot(x - LANDMARKS.house.x, z - LANDMARKS.house.z) < 1.38) continue;
    if (Math.hypot(x - LANDMARKS.windmill.x, z - LANDMARKS.windmill.z) < 1.02) continue;

    const y = getIslandSurfaceHeight(x, z);
    if (y < 0.02) continue;

    placements.push({
      x,
      y: y - 0.015,
      z,
      rotY: rng() * Math.PI * 2,
      scale: 0.72 + rng() * 0.65,
      phase: x * 0.8 + z * 0.6 + rng() * 1.5,
    });
  }

  const instanced = new THREE.InstancedMesh(mergedGeo, grassMat, placements.length);
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cBase = new THREE.Color(0x6ea851);
  const cSun = new THREE.Color(0x8ec267);
  const tmpC = new THREE.Color();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rotY, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    instanced.setMatrixAt(i, dummy.matrix);

    tmpC.copy(cBase).lerp(cSun, rng() * 0.75);
    instanced.setColorAt(i, tmpC);
  }
  if (instanced.instanceColor) {
    instanced.instanceColor.needsUpdate = true;
  }

  parent.add(instanced);

  let wasResting = false;

  return {
    update(elapsed, wind, rainAmount, motionScale) {
      grassMat.roughness = lerp(0.86, 0.58, rainAmount);

      if (wind < 0.002) {
        if (!wasResting) {
          for (let i = 0; i < placements.length; i++) {
            const p = placements[i];
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(0, p.rotY, 0);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
          }
          instanced.instanceMatrix.needsUpdate = true;
          wasResting = true;
        }
        return;
      }

      wasResting = false;
      const speed = 2.4 + wind * 3.2;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        const wave = Math.sin(elapsed * speed + p.phase) * 0.14 * wind * motionScale;
        const bend = wind * 0.24 + wave;

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(bend * 0.45, p.rotY, -bend * 0.85);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;
    },
  };
}

function mergeSimpleGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const g of geos) {
    const nonIndexed = g.index ? g.toNonIndexed() : g;
    const pos = nonIndexed.attributes.position;
    const norm = nonIndexed.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    }
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return out;
}
