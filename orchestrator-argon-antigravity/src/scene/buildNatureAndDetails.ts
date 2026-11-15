import * as THREE from 'three';
import {
  POND_CENTER,
  POND_WATER_Y,
  getIslandSurfaceHeight,
} from '../state/worldState';
import { SceneMaterials, createSoftParticleTexture } from './materials';

export interface TreeInstance {
  group: THREE.Group;
  crownGroup: THREE.Group;
  baseRotX: number;
  baseRotZ: number;
  phase: number;
  flexibility: number;
}

export interface CloudInstance {
  group: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  speedMultiplier: number;
  phase: number;
  scale: number;
}

export interface SmokePuff {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  startX: number;
  startY: number;
  startZ: number;
  seed: number;
}

export interface NatureBuildResult {
  root: THREE.Group;
  trees: TreeInstance[];
  clouds: CloudInstance[];
  smokePuffs: SmokePuff[];
  nightStars: THREE.Points;
  starMaterial: THREE.PointsMaterial;
}

function createPineTree(
  x: number,
  z: number,
  scale: number,
  phase: number,
  materials: SceneMaterials,
  foliageMat: THREE.Material,
): TreeInstance {
  const group = new THREE.Group();
  const y = getIslandSurfaceHeight(x, z);
  group.position.set(x, y - 0.04, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065 * scale, 0.11 * scale, 0.65 * scale, 7),
    materials.woodDark,
  );
  trunk.position.y = 0.32 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crownGroup = new THREE.Group();
  crownGroup.position.y = 0.45 * scale;
  group.add(crownGroup);

  const tiers = [
    { r: 0.48, h: 0.68, y: 0.34 },
    { r: 0.38, h: 0.58, y: 0.68 },
    { r: 0.25, h: 0.46, y: 0.98 },
  ];
  for (const t of tiers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(t.r * scale, t.h * scale, 7),
      foliageMat,
    );
    cone.position.y = t.y * scale;
    cone.castShadow = true;
    cone.receiveShadow = true;
    crownGroup.add(cone);
  }

  return {
    group,
    crownGroup,
    baseRotX: 0,
    baseRotZ: 0,
    phase,
    flexibility: 0.9,
  };
}

function createOakTree(
  x: number,
  z: number,
  scale: number,
  phase: number,
  materials: SceneMaterials,
  foliageMat: THREE.Material,
): TreeInstance {
  const group = new THREE.Group();
  const y = getIslandSurfaceHeight(x, z);
  group.position.set(x, y - 0.04, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075 * scale, 0.13 * scale, 0.72 * scale, 7),
    materials.woodWarm,
  );
  trunk.position.y = 0.34 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crownGroup = new THREE.Group();
  crownGroup.position.y = 0.68 * scale;
  group.add(crownGroup);

  const blobGeo = new THREE.IcosahedronGeometry(0.36 * scale, 1);
  const puffs: Array<[number, number, number, number]> = [
    [0, 0.26, 0, 1.08],
    [-0.24, 0.1, 0.14, 0.82],
    [0.24, 0.12, -0.1, 0.85],
    [0.05, 0.14, -0.24, 0.78],
  ];
  for (const [px, py, pz, ps] of puffs) {
    const puff = new THREE.Mesh(blobGeo, foliageMat);
    puff.position.set(px * scale, py * scale, pz * scale);
    puff.scale.setScalar(ps);
    puff.castShadow = true;
    puff.receiveShadow = true;
    crownGroup.add(puff);
  }

  return {
    group,
    crownGroup,
    baseRotX: 0,
    baseRotZ: 0,
    phase,
    flexibility: 0.75,
  };
}

function createPondCypress(
  x: number,
  z: number,
  scale: number,
  phase: number,
  materials: SceneMaterials,
  foliageMat: THREE.Material,
): TreeInstance {
  const group = new THREE.Group();
  const y = getIslandSurfaceHeight(x, z);
  group.position.set(x, y - 0.04, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045 * scale, 0.08 * scale, 0.55 * scale, 6),
    materials.woodDark,
  );
  trunk.position.y = 0.27 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  const crownGroup = new THREE.Group();
  crownGroup.position.y = 0.44 * scale;
  group.add(crownGroup);

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.24 * scale, 1.15 * scale, 8),
    foliageMat,
  );
  body.position.y = 0.52 * scale;
  body.castShadow = true;
  body.receiveShadow = true;
  crownGroup.add(body);

  return {
    group,
    crownGroup,
    baseRotX: 0,
    baseRotZ: 0,
    phase,
    flexibility: 1.15,
  };
}

