import * as THREE from 'three';
import { createRng, fbm3D, lerp } from '../utils/math';
import { getProceduralTextures } from '../utils/textures';
import {
  getIslandSurfaceHeight,
  getNormalizedIslandRadius,
  isNearPath,
  isPointInWater,
  LANDMARKS,
  PATH_WAYPOINTS_MAIN,
  PATH_WAYPOINTS_MILL,
} from './terrainMath';

export interface PropsRig {
  group: THREE.Group;
  update: (elapsed: number, wind: number, rainAmount: number, reducedMotion: boolean) => void;
}

interface FlowerStem {
  group: THREE.Group;
  phase: number;
}

export function createProps(): PropsRig {
  const group = new THREE.Group();
  group.name = 'PropsGroup';
  const textures = getProceduralTextures();
  const rng = createRng(9183);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xa49c90,
    roughness: 0.88,
    flatShading: true,
  });

  const boulderMat = new THREE.MeshStandardMaterial({
    color: 0x8e867c,
    roughness: 0.9,
    flatShading: true,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x8d5f3e,
    roughness: 0.86,
  });

  // 1. Stepping-Stone Garden Paths (Cottage -> Pond Jetty & Fork -> Windmill)
  addSteppingStonePath(group, PATH_WAYPOINTS_MAIN, 9, stoneMat, rng);
  addSteppingStonePath(group, PATH_WAYPOINTS_MILL, 13, stoneMat, rng);

  // 2. Rustic Split-Rail Wooden Fences along Scenic Meadow Overlooks
  addSplitRailFence(
    group,
    [
      [3.78, 1.15],
      [3.38, 2.08],
      [2.68, 2.82],
      [1.82, 3.32],
    ],
    woodMat,
    rng
  );

  addSplitRailFence(
    group,
    [
      [-2.95, -0.35],
      [-3.18, 0.42],
      [-3.05, 1.18],
    ],
    woodMat,
    rng
  );

  // 3. Sculpted Mossy Rocks & Boulders
  addMeadowRocks(group, boulderMat, rng);

  // 4. Cozy Wooden Bench Overlooking the Pond + Cottage Firewood + Mill Flour Sacks
  addHandcraftedVignettes(group, woodMat, stoneMat);

  // 5. Restrained, Colorful Wildflower Patches
  const flowerStems = addWildflowerPatches(group, rng);

  return {
    group,
    update(elapsed, wind, rainAmount, reducedMotion) {
      stoneMat.roughness = lerp(0.88, 0.56, rainAmount);
      boulderMat.roughness = lerp(0.9, 0.6, rainAmount);

      const motion = reducedMotion ? 0.2 : 1.0;
      for (const f of flowerStems) {
        if (wind < 0.002) {
          f.group.rotation.x = 0;
          f.group.rotation.z = 0;
          continue;
        }
        const nod = Math.sin(elapsed * (2.8 + wind * 2.5) + f.phase) * 0.08 * wind * motion;
        const lean = wind * 0.16 + nod;
        f.group.rotation.z = -lean * 0.88;
        f.group.rotation.x = lean * 0.47;
      }
    },
  };
}

function addSteppingStonePath(
  parent: THREE.Group,
  waypoints: ReadonlyArray<readonly [number, number]>,
  stoneCount: number,
  mat: THREE.Material,
  rng: () => number
): void {
  const pts = waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts);

  for (let i = 0; i < stoneCount; i++) {
    const t = i / (stoneCount - 1);
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t);

    // Slight alternating left-right stepping cadence
    const perpX = -tangent.z;
    const perpZ = tangent.x;
    const sideOffset = (i % 2 === 0 ? 1 : -1) * 0.045 + (rng() - 0.5) * 0.03;

    const sx = p.x + perpX * sideOffset;
    const sz = p.z + perpZ * sideOffset;
    if (isPointInWater(sx, sz)) continue;

    const sy = getIslandSurfaceHeight(sx, sz);

    // Sample local slope so stones lie naturally flush on hillsides
    const eps = 0.12;
    const hx = (getIslandSurfaceHeight(sx + eps, sz) - getIslandSurfaceHeight(sx - eps, sz)) / (eps * 2);
    const hz = (getIslandSurfaceHeight(sx, sz + eps) - getIslandSurfaceHeight(sx, sz - eps)) / (eps * 2);

    const r = 0.13 + rng() * 0.045;
    const stoneGeo = new THREE.CylinderGeometry(r * 0.92, r * 1.05, 0.055, 7);
    stoneGeo.scale(1.15, 1.0, 0.88 + rng() * 0.24);

    const stone = new THREE.Mesh(stoneGeo, mat);
    stone.position.set(sx, sy + 0.012, sz);
    stone.rotation.set(Math.atan(hz), rng() * Math.PI, -Math.atan(hx));
    stone.receiveShadow = true;
    stone.castShadow = true;
    parent.add(stone);
  }
}

