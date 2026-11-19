import * as THREE from 'three';
import type { WorldMaterials } from './materials';
import { WATER_LEVEL, getTerrainHeight } from './terrainMath';

export interface DetailsBundle {
  group: THREE.Group;
  update: (
    elapsed: number,
    windStrength: number,
    windDirX: number,
    windDirZ: number,
    reducedMotion: boolean,
  ) => void;
  dispose: () => void;
}

interface SwayingReed {
  pivot: THREE.Group;
  phase: number;
}

export function createEnvironmentDetails(materials: WorldMaterials): DetailsBundle {
  const group = new THREE.Group();
  group.name = 'environmental-details';

  const geometries: THREE.BufferGeometry[] = [];
  const registerGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // --- 1. Curved stepping-stone garden path (cottage -> pond pier & cottage -> windmill) ---
  const stoneGeo = registerGeo(new THREE.CylinderGeometry(0.24, 0.27, 0.08, 7));
  const pathPoints: Array<[number, number, number, number]> = [
    // From cottage threshold toward pond pier
    [-0.95, 0.35, 1.05, 0.85],
    [-0.65, 0.72, 0.92, 0.78],
    [-0.32, 1.05, 1.0, 0.82],
    // Branch curving toward windmill doorway
    [-0.45, -0.05, 0.9, 0.78],
    [0.08, -0.32, 0.96, 0.82],
    [0.64, -0.52, 0.88, 0.76],
    [1.18, -0.68, 0.95, 0.8],
    [1.66, -0.78, 0.85, 0.75],
  ];

  pathPoints.forEach(([x, z, sx, sz], idx) => {
    const stone = new THREE.Mesh(stoneGeo, materials.steppingStone);
    const y = getTerrainHeight(x, z);
    stone.position.set(x, y + 0.025, z);
    stone.scale.set(sx, 1, sz);
    stone.rotation.y = idx * 0.95 + 0.2;
    stone.receiveShadow = true;
    stone.castShadow = true;
    group.add(stone);
  });

  // --- 2. Cozy miniature wooden pond pier / landing ---
  const pierGroup = new THREE.Group();
  const pierAnchorX = -0.02;
  const pierAnchorZ = 1.24;
  pierGroup.position.set(pierAnchorX, WATER_LEVEL + 0.14, pierAnchorZ);
  pierGroup.rotation.y = -0.18;

  const plankGeo = registerGeo(new THREE.BoxGeometry(0.18, 0.045, 0.62));
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(plankGeo, i % 2 === 0 ? materials.warmWood : materials.lightWood);
    plank.position.set(i * 0.21, 0, (i % 2 === 0 ? 1 : -1) * 0.015);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pierGroup.add(plank);
  }

  const stringerGeo = registerGeo(new THREE.BoxGeometry(0.84, 0.05, 0.06));
  for (const dz of [-0.21, 0.21]) {
    const stringer = new THREE.Mesh(stringerGeo, materials.darkWood);
    stringer.position.set(0.32, -0.04, dz);
    pierGroup.add(stringer);
  }

  const pilingGeo = registerGeo(new THREE.CylinderGeometry(0.045, 0.052, 0.56, 6));
  const pilingCoords: Array<[number, number, number]> = [
    [0.08, -0.22, -0.24],
    [0.08, -0.22, 0.24],
    [0.64, -0.17, -0.24],
    [0.64, -0.17, 0.24],
  ];
  for (const [px, py, pz] of pilingCoords) {
    const post = new THREE.Mesh(pilingGeo, materials.darkWood);
    post.position.set(px, py, pz);
    post.castShadow = true;
    pierGroup.add(post);
  }
  group.add(pierGroup);

  // --- 3. Restrained rustic wooden fence along front-left meadow ---
  const fencePts: Array<[number, number]> = [
    [-2.78, 0.92],
    [-2.34, 1.48],
    [-1.78, 1.94],
    [-1.18, 2.28],
    [-0.55, 2.46],
  ];
  const fencePostGeo = registerGeo(new THREE.CylinderGeometry(0.042, 0.052, 0.44, 6));

  for (let i = 0; i < fencePts.length; i++) {
    const [x, z] = fencePts[i];
    const y = getTerrainHeight(x, z);
    const post = new THREE.Mesh(fencePostGeo, materials.warmWood);
    post.position.set(x, y + 0.16, z);
    // Subtle handcrafted tilt so it feels miniature-built
    post.rotation.z = ((i % 3) - 1) * 0.05;
    post.rotation.x = (((i + 1) % 3) - 1) * 0.04;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);

    if (i < fencePts.length - 1) {
      const [nx, nz] = fencePts[i + 1];
      const ny = getTerrainHeight(nx, nz);
      const start = new THREE.Vector3(x, y + 0.24, z);
      const end = new THREE.Vector3(nx, ny + 0.24, nz);
      const dist = start.distanceTo(end);
      const railGeo = registerGeo(new THREE.BoxGeometry(0.036, 0.042, dist));

      for (const yOff of [-0.08, 0.05]) {
        const rail = new THREE.Mesh(railGeo, materials.lightWood);
        rail.position.lerpVectors(start, end, 0.5);
        rail.position.y += yOff;
        rail.lookAt(end.x, end.y + yOff, end.z);
        rail.castShadow = true;
        group.add(rail);
      }
    }
  }

  // --- 4. Sculpted mossy boulders & shoreline river stones ---
  const rockGeo = registerGeo(new THREE.DodecahedronGeometry(0.32, 0));
  const rockPlacements: Array<[number, number, [number, number, number], number]> = [
    // Shoreline pebbles around pond
    [2.78, 0.56, [0.82, 0.52, 0.72], 0.4],
    [3.12, 0.92, [0.54, 0.36, 0.48], 1.2],
    [2.65, 2.38, [0.76, 0.48, 0.65], 2.1],
    [0.65, 2.58, [0.68, 0.42, 0.58], 0.9],
    [0.28, 2.35, [0.46, 0.32, 0.44], 1.8],
    // Accents near windmill knoll & garden edges
    [1.38, -2.02, [1.05, 0.68, 0.88], 0.6],
    [1.76, -2.35, [0.64, 0.44, 0.58], 2.4],
    [-2.85, -0.35, [0.78, 0.5, 0.66], 1.5],
    [-1.42, 2.52, [0.58, 0.38, 0.52], 0.3],
    [-2.65, 3.12, [0.95, 0.56, 0.8], 1.1],
    [-2.18, 3.45, [0.62, 0.38, 0.52], 2.6],
    [-0.95, 3.55, [0.52, 0.32, 0.46], 0.7],
    [3.52, -0.82, [0.84, 0.55, 0.74], 2.9],
  ];

  for (const [x, z, sc, yaw] of rockPlacements) {
    const rock = new THREE.Mesh(rockGeo, materials.boulder);
    const y = getTerrainHeight(x, z);
    rock.position.set(x, y + 0.04, z);
    rock.scale.set(sc[0], sc[1], sc[2]);
    rock.rotation.set(yaw * 0.25, yaw, yaw * 0.15);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // --- 5. Cozy garden shrubs softening the cottage & fence ---
  const shrubGeo = registerGeo(new THREE.IcosahedronGeometry(0.26, 1));
  const shrubSpecs: Array<[number, number, number, number]> = [
    [-2.42, -0.05, 1.0, 0],
    [-2.62, 0.22, 0.72, 1],
    [-0.18, -1.68, 0.92, 2],
    [0.12, -1.55, 0.68, 1],
    [-1.92, 1.85, 0.84, 0],
    [-2.42, 3.22, 0.88, 1],
    [-2.02, 3.52, 0.64, 2],
    [3.12, -0.42, 0.78, 2],
  ];
  const shrubMats = [materials.leafSage, materials.leafOlive, materials.leafMoss];
  for (const [x, z, sc, mIdx] of shrubSpecs) {
    const bush = new THREE.Mesh(shrubGeo, shrubMats[mIdx]);
    const y = getTerrainHeight(x, z);
    bush.position.set(x, y + 0.12 * sc, z);
    bush.scale.set(sc * 1.15, sc * 0.82, sc * 1.05);
    bush.castShadow = true;
    bush.receiveShadow = true;
    group.add(bush);
  }

  // --- 6. Pond lily pads + one tiny floating blossom ---
  const lilyShape = new THREE.Shape();
  lilyShape.absarc(0, 0, 0.22, 0.24, Math.PI * 2 - 0.24, false);
  lilyShape.lineTo(0, 0);
  lilyShape.closePath();
  const lilyGeo = registerGeo(new THREE.ShapeGeometry(lilyShape, 12));
  lilyGeo.rotateX(-Math.PI / 2);

  const lilyCoords: Array<[number, number, number, number, boolean]> = [
    [1.82, 1.98, 1.05, 0.5, true],
    [2.16, 1.72, 0.78, 2.3, false],
    [1.08, 1.92, 0.88, 4.1, false],
    [1.92, 0.84, 0.82, 1.4, false],
  ];

  const lotusPetalGeo = registerGeo(new THREE.ConeGeometry(0.042, 0.085, 5));
  for (const [lx, lz, sc, yaw, hasBlossom] of lilyCoords) {
    const pad = new THREE.Mesh(lilyGeo, materials.lilyPad);
    pad.position.set(lx, WATER_LEVEL + 0.014, lz);
    pad.scale.setScalar(sc);
    pad.rotation.y = yaw;
    pad.receiveShadow = true;
    group.add(pad);

    if (hasBlossom) {
      const blossom = new THREE.Group();
      blossom.position.set(lx, WATER_LEVEL + 0.045, lz);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(lotusPetalGeo, materials.flowerCream);
        petal.position.set(Math.cos(a) * 0.032, 0, Math.sin(a) * 0.032);
        petal.rotation.z = -Math.cos(a) * 0.55;
        petal.rotation.x = Math.sin(a) * 0.55;
        blossom.add(petal);
      }
      group.add(blossom);
    }
  }

  // --- 7. Shoreline swaying reeds & cattails ---
  const reedStalkGeo = registerGeo(new THREE.CylinderGeometry(0.012, 0.02, 0.62, 5));
  const cattailHeadGeo = registerGeo(new THREE.CylinderGeometry(0.032, 0.03, 0.14, 6));
  const reedClusters: Array<[number, number]> = [
    [2.72, 1.82],
    [2.18, 2.48],
    [0.92, 2.46],
    [2.52, 0.62],
  ];
  const reeds: SwayingReed[] = [];

  reedClusters.forEach(([cx, cz], cIdx) => {
    for (let r = 0; r < 4; r++) {
      const rx = cx + Math.cos(r * 1.7 + cIdx) * 0.16;
      const rz = cz + Math.sin(r * 1.7 + cIdx) * 0.16;
      const ry = getTerrainHeight(rx, rz);

      const pivot = new THREE.Group();
      pivot.position.set(rx, Math.max(ry, WATER_LEVEL - 0.12), rz);

      const hScale = 0.78 + ((r + cIdx) % 3) * 0.18;
      const stalk = new THREE.Mesh(reedStalkGeo, materials.reedGreen);
      stalk.position.y = 0.31 * hScale;
      stalk.scale.set(1, hScale, 1);
      stalk.castShadow = true;
      pivot.add(stalk);

      if (r % 2 === 0) {
        const head = new THREE.Mesh(cattailHeadGeo, materials.cattailBrown);
        head.position.y = 0.54 * hScale;
        pivot.add(head);
      }

      group.add(pivot);
      reeds.push({ pivot, phase: cIdx * 1.3 + r * 0.75 });
    }
  });

  // --- 8. Restrained miniature wildflower tufts scattered softly across the meadow ---
  const stemGeo = registerGeo(new THREE.CylinderGeometry(0.01, 0.014, 0.14, 4));
  const blossomGeo = registerGeo(new THREE.SphereGeometry(0.048, 6, 5));
  const flowerMats = [
    materials.flowerCream,
    materials.flowerButter,
    materials.flowerCoral,
    materials.flowerLavender,
  ];

  const flowerPatches: Array<[number, number, number]> = [
    [-2.18, 1.15, 0],
    [-1.48, 1.82, 1],
    [-0.78, 2.18, 2],
    [-0.08, 2.38, 3],
    [-2.95, 1.55, 1],
    [-1.85, 0.58, 0],
    [-1.68, 3.15, 2],
    [-1.12, 3.32, 0],
    [-3.18, 2.48, 3],
    [0.52, -1.25, 2],
    [1.18, -1.65, 0],
    [3.15, -1.05, 1],
    [3.32, 0.42, 3],
    [-0.65, -2.18, 0],
    [-2.55, -1.85, 2],
  ];

  flowerPatches.forEach(([px, pz, matStart], pIdx) => {
    for (let f = 0; f < 3; f++) {
      const fx = px + Math.cos(f * 2.2 + pIdx) * 0.16;
      const fz = pz + Math.sin(f * 2.2 + pIdx) * 0.16;
      const fy = getTerrainHeight(fx, fz);

      const stem = new THREE.Mesh(stemGeo, materials.reedGreen);
      stem.position.set(fx, fy + 0.06, fz);
      group.add(stem);

      const head = new THREE.Mesh(
        blossomGeo,
        flowerMats[(matStart + f) % flowerMats.length],
      );
      head.position.set(fx, fy + 0.14, fz);
      head.scale.set(1, 0.75, 1);
      group.add(head);
    }
  });

  // --- 9. Tiny cozy garden bench near the meadow path overlooking the pond ---
  const bench = new THREE.Group();
  const bx = -0.78;
  const bz = 1.66;
  bench.position.set(bx, getTerrainHeight(bx, bz) + 0.02, bz);
  bench.rotation.y = 0.74;

  const benchSeat = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.56, 0.045, 0.22)),
    materials.warmWood,
  );
  benchSeat.position.y = 0.2;
  benchSeat.castShadow = true;
  benchSeat.receiveShadow = true;
  bench.add(benchSeat);

  const benchBack = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.56, 0.16, 0.04)),
    materials.lightWood,
  );
  benchBack.position.set(0, 0.34, -0.095);
  benchBack.rotation.x = -0.14;
  benchBack.castShadow = true;
  bench.add(benchBack);

  const benchLegGeo = registerGeo(new THREE.BoxGeometry(0.05, 0.22, 0.18));
  for (const lx of [-0.21, 0.21]) {
    const leg = new THREE.Mesh(benchLegGeo, materials.darkWood);
    leg.position.set(lx, 0.1, 0);
    leg.castShadow = true;
    bench.add(leg);
  }
  group.add(bench);

  const update: DetailsBundle['update'] = (
    elapsed,
    windStrength,
    windDirX,
    windDirZ,
    reducedMotion,
  ) => {
    const gustScale = reducedMotion ? 0.25 : 1.0;
    for (const reed of reeds) {
      if (windStrength <= 0.0005) {
        reed.pivot.rotation.x = 0;
        reed.pivot.rotation.z = 0;
        continue;
      }
      const bend =
        windStrength * 0.22 +
        windStrength * gustScale * 0.11 * Math.sin(elapsed * (2.6 + windStrength * 2.2) + reed.phase);
      reed.pivot.rotation.z = -windDirX * bend;
      reed.pivot.rotation.x = windDirZ * bend;
    }
  };

  return {
    group,
    update,
    dispose: () => {
      for (const geo of geometries) {
        geo.dispose();
      }
    },
  };
}
