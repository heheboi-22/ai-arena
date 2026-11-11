import * as THREE from 'three';
import { Builder, box, cone, cyl } from '../core/builder';
import { TAU, mulberry32 } from '../core/math';
import type { Wind } from '../env/wind';
import { clay } from './materials';
import { C } from './palette';
import { lumpy } from './shapes';
import { groundHeight } from './terrain';

type Kind = 'round' | 'pine' | 'birch';

interface Spec {
  kind: Kind;
  x: number;
  z: number;
  scale: number;
  warm?: boolean;
}

/** Hand-placed so the grove frames the house and nothing overlaps. */
export const TREE_SPECS: Spec[] = [
  { kind: 'round', x: -3.95, z: -1.85, scale: 1.3 },
  { kind: 'pine', x: -2.35, z: -3.45, scale: 1.25 },
  { kind: 'pine', x: -0.95, z: -4.2, scale: 0.92 },
  { kind: 'birch', x: -4.55, z: 0.55, scale: 1.0 },
  { kind: 'round', x: 0.55, z: -3.2, scale: 0.86, warm: true },
  { kind: 'pine', x: 4.55, z: -0.35, scale: 0.8 },
  { kind: 'birch', x: 4.5, z: 2.0, scale: 0.86 },
  { kind: 'round', x: -3.45, z: 2.45, scale: 0.95 },
];

interface Tree {
  sway: THREE.Group;
  crown: THREE.Group;
  /** Phase lag so gusts roll across the island instead of hitting at once. */
  lag: number;
  /** How willingly this tree bends. */
  flex: number;
}

export class Trees {
  readonly group = new THREE.Group();
  private readonly trees: Tree[] = [];

  constructor(windDir: THREE.Vector2) {
    const rng = mulberry32(5);
    this.group.name = 'trees';
    for (const spec of TREE_SPECS) {
      const s = spec.scale;
      const yaw = rng() * TAU;
      const trunk = new Builder(rng);
      const crown = new Builder(rng);
      let crownY = 1;
      let flex = 1;

      if (spec.kind === 'round') {
        crownY = 1.0;
        trunk.add(cyl(0.085, 0.16, 1.15, 6), C.wood, { p: [0, 0.55, 0] }, 0.07);
        trunk.add(cyl(0.04, 0.06, 0.5, 5), C.wood, { p: [0.17, 0.95, 0], r: [0, 0, -0.75] }, 0.07);
        const main = spec.warm ? C.leafWarm : C.leaf;
        crown.add(lumpy(0.74, 1, 0.13, 1 + s), main, { p: [0, 0.55, 0] }, 0.06);
        crown.add(lumpy(0.5, 1, 0.13, 2 + s), C.leafDeep, { p: [0.46, 0.28, 0.16] }, 0.06);
        crown.add(lumpy(0.46, 1, 0.13, 3 + s), spec.warm ? C.leaf : C.leafLight, { p: [-0.43, 0.38, -0.1] }, 0.06);
        crown.add(lumpy(0.42, 1, 0.13, 4 + s), C.leafLight, { p: [0.06, 0.98, -0.04] }, 0.06);
        crown.add(lumpy(0.36, 1, 0.13, 5 + s), main, { p: [-0.05, 0.36, 0.48] }, 0.06);
      } else if (spec.kind === 'pine') {
        crownY = 0.42;
        flex = 0.75;
        trunk.add(cyl(0.07, 0.12, 0.75, 6), C.woodDark, { p: [0, 0.36, 0] }, 0.07);
        const tiers: [number, number, number][] = [
          [0.74, 0.92, 0.44],
          [0.58, 0.82, 0.94],
          [0.42, 0.72, 1.4],
          [0.26, 0.6, 1.84],
        ];
        tiers.forEach(([r, h, y], i) => {
          crown.add(
            cone(r, h, 7),
            i % 2 === 0 ? C.pine : C.pineLight,
            { p: [(rng() - 0.5) * 0.06, y, (rng() - 0.5) * 0.06], r: [0, rng() * TAU, 0] },
            0.07,
          );
        });
      } else {
        crownY = 1.15;
        flex = 1.35;
        trunk.add(cyl(0.05, 0.085, 1.75, 6), C.birchBark, { p: [0, 0.87, 0] }, 0.03);
        for (const y of [0.35, 0.72, 1.02]) {
          trunk.add(box(0.1, 0.03, 0.1), '#5d544b', { p: [0, y, 0], r: [0, y * 3, 0] });
        }
        crown.add(lumpy(0.44, 1, 0.12, 6 + s, [1, 1.4, 1]), C.leafLight, { p: [0, 0.62, 0] }, 0.06);
        crown.add(lumpy(0.31, 1, 0.12, 7 + s, [1, 1.25, 1]), C.leafWarm, { p: [0.24, 0.2, 0.1] }, 0.06);
        crown.add(lumpy(0.29, 1, 0.12, 8 + s, [1, 1.2, 1]), C.leaf, { p: [-0.21, 0.3, -0.09] }, 0.06);
      }

      // Bake yaw and scale into the geometry so sway axes stay in world space.
      const bake = (src: Builder, lift: number): THREE.Mesh =>
        new Builder()
          .addRaw(src.geometry(), { p: [0, -lift * s, 0], r: [0, yaw, 0], s })
          .mesh(clay);

      const sway = new THREE.Group();
      sway.position.set(spec.x, groundHeight(spec.x, spec.z) - 0.04, spec.z);
      sway.add(bake(trunk, 0));
      const crownGroup = new THREE.Group();
      crownGroup.position.y = crownY * s;
      crownGroup.add(bake(crown, crownY));
      sway.add(crownGroup);
      this.group.add(sway);
      this.trees.push({
        sway,
        crown: crownGroup,
        lag: -(spec.x * windDir.x + spec.z * windDir.y) * 0.45,
        flex: flex / Math.sqrt(s),
      });
    }
  }

  /** @param motion 1 normally, lower when the user prefers reduced motion. */
  update(wind: Wind, motion: number): void {
    const { x: dx, y: dz } = wind.dir;
    for (const t of this.trees) {
      const osc = Math.sin(wind.phase * 2.2 + t.lag) * 0.6 + Math.sin(wind.phase * 3.7 + t.lag * 1.7) * 0.4;
      const lean = wind.strength * (0.035 + 0.02 * wind.gustiness);
      const bend = (lean + wind.strength * 0.04 * osc * motion) * t.flex;
      // Tilt "up" towards the wind direction.
      t.sway.rotation.set(bend * dz, 0, -bend * dx);
      const flutter = Math.sin(wind.phase * 4.1 + t.lag * 2.3);
      const extra = (lean * 0.8 + wind.strength * 0.045 * flutter * motion) * t.flex;
      t.crown.rotation.set(extra * dz, 0, -extra * dx);
    }
  }
}
