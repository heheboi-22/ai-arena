import * as THREE from 'three';
import type { SceneContext } from '../environment/runtime';
import { mergePainted } from '../utils/geometry';
import { seededRandom } from '../utils/math';
import { TREES, type TreeSpec } from './layout';
import type { WorldMaterials } from './materials';
import { terrainHeight } from './terrain';

interface PaintedPart {
  geometry: THREE.BufferGeometry;
  color: THREE.Color;
}

interface TreeRig {
  group: THREE.Group;
  crown: THREE.Group;
  phase: number;
  trunkAmplitude: number;
  crownAmplitude: number;
  baseLeanX: number;
  baseLeanZ: number;
}

const transform = (
  geometry: THREE.BufferGeometry,
  color: THREE.Color,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
): PaintedPart => {
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  matrix.compose(
    new THREE.Vector3(...position),
    quaternion,
    new THREE.Vector3(...scale)
  );
  geometry.applyMatrix4(matrix);
  return { geometry, color };
};

const blob = (
  radius: number,
  color: THREE.Color,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  detail = 1
): PaintedPart => {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  return transform(geometry, color, position, [0, 0, 0], scale);
};

const branch = (
  radiusTop: number,
  radiusBottom: number,
  length: number,
  color: THREE.Color,
  position: [number, number, number],
  rotation: [number, number, number]
): PaintedPart => {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 6, 1);
  return transform(geometry, color, position, rotation);
};

interface BuiltTree {
  trunk: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
  pivotY: number;
}

const buildOak = (random: () => number): BuiltTree => {
  const bark = new THREE.Color(0x6d513b);
  const barkLight = new THREE.Color(0x7d5e45);
  const greens = [0x5b7b43, 0x698a4d, 0x7a9b58, 0x87a765, 0x6f9252].map(
    (hex) => new THREE.Color(hex)
  );
  const trunkParts: PaintedPart[] = [
    transform(new THREE.CylinderGeometry(0.085, 0.16, 1.25, 7), bark, [0, 0.62, 0]),
    branch(0.04, 0.065, 0.62, barkLight, [0.17, 1.16, 0.02], [0.2, 0, -0.65]),
    branch(0.035, 0.055, 0.5, bark, [-0.18, 1.2, 0.08], [-0.15, 0.4, 0.72]),
    branch(0.026, 0.045, 0.38, barkLight, [0.02, 1.28, -0.15], [0.7, 0.2, 0.1])
  ];
  const crownParts: PaintedPart[] = [
    blob(0.58, greens[1]!, [0.02, 1.9, 0], [1.25, 0.95, 1.12]),
    blob(0.46, greens[2]!, [0.55, 1.7, 0.08], [1.1, 0.85, 1], 1),
    blob(0.4, greens[0]!, [-0.48, 1.72, 0.12], [1.05, 0.9, 1.05]),
    blob(0.36, greens[3]!, [0.16, 2.25, -0.12], [1.15, 0.8, 1]),
    blob(0.33, greens[4]!, [-0.3, 2.0, -0.4], [1, 0.9, 1.05]),
    blob(0.28, greens[2]!, [0.42, 2.08, 0.36], [1, 0.85, 1]),
    blob(0.24, greens[3]!, [0.02, 1.56, 0.44], [1.2, 0.7, 0.9])
  ];
  for (let i = 0; i < 3; i += 1) {
    crownParts.push(
      blob(
        0.19 + random() * 0.12,
        greens[2 + (i % 2)]!,
        [(random() - 0.5) * 1.15, 1.55 + random() * 0.8, (random() - 0.5) * 0.85],
        [1.2, 0.8, 1]
      )
    );
  }
  return { trunk: mergePainted(trunkParts), crown: mergePainted(crownParts), pivotY: 0.9 };
};

