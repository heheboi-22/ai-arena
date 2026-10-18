import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { terrainHeight } from './terrain';
import { PALETTE, type SharedMaterials } from './materials';
import { FENCE, PATH, isClear } from './layout';
import { createRng } from '../util/math';

const ROCK_SITES: [number, number][] = [
  [-1.1, 3.4],
  [3.9, 3.6],
  [-4.2, -3.9],
  [2.6, -4.2],
  [4.9, -0.9],
  [-2.2, -3.6],
  [0.4, -1.8],
  [-3.4, 4.2],
];

const SHRUB_SITES: [number, number][] = [
  [-2.25, 0.85],
  [0.6, 0.55],
  [-1.7, 1.9],
  [-0.8, -2.2],
  [2.8, -0.9],
  [1.5, -1.6],
  [-3.4, 1.9],
  [3.2, 3.4],
  [-2.1, -0.7],
];

const FLOWER_CENTRES: [number, number, number][] = [
  [-1.2, 1.9, 0.5],
  [3.2, -0.6, 0.6],
  [-0.2, -3.2, 0.7],
  [2.7, 3.6, 0.5],
  [-3.1, 2.2, 0.5],
  [0.9, 2.8, 0.4],
];

function groundAt(x: number, z: number): number {
  return terrainHeight(x, z);
}

function buildRocks(mats: SharedMaterials): InstancedMesh | null {
  const sites = ROCK_SITES.filter(([x, z]) => isClear(x, z, 0.15));
  if (sites.length === 0) return null;
  const rng = createRng(911);
  const rocks = new InstancedMesh(new DodecahedronGeometry(1, 0), mats.stone, sites.length);
  rocks.name = 'rocks';
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const dummy = new Object3D();
  sites.forEach(([x, z], i) => {
    const s = 0.14 + rng() * 0.14;
    dummy.position.set(x, groundAt(x, z) + s * 0.1, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s * (1.1 + rng() * 0.4), s * 0.7, s * (1 + rng() * 0.3));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  return rocks;
}

function buildShrubs(mats: SharedMaterials): InstancedMesh | null {
  const sites = SHRUB_SITES.filter(([x, z]) => isClear(x, z, 0.12));
  if (sites.length === 0) return null;
  const rng = createRng(227);
  const lobes = [
    [0, 0.12, 0, 0.2],
    [0.14, 0.08, 0.08, 0.15],
    [-0.11, 0.07, -0.1, 0.16],
  ] as const;
  const shrubs = new InstancedMesh(new IcosahedronGeometry(1, 0), mats.shrub, sites.length * lobes.length);
  shrubs.name = 'shrubs';
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  const dummy = new Object3D();
  let k = 0;
  for (const [x, z] of sites) {
    const base = groundAt(x, z);
    for (const [dx, dy, dz, r] of lobes) {
      dummy.position.set(x + dx, base + dy, z + dz);
      dummy.rotation.set(rng() * 3, rng() * 3, 0);
      dummy.scale.setScalar(r * (0.9 + rng() * 0.2));
      dummy.updateMatrix();
      shrubs.setMatrixAt(k++, dummy.matrix);
    }
  }
  shrubs.instanceMatrix.needsUpdate = true;
  return shrubs;
}

/** A flat ribbon of stone following the PATH control points, lying on the grass. */
function buildPath(mats: SharedMaterials): Mesh {
  const curve = new CatmullRomCurve3(PATH.map(([x, z]) => new Vector3(x, 0, z)), false, 'catmullrom', 0.5);
  const SAMPLES = 80;
  const halfWidth = 0.17;
  const positions = new Float32Array((SAMPLES + 1) * 2 * 3);
  const indices: number[] = [];

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const px = -tangent.z * halfWidth;
    const pz = tangent.x * halfWidth;
    const left = [p.x + px, p.z + pz] as const;
    const right = [p.x - px, p.z - pz] as const;
    const o = i * 6;
    positions[o] = left[0];
    positions[o + 1] = groundAt(left[0], left[1]) + 0.035;
    positions[o + 2] = left[1];
    positions[o + 3] = right[0];
    positions[o + 4] = groundAt(right[0], right[1]) + 0.035;
    positions[o + 5] = right[1];
  }
  for (let i = 0; i < SAMPLES; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, mats.path);
  mesh.receiveShadow = true;
  mesh.name = 'path';
  return mesh;
}

/** A short picket fence: posts every half unit and two rails between each pair, each following the grass. */
function buildFence(mats: SharedMaterials): Group {
  const group = new Group();
  group.name = 'fence';
  const [[ax, az], [bx, bz]] = FENCE;
  const length = Math.hypot(bx - ax, bz - az);
  const segments = Math.max(1, Math.round(length / 0.5));
  const postGeometry = new BoxGeometry(0.07, 0.36, 0.07);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const post = new Mesh(postGeometry, mats.fence);
    post.position.set(x, groundAt(x, z) + 0.18, z);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }

  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const x0 = ax + (bx - ax) * t0;
    const z0 = az + (bz - az) * t0;
    const x1 = ax + (bx - ax) * t1;
    const z1 = az + (bz - az) * t1;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const span = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    const base = groundAt(mx, mz);
    for (const y of [0.13, 0.27]) {
      const rail = new Mesh(new BoxGeometry(0.035, 0.05, span), mats.fence);
      rail.position.set(mx, base + y, mz);
      rail.rotation.y = yaw;
      rail.castShadow = true;
      rail.receiveShadow = true;
      group.add(rail);
    }
  }
  return group;
}

function buildFlowers(mats: SharedMaterials): InstancedMesh | null {
  const rng = createRng(53);
  const palette = [PALETTE.flowerYellow, PALETTE.flowerPink, PALETTE.flowerWhite].map((c) => new Color(c));
  const maxCount = FLOWER_CENTRES.length * 16;
  const flowers = new InstancedMesh(new SphereGeometry(0.04, 6, 5), mats.flower, maxCount);
  flowers.name = 'flowers';
  const dummy = new Object3D();

  let count = 0;
  for (const [cx, cz, radius] of FLOWER_CENTRES) {
    for (let tries = 0; tries < 16 && count < maxCount; tries++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * radius;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!isClear(x, z, 0.08)) continue;
      dummy.position.set(x, groundAt(x, z) + 0.05, z);
      dummy.scale.setScalar(0.9 + rng() * 0.3);
      dummy.updateMatrix();
      flowers.setMatrixAt(count, dummy.matrix);
      flowers.setColorAt(count, palette[count % palette.length]);
      count++;
    }
  }
  if (count === 0) return null;
  flowers.count = count;
  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  return flowers;
}

/** Rocks, shrubs, the stone path, the fence and flowers. Placement is filtered by isClear(). */
export function createProps(mats: SharedMaterials): Group {
  const group = new Group();
  group.name = 'props';
  for (const part of [buildRocks(mats), buildShrubs(mats), buildFlowers(mats)]) {
    if (part) group.add(part);
  }
  group.add(buildPath(mats));
  group.add(buildFence(mats));
  return group;
}
