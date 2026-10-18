import * as THREE from 'three';
import { createNoiseTexture } from '../utils/textures';

export const POND_CENTER = new THREE.Vector2(1.05, 1.45);
export const POND_RADIUS = 1.55;
export const POND_WATER_Y = 0.14;

export const HOUSE_POS = new THREE.Vector3(-1.35, 0.30, -0.75);
export const WINDMILL_POS = new THREE.Vector3(2.25, 0.58, -1.85);

/**
 * Returns the outer radius of the floating island at a given horizontal angle (radians).
 * Produces an organic, handmade irregular silhouette rather than a perfect circle.
 */
export function getIslandRadiusAtAngle(theta: number): number {
  return (
    5.55 +
    0.38 * Math.sin(theta * 2.0 + 0.4) +
    0.26 * Math.cos(theta * 3.0 - 0.8) +
    0.18 * Math.sin(theta * 5.0 + 1.7) +
    0.1 * Math.cos(theta * 7.0)
  );
}

/**
 * Returns true if the world (x, z) point lies within the floating island's horizontal silhouette.
 */
export function isInsideIsland(x: number, z: number, margin = 0): boolean {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  return r <= getIslandRadiusAtAngle(theta) + margin;
}

/**
 * Deterministic terrain height function for any (x, z) point on the island top surface.
 * Used for both vertex sculpting and exact object/rain placement.
 */
export function getIslandSurfaceHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const maxR = getIslandRadiusAtAngle(theta);

  // Gentle rolling base undulation
  let h =
    0.26 +
    0.07 * Math.sin(x * 0.55) * Math.cos(z * 0.55) +
    0.04 * Math.cos(x * 0.9 - z * 0.7);

  // Flatten terrace around the house
  const distHouse = Math.hypot(x - HOUSE_POS.x, z - HOUSE_POS.z);
  const houseBlend = Math.max(0, 1 - distHouse / 2.2);
  if (houseBlend > 0) {
    const smooth = houseBlend * houseBlend * (3 - 2 * houseBlend);
    h = THREE.MathUtils.lerp(h, HOUSE_POS.y, smooth * 0.85);
  }

  // Raised knoll for the windmill in the northeast
  const distMill = Math.hypot(x - WINDMILL_POS.x, z - WINDMILL_POS.z);
  if (distMill < 2.5) {
    const t = 1 - distMill / 2.5;
    const smooth = t * t * (3 - 2 * t);
    h += smooth * 0.36;
  }

  // Carved basin for the pond in the southeast so water & shoreline are recessed
  const distPond = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.y);
  if (distPond < POND_RADIUS + 0.42) {
    const norm = distPond / (POND_RADIUS + 0.42);
    const bowl = Math.cos(Math.min(1, norm) * Math.PI * 0.5);
    h -= bowl * bowl * 0.56;
  }

  // Taper slightly near the outer grassy lip
  const edgeRatio = r / maxR;
  if (edgeRatio > 0.82) {
    const t = Math.min(1, (edgeRatio - 0.82) / 0.18);
    h -= t * t * 0.18;
  }

  return h;
}

export interface IslandComponents {
  root: THREE.Group;
  waterMesh: THREE.Mesh;
  waterMaterial: THREE.MeshStandardMaterial;
  floatingIslets: Array<{
    mesh: THREE.Group;
    baseY: number;
    speed: number;
    phase: number;
  }>;
}