function buildClouds(materials: SceneMaterials): CloudInstance[] {
  const sphereGeo = new THREE.SphereGeometry(0.45, 14, 12);
  const cloudSpecs: Array<{
    pos: [number, number, number];
    scale: number;
    speed: number;
    phase: number;
  }> = [
    { pos: [-3.4, 4.4, -2.5], scale: 1.05, speed: 0.9, phase: 0.4 },
    { pos: [2.9, 4.8, -2.1], scale: 0.85, speed: 1.15, phase: 1.9 },
    { pos: [3.7, 4.1, 2.2], scale: 0.95, speed: 0.82, phase: 3.3 },
    { pos: [-2.7, 5.1, 2.8], scale: 0.78, speed: 1.25, phase: 4.8 },
    { pos: [0.3, 5.4, -3.7], scale: 1.12, speed: 0.72, phase: 5.7 },
  ];

  const puffOffsets: Array<[number, number, number, number]> = [
    [0, 0.06, 0, 1.0],
    [-0.46, -0.04, 0.08, 0.78],
    [0.48, -0.05, -0.06, 0.82],
    [0.14, 0.14, 0.24, 0.68],
    [-0.18, 0.12, -0.22, 0.64],
  ];

  return cloudSpecs.map((spec) => {
    const group = new THREE.Group();
    for (const [ox, oy, oz, os] of puffOffsets) {
      const puff = new THREE.Mesh(sphereGeo, materials.cloudMaterial);
      puff.position.set(ox, oy, oz);
      puff.scale.set(os * 1.15, os * 0.78, os * 0.95);
      puff.castShadow = false;
      puff.receiveShadow = true;
      group.add(puff);
    }
    group.position.set(...spec.pos);
    group.scale.setScalar(spec.scale);
    return {
      group,
      baseX: spec.pos[0],
      baseY: spec.pos[1],
      baseZ: spec.pos[2],
      speedMultiplier: spec.speed,
      phase: spec.phase,
      scale: spec.scale,
    };
  });
}

function buildSteppingStonePath(root: THREE.Group, materials: SceneMaterials): void {
  const stoneGeo = new THREE.CylinderGeometry(0.18, 0.21, 0.055, 7);
  // Path curving from cottage porch out toward pond dock & windmill path
  const points: Array<[number, number, number]> = [
    [0.24, 1.35, 1.0],
    [0.52, 1.66, 0.88],
    [0.86, 1.88, 0.95],
    [-0.55, 1.24, 0.86],
    [-1.12, 0.95, 0.92],
    [-1.68, 0.68, 0.86],
  ];
  points.forEach(([x, z, scale], idx) => {
    const y = getIslandSurfaceHeight(x, z) + 0.015;
    const stone = new THREE.Mesh(stoneGeo, materials.stoneGrey);
    stone.position.set(x, y, z);
    stone.scale.set(scale * 1.1, 1, scale * 0.85);
    stone.rotation.y = idx * 0.75;
    stone.receiveShadow = true;
    stone.castShadow = true;
    root.add(stone);
  });
}

