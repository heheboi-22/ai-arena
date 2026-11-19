import * as THREE from "three";
import { WindDerived } from "../state/worldState";
import { createRng, getIslandTopHeight } from "./terrainMath";
import { ProceduralTextures } from "./textures";

export interface FoliageSystem {
  group: THREE.Group;
  update: (dt: number, elapsed: number, wind: WindDerived, reducedMotion: boolean) => void;
  dispose: () => void;
}

interface SwayTree {
  pivot: THREE.Group;
  canopy: THREE.Group;
  phase: number;
  flexibility: number;
  baseRotX: number;
  baseRotZ: number;
}

type TreeArchetype = "oak" | "pine" | "cypress" | "birch";

interface TreePlacement {
  x: number;
  z: number;
  scale: number;
  type: TreeArchetype;
  rotY: number;
}

// Carefully composed tree placements framing the cottage, windmill, and pond without occluding focal sightlines
const TREE_PLACEMENTS: TreePlacement[] = [
  { x: -4.45, z: -2.05, scale: 1.18, type: "oak", rotY: 0.4 },
  { x: -4.85, z: 0.95, scale: 0.92, type: "oak", rotY: 2.1 },
  { x: -3.45, z: 3.15, scale: 0.76, type: "oak", rotY: 4.0 },
  { x: 0.25, z: -4.15, scale: 1.15, type: "pine", rotY: 0.8 },
  { x: 4.15, z: -3.35, scale: 1.08, type: "pine", rotY: 1.9 },
  { x: 4.85, z: -1.15, scale: 0.88, type: "pine", rotY: 3.4 },
  { x: -2.65, z: -4.15, scale: 1.0, type: "cypress", rotY: 0.3 },
  { x: 4.25, z: 1.25, scale: 0.96, type: "birch", rotY: 2.6 },
  { x: -1.35, z: 4.15, scale: 0.72, type: "birch", rotY: 5.1 },
];