export function createIsland(): IslandComponents {
  const root = new THREE.Group();
  root.name = 'IslandRoot';

  const grassTexture = createNoiseTexture('#76b05e', '#5d9449', 128, 3);
  grassTexture.repeat.set(4, 4);

  const rockTexture = createNoiseTexture('#8c7b6b', '#6e5f52', 128, 4);
  rockTexture.repeat.set(3, 3);

  // 1. Sculpted Grassy Top Cap
  const grassGeo = createSculptedGrassTopGeometry();
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x7cb863,
    map: grassTexture,
    roughness: 0.84,
    metalness: 0.02,
    flatShading: true,
  });
  const grassMesh = new THREE.Mesh(grassGeo, grassMat);
  grassMesh.castShadow = true;
  grassMesh.receiveShadow = true;
  root.add(grassMesh);

  // 2. Sculpted Rocky Underside & Cliff Buttresses
  const rockGroup = createSculptedRockyUnderside();
  root.add(rockGroup);

  // 3. Pond Shoreline Basin, Water Surface, Dock, and Lily Pads
  const { pondGroup, waterMesh, waterMaterial } = createPondAndShoreline();
  root.add(pondGroup);

  // 4. Winding Stepping-Stone Path
  const pathGroup = createSteppingStonePath();
  root.add(pathGroup);

  // 5. Decorative Surface Boulders & Cliff Rocks
  const bouldersGroup = createSurfaceRocks();
  root.add(bouldersGroup);

  // 6. Floating Satellite Mini-Islets
  const floatingIslets = createFloatingIslets(grassMat, rockTexture);
  for (const islet of floatingIslets) {
    root.add(islet.mesh);
  }

  return {
    root,
    waterMesh,
    waterMaterial,
    floatingIslets,
  };
}