function buildFenceSegment(
  p1: [number, number],
  p2: [number, number],
  materials: SceneMaterials,
): THREE.Group {
  const seg = new THREE.Group();
  const [x1, z1] = p1;
  const [x2, z2] = p2;
  const y1 = getIslandSurfaceHeight(x1, z1);
  const y2 = getIslandSurfaceHeight(x2, z2);
  const midX = (x1 + x2) / 2;
  const midZ = (z1 + z2) / 2;
  const midY = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const angle = Math.atan2(x2 - x1, z2 - z1);

  const postGeo = new THREE.BoxGeometry(0.055, 0.3, 0.055);
  const post1 = new THREE.Mesh(postGeo, materials.woodWarm);
  post1.position.set(x1, y1 + 0.13, z1);
  post1.castShadow = true;
  const post2 = new THREE.Mesh(postGeo, materials.woodWarm);
  post2.position.set(x2, y2 + 0.13, z2);
  post2.castShadow = true;
  seg.add(post1, post2);

  const railGeo = new THREE.BoxGeometry(0.032, 0.035, len);
  const topRail = new THREE.Mesh(railGeo, materials.woodWarm);
  topRail.position.set(midX, midY + 0.22, midZ);
  topRail.rotation.y = angle;
  topRail.castShadow = true;
  const lowRail = new THREE.Mesh(railGeo, materials.woodWarm);
  lowRail.position.set(midX, midY + 0.11, midZ);
  lowRail.rotation.y = angle;
  lowRail.castShadow = true;
  seg.add(topRail, lowRail);

  return seg;
}

function buildPondDock(root: THREE.Group, materials: SceneMaterials): void {
  const dock = new THREE.Group();
  const edgeAngle = 2.65;
  const startR = POND_CENTER.radius * 0.92;
  const dx = POND_CENTER.x + Math.cos(edgeAngle) * startR;
  const dz = POND_CENTER.z + Math.sin(edgeAngle) * startR;
  dock.position.set(dx, POND_WATER_Y + 0.07, dz);
  dock.rotation.y = -edgeAngle + Math.PI / 2;

  const plankGeo = new THREE.BoxGeometry(0.46, 0.035, 0.12);
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(plankGeo, materials.woodWarm);
    plank.position.set(0, 0, -i * 0.14);
    plank.castShadow = true;
    plank.receiveShadow = true;
    dock.add(plank);
  }

  const postGeo = new THREE.CylinderGeometry(0.03, 0.032, 0.34, 7);
  const postOffsets: Array<[number, number]> = [
    [-0.2, -0.04],
    [0.2, -0.04],
    [-0.2, -0.4],
    [0.2, -0.4],
  ];
  for (const [px, pz] of postOffsets) {
    const post = new THREE.Mesh(postGeo, materials.woodDark);
    post.position.set(px, -0.04, pz);
    post.castShadow = true;
    dock.add(post);
  }

  root.add(dock);
}

function buildFlowersAndRocks(root: THREE.Group, materials: SceneMaterials): void {
  // Larger sculptural garden rocks
  const rockGeo = new THREE.DodecahedronGeometry(0.28, 0);
  const rockPlacements: Array<{ pos: [number, number]; scale: [number, number, number]; rot: number; light?: boolean }> = [
    { pos: [-2.8, 1.5], scale: [1.3, 0.85, 1.05], rot: 0.4 },
    { pos: [-2.45, 1.82], scale: [0.75, 0.6, 0.72], rot: 1.2, light: true },
    { pos: [1.25, -2.55], scale: [1.1, 0.75, 0.9], rot: 2.1 },
    { pos: [3.2, -0.4], scale: [0.9, 0.65, 0.85], rot: 0.9, light: true },
  ];
  for (const r of rockPlacements) {
    const y = getIslandSurfaceHeight(r.pos[0], r.pos[1]) + 0.06;
    const mesh = new THREE.Mesh(rockGeo, r.light ? materials.rockLight : materials.stoneGrey);
    mesh.position.set(r.pos[0], y, r.pos[1]);
    mesh.scale.set(...r.scale);
    mesh.rotation.y = r.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // Restrained flower clusters near cottage, fence, and pond
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.14, 5);
  const bloomGeo = new THREE.DodecahedronGeometry(0.055, 0);
  const clusters: Array<[number, number, number]> = [
    [0.65, 0.62, 0],
    [0.78, 0.45, 1],
    [-1.12, 1.48, 2],
    [-0.95, 1.62, 1],
    [0.15, -1.35, 0],
    [0.35, -1.46, 2],
    [2.65, 2.15, 1],
    [2.82, 1.98, 0],
    [-2.55, -0.95, 2],
    [-1.65, -1.85, 1],
  ];

  clusters.forEach(([cx, cz, matIdx], i) => {
    const baseY = getIslandSurfaceHeight(cx, cz);
    const flower = new THREE.Group();
    flower.position.set(cx, baseY, cz);

    const stem = new THREE.Mesh(stemGeo, materials.foliageMaterials[0]);
    stem.position.y = 0.06;
    const bloom = new THREE.Mesh(
      bloomGeo,
      materials.flowerMaterials[matIdx % materials.flowerMaterials.length],
    );
    bloom.position.y = 0.14;
    bloom.rotation.y = i * 0.8;
    flower.add(stem, bloom);
    root.add(flower);
  });
}