const buildBirch = (random: () => number): BuiltTree => {
  const bark = new THREE.Color(0xd6c8ac);
  const barkDark = new THREE.Color(0x5e5244);
  const greens = [0x819e58, 0x94af66, 0x749251, 0xa0b976].map((hex) => new THREE.Color(hex));
  const trunkParts: PaintedPart[] = [
    transform(new THREE.CylinderGeometry(0.055, 0.11, 1.7, 7), bark, [0.02, 0.85, 0]),
    branch(0.025, 0.045, 0.52, bark, [0.17, 1.63, 0.06], [0.25, 0, -0.55]),
    branch(0.02, 0.035, 0.4, bark, [-0.16, 1.68, -0.05], [-0.2, 0.4, 0.6])
  ];
  for (let i = 0; i < 5; i += 1) {
    const ring = new THREE.CylinderGeometry(0.06 - i * 0.003, 0.07 - i * 0.003, 0.035, 7, 1, true);
    trunkParts.push(transform(ring, barkDark, [0.02, 0.45 + i * 0.23, 0]));
  }
  const crownParts: PaintedPart[] = [
    blob(0.33, greens[1]!, [0.06, 2.0, 0], [1.1, 0.9, 1]),
    blob(0.26, greens[2]!, [0.36, 1.8, 0.12], [1, 0.85, 1]),
    blob(0.24, greens[0]!, [-0.26, 1.86, -0.1], [1, 0.8, 1]),
    blob(0.2, greens[3]!, [0.12, 2.22, 0.05], [1.1, 0.85, 1]),
    blob(0.18, greens[2]!, [-0.12, 1.65, 0.32], [1, 0.85, 1])
  ];
  for (let i = 0; i < 2; i += 1) {
    crownParts.push(
      blob(
        0.13 + random() * 0.07,
        greens[2]!,
        [(random() - 0.5) * 0.6, 1.7 + random() * 0.5, (random() - 0.5) * 0.4]
      )
    );
  }
  return { trunk: mergePainted(trunkParts), crown: mergePainted(crownParts), pivotY: 1.1 };
};

const buildConifer = (): BuiltTree => {
  const bark = new THREE.Color(0x5e4837);
  const greens = [0x436643, 0x4e7249, 0x5a7d51, 0x65885a].map((hex) => new THREE.Color(hex));
  const trunkParts: PaintedPart[] = [
    transform(new THREE.CylinderGeometry(0.08, 0.15, 1.45, 7), bark, [0, 0.72, 0])
  ];
  const crownParts: PaintedPart[] = [
    transform(new THREE.ConeGeometry(0.72, 1.1, 8), greens[0]!, [0, 1.2, 0], [0, 0.1, 0], [1, 1, 1]),
    transform(new THREE.ConeGeometry(0.58, 0.94, 8), greens[1]!, [0, 1.72, 0.02], [0, -0.2, 0]),
    transform(new THREE.ConeGeometry(0.44, 0.8, 8), greens[2]!, [0, 2.16, 0], [0, 0.25, 0]),
    transform(new THREE.ConeGeometry(0.29, 0.62, 8), greens[3]!, [0, 2.55, 0], [0, -0.1, 0])
  ];
  return { trunk: mergePainted(trunkParts), crown: mergePainted(crownParts), pivotY: 0.85 };
};

const buildSapling = (random: () => number): BuiltTree => {
  const bark = new THREE.Color(0x72553d);
  const greens = [0x6f9050, 0x809f5c, 0x8fa969].map((hex) => new THREE.Color(hex));
  const trunkParts: PaintedPart[] = [
    transform(new THREE.CylinderGeometry(0.028, 0.055, 0.82, 6), bark, [0, 0.4, 0]),
    branch(0.015, 0.025, 0.25, bark, [0.1, 0.66, 0], [0.1, 0, -0.7])
  ];
  const crownParts: PaintedPart[] = [
    blob(0.2, greens[0]!, [0.12, 0.92, 0], [1.15, 0.9, 1]),
    blob(0.16, greens[1]!, [-0.13, 0.83, 0.04], [1, 0.9, 1]),
    blob(0.12, greens[2]!, [0.02, 1.05, -0.15], [1.1, 0.85, 1])
  ];
  for (let i = 0; i < 2; i += 1) {
    crownParts.push(
      blob(
        0.1 + random() * 0.04,
        greens[1]!,
        [(random() - 0.5) * 0.35, 0.82 + random() * 0.25, (random() - 0.5) * 0.3]
      )
    );
  }
  return { trunk: mergePainted(trunkParts), crown: mergePainted(crownParts), pivotY: 0.55 };
};