function createSculptedGrassTopGeometry(): THREE.BufferGeometry {
  const radialSteps = 26;
  const angularSteps = 64;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Center vertex (index 0)
  const centerH = getIslandSurfaceHeight(0, 0);
  positions.push(0, centerH, 0);
  uvs.push(0.5, 0.5);

  // Rings 1 .. radialSteps on top surface
  for (let rIdx = 1; rIdx <= radialSteps; rIdx++) {
    const frac = rIdx / radialSteps;
    for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
      const theta = (aIdx / angularSteps) * Math.PI * 2;
      const maxR = getIslandRadiusAtAngle(theta);
      const rad = frac * maxR;
      const x = Math.cos(theta) * rad;
      const z = Math.sin(theta) * rad;
      const y = getIslandSurfaceHeight(x, z);

      positions.push(x, y, z);
      uvs.push(0.5 + x / 12, 0.5 + z / 12);
    }
  }

  // Add 2 extra skirt rings to form a thick rounded grassy overhang lip
  const skirtRings = [
    { rScale: 1.018, yDrop: 0.14 },
    { rScale: 0.96, yDrop: 0.36 },
  ];

  for (const skirt of skirtRings) {
    for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
      const theta = (aIdx / angularSteps) * Math.PI * 2;
      const maxR = getIslandRadiusAtAngle(theta) * skirt.rScale;
      const x = Math.cos(theta) * maxR;
      const z = Math.sin(theta) * maxR;
      const edgeY = getIslandSurfaceHeight(
        Math.cos(theta) * getIslandRadiusAtAngle(theta),
        Math.sin(theta) * getIslandRadiusAtAngle(theta)
      );
      const y = edgeY - skirt.yDrop + 0.03 * Math.sin(theta * 9);
      positions.push(x, y, z);
      uvs.push(0.5 + x / 12, 0.5 + z / 12);
    }
  }

  // Triangles for center fan (ring 1)
  for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
    const nextA = (aIdx + 1) % angularSteps;
    indices.push(0, 1 + nextA, 1 + aIdx);
  }

  // Triangles between concentric rings (including skirt rings)
  const totalRings = radialSteps + skirtRings.length;
  for (let rIdx = 1; rIdx < totalRings; rIdx++) {
    const ringStart = 1 + (rIdx - 1) * angularSteps;
    const nextRingStart = 1 + rIdx * angularSteps;
    for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
      const nextA = (aIdx + 1) % angularSteps;
      const a = ringStart + aIdx;
      const b = ringStart + nextA;
      const c = nextRingStart + aIdx;
      const d = nextRingStart + nextA;

      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createSculptedRockyUnderside(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RockyUnderside';

  const angularSteps = 44;
  const verticalLevels = [
    { y: 0.02, rFactor: 0.96, jitter: 0.08 },
    { y: -0.48, rFactor: 0.92, jitter: 0.24 },
    { y: -1.12, rFactor: 0.80, jitter: 0.32 },
    { y: -1.85, rFactor: 0.62, jitter: 0.34 },
    { y: -2.55, rFactor: 0.44, jitter: 0.28 },
    { y: -3.25, rFactor: 0.25, jitter: 0.20 },
    { y: -3.82, rFactor: 0.10, jitter: 0.09 },
  ];

  const positions: number[] = [];
  const indices: number[] = [];

  for (let lvlIdx = 0; lvlIdx < verticalLevels.length; lvlIdx++) {
    const lvl = verticalLevels[lvlIdx];
    for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
      const theta = (aIdx / angularSteps) * Math.PI * 2;
      const baseR = getIslandRadiusAtAngle(theta) * lvl.rFactor;

      // Craggy faceted rock displacement
      const crag =
        Math.sin(theta * 6 + lvlIdx * 1.4) * lvl.jitter +
        Math.cos(theta * 11 - lvlIdx * 2.1) * (lvl.jitter * 0.6);

      const r = Math.max(0.12, baseR + crag);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y =
        lvl.y +
        (lvlIdx > 0 ? Math.sin(theta * 5 + lvlIdx) * 0.14 : 0);

      positions.push(x, y, z);
    }
  }

  // Bottom apex point
  const bottomVertexIndex = verticalLevels.length * angularSteps;
  positions.push(0.08, -4.35, -0.06);

  // Connect rings with outward-facing normals
  for (let lvlIdx = 0; lvlIdx < verticalLevels.length - 1; lvlIdx++) {
    const rowStart = lvlIdx * angularSteps;
    const nextRowStart = (lvlIdx + 1) * angularSteps;
    for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
      const nextA = (aIdx + 1) % angularSteps;
      const a = rowStart + aIdx;
      const b = rowStart + nextA;
      const c = nextRowStart + aIdx;
      const d = nextRowStart + nextA;

      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  // Connect last ring to bottom apex with outward-facing normals
  const lastRingStart = (verticalLevels.length - 1) * angularSteps;
  for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
    const nextA = (aIdx + 1) % angularSteps;
    indices.push(lastRingStart + aIdx, lastRingStart + nextA, bottomVertexIndex);
  }

  const indexedRockGeo = new THREE.BufferGeometry();
  indexedRockGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexedRockGeo.setIndex(indices);
  const rockGeo = indexedRockGeo.toNonIndexed();
  rockGeo.computeVertexNormals();

  const mainRockMat = new THREE.MeshStandardMaterial({
    color: 0x9e8b78,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const darkRockMat = new THREE.MeshStandardMaterial({
    color: 0x736457,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  });

  const warmEarthMat = new THREE.MeshStandardMaterial({
    color: 0xa1866c,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  });

  const mainUnderside = new THREE.Mesh(rockGeo, mainRockMat);
  mainUnderside.castShadow = true;
  mainUnderside.receiveShadow = true;
  group.add(mainUnderside);

  // Sculpted cliff buttresses & stepped strata shelves around the underside
  const buttressSpecs = [
    { angle: 0.35, y: -0.95, rScale: 0.86, sx: 1.4, sy: 1.25, sz: 1.1, mat: warmEarthMat },
    { angle: 1.15, y: -1.1, rScale: 0.82, sx: 1.55, sy: 1.4, sz: 1.2, mat: darkRockMat },
    { angle: 2.05, y: -0.85, rScale: 0.88, sx: 1.3, sy: 1.15, sz: 1.3, mat: mainRockMat },
    { angle: 2.85, y: -1.3, rScale: 0.76, sx: 1.45, sy: 1.5, sz: 1.1, mat: warmEarthMat },
    { angle: 3.75, y: -1.0, rScale: 0.84, sx: 1.65, sy: 1.3, sz: 1.25, mat: darkRockMat },
    { angle: 4.65, y: -1.25, rScale: 0.78, sx: 1.4, sy: 1.45, sz: 1.15, mat: mainRockMat },
    { angle: 5.5, y: -0.9, rScale: 0.86, sx: 1.35, sy: 1.2, sz: 1.2, mat: warmEarthMat },
  ];

  const dodecaGeo = new THREE.DodecahedronGeometry(0.82, 0);
  for (const spec of buttressSpecs) {
    const rad = getIslandRadiusAtAngle(spec.angle) * spec.rScale;
    const mesh = new THREE.Mesh(dodecaGeo, spec.mat);
    mesh.position.set(
      Math.cos(spec.angle) * rad,
      spec.y,
      Math.sin(spec.angle) * rad
    );
    mesh.scale.set(spec.sx, spec.sy, spec.sz);
    mesh.rotation.set(spec.angle * 0.7, spec.angle, 0.3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Hanging stalactite spires beneath the island for a dramatic floating silhouette
  const spireGeo = new THREE.ConeGeometry(0.42, 1.45, 5);
  spireGeo.rotateX(Math.PI); // Point downward
  const spireOffsets = [
    { x: -1.4, y: -2.85, z: 0.9, s: 1.0 },
    { x: 1.5, y: -2.65, z: -0.7, s: 1.15 },
    { x: -0.5, y: -3.25, z: -1.2, s: 0.9 },
    { x: 0.7, y: -3.1, z: 1.1, s: 0.85 },
  ];
  for (const sp of spireOffsets) {
    const spire = new THREE.Mesh(spireGeo, darkRockMat);
    spire.position.set(sp.x, sp.y, sp.z);
    spire.scale.setScalar(sp.s);
    spire.castShadow = true;
    group.add(spire);
  }

  return group;
}

function createPondAndShoreline(): {
  pondGroup: THREE.Group;
  waterMesh: THREE.Mesh;
  waterMaterial: THREE.MeshStandardMaterial;
} {
  const pondGroup = new THREE.Group();
  pondGroup.name = 'PondAndShore';

  // Warm sandy shoreline ring framing the water
  const shoreRingGeo = new THREE.RingGeometry(
    POND_RADIUS - 0.35,
    POND_RADIUS + 0.22,
    36
  );
  shoreRingGeo.rotateX(-Math.PI / 2);
  const shoreMat = new THREE.MeshStandardMaterial({
    color: 0xdcc59e,
    roughness: 0.9,
    metalness: 0.0,
  });
  const shoreRing = new THREE.Mesh(shoreRingGeo, shoreMat);
  shoreRing.position.set(POND_CENTER.x, POND_WATER_Y - 0.008, POND_CENTER.y);
  shoreRing.receiveShadow = true;
  pondGroup.add(shoreRing);

  // Deeper pond bed in muted teal-blue so semi-transparent water has rich aquatic depth
  const bedGeo = new THREE.CircleGeometry(POND_RADIUS - 0.08, 36);
  bedGeo.rotateX(-Math.PI / 2);
  const bedMat = new THREE.MeshStandardMaterial({
    color: 0x2c6b82,
    roughness: 0.85,
  });
  const bedMesh = new THREE.Mesh(bedGeo, bedMat);
  bedMesh.position.set(POND_CENTER.x, POND_WATER_Y - 0.03, POND_CENTER.y);
  bedMesh.receiveShadow = true;
  pondGroup.add(bedMesh);

  // Calm stylized water surface sitting clearly above the pond bed
  const waterGeo = new THREE.CircleGeometry(POND_RADIUS - 0.04, 36);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x4ea3c7,
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: 0.9,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
  waterMesh.position.set(POND_CENTER.x, POND_WATER_Y, POND_CENTER.y);
  waterMesh.receiveShadow = true;
  pondGroup.add(waterMesh);

  // Miniature wooden dock on the northwest edge of the pond
  const dockGroup = new THREE.Group();
  dockGroup.position.set(POND_CENTER.x - 1.15, POND_WATER_Y + 0.08, POND_CENTER.y - 0.45);
  dockGroup.rotation.y = Math.PI * 0.2;

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x9c6b43,
    roughness: 0.82,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x6e472b,
    roughness: 0.88,
  });

  // Dock support posts
  const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8);
  const postOffsets = [
    [-0.22, -0.1, -0.35],
    [0.22, -0.1, -0.35],
    [-0.22, -0.1, 0.35],
    [0.22, -0.1, 0.35],
  ];
  for (const [px, py, pz] of postOffsets) {
    const post = new THREE.Mesh(postGeo, darkWoodMat);
    post.position.set(px, py, pz);
    post.castShadow = true;
    dockGroup.add(post);
  }

  // Dock planks
  const plankGeo = new THREE.BoxGeometry(0.52, 0.04, 0.11);
  for (let i = 0; i < 6; i++) {
    const plank = new THREE.Mesh(plankGeo, woodMat);
    plank.position.set(0, 0.03, -0.35 + i * 0.14);
    plank.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.015;
    plank.castShadow = true;
    plank.receiveShadow = true;
    dockGroup.add(plank);
  }
  pondGroup.add(dockGroup);

  // Lily pads & lotus flower on the pond
  const lilyMat = new THREE.MeshStandardMaterial({
    color: 0x5c9c49,
    roughness: 0.75,
    flatShading: true,
  });
  const lilyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.015, 12, 1, false, 0, Math.PI * 1.82);
  const lilySpecs = [
    { x: POND_CENTER.x + 0.45, z: POND_CENTER.y + 0.35, s: 1.1, rot: 0.8, flower: true },
    { x: POND_CENTER.x + 0.72, z: POND_CENTER.y + 0.12, s: 0.85, rot: 2.4, flower: false },
    { x: POND_CENTER.x - 0.25, z: POND_CENTER.y + 0.65, s: 0.95, rot: 4.1, flower: true },
    { x: POND_CENTER.x + 0.18, z: POND_CENTER.y - 0.55, s: 0.78, rot: 1.5, flower: false },
  ];

  const lotusMat = new THREE.MeshStandardMaterial({
    color: 0xf7b2c4,
    roughness: 0.6,
    flatShading: true,
  });
  const lotusGeo = new THREE.OctahedronGeometry(0.065, 0);

  for (const sp of lilySpecs) {
    const pad = new THREE.Mesh(lilyGeo, lilyMat);
    pad.position.set(sp.x, POND_WATER_Y + 0.012, sp.z);
    pad.scale.setScalar(sp.s);
    pad.rotation.y = sp.rot;
    pad.receiveShadow = true;
    pondGroup.add(pad);

    if (sp.flower) {
      const blossom = new THREE.Mesh(lotusGeo, lotusMat);
      blossom.position.set(sp.x, POND_WATER_Y + 0.052, sp.z);
      blossom.scale.set(1, 0.75, 1);
      blossom.castShadow = true;
      pondGroup.add(blossom);
    }
  }

  // Shoreline pebbles around the pond perimeter
  const pebbleGeo = new THREE.DodecahedronGeometry(0.12, 0);
  const pebbleMat1 = new THREE.MeshStandardMaterial({
    color: 0x9c9286,
    roughness: 0.88,
    flatShading: true,
  });
  const pebbleMat2 = new THREE.MeshStandardMaterial({
    color: 0xb5a895,
    roughness: 0.85,
    flatShading: true,
  });

  const pebbleCount = 22;
  for (let i = 0; i < pebbleCount; i++) {
    const angle = (i / pebbleCount) * Math.PI * 2 + 0.15;
    if (angle > 3.4 && angle < 4.2) continue;

    const r = POND_RADIUS + 0.04 + (i % 3) * 0.09;
    const px = POND_CENTER.x + Math.cos(angle) * r;
    const pz = POND_CENTER.y + Math.sin(angle) * r;
    const py = Math.max(POND_WATER_Y - 0.02, getIslandSurfaceHeight(px, pz));

    const pebble = new THREE.Mesh(
      pebbleGeo,
      i % 2 === 0 ? pebbleMat1 : pebbleMat2
    );
    const s = 0.65 + (i % 4) * 0.28;
    pebble.position.set(px, py + 0.01, pz);
    pebble.scale.set(s * 1.2, s * 0.65, s);
    pebble.rotation.set(i * 0.5, angle, i * 0.3);
    pebble.castShadow = true;
    pebble.receiveShadow = true;
    pondGroup.add(pebble);
  }

  return { pondGroup, waterMesh, waterMaterial };
}