function buildNightStars(root: THREE.Group): {
  nightStars: THREE.Points;
  starMaterial: THREE.PointsMaterial;
} {
  const count = 90;
  const positions = new Float32Array(count * 3);
  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = rand() * Math.PI * 0.48;
    const radius = 22 + rand() * 8;
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius * 0.75 + 1.5;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const tex = createSoftParticleTexture();
  const starMaterial = new THREE.PointsMaterial({
    color: 0xf7f2d8,
    size: 0.38,
    map: tex ?? undefined,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const nightStars = new THREE.Points(geo, starMaterial);
  root.add(nightStars);
  return { nightStars, starMaterial };
}

export function buildNatureAndDetails(
  materials: SceneMaterials,
  chimneyOrigin: THREE.Vector3,
): NatureBuildResult {
  const root = new THREE.Group();
  root.name = 'NatureAndDetails';

  // 1. Trees with varied silhouettes and balanced placement around focal points
  const trees: TreeInstance[] = [
    createPineTree(-3.1, -1.65, 1.12, 0.2, materials, materials.foliageMaterials[1]),
    createPineTree(-1.35, -2.55, 0.92, 1.4, materials, materials.foliageMaterials[0]),
    createOakTree(-1.55, 2.25, 1.08, 2.2, materials, materials.foliageMaterials[2]),
    createOakTree(1.25, -1.75, 1.18, 3.1, materials, materials.foliageMaterials[0]),
    createPineTree(2.35, -2.15, 0.88, 4.0, materials, materials.foliageMaterials[1]),
    createOakTree(3.15, 0.25, 0.95, 5.1, materials, materials.foliageMaterials[2]),
    createPondCypress(2.92, 1.68, 0.96, 2.7, materials, materials.foliageMaterials[1]),
    createPondCypress(0.28, 2.55, 0.82, 0.9, materials, materials.foliageMaterials[0]),
  ];

  for (const tree of trees) {
    root.add(tree.group);
  }

  // 2. Path, dock, fences, boulders, flowers
  buildSteppingStonePath(root, materials);
  buildPondDock(root, materials);
  buildFlowersAndRocks(root, materials);

  // Garden fence segments along the cottage flank
  const fencePts: Array<[number, number]> = [
    [-1.45, 1.55],
    [-0.9, 1.98],
    [-0.3, 2.24],
    [0.85, -0.58],
    [1.45, -0.95],
  ];
  root.add(buildFenceSegment(fencePts[0], fencePts[1], materials));
  root.add(buildFenceSegment(fencePts[1], fencePts[2], materials));
  root.add(buildFenceSegment(fencePts[3], fencePts[4], materials));

  // 3. Clouds
  const clouds = buildClouds(materials);
  for (const cloud of clouds) {
    root.add(cloud.group);
  }

  // 4. Pooled chimney smoke puffs
  const puffGeo = new THREE.SphereGeometry(0.11, 8, 8);
  const smokePuffs: SmokePuff[] = [];
  const puffCount = 10;
  for (let i = 0; i < puffCount; i++) {
    const mesh = new THREE.Mesh(puffGeo, materials.smokeMaterial);
    mesh.position.copy(chimneyOrigin);
    root.add(mesh);
    smokePuffs.push({
      mesh,
      age: (i / puffCount) * 3.2,
      maxAge: 3.2,
      startX: chimneyOrigin.x,
      startY: chimneyOrigin.y,
      startZ: chimneyOrigin.z,
      seed: i * 1.37,
    });
  }

  // 5. Night starfield
  const { nightStars, starMaterial } = buildNightStars(root);

  return {
    root,
    trees,
    clouds,
    smokePuffs,
    nightStars,
    starMaterial,
  };
}
