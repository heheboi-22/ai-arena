import { CylinderGeometry, ConeGeometry, Group, IcosahedronGeometry, Mesh, SphereGeometry, type MeshStandardMaterial } from 'three';
import { terrainHeight } from './terrain';
import type { SharedMaterials } from './materials';
import { TREE_SITES, type TreeKind } from './layout';
import { createRng } from '../util/math';

export interface Tree {
  root: Group;
  /** Everything above the trunk. Rotating it bends the crown, so the trunk stays put. */
  crown: Group;
  phase: number;
  /** Per-tree multiplier so neighbouring trees don't sway in lockstep. */
  amplitude: number;
}

function add(parent: Group, mesh: Mesh, x: number, y: number, z: number): void {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function buildRound(root: Group, crown: Group, mats: SharedMaterials, rng: () => number): void {
  const trunk = new Mesh(new CylinderGeometry(0.07, 0.11, 0.9, 7), mats.trunk);
  add(root, trunk, 0, 0.45, 0);
  crown.position.y = 0.85;
  root.add(crown);

  const blobs: [number, number, number, number, MeshStandardMaterial][] = [
    [0, 0.28, 0, 0.56, mats.treeMid],
    [0.3, -0.02, 0.12, 0.4, mats.treeLight],
    [-0.26, -0.06, -0.14, 0.37, mats.treeDeep],
    [0.04, 0.6, -0.06, 0.36, mats.treeLight],
  ];
  const geometry = new IcosahedronGeometry(1, 1);
  for (const [x, y, z, r, mat] of blobs) {
    const blob = new Mesh(geometry, mat);
    blob.scale.setScalar(r * (0.92 + rng() * 0.16));
    add(crown, blob, x, y, z);
  }
}

function buildConifer(root: Group, crown: Group, mats: SharedMaterials): void {
  const trunk = new Mesh(new CylinderGeometry(0.05, 0.08, 0.6, 7), mats.trunk);
  add(root, trunk, 0, 0.3, 0);
  crown.position.y = 0.5;
  root.add(crown);

  const tiers: [number, number, number, number][] = [
    [0.62, 0.95, 0.45, 9],
    [0.46, 0.8, 1.0, 9],
    [0.3, 0.65, 1.45, 8],
  ];
  for (const [radius, height, y, segments] of tiers) {
    add(crown, new Mesh(new ConeGeometry(radius, height, segments), mats.conifer), 0, y, 0);
  }
}

function buildTall(root: Group, crown: Group, mats: SharedMaterials): void {
  const trunk = new Mesh(new CylinderGeometry(0.06, 0.09, 0.8, 7), mats.trunk);
  add(root, trunk, 0, 0.4, 0);
  crown.position.y = 0.8;
  root.add(crown);

  const body = new Mesh(new SphereGeometry(0.3, 12, 10), mats.treeDeep);
  body.scale.set(1, 2.4, 1);
  add(crown, body, 0, 1.1, 0);
}

/** Builds one tree at (x, z) on the island surface. Geometry and materials are shared through `mats`. */
export function createTree(kind: TreeKind, x: number, z: number, mats: SharedMaterials, rng: () => number): Tree {
  const root = new Group();
  root.name = `tree-${kind}`;
  root.position.set(x, terrainHeight(x, z), z);
  root.rotation.y = rng() * Math.PI * 2;
  root.scale.setScalar(0.85 + rng() * 0.3);

  const crown = new Group();
  crown.name = 'tree-crown';

  if (kind === 'round') buildRound(root, crown, mats, rng);
  else if (kind === 'conifer') buildConifer(root, crown, mats);
  else buildTall(root, crown, mats);

  return { root, crown, phase: rng() * Math.PI * 2, amplitude: 0.75 + rng() * 0.5 };
}

export function createTrees(mats: SharedMaterials): { group: Group; trees: Tree[] } {
  const group = new Group();
  group.name = 'trees';
  const rng = createRng(404);
  const trees = TREE_SITES.map((site) => createTree(site.kind, site.x, site.z, mats, rng));
  for (const tree of trees) group.add(tree.root);
  return { group, trees };
}
