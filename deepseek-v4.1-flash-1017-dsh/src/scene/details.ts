import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { createGroundRibbon } from '../lib/geometry';
import { Rng } from '../lib/noise';
import type { SceneMaterials } from './palette';
import { POND_CENTER, terrainHeight } from './island';

interface FlowerPatch {
  pivot: Group;
  phase: number;
}

export interface DetailSet {
  group: Group;
  update(elapsed: number, wind: number, reducedMotion: boolean): void;
}

export function createDetails(
  materials: SceneMaterials,
  doorPoint: Vector3,
): DetailSet {
  const group = new Group();
  group.name = 'details';
  const patches: FlowerPatch[] = [];

  group.add(createPath(materials, doorPoint));
  group.add(createFence(materials));
  group.add(createRocks(materials));
  group.add(createBench(materials));

  const patchSpecs = [
    { x: 3.15, z: 1.55, seed: 41 },
    { x: 0.05, z: 2.5, seed: 42 },
    { x: -3.35, z: 2.15, seed: 43 },
    { x: -3.85, z: -0.8, seed: 44 },
  ];
  for (const spec of patchSpecs) {
    const patch = createFlowerPatch(materials, spec.x, spec.z, spec.seed);
    group.add(patch.group);
    patches.push({ pivot: patch.pivot, phase: patch.phase });
  }

  group.add(createMushrooms(-3.3, -1.1));
  group.add(createMushrooms(0.2, -3.2));

  return {
    group,
    update: (elapsed, wind, reducedMotion) => {
      const strength = Math.pow(wind, 1.2) * (reducedMotion ? 0.15 : 1);
      for (const patch of patches) {
        patch.pivot.rotation.z = Math.sin(elapsed * 1.3 + patch.phase) * strength * 0.055;
        patch.pivot.rotation.x = Math.cos(elapsed * 1.05 + patch.phase) * strength * 0.03;
      }
    },
  };
}

function createPath(materials: SceneMaterials, doorPoint: Vector3): Group {
  const group = new Group();
  group.name = 'path';

  const points = [
    new Vector3(doorPoint.x, 0, doorPoint.z),
    new Vector3(1.92, 0, 1.72),
    new Vector3(2.28, 0, 2.6),
    new Vector3(2.98, 0, 3.45),
    new Vector3(3.05, 0, 4.3),
  ];

  const ribbon = createGroundRibbon(points, 0.42, terrainHeight, 56);
  const path = new Mesh(ribbon.geometry, materials.path);
  path.receiveShadow = true;
  group.add(path);

  // Worn stepping stones follow the same curve.
  const random = new Rng(608);
  const stoneGeometry = new CylinderGeometry(1, 1, 0.045, 8);
  for (let i = 0; i < 7; i += 1) {
    const t = 0.08 + i * 0.125;
    const point = ribbon.curve.getPoint(t);
    const stone = new Mesh(stoneGeometry, materials.stone);
    stone.position.set(
      point.x + random.range(-0.1, 0.1),
      terrainHeight(point.x, point.z) + 0.028,
      point.z + random.range(-0.1, 0.1),
    );
    const scale = random.range(0.13, 0.2);
    stone.scale.set(scale * random.range(0.8, 1.4), 1, scale * random.range(0.8, 1.3));
    stone.rotation.y = random.range(0, Math.PI);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  return group;
}

function createFence(materials: SceneMaterials): Group {
  const group = new Group();
  group.name = 'fence';
  const posts: Vector3[] = [];
  const start = new Vector3(1.08, 0, 2.02);
  const end = new Vector3(1.52, 0, 3.22);
  const count = 4;

  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = start.x + (end.x - start.x) * t;
    const z = start.z + (end.z - start.z) * t;
    const y = terrainHeight(x, z);
    posts.push(new Vector3(x, y, z));

    const post = new Mesh(new BoxGeometry(0.08, 0.5, 0.08), materials.woodDark);
    post.position.set(x, y + 0.25, z);
    post.rotation.y = 0.18 + i * 0.03;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }

  for (let i = 0; i < count - 1; i += 1) {
    const a = posts[i];
    const b = posts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    for (const height of [0.19, 0.39]) {
      const rail = new Mesh(new BoxGeometry(0.055, 0.065, length + 0.06), materials.wood);
      rail.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + height, (a.z + b.z) / 2);
      rail.rotation.y = angle;
      rail.rotation.z = (b.y - a.y) / length;
      rail.castShadow = true;
      group.add(rail);
    }
  }

  return group;
}