export function createFoliageAndProps(textures: ProceduralTextures): FoliageSystem {
  const group = new THREE.Group();
  group.name = "FoliageAndProps";
  const disposables: Array<{ dispose: () => void }> = [];
  const swayTrees: SwayTree[] = [];
  const rng = createRng(909);

  // Shared materials with handcrafted matte-organic palette
  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x6f513b,
    map: textures.woodMap,
    bumpMap: textures.woodBump,
    bumpScale: 0.03,
    roughness: 0.92,
    metalness: 0.0,
  });

  const birchBarkMat = new THREE.MeshStandardMaterial({
    color: 0xd9d2c5,
    bumpMap: textures.woodBump,
    bumpScale: 0.025,
    roughness: 0.86,
    metalness: 0.0,
  });

  const oakMats = [
    new THREE.MeshStandardMaterial({ color: 0x6a9056, roughness: 0.86, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x7da162, roughness: 0.84, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x577b48, roughness: 0.88, flatShading: true }),
  ];

  const pineMats = [
    new THREE.MeshStandardMaterial({ color: 0x456948, roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x527851, roughness: 0.86, flatShading: true }),
  ];

  const birchLeafMats = [
    new THREE.MeshStandardMaterial({ color: 0x87a860, roughness: 0.84, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0xa2be77, roughness: 0.82, flatShading: true }),
  ];

  const flagstoneMat = new THREE.MeshStandardMaterial({
    color: 0xd2c7b4,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  });

  const boulderMat = new THREE.MeshStandardMaterial({
    color: 0x8b867d,
    roughness: 0.9,
    metalness: 0.03,
    bumpMap: textures.rockBump,
    bumpScale: 0.04,
    flatShading: true,
  });

  const fenceWoodMat = new THREE.MeshStandardMaterial({
    color: 0x8b6545,
    map: textures.woodMap,
    roughness: 0.85,
    metalness: 0.02,
  });

  disposables.push(
    barkMat,
    birchBarkMat,
    ...oakMats,
    ...pineMats,
    ...birchLeafMats,
    flagstoneMat,
    boulderMat,
    fenceWoodMat
  );

  // Shared geometries for multi-part trees
  const lobeGeo = new THREE.IcosahedronGeometry(0.62, 1);
  const pineConeGeo = new THREE.ConeGeometry(0.75, 1.35, 7);
  const trunkGeo = new THREE.CylinderGeometry(0.085, 0.17, 1.35, 7);
  trunkGeo.translate(0, 0.62, 0);
  const branchGeo = new THREE.CylinderGeometry(0.038, 0.068, 0.68, 5);
  branchGeo.translate(0, 0.34, 0);
  disposables.push(lobeGeo, pineConeGeo, trunkGeo, branchGeo);

  for (let idx = 0; idx < TREE_PLACEMENTS.length; idx++) {
    const spec = TREE_PLACEMENTS[idx];
    const groundY = getIslandTopHeight(spec.x, spec.z);

    const pivot = new THREE.Group();
    pivot.position.set(spec.x, groundY - 0.08, spec.z);
    pivot.rotation.y = spec.rotY;
    pivot.scale.setScalar(spec.scale);

    const canopy = new THREE.Group();

    if (spec.type === "oak") {
      // Sculpted trunk + root flare + 2 branches + 5 organic overlapping canopy lobes
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.scale.set(1.1, 1.05, 1.1);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      pivot.add(trunk);

      for (const b of [
        { rx: 0.42, rz: 0.48, y: 0.92 },
        { rx: -0.35, rz: -0.52, y: 0.82 },
      ]) {
        const branch = new THREE.Mesh(branchGeo, barkMat);
        branch.position.y = b.y;
        branch.rotation.set(b.rx, 0, b.rz);
        branch.castShadow = true;
        pivot.add(branch);
      }

      canopy.position.set(0, 1.25, 0);
      const lobes: Array<[number, number, number, number, number, number]> = [
        [0, 0.45, 0, 1.25, 1.02, 1.2],
        [-0.55, 0.12, 0.28, 0.88, 0.78, 0.85],
        [0.54, 0.16, -0.22, 0.92, 0.8, 0.88],
        [0.12, 0.14, 0.56, 0.78, 0.72, 0.8],
        [-0.18, 0.72, -0.28, 0.76, 0.68, 0.74],
      ];
      lobes.forEach(([lx, ly, lz, sx, sy, sz], li) => {
        const lobe = new THREE.Mesh(lobeGeo, oakMats[(idx + li) % oakMats.length]);
        lobe.position.set(lx, ly, lz);
        lobe.scale.set(sx, sy, sz);
        lobe.rotation.set(li * 0.6, li * 1.1, li * 0.4);
        lobe.castShadow = true;
        lobe.receiveShadow = true;
        canopy.add(lobe);
      });
      pivot.add(canopy);
    } else if (spec.type === "pine") {
      // Sturdy conifer trunk + 4 tiered ruffled pine cones
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.scale.set(0.82, 1.15, 0.82);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      pivot.add(trunk);

      canopy.position.set(0, 0.75, 0);
      const tiers = [
        { y: 0.55, sx: 1.22, sy: 0.98, rot: 0.0 },
        { y: 1.25, sx: 0.98, sy: 0.94, rot: 0.48 },
        { y: 1.88, sx: 0.74, sy: 0.88, rot: 0.92 },
        { y: 2.42, sx: 0.48, sy: 0.82, rot: 1.38 },
      ];
      tiers.forEach((t, ti) => {
        const cone = new THREE.Mesh(pineConeGeo, pineMats[(idx + ti) % pineMats.length]);
        cone.position.y = t.y;
        cone.scale.set(t.sx, t.sy, t.sx);
        cone.rotation.y = t.rot;
        cone.castShadow = true;
        cone.receiveShadow = true;
        canopy.add(cone);
      });
      pivot.add(canopy);
    } else if (spec.type === "cypress") {
      // Tall slender Mediterranean cypress accent silhouette
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.scale.set(0.65, 0.9, 0.65);
      trunk.castShadow = true;
      pivot.add(trunk);

      canopy.position.set(0, 0.65, 0);
      for (let ti = 0; ti < 4; ti++) {
        const cone = new THREE.Mesh(pineConeGeo, pineMats[0]);
        cone.position.y = 0.55 + ti * 0.58;
        const w = 0.58 - ti * 0.1;
        cone.scale.set(w, 0.95, w);
        cone.rotation.y = ti * 0.7;
        cone.castShadow = true;
        cone.receiveShadow = true;
        canopy.add(cone);
      }
      pivot.add(canopy);
    } else {
      // Graceful pale-bark birch / warm spring blossom tree
      const trunk = new THREE.Mesh(trunkGeo, birchBarkMat);
      trunk.scale.set(0.68, 1.25, 0.68);
      trunk.rotation.z = 0.08;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      pivot.add(trunk);

      const b = new THREE.Mesh(branchGeo, birchBarkMat);
      b.position.set(-0.08, 1.0, 0);
      b.rotation.z = 0.48;
      b.castShadow = true;
      pivot.add(b);

      canopy.position.set(-0.08, 1.38, 0);
      const puffs: Array<[number, number, number, number]> = [
        [0, 0.35, 0, 0.88],
        [-0.45, 0.14, 0.18, 0.64],
        [0.42, 0.18, -0.15, 0.68],
        [0.05, 0.62, 0.16, 0.56],
      ];
      puffs.forEach(([px, py, pz, s], pi) => {
        const m = new THREE.Mesh(lobeGeo, birchLeafMats[pi === 3 || idx === 7 ? 1 : 0]);
        m.position.set(px, py, pz);
        m.scale.set(s * 1.1, s * 0.85, s);
        m.castShadow = true;
        m.receiveShadow = true;
        canopy.add(m);
      });
      pivot.add(canopy);
    }

    group.add(pivot);
    swayTrees.push({
      pivot,
      canopy,
      phase: idx * 1.13 + rng() * 0.8,
      flexibility: spec.type === "pine" ? 0.85 : spec.type === "cypress" ? 1.1 : 1.0,
      baseRotX: (rng() - 0.5) * 0.03,
      baseRotZ: (rng() - 0.5) * 0.03,
    });
  }

  // 2. Curved Flagstone Garden Path (cottage doorstep -> pond dock & branch -> windmill)
  const stoneStepGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.075, 7);
  disposables.push(stoneStepGeo);

  const pathNodes: Array<[number, number, number]> = [
    // Cottage doorstep to pond dock
    [-1.08, 0.18, 1.05],
    [-0.86, 0.52, 0.92],
    [-0.58, 0.86, 1.02],
    [-0.3, 1.16, 0.88],
    // Branch toward windmill entrance
    [-0.12, 0.52, 0.85],
    [0.34, 0.16, 0.95],
    [0.82, -0.22, 0.9],
    [1.26, -0.58, 0.88],
    [1.68, -0.92, 0.94],
    [2.02, -1.16, 0.86],
  ];
  for (let i = 0; i < pathNodes.length; i++) {
    const [px, pz, sc] = pathNodes[i];
    const py = getIslandTopHeight(px, pz);
    const stone = new THREE.Mesh(stoneStepGeo, flagstoneMat);
    stone.position.set(px, py + 0.02, pz);
    stone.scale.set(sc * (0.9 + (i % 2) * 0.2), 1, sc * 0.82);
    stone.rotation.y = i * 1.15;
    stone.receiveShadow = true;
    stone.castShadow = false;
    group.add(stone);
  }

  // 3. Rustic Split-Rail Wooden Fence along the south-west meadow edge
  const fencePoints: Array<[number, number]> = [
    [-3.95, 1.85],
    [-3.18, 2.52],
    [-2.32, 3.08],
    [-1.38, 3.45],
    [-0.55, 3.55],
  ];
  const fencePostGeo = new THREE.CylinderGeometry(0.048, 0.058, 0.68, 6);
  const railGeo = new THREE.BoxGeometry(1, 0.058, 0.045);
  disposables.push(fencePostGeo, railGeo);

  const postWorldCoords: THREE.Vector3[] = [];
  for (let i = 0; i < fencePoints.length; i++) {
    const [fx, fz] = fencePoints[i];
    const fy = getIslandTopHeight(fx, fz);
    const post = new THREE.Mesh(fencePostGeo, fenceWoodMat);
    post.position.set(fx, fy + 0.24, fz);
    post.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.035;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
    postWorldCoords.push(new THREE.Vector3(fx, fy, fz));
  }
  for (let i = 0; i < postWorldCoords.length - 1; i++) {
    const a = postWorldCoords[i];
    const b = postWorldCoords[i + 1];
    const dist = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
    const pitch = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));

    for (const hOff of [0.22, 0.44]) {
      const rail = new THREE.Mesh(railGeo, fenceWoodMat);
      rail.position.set(mid.x, mid.y + hOff, mid.z);
      rail.scale.x = dist + 0.05;
      rail.rotation.y = yaw;
      rail.rotation.z = pitch;
      rail.castShadow = true;
      rail.receiveShadow = true;
      group.add(rail);
    }
  }

  // 4. Sculpted Meadow Boulders (clustered near trees & ridge edges)
  const boulderGeo = new THREE.DodecahedronGeometry(0.42, 1);
  disposables.push(boulderGeo);
  const boulderSpecs: Array<[number, number, number, number, number]> = [
    [-3.7, -3.15, 1.25, 0.78, 1.0],
    [-3.25, -3.55, 0.72, 0.55, 0.68],
    [3.85, -2.55, 1.15, 0.72, 0.92],
    [4.45, -2.3, 0.62, 0.5, 0.65],
    [-4.15, 2.3, 0.85, 0.55, 0.75],
    [1.6, -3.8, 0.92, 0.6, 0.8],
    // Grounded stones & low meadow tufts balancing the front-right & front-left foreground edges
    [4.45, 2.75, 0.95, 0.52, 0.78],
    [4.95, 2.35, 0.58, 0.38, 0.54],
    [-5.1, -0.35, 0.88, 0.52, 0.76],
  ];
  for (let i = 0; i < boulderSpecs.length; i++) {
    const [bx, bz, sx, sy, sz] = boulderSpecs[i];
    const by = getIslandTopHeight(bx, bz);
    const rock = new THREE.Mesh(boulderGeo, boulderMat);
    rock.position.set(bx, by + sy * 0.14, bz);
    rock.scale.set(sx, sy, sz);
    rock.rotation.set(i * 0.4, i * 1.1, i * 0.25);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // Soft low meadow bushes tucked near the cottage, fence, and front-right knoll
  const bushSpots: Array<[number, number, number]> = [
    [4.75, 1.85, 0.78],
    [5.15, 1.45, 0.56],
    [3.45, 3.65, 0.64],
    [-4.35, 1.65, 0.66],
    [-2.95, -0.45, 0.58],
    [0.85, -1.95, 0.62],
  ];
  for (let i = 0; i < bushSpots.length; i++) {
    const [bx, bz, sc] = bushSpots[i];
    const by = getIslandTopHeight(bx, bz);
    const bushGroup = new THREE.Group();
    bushGroup.position.set(bx, by + 0.08 * sc, bz);
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(lobeGeo, oakMats[(i + p) % oakMats.length]);
      puff.position.set((p - 1) * 0.28 * sc, (p === 1 ? 0.14 : 0.04) * sc, (p % 2 === 0 ? 0.08 : -0.1) * sc);
      puff.scale.set(0.55 * sc, 0.44 * sc, 0.52 * sc);
      puff.castShadow = true;
      puff.receiveShadow = true;
      bushGroup.add(puff);
    }
    group.add(bushGroup);
  }

  // 5. Restrained Instanced Wildflower Tufts (soft cream, buttercup, muted coral & lavender)
  const flowerSpots: Array<[number, number]> = [
    [-2.85, 1.15], [-2.6, 1.4], [-2.95, 1.5],
    [-1.75, 2.35], [-1.45, 2.55], [-1.9, 2.65],
    [-0.15, 2.85], [0.1, 3.05],
    [0.55, -2.45], [0.85, -2.65], [0.35, -2.7],
    [3.55, 0.25], [3.85, 0.5], [3.4, 0.55],
    [-3.55, -0.45], [-3.85, -0.2],
    [1.55, -2.95], [1.85, -3.1],
    [-0.65, 2.25], [-0.4, 2.45],
    [2.6, 3.35], [2.85, 3.15],
  ];
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.22, 4);
  stemGeo.translate(0, 0.11, 0);
  const petalGeo = new THREE.DodecahedronGeometry(0.068, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5c8049, roughness: 0.85 });
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  disposables.push(stemGeo, petalGeo, stemMat, petalMat);

  const stems = new THREE.InstancedMesh(stemGeo, stemMat, flowerSpots.length);
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, flowerSpots.length);
  const palette = [
    new THREE.Color(0xf6e6b4), // buttercup
    new THREE.Color(0xf4efe3), // daisy cream
    new THREE.Color(0xe5a491), // soft coral
    new THREE.Color(0xc5b7de), // pale lavender
  ];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < flowerSpots.length; i++) {
    const [fx, fz] = flowerSpots[i];
    const fy = getIslandTopHeight(fx, fz);
    const sc = 0.82 + (i % 3) * 0.2;
    dummy.position.set(fx, fy - 0.01, fz);
    dummy.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI * 2, (rng() - 0.5) * 0.2);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);

    dummy.position.set(fx, fy + 0.2 * sc, fz);
    dummy.scale.set(sc * 1.1, sc * 0.72, sc * 1.1);
    dummy.updateMatrix();
    petals.setMatrixAt(i, dummy.matrix);
    petals.setColorAt(i, palette[i % palette.length]);
  }
  stems.instanceMatrix.needsUpdate = true;
  petals.instanceMatrix.needsUpdate = true;
  if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
  stems.computeBoundingSphere();
  petals.computeBoundingSphere();
  group.add(stems, petals);

  // Smooth wind damping state so slider scrubs transition naturally without snaps
  let smoothAmp = 0;
  let swayPhaseTime = 0;

  return {
    group,
    update: (dt, _elapsed, wind, reducedMotion) => {
      const targetAmp = reducedMotion ? 0 : wind.treeSwayRadians;
      smoothAmp += (targetAmp - smoothAmp) * (1 - Math.exp(-4.5 * dt));
      if (targetAmp === 0 && smoothAmp < 0.0005) smoothAmp = 0;

      if (!reducedMotion) {
        swayPhaseTime += dt * wind.treeSwayFrequency;
      }

      // Bend gently along the shared wind direction (NW -> SE) with an organic oscillating gust
      for (const tree of swayTrees) {
        const gust = 0.55 + 0.45 * Math.sin(swayPhaseTime + tree.phase) + 0.18 * Math.sin(swayPhaseTime * 1.73 + tree.phase * 1.7);
        const lean = smoothAmp * tree.flexibility * gust;

        // World-aligned lean projection onto tree's local rotation
        const rotY = tree.pivot.rotation.y;
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const localWindX = wind.dirX * cosY - wind.dirZ * sinY;
        const localWindZ = wind.dirX * sinY + wind.dirZ * cosY;

        // Leaning toward +X corresponds to negative rotation.z; toward +Z corresponds to positive rotation.x
        tree.pivot.rotation.z = tree.baseRotZ - localWindX * lean * 0.65;
        tree.pivot.rotation.x = tree.baseRotX + localWindZ * lean * 0.65;

        // Secondary canopy rustle for organic life without bending trunks implausibly
        tree.canopy.rotation.z = -localWindX * lean * 0.55;
        tree.canopy.rotation.x = localWindZ * lean * 0.55;
      }
    },
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