function addSplitRailFence(
  parent: THREE.Group,
  posts: ReadonlyArray<readonly [number, number]>,
  woodMat: THREE.Material,
  rng: () => number
): void {
  const postPositions: THREE.Vector3[] = [];

  for (const [px, pz] of posts) {
    const py = getIslandSurfaceHeight(px, pz);
    const postH = 0.38;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, postH, 6), woodMat);
    post.position.set(px, py + postH * 0.44, pz);
    post.rotation.set((rng() - 0.5) * 0.09, rng() * Math.PI, (rng() - 0.5) * 0.09);
    post.castShadow = true;
    post.receiveShadow = true;
    parent.add(post);

    postPositions.push(new THREE.Vector3(px, py, pz));
  }

  for (let i = 0; i < postPositions.length - 1; i++) {
    const a = postPositions[i];
    const b = postPositions[i + 1];
    const dist = a.distanceTo(b);

    for (const railH of [0.15, 0.28]) {
      const start = new THREE.Vector3(a.x, a.y + railH, a.z);
      const end = new THREE.Vector3(b.x, b.y + railH, b.z);
      const mid = start.clone().lerp(end, 0.5);

      const railGeo = new THREE.BoxGeometry(0.028, 0.034, dist + 0.05);
      const rail = new THREE.Mesh(railGeo, woodMat);
      rail.position.copy(mid);
      rail.lookAt(end);
      rail.castShadow = true;
      rail.receiveShadow = true;
      parent.add(rail);
    }
  }
}

function addMeadowRocks(
  parent: THREE.Group,
  boulderMat: THREE.Material,
  rng: () => number
): void {
  const mossCapMat = new THREE.MeshStandardMaterial({
    color: 0x629651,
    roughness: 0.9,
    flatShading: true,
  });

  const clusters: ReadonlyArray<{ x: number; z: number; r: number; mossy: boolean }> = [
    { x: -1.15, z: -2.05, r: 0.28, mossy: true },
    { x: -0.88, z: -2.18, r: 0.17, mossy: false },
    { x: 2.75, z: -1.35, r: 0.26, mossy: true },
    { x: 2.98, z: -1.18, r: 0.16, mossy: false },
    { x: -2.48, z: 2.42, r: 0.24, mossy: true },
    { x: -2.22, z: 2.62, r: 0.15, mossy: false },
    { x: 0.42, z: 2.65, r: 0.21, mossy: false },
    { x: -3.25, z: -1.52, r: 0.22, mossy: true },
  ];

  for (const c of clusters) {
    const y = getIslandSurfaceHeight(c.x, c.z);
    const geo = new THREE.DodecahedronGeometry(c.r, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const n = 0.84 + (fbm3D(vx * 4 + c.x, vy * 4, vz * 4 + c.z, 2) * 0.5 + 0.5) * 0.32;
      pos.setXYZ(i, vx * n * 1.15, vy * n * 0.76, vz * n);
    }
    geo.computeVertexNormals();

    const rock = new THREE.Mesh(geo, boulderMat);
    rock.position.set(c.x, y + c.r * 0.32, c.z);
    rock.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4);
    rock.castShadow = true;
    rock.receiveShadow = true;
    parent.add(rock);

    if (c.mossy) {
      const mossGeo = new THREE.SphereGeometry(c.r * 0.68, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.48);
      mossGeo.scale(1.15, 0.55, 1.0);
      const moss = new THREE.Mesh(mossGeo, mossCapMat);
      moss.position.set(c.x, y + c.r * 0.54, c.z);
      moss.receiveShadow = true;
      parent.add(moss);
    }
  }
}