const buildTree = (spec: TreeSpec, material: THREE.MeshStandardMaterial): TreeRig => {
  const random = seededRandom(Math.round(spec.phase * 1000 + spec.x * 91 + spec.z * 37));
  let built: BuiltTree;
  let trunkAmp = 0.02;
  let crownAmp = 0.06;
  switch (spec.kind) {
    case 'oak':
      built = buildOak(random);
      trunkAmp = 0.022;
      crownAmp = 0.065;
      break;
    case 'birch':
      built = buildBirch(random);
      trunkAmp = 0.032;
      crownAmp = 0.09;
      break;
    case 'conifer':
      built = buildConifer();
      trunkAmp = 0.013;
      crownAmp = 0.035;
      break;
    case 'sapling':
      built = buildSapling(random);
      trunkAmp = 0.03;
      crownAmp = 0.08;
      break;
  }

  const group = new THREE.Group();
  group.position.set(spec.x, terrainHeight(spec.x, spec.z) - 0.015, spec.z);
  group.rotation.y = random() * Math.PI * 2;
  group.scale.setScalar(spec.scale);
  const baseLeanX = (random() - 0.5) * 0.06;
  const baseLeanZ = (random() - 0.5) * 0.06;
  group.rotation.x = baseLeanX;
  group.rotation.z = baseLeanZ;

  const crown = new THREE.Group();
  crown.position.y = built.pivotY;
  built.crown.translate(0, -built.pivotY, 0);

  const trunkMesh = new THREE.Mesh(built.trunk, material);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  trunkMesh.name = `${spec.kind}-trunk`;

  const crownMesh = new THREE.Mesh(built.crown, material);
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  crownMesh.name = `${spec.kind}-crown`;

  crown.add(crownMesh);
  group.add(trunkMesh, crown);
  return {
    group,
    crown,
    phase: spec.phase,
    trunkAmplitude: trunkAmp,
    crownAmplitude: crownAmp,
    baseLeanX: baseLeanX,
    baseLeanZ: baseLeanZ
  };
};

export class Trees {
  readonly group = new THREE.Group();
  private readonly rigs: TreeRig[] = [];

  constructor(materials: WorldMaterials) {
    this.group.name = 'trees';
    for (const spec of TREES) {
      const rig = buildTree(spec, materials.foliage);
      this.rigs.push(rig);
      this.group.add(rig.group);
    }
  }

  update(ctx: SceneContext): void {
    const motion = ctx.reducedMotion ? 0.45 : 1;
    for (const rig of this.rigs) {
      const wind = ctx.wind;
      const sway = Math.sin(ctx.time * 0.9 + rig.phase) * wind * motion;
      const sway2 = Math.sin(ctx.time * 1.45 + rig.phase * 1.7 + 0.6) * wind * motion;
      rig.group.rotation.z = rig.baseLeanZ + sway * rig.trunkAmplitude * 0.35;
      rig.group.rotation.x = rig.baseLeanX + Math.cos(ctx.time * 0.75 + rig.phase) * wind * rig.trunkAmplitude * 0.3;
      rig.crown.rotation.z = sway * rig.crownAmplitude;
      rig.crown.rotation.x = sway2 * rig.crownAmplitude * 0.55;
    }
  }
}