function createSteppingStonePath(): THREE.Group {
  const pathGroup = new THREE.Group();
  pathGroup.name = 'SteppingStonePath';

  const stoneGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.06, 7);
  const stoneMatWarm = new THREE.MeshStandardMaterial({
    color: 0xc8b9a6,
    roughness: 0.88,
    flatShading: true,
  });
  const stoneMatGray = new THREE.MeshStandardMaterial({
    color: 0xb2a696,
    roughness: 0.9,
    flatShading: true,
  });

  const waypoints: Array<[number, number, number, number]> = [
    [-0.85, 0.22, 1.15, 0.9],
    [-0.68, 0.58, 0.95, 0.85],
    [-0.52, 0.92, 1.05, 0.9],
    [-0.72, 1.28, 0.9, 0.85],
    [-0.95, 1.62, 1.0, 0.85],
    [-0.38, 0.05, 0.9, 0.8],
    [0.05, -0.18, 1.0, 0.85],
    [0.48, -0.45, 0.88, 0.78],
    [0.92, -0.76, 0.95, 0.82],
    [1.34, -1.08, 0.9, 0.8],
    [1.72, -1.36, 1.0, 0.85],
  ];

  waypoints.forEach(([x, z, sx, sz], idx) => {
    const y = getIslandSurfaceHeight(x, z);
    const stone = new THREE.Mesh(
      stoneGeo,
      idx % 2 === 0 ? stoneMatWarm : stoneMatGray
    );
    stone.position.set(x, y + 0.015, z);
    stone.scale.set(sx, 1, sz);
    stone.rotation.y = idx * 1.1;
    stone.receiveShadow = true;
    stone.castShadow = true;
    pathGroup.add(stone);
  });

  return pathGroup;
}

