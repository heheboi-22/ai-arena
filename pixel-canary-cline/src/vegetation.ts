import * as THREE from 'three';
import { groundAt } from './island';
import { makeRandom } from './noise';

export interface Swaying {
  object: THREE.Object3D;
  /** Radians of lean at full wind. */
  amplitude: number;
  phase: number;
  speed: number;
}

export interface VegetationHandle {
  group: THREE.Group;
  swayables: Swaying[];
  update: (elapsed: number, wind: number, reduced: boolean) => void;
}

const TRUNK = new THREE.MeshStandardMaterial({ color: '#6b4a30', roughness: 0.92 });
const LEAF_DARK = new THREE.MeshStandardMaterial({ color: '#3f6f45', roughness: 0.95, flatShading: true });
const LEAF_MID = new THREE.MeshStandardMaterial({ color: '#4f8451', roughness: 0.95, flatShading: true });
const LEAF_LIGHT = new THREE.MeshStandardMaterial({ color: '#6f9c54', roughness: 0.95, flatShading: true });
const LEAF_WARM = new THREE.MeshStandardMaterial({ color: '#8a9448', roughness: 0.95, flatShading: true });

function conifer(scale: number, foliage: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.5 * scale, 7), TRUNK);
  trunk.position.y = 0.25 * scale;
  trunk.castShadow = true;
  g.add(trunk);

  const tiers = 4;
  for (let i = 0; i < tiers; i += 1) {
    const t = i / (tiers - 1);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry((0.44 - t * 0.24) * scale, (0.5 - t * 0.12) * scale, 8),
      foliage,
    );
    cone.position.y = (0.55 + i * 0.32) * scale;
    cone.rotation.y = i * 0.4;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
  }
  return g;
}

function broadleaf(scale: number, foliage: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, 0.62 * scale, 7), TRUNK);
  trunk.position.y = 0.31 * scale;
  trunk.castShadow = true;
  g.add(trunk);

  // Canopy = a few overlapping low-poly blobs, squashed and offset from each other.
  const rand = makeRandom(Math.round(scale * 1000) + 17);
  const blobs = 4;
  for (let i = 0; i < blobs; i += 1) {
    const r = (0.32 + rand() * 0.2) * scale;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliage);
    const a = (i / blobs) * Math.PI * 2 + rand();
    blob.position.set(Math.cos(a) * 0.2 * scale, (0.82 + rand() * 0.28) * scale, Math.sin(a) * 0.2 * scale);
    blob.scale.set(1, 0.82 + rand() * 0.3, 1);
    blob.rotation.set(rand() * 2, rand() * 2, rand() * 2);
    blob.castShadow = true;
    blob.receiveShadow = true;
    g.add(blob);
  }
  return g;
}

/** Slender tree: bare lower trunk, high narrow crown. */
function slim(scale: number, foliage: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.08 * scale, 1.05 * scale, 6), TRUNK);
  trunk.position.y = 0.52 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 3; i += 1) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((0.26 - i * 0.05) * scale, 0), foliage);
    blob.position.set((i - 1) * 0.12 * scale, (1.05 + i * 0.24) * scale, i % 2 === 0 ? 0.08 : -0.07);
    blob.scale.set(1.15, 0.9, 1.15);
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}

/** Six trees, deliberately uneven in species, size and placement. */
export function buildVegetation(): VegetationHandle {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const swayables: Swaying[] = [];

  const spots: [number, number, number, 'conifer' | 'broadleaf' | 'slim', THREE.MeshStandardMaterial][] = [
    [-2.65, -0.55, 1.15, 'conifer', LEAF_DARK],
    [-2.25, 1.65, 0.95, 'broadleaf', LEAF_MID],
    [-0.6, -1.95, 1.3, 'conifer', LEAF_MID],
    [1.0, -2.3, 0.8, 'slim', LEAF_WARM],
    [2.75, -1.55, 1.05, 'broadleaf', LEAF_LIGHT],
    [3.05, 0.95, 0.72, 'slim', LEAF_MID],
    [-0.15, 2.95, 0.62, 'broadleaf', LEAF_LIGHT],
  ];

  for (const [x, z, scale, kind, foliage] of spots) {
    const tree =
      kind === 'conifer'
        ? conifer(scale, foliage)
        : kind === 'broadleaf'
          ? broadleaf(scale, foliage)
          : slim(scale, foliage);
    tree.position.set(x, groundAt(x, z) - 0.03, z);
    tree.rotation.y = (x * 3.1 + z * 1.7) % Math.PI;
    group.add(tree);
    swayables.push({
      object: tree,
      amplitude: (kind === 'slim' ? 0.055 : kind === 'broadleaf' ? 0.04 : 0.026) * (1.25 - scale * 0.35),
      phase: (x + z) * 2.3,
      speed: 1.15 + (scale % 0.4),
    });
  }

  return {
    group,
    swayables,
    update(elapsed, wind, reduced) {
      const strength = reduced ? 0.3 : 1;
      for (const item of swayables) {
        // Two sines per tree keeps the grove from swaying in lockstep.
        const sway =
          Math.sin(elapsed * item.speed + item.phase) * 0.7 +
          Math.sin(elapsed * item.speed * 2.3 + item.phase * 1.7) * 0.3;
        const lean = sway * item.amplitude * wind * strength;
        item.object.rotation.z = lean;
        item.object.rotation.x = lean * 0.45;
      }
    },
  };
}