function addHandcraftedVignettes(
  parent: THREE.Group,
  woodMat: THREE.Material,
  stoneMat: THREE.Material
): void {
  // 1. Cozy Wooden Bench facing the Pond
  const bx = 0.48;
  const bz = 1.68;
  const by = getIslandSurfaceHeight(bx, bz);
  const bench = new THREE.Group();
  bench.position.set(bx, by, bz);
  bench.rotation.y = -1.95; // Faces pond & cascade

  for (const lx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.18), stoneMat);
    leg.position.set(lx, 0.08, 0);
    leg.castShadow = true;
    bench.add(leg);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.032, 0.2), woodMat);
  seat.position.y = 0.17;
  seat.castShadow = true;
  seat.receiveShadow = true;
  bench.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.026), woodMat);
  backrest.position.set(0, 0.28, -0.085);
  backrest.rotation.x = -0.18;
  backrest.castShadow = true;
  bench.add(backrest);
  parent.add(bench);

  // 2. Stacked Firewood Logs tucked beside Cottage Annex
  const logGroup = new THREE.Group();
  const hx = LANDMARKS.house.x + 0.96;
  const hz = LANDMARKS.house.z + 0.62;
  logGroup.position.set(hx, getIslandSurfaceHeight(hx, hz), hz);
  logGroup.rotation.y = LANDMARKS.house.rotY;

  const logGeo = new THREE.CylinderGeometry(0.038, 0.04, 0.28, 7);
  logGeo.rotateZ(Math.PI * 0.5);
  const logOffsets = [
    [0, 0.038, -0.08],
    [0, 0.038, 0],
    [0, 0.038, 0.08],
    [0, 0.1, -0.04],
    [0, 0.1, 0.04],
    [0, 0.16, 0],
  ];
  for (const [ox, oy, oz] of logOffsets) {
    const log = new THREE.Mesh(logGeo, woodMat);
    log.position.set(ox, oy, oz);
    log.castShadow = true;
    logGroup.add(log);
  }
  parent.add(logGroup);

  // 3. Flour Sacks & Wooden Barrel beside Windmill Door
  const sackMat = new THREE.MeshStandardMaterial({
    color: 0xe6d7b8,
    roughness: 0.92,
  });
  const mx = LANDMARKS.windmill.x + 0.72;
  const mz = LANDMARKS.windmill.z + 0.36;
  const my = getIslandSurfaceHeight(mx, mz);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.088, 0.24, 10), woodMat);
  barrel.position.set(mx, my + 0.11, mz);
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  parent.add(barrel);

  for (const [sx, sz, rotZ] of [
    [mx - 0.18, mz + 0.09, 0.18],
    [mx - 0.08, mz + 0.17, -0.22],
  ] as const) {
    const sackGeo = new THREE.SphereGeometry(0.09, 8, 7);
    sackGeo.scale(1.0, 1.25, 0.82);
    const sack = new THREE.Mesh(sackGeo, sackMat);
    sack.position.set(sx, getIslandSurfaceHeight(sx, sz) + 0.09, sz);
    sack.rotation.z = rotZ;
    sack.castShadow = true;
    sack.receiveShadow = true;
    parent.add(sack);
  }
}

function addWildflowerPatches(parent: THREE.Group, rng: () => number): FlowerStem[] {
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x568e46, roughness: 0.88 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xf4c444, roughness: 0.75 });
  const petalPalette = [
    new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.7 }), // Daisy cream-white
    new THREE.MeshStandardMaterial({ color: 0xf6a692, roughness: 0.7 }), // Warm coral
    new THREE.MeshStandardMaterial({ color: 0xffd768, roughness: 0.7 }), // Buttercup yellow
    new THREE.MeshStandardMaterial({ color: 0xc5a8e8, roughness: 0.7 }), // Soft lavender
  ];

  const patchCenters: ReadonlyArray<readonly [number, number]> = [
    [1.82, 0.95],
    [0.18, 0.58],
    [-0.55, -0.82],
    [-2.55, 0.15],
    [1.15, 2.05],
    [2.65, -0.45],
    [-1.65, 2.65],
  ];

  const stems: FlowerStem[] = [];
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.011, 0.14, 5);
  stemGeo.translate(0, 0.07, 0);
  const headGeo = new THREE.DodecahedronGeometry(0.034, 0);
  headGeo.scale(1.25, 0.65, 1.25);
  const dotGeo = new THREE.SphereGeometry(0.016, 5, 5);

  for (let pIdx = 0; pIdx < patchCenters.length; pIdx++) {
    const [cx, cz] = patchCenters[pIdx];
    const count = 5 + Math.floor(rng() * 4);
    const mainMat = petalPalette[pIdx % petalPalette.length];

    for (let i = 0; i < count; i++) {
      const fx = cx + (rng() - 0.5) * 0.58;
      const fz = cz + (rng() - 0.5) * 0.58;
      if (getNormalizedIslandRadius(fx, fz) > 0.88) continue;
      if (isPointInWater(fx, fz) || isNearPath(fx, fz, 0.28)) continue;

      const fy = getIslandSurfaceHeight(fx, fz);
      const g = new THREE.Group();
      g.position.set(fx, fy - 0.01, fz);

      const sScale = 0.8 + rng() * 0.45;
      g.scale.setScalar(sScale);

      const stem = new THREE.Mesh(stemGeo, stemMat);
      g.add(stem);

      const pMat = rng() > 0.25 ? mainMat : petalPalette[(pIdx + 1) % petalPalette.length];
      const blossom = new THREE.Mesh(headGeo, pMat);
      blossom.position.y = 0.14;
      g.add(blossom);

      const dot = new THREE.Mesh(dotGeo, centerMat);
      dot.position.y = 0.155;
      g.add(dot);

      parent.add(g);
      stems.push({
        group: g,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  return stems;
}