function createRocks(materials: SceneMaterials): Group {
  const group = new Group();
  group.name = 'rocks';
  const random = new Rng(289);
  const geometry = new DodecahedronGeometry(1, 0);
  const mossGeometry = new SphereGeometry(1, 7, 5);
  const mossMaterial = new MeshStandardMaterial({
    color: new Color('#6f8050'),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });

  const spots = [
    { x: 3.85, z: 1.7, s: 0.38 },
    { x: -3.55, z: 3.1, s: 0.3 },
    { x: 0.4, z: -4.35, s: 0.45 },
    { x: 4.05, z: -0.65, s: 0.28 },
    { x: -4.2, z: -1.7, s: 0.36 },
    { x: -0.65, z: 4.45, s: 0.3 },
    { x: 3.0, z: -2.1, s: 0.24 },
    { x: -3.0, z: 0.3, s: 0.2 },
  ];

  for (const spot of spots) {
    const y = terrainHeight(spot.x, spot.z);
    const scale = spot.s;
    const rock = new Mesh(geometry, materials.rock);
    rock.position.set(spot.x, y + scale * 0.32, spot.z);
    rock.scale.set(scale * random.range(0.9, 1.5), scale * random.range(0.6, 1.05), scale * random.range(0.9, 1.4));
    rock.rotation.set(random.range(0, 1), random.range(0, Math.PI * 2), random.range(0, 1));
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);

    if (random.next() > 0.45) {
      const moss = new Mesh(mossGeometry, mossMaterial);
      moss.position.set(spot.x + scale * 0.1, y + scale * 0.62, spot.z - scale * 0.05);
      moss.scale.set(scale * 0.4, scale * 0.1, scale * 0.32);
      moss.rotation.y = random.range(0, Math.PI * 2);
      group.add(moss);
    }
  }

  return group;
}

function createFlowerPatch(
  materials: SceneMaterials,
  x: number,
  z: number,
  seed: number,
): { group: Group; pivot: Group; phase: number } {
  const group = new Group();
  const pivot = new Group();
  const random = new Rng(seed);
  const baseY = terrainHeight(x, z);
  pivot.position.set(x, baseY, z);
  group.add(pivot);

  const stemGeometry = new CylinderGeometry(0.006, 0.01, 1, 4);
  const headGeometry = new SphereGeometry(0.04, 7, 6);
  const centerGeometry = new SphereGeometry(0.016, 5, 4);
  const stemMaterial = materials.leafC;
  const heads = [materials.flowerCream, materials.flowerRose, materials.flowerGold];
  const centers = new MeshStandardMaterial({
    color: new Color('#8a693d'),
    roughness: 0.9,
    metalness: 0,
  });

  for (let i = 0; i < 8; i += 1) {
    const angle = random.range(0, Math.PI * 2);
    const radius = random.range(0.02, 0.24);
    const height = random.range(0.14, 0.34);
    const stem = new Mesh(stemGeometry, stemMaterial);
    stem.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    stem.scale.y = height;
    stem.rotation.z = random.range(-0.14, 0.14);
    stem.castShadow = true;
    pivot.add(stem);

    const head = new Mesh(headGeometry, heads[i % heads.length]);
    head.position.set(
      Math.cos(angle) * radius + random.range(-0.02, 0.02),
      height,
      Math.sin(angle) * radius + random.range(-0.02, 0.02),
    );
    head.scale.setScalar(random.range(0.75, 1.2));
    head.castShadow = true;
    pivot.add(head);

    const center = new Mesh(centerGeometry, centers);
    center.position.copy(head.position).add(new Vector3(0, 0.022, 0));
    pivot.add(center);
  }

  const phase = random.range(0, Math.PI * 2);
  return { group, pivot, phase };
}

function createMushrooms(x: number, z: number): Group {
  const group = new Group();
  const random = new Rng(Math.round(x * 71 + z * 37) + 11);
  const baseY = terrainHeight(x, z);
  const capMaterial = new MeshStandardMaterial({
    color: new Color('#b86a55'),
    roughness: 0.85,
    metalness: 0,
  });
  const stemMaterial = new MeshStandardMaterial({
    color: new Color('#eadfc8'),
    roughness: 0.95,
    metalness: 0,
  });

  for (let i = 0; i < 3; i += 1) {
    const sx = x + random.range(-0.16, 0.16);
    const sz = z + random.range(-0.14, 0.14);
    const height = random.range(0.075, 0.14);
    const stem = new Mesh(new CylinderGeometry(0.017, 0.026, height, 6), stemMaterial);
    stem.position.set(sx, baseY + height / 2, sz);
    stem.castShadow = true;
    group.add(stem);

    const cap = new Mesh(new ConeGeometry(0.1, 0.075, 9), capMaterial);
    cap.position.set(sx, baseY + height + 0.02, sz);
    cap.scale.setScalar(random.range(0.7, 1.2));
    cap.castShadow = true;
    group.add(cap);
  }

  return group;
}

function createBench(materials: SceneMaterials): Group {
  const group = new Group();
  group.name = 'bench';
  const x = -0.62;
  const z = 3.0;
  const y = terrainHeight(x, z);
  group.position.set(x, y, z);
  group.rotation.y = Math.atan2(POND_CENTER.x - x, POND_CENTER.z - z);

  const seat = new Mesh(new BoxGeometry(0.78, 0.07, 0.26), materials.wood);
  seat.position.y = 0.22;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  for (const side of [-1, 1] as const) {
    const leg = new Mesh(new BoxGeometry(0.07, 0.22, 0.22), materials.woodDark);
    leg.position.set(side * 0.3, 0.11, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  const back = new Mesh(new BoxGeometry(0.78, 0.24, 0.055), materials.wood);
  back.position.set(0, 0.42, -0.11);
  back.rotation.x = -0.1;
  back.castShadow = true;
  group.add(back);

  for (const side of [-1, 1] as const) {
    const arm = new Mesh(new BoxGeometry(0.055, 0.05, 0.27), materials.woodDark);
    arm.position.set(side * 0.36, 0.35, 0);
    arm.castShadow = true;
    group.add(arm);
  }

  return group;
}