function createSurfaceRocks(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SurfaceRocks';

  const rockGeo = new THREE.DodecahedronGeometry(0.35, 0);
  const rockMatLight = new THREE.MeshStandardMaterial({
    color: 0x968b7e,
    roughness: 0.9,
    flatShading: true,
  });
  const rockMatDark = new THREE.MeshStandardMaterial({
    color: 0x786e63,
    roughness: 0.92,
    flatShading: true,
  });

  const clusters = [
    { x: -3.85, z: -2.75, sx: 1.4, sy: 0.95, sz: 1.2, dark: false },
    { x: -3.45, z: -3.15, sx: 0.85, sy: 0.65, sz: 0.9, dark: true },
    { x: 3.45, z: -2.25, sx: 1.25, sy: 0.85, sz: 1.1, dark: false },
    { x: 3.75, z: -1.85, sx: 0.75, sy: 0.6, sz: 0.8, dark: true },
    { x: 0.35, z: 3.65, sx: 1.1, sy: 0.7, sz: 0.95, dark: false },
    { x: -0.05, z: 3.85, sx: 0.7, sy: 0.5, sz: 0.65, dark: true },
    { x: -4.25, z: 0.85, sx: 1.05, sy: 0.75, sz: 0.9, dark: true },
  ];

  clusters.forEach((c, i) => {
    const y = getIslandSurfaceHeight(c.x, c.z);
    const mesh = new THREE.Mesh(rockGeo, c.dark ? rockMatDark : rockMatLight);
    mesh.position.set(c.x, y + c.sy * 0.15, c.z);
    mesh.scale.set(c.sx, c.sy, c.sz);
    mesh.rotation.set(i * 0.4, i * 1.3, i * 0.25);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}

function createFloatingIslets(
  grassMat: THREE.MeshStandardMaterial,
  rockTexture: THREE.CanvasTexture
): IslandComponents['floatingIslets'] {
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x857567,
    map: rockTexture,
    roughness: 0.92,
    flatShading: true,
  });

  const specs = [
    { x: -6.2, y: -1.05, z: 1.5, scale: 0.78, speed: 1.3, phase: 0.0 },
    { x: 6.0, y: -1.55, z: -1.6, scale: 0.62, speed: 1.6, phase: 2.1 },
  ];

  return specs.map((sp) => {
    const isletGroup = new THREE.Group();
    isletGroup.position.set(sp.x, sp.y, sp.z);

    const topGeo = new THREE.CylinderGeometry(0.85 * sp.scale, 0.78 * sp.scale, 0.22 * sp.scale, 9);
    const topMesh = new THREE.Mesh(topGeo, grassMat);
    topMesh.position.y = 0.08 * sp.scale;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    isletGroup.add(topMesh);

    const botGeo = new THREE.ConeGeometry(0.8 * sp.scale, 1.35 * sp.scale, 7);
    botGeo.rotateX(Math.PI);
    const botMesh = new THREE.Mesh(botGeo, rockMat);
    botMesh.position.y = -0.68 * sp.scale;
    botMesh.castShadow = true;
    botMesh.receiveShadow = true;
    isletGroup.add(botMesh);

    return {
      mesh: isletGroup,
      baseY: sp.y,
      speed: sp.speed,
      phase: sp.phase,
    };
  });
}
