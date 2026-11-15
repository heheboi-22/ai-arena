import * as THREE from "three";
import {
  createRng,
  groundHeightAt,
  HOUSE_CENTER,
  islandRadiusAt,
  pondNormalizedRadius,
  WINDMILL_CENTER,
} from "../util/math";
import type { ProceduralTextures } from "./textures";

export interface DetailsRig {
  group: THREE.Group;
  update: (
    elapsed: number,
    windStrength: number,
    nightness: number,
    rainMix: number,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

interface GrassSeed {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  phase: number;
}

interface FireflySlot {
  sprite: THREE.Sprite;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  radius: number;
}

export function createDetails(textures: ProceduralTextures): DetailsRig {
  const group = new THREE.Group();
  group.name = "EnvironmentalDetails";

  const disposables: { dispose: () => void }[] = [];
  const rng = createRng(9090);

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneMap,
    color: "#a7a093",
    roughness: 0.9,
    metalness: 0.03,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.rockMap,
    color: "#7b746a",
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: "#785336",
    roughness: 0.82,
    metalness: 0.04,
  });
  disposables.push(stoneMat, rockMat, woodMat);

  // 1. Flagstone Footpath (cottage porch -> pond dock, and fork -> windmill)
  const flagGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.055, 7);
  disposables.push(flagGeo);

  const pathPoints: [number, number, number][] = [
    // Porch to pond dock
    [1.12, 0.26, 1.0],
    [0.98, 0.62, 0.88],
    [0.86, 0.98, 0.95],
    [0.9, 1.28, 0.85],
    // Branch from cottage path toward windmill
    [0.52, -0.05, 0.92],
    [-0.08, -0.22, 0.86],
    [-0.68, -0.35, 0.94],
    [-1.3, -0.52, 0.88],
    [-1.88, -0.74, 0.95],
  ];

  for (const [px, pz, sc] of pathPoints) {
    const py = groundHeightAt(px, pz);
    const stone = new THREE.Mesh(flagGeo, stoneMat);
    stone.position.set(px, py + 0.008, pz);
    stone.scale.set(sc * (0.9 + rng() * 0.25), 1, sc * (0.78 + rng() * 0.24));
    stone.rotation.y = rng() * Math.PI;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // 2. Split-Rail Wooden Fence along two scenic meadow edges
  const fencePostGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.42, 6);
  fencePostGeo.translate(0, 0.21, 0);
  const fenceRailGeo = new THREE.BoxGeometry(0.68, 0.035, 0.035);
  disposables.push(fencePostGeo, fenceRailGeo);

  function addFenceArc(points: [number, number][]) {
    for (let i = 0; i < points.length; i++) {
      const [px, pz] = points[i];
      const py = groundHeightAt(px, pz);
      const post = new THREE.Mesh(fencePostGeo, woodMat);
      post.position.set(px, py - 0.04, pz);
      post.rotation.z = (rng() - 0.5) * 0.08;
      post.castShadow = true;
      group.add(post);

      if (i < points.length - 1) {
        const [nx, nz] = points[i + 1];
        const ny = groundHeightAt(nx, nz);
        const mx = (px + nx) * 0.5;
        const mz = (pz + nz) * 0.5;
        const my = (py + ny) * 0.5;
        const dist = Math.hypot(nx - px, nz - pz);
        const yaw = -Math.atan2(nz - pz, nx - px);

        for (const h of [0.16, 0.3]) {
          const rail = new THREE.Mesh(fenceRailGeo, woodMat);
          rail.position.set(mx, my + h - 0.02, mz);
          rail.rotation.y = yaw;
          rail.scale.x = dist / 0.68;
          rail.castShadow = true;
          group.add(rail);
        }
      }
    }
  }

  addFenceArc([
    [2.75, 2.55],
    [3.35, 2.05],
    [3.88, 1.45],
    [4.28, 0.78],
  ]);
  addFenceArc([
    [-4.35, 1.1],
    [-4.75, 0.45],
    [-4.95, -0.25],
  ]);

  // 3. Wooden Garden Bench facing the pond + Firewood Stack + Signpost
  const benchGroup = new THREE.Group();
  const bx = 1.65;
  const bz = 2.68;
  benchGroup.position.set(bx, groundHeightAt(bx, bz) - 0.01, bz);
  benchGroup.rotation.y = -2.25;
  const benchSeatGeo = new THREE.BoxGeometry(0.68, 0.045, 0.24);
  const benchBackGeo = new THREE.BoxGeometry(0.68, 0.22, 0.04);
  const benchLegGeo = new THREE.BoxGeometry(0.05, 0.2, 0.22);
  disposables.push(benchSeatGeo, benchBackGeo, benchLegGeo);

  const bSeat = new THREE.Mesh(benchSeatGeo, woodMat);
  bSeat.position.y = 0.2;
  bSeat.castShadow = true;
  const bBack = new THREE.Mesh(benchBackGeo, woodMat);
  bBack.position.set(0, 0.33, -0.1);
  bBack.rotation.x = -0.14;
  bBack.castShadow = true;
  const bLegL = new THREE.Mesh(benchLegGeo, woodMat);
  bLegL.position.set(-0.26, 0.1, 0);
  const bLegR = new THREE.Mesh(benchLegGeo, woodMat);
  bLegR.position.set(0.26, 0.1, 0);
  benchGroup.add(bSeat, bBack, bLegL, bLegR);
  group.add(benchGroup);

  // Stacked Firewood Pile beside cottage
  const logGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.36, 7);
  logGeo.rotateX(Math.PI * 0.5);
  disposables.push(logGeo);
  const logGroup = new THREE.Group();
  const lx = 3.25;
  const lz = -0.42;
  logGroup.position.set(lx, groundHeightAt(lx, lz), lz);
  logGroup.rotation.y = -0.56;
  const logOffsets: [number, number][] = [
    [-0.12, 0.05],
    [0, 0.05],
    [0.12, 0.05],
    [-0.06, 0.14],
    [0.06, 0.14],
    [0, 0.23],
  ];
  for (const [ox, oy] of logOffsets) {
    const log = new THREE.Mesh(logGeo, woodMat);
    log.position.set(ox, oy, 0);
    log.castShadow = true;
    logGroup.add(log);
  }
  group.add(logGroup);

  // Wooden Signpost near path fork
  const signGroup = new THREE.Group();
  const sx = 0.32;
  const sz = -0.48;
  signGroup.position.set(sx, groundHeightAt(sx, sz) - 0.02, sz);
  const sPostGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.72, 6);
  sPostGeo.translate(0, 0.36, 0);
  const sBoardGeo = new THREE.BoxGeometry(0.42, 0.11, 0.03);
  disposables.push(sPostGeo, sBoardGeo);
  const sPost = new THREE.Mesh(sPostGeo, woodMat);
  sPost.castShadow = true;
  const sBoard1 = new THREE.Mesh(sBoardGeo, woodMat);
  sBoard1.position.set(0.12, 0.62, 0.02);
  sBoard1.rotation.y = 0.25;
  const sBoard2 = new THREE.Mesh(sBoardGeo, woodMat);
  sBoard2.position.set(-0.1, 0.48, -0.02);
  sBoard2.rotation.y = -0.45;
  signGroup.add(sPost, sBoard1, sBoard2);
  group.add(signGroup);

  // 4. Mossy Meadow Boulders
  const boulderGeo = new THREE.DodecahedronGeometry(1, 0);
  disposables.push(boulderGeo);
  const boulders: [number, number, number][] = [
    [4.45, -0.95, 0.32],
    [4.75, -0.68, 0.22],
    [-4.35, -2.15, 0.36],
    [-3.15, -4.15, 0.28],
    [1.15, -3.55, 0.25],
    [-1.4, 3.65, 0.26],
  ];
  boulders.forEach(([rx, rz, sc], i) => {
    const b = new THREE.Mesh(boulderGeo, rockMat);
    const ry = groundHeightAt(rx, rz);
    b.position.set(rx, ry + sc * 0.28, rz);
    b.scale.set(sc * 1.2, sc * 0.85, sc);
    b.rotation.set(i * 0.4, i * 1.1, i * 0.3);
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
  });

  // 5. Instanced Swaying Grass Tufts & Wildflowers
  const grassBladeGeo = new THREE.ConeGeometry(0.036, 0.24, 4);
  grassBladeGeo.translate(0, 0.12, 0);
  const grassBladeMat = new THREE.MeshStandardMaterial({
    color: "#80ac65",
    roughness: 0.85,
    metalness: 0.02,
  });
  const flowerGeo = new THREE.DodecahedronGeometry(0.055, 0);
  const flowerMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.72,
    metalness: 0.02,
  });
  disposables.push(grassBladeGeo, grassBladeMat, flowerGeo, flowerMat);

  function isClearSpot(x: number, z: number): boolean {
    const r = Math.hypot(x, z);
    const maxR = islandRadiusAt(Math.atan2(z, x));
    if (r > maxR - 0.55) return false;
    if (pondNormalizedRadius(x, z) < 1.18) return false;
    if (Math.hypot(x - HOUSE_CENTER.x, z - HOUSE_CENTER.z) < 1.85) return false;
    if (Math.hypot(x - WINDMILL_CENTER.x, z - WINDMILL_CENTER.z) < 1.35) return false;
    return true;
  }

  const grassSeeds: GrassSeed[] = [];
  for (let i = 0; i < 360 && grassSeeds.length < 180; i++) {
    const a = rng() * Math.PI * 2;
    const maxR = islandRadiusAt(a) - 0.6;
    const rad = Math.sqrt(rng()) * maxR;
    const gx = Math.cos(a) * rad;
    const gz = Math.sin(a) * rad;
    if (!isClearSpot(gx, gz)) continue;
    grassSeeds.push({
      x: gx,
      y: groundHeightAt(gx, gz) - 0.02,
      z: gz,
      scale: 0.7 + rng() * 0.75,
      rotY: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
    });
  }

  const grassInst = new THREE.InstancedMesh(
    grassBladeGeo,
    grassBladeMat,
    grassSeeds.length
  );
  grassInst.receiveShadow = true;
  const gColor = new THREE.Color();
  const dummy = new THREE.Object3D();

  grassSeeds.forEach((s, idx) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.rotY, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    grassInst.setMatrixAt(idx, dummy.matrix);
    gColor.setHSL(0.27 + (rng() - 0.5) * 0.04, 0.36, 0.5 + (rng() - 0.5) * 0.1);
    grassInst.setColorAt(idx, gColor);
  });
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  // Wildflowers
  const FLOWER_COUNT = 75;
  const flowerCoords: { x: number; y: number; z: number; s: number }[] = [];
  for (let i = 0; i < 240 && flowerCoords.length < FLOWER_COUNT; i++) {
    const a = rng() * Math.PI * 2;
    const maxR = islandRadiusAt(a) - 0.75;
    const rad = Math.sqrt(rng()) * maxR;
    const fx = Math.cos(a) * rad;
    const fz = Math.sin(a) * rad;
    if (!isClearSpot(fx, fz)) continue;
    flowerCoords.push({
      x: fx,
      y: groundHeightAt(fx, fz) + 0.04,
      z: fz,
      s: 0.7 + rng() * 0.65,
    });
  }

  const flowerInst = new THREE.InstancedMesh(
    flowerGeo,
    flowerMat,
    flowerCoords.length
  );
  const flowerPalette = ["#f7f3e3", "#f6cf67", "#d9a2b8", "#b9b4e4"];
  flowerCoords.forEach((f, idx) => {
    dummy.position.set(f.x, f.y, f.z);
    dummy.rotation.set(rng(), rng(), rng());
    dummy.scale.set(f.s, f.s * 0.72, f.s);
    dummy.updateMatrix();
    flowerInst.setMatrixAt(idx, dummy.matrix);
    gColor.set(flowerPalette[idx % flowerPalette.length]);
    flowerInst.setColorAt(idx, gColor);
  });
  flowerInst.instanceMatrix.needsUpdate = true;
  if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
  flowerInst.computeBoundingSphere();
  group.add(flowerInst);

  // 6. Subtle Night Fireflies over meadow & reeds
  const fireflyBaseMat = new THREE.SpriteMaterial({
    map: textures.softSprite,
    color: "#ffd670",
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(fireflyBaseMat);

  const fireflies: FireflySlot[] = [];
  for (let i = 0; i < 14; i++) {
    const mat = fireflyBaseMat.clone();
    disposables.push(mat);
    const sprite = new THREE.Sprite(mat);
    const angle = (i / 14) * Math.PI * 2;
    const dist = 1.4 + rng() * 3.6;
    const fx = Math.cos(angle) * dist;
    const fz = Math.sin(angle) * dist;
    const fy = groundHeightAt(fx, fz) + 0.45 + rng() * 0.7;
    sprite.position.set(fx, fy, fz);
    sprite.scale.setScalar(0.14);
    group.add(sprite);
    fireflies.push({
      sprite,
      baseX: fx,
      baseY: fy,
      baseZ: fz,
      phase: rng() * Math.PI * 2,
      radius: 0.22 + rng() * 0.35,
    });
  }

  const update = (
    elapsed: number,
    windStrength: number,
    nightness: number,
    rainMix: number,
    reducedMotion: boolean
  ) => {
    // Wind sway on grass tufts (only when windStrength > 0.01)
    if (!reducedMotion) {
      const lean = windStrength * 0.28;
      for (let i = 0; i < grassSeeds.length; i++) {
        const s = grassSeeds[i];
        const gust =
          windStrength < 0.01
            ? 0
            : Math.sin(elapsed * (2.2 + windStrength * 2.5) + s.phase) *
              (0.04 + windStrength * 0.14);
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(0, s.rotY, -(lean + gust));
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        grassInst.setMatrixAt(i, dummy.matrix);
      }
      grassInst.instanceMatrix.needsUpdate = true;
    }

    // Night fireflies
    const fireflyVis = Math.max(0, (nightness - 0.25) / 0.75) * (1 - rainMix * 0.9);
    for (const f of fireflies) {
      const mat = f.sprite.material as THREE.SpriteMaterial;
      if (fireflyVis <= 0.02) {
        f.sprite.visible = false;
        continue;
      }
      f.sprite.visible = true;
      const move = reducedMotion ? 0 : 1;
      f.sprite.position.set(
        f.baseX + Math.sin(elapsed * 0.7 + f.phase) * f.radius * move,
        f.baseY + Math.sin(elapsed * 1.15 + f.phase * 1.7) * 0.14 * move,
        f.baseZ + Math.cos(elapsed * 0.65 + f.phase) * f.radius * move
      );
      const twinkle = 0.55 + 0.45 * Math.sin(elapsed * 2.4 + f.phase * 2.3);
      mat.opacity = fireflyVis * twinkle * 0.85;
    }
  };

  const dispose = () => {
    for (const d of disposables) d.dispose();
  };

  return {
    group,
    update,
    dispose,
  };
}
