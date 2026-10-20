import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Color,
} from 'three';
import { Rng } from '../lib/noise';
import type { SceneMaterials } from './palette';
import { terrainHeight } from './island';

export type TreeVariant = 'broadleaf' | 'pine' | 'birch' | 'blossom';

export interface TreePlacement {
  variant: TreeVariant;
  x: number;
  z: number;
  scale?: number;
  rotation?: number;
  seed?: number;
}

interface Tree {
  sway: Group;
  phase: number;
  amplitude: number;
}

export interface TreeSet {
  group: Group;
  update(elapsed: number, wind: number, reducedMotion: boolean): void;
}

export function createTrees(
  materials: SceneMaterials,
  placements: TreePlacement[],
): TreeSet {
  const group = new Group();
  group.name = 'trees';
  const trees: Tree[] = [];

  const shared = {
    trunk: new CylinderGeometry(0.08, 0.155, 1, 6),
    branch: new CylinderGeometry(0.025, 0.045, 0.5, 5),
    leaf: new IcosahedronGeometry(1, 1),
    cone: new ConeGeometry(1, 1, 8),
    blossom: new SphereGeometry(0.05, 6, 5),
    band: new TorusGeometry(0.075, 0.011, 3, 7),
    birchBark: new MeshStandardMaterial({
      color: new Color('#d7cbb5'),
      roughness: 0.92,
      metalness: 0,
    }),
    birchMark: new MeshStandardMaterial({
      color: new Color('#50493c'),
      roughness: 0.95,
      metalness: 0,
    }),
  };

  for (const placement of placements) {
    const random = new Rng(placement.seed ?? Math.round(placement.x * 937 + placement.z * 191));
    const scale = placement.scale ?? 1;
    const tree = new Group();
    tree.position.set(placement.x, terrainHeight(placement.x, placement.z) - 0.02, placement.z);
    tree.rotation.y = placement.rotation ?? random.range(0, Math.PI * 2);
    tree.scale.setScalar(scale);

    const sway = new Group();
    tree.add(sway);
    let phase = random.range(0, Math.PI * 2);
    let amplitude = 1;

    if (placement.variant === 'broadleaf' || placement.variant === 'blossom') {
      const trunkHeight = random.range(1.15, 1.5);
      const trunk = new Mesh(shared.trunk, materials.wood);
      trunk.scale.set(1, trunkHeight, 1);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      // Two short branch stubs give the silhouette a hand-built asymmetry.
      for (let i = 0; i < 2; i += 1) {
        const branch = new Mesh(shared.branch, materials.woodDark);
        branch.position.set(0, trunkHeight * 0.82, 0);
        branch.rotation.z = (i === 0 ? 1 : -1) * random.range(0.45, 0.8);
        branch.rotation.y = random.range(0, Math.PI * 2);
        branch.castShadow = true;
        tree.add(branch);
      }

      sway.position.y = trunkHeight * 0.9;
      const blobs = placement.variant === 'blossom' ? 6 : 5;
      for (let i = 0; i < blobs; i += 1) {
        const blob = new Mesh(
          shared.leaf,
          random.pick([materials.leafA, materials.leafB, materials.leafC]),
        );
        const angle = (i / blobs) * Math.PI * 2 + random.range(-0.4, 0.4);
        const radius = i === 0 ? 0 : random.range(0.28, 0.62);
        blob.position.set(
          Math.cos(angle) * radius,
          random.range(-0.1, 0.42) + (i === 0 ? 0.38 : 0),
          Math.sin(angle) * radius,
        );
        const size = random.range(0.42, 0.7) * (i === 0 ? 1.15 : 1);
        blob.scale.set(size, size * random.range(0.75, 0.98), size);
        blob.rotation.set(random.range(0, Math.PI), random.range(0, Math.PI), 0);
        blob.castShadow = true;
        blob.receiveShadow = true;
        sway.add(blob);
      }

      if (placement.variant === 'blossom') {
        for (let i = 0; i < 24; i += 1) {
          const flower = new Mesh(shared.blossom, materials.blossom);
          const angle = random.range(0, Math.PI * 2);
          const radius = random.range(0.2, 0.65);
          flower.position.set(
            Math.cos(angle) * radius,
            random.range(0.08, 0.72),
            Math.sin(angle) * radius,
          );
          flower.scale.setScalar(random.range(0.7, 1.25));
          sway.add(flower);
        }
      }
    } else if (placement.variant === 'pine') {
      const trunkHeight = 0.85;
      const trunk = new Mesh(shared.trunk, materials.wood);
      trunk.scale.set(0.66, trunkHeight, 0.66);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      sway.position.y = 0.45;
      const layers = 4;
      for (let i = 0; i < layers; i += 1) {
        const cone = new Mesh(shared.cone, i % 2 === 0 ? materials.pine : materials.pineLight);
        const t = i / (layers - 1);
        const radius = 0.78 - t * 0.42;
        const height = 1.05 - t * 0.22;
        cone.scale.set(radius, height, radius);
        cone.position.y = 0.58 + i * 0.48;
        cone.rotation.y = random.range(0, Math.PI * 2);
        cone.castShadow = true;
        cone.receiveShadow = true;
        sway.add(cone);
      }
    } else {
      const trunkHeight = 1.85;
      const trunk = new Mesh(shared.trunk, shared.birchBark);
      trunk.scale.set(0.42, trunkHeight, 0.42);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      for (let i = 0; i < 5; i += 1) {
        const band = new Mesh(shared.band, shared.birchMark);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.32 + i * 0.32;
        band.scale.setScalar(random.range(0.8, 1.1));
        tree.add(band);
      }

      sway.position.y = trunkHeight * 0.78;
      for (let i = 0; i < 4; i += 1) {
        const blob = new Mesh(shared.leaf, random.pick([materials.leafB, materials.leafA]));
        const angle = (i / 4) * Math.PI * 2 + 0.3;
        blob.position.set(Math.cos(angle) * 0.33, random.range(0.1, 0.5), Math.sin(angle) * 0.33);
        const size = random.range(0.3, 0.48);
        blob.scale.set(size, size * 0.9, size);
        blob.castShadow = true;
        sway.add(blob);
      }
    }

    amplitude = placement.variant === 'pine' ? 0.55 : placement.variant === 'birch' ? 1.25 : 1;
    phase = random.range(0, Math.PI * 2);
    trees.push({ sway, phase, amplitude });
    group.add(tree);
  }

  return {
    group,
    update: (elapsed, wind, reducedMotion) => {
      const strength = Math.pow(wind, 1.15) * (reducedMotion ? 0.22 : 1);
      for (const tree of trees) {
        const swayZ = Math.sin(elapsed * 1.05 + tree.phase) * strength * 0.055 * tree.amplitude;
        const swayX = Math.cos(elapsed * 0.83 + tree.phase * 1.3) * strength * 0.032 * tree.amplitude;
        tree.sway.rotation.z = swayZ;
        tree.sway.rotation.x = swayX;
      }
    },
  };
}
