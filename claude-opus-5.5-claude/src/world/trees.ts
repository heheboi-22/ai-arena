import * as THREE from 'three';
import { jitter, paintGradient, PartBuilder, placementMatrix, type Placement } from '../core/parts';
import { Random } from '../core/random';
import { place, TREES, type TreeSpot } from './layout';
import { PALETTE, swayingDepth, type Materials } from './materials';
import { groundHeight } from './terrain';

function shaped(g: THREE.BufferGeometry, at: Placement, jit: number, seed: number): THREE.BufferGeometry {
  jitter(g, jit, seed);
  g.applyMatrix4(placementMatrix(at));
  return g;
}

function blob(r: number, at: Placement, seed: number, detail = 1): THREE.BufferGeometry {
  return shaped(new THREE.IcosahedronGeometry(r, detail), at, r * 0.14, seed);
}

function buildTree(spot: TreeSpot, m: Materials): THREE.Group {
  const rnd = new Random(spot.seed * 97);
  const H = spot.size;
  const b = new PartBuilder();
  const foliage: THREE.BufferGeometry[] = [];
  let bottom: string = PALETTE.leafDeep;
  let top: string = PALETTE.leafLight;

  switch (spot.kind) {
    case 'pine': {
      bottom = PALETTE.pine;
      top = PALETTE.pineLight;
      b.add(m.bark, new THREE.CylinderGeometry(0.035 * H, 0.06 * H, 0.32 * H, 6), { y: 0.16 * H });
      const tiers = 4;
      for (let i = 0; i < tiers; i++) {
        const h = (0.38 - i * 0.035) * H;
        const r = (0.25 - i * 0.048) * H;
        const y = (0.2 + i * 0.19) * H + h / 2;
        foliage.push(
          shaped(new THREE.ConeGeometry(r, h, 8, 1), { y, ry: rnd.range(0, Math.PI) }, r * 0.12, spot.seed + i),
        );
      }
      break;
    }
    case 'round': {
      b.add(m.bark, new THREE.CylinderGeometry(0.035 * H, 0.055 * H, 0.5 * H, 6), { y: 0.25 * H });
      b.add(m.bark, new THREE.CylinderGeometry(0.015 * H, 0.025 * H, 0.22 * H, 5), {
        x: 0.06 * H,
        y: 0.42 * H,
        rz: -0.7,
      });
      foliage.push(blob(0.3 * H, { y: 0.66 * H, sy: 0.9 }, spot.seed));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + rnd.range(-0.4, 0.4);
        foliage.push(
          blob(0.19 * H, { x: Math.cos(a) * 0.22 * H, y: rnd.range(0.52, 0.68) * H, z: Math.sin(a) * 0.22 * H }, spot.seed + 10 + i),
        );
      }
      break;
    }
    case 'poplar': {
      b.add(m.bark, new THREE.CylinderGeometry(0.03 * H, 0.05 * H, 0.3 * H, 6), { y: 0.15 * H });
      foliage.push(blob(1, { y: 0.56 * H, sx: 0.17 * H, sy: 0.4 * H, sz: 0.17 * H }, spot.seed));
      foliage.push(blob(0.11 * H, { x: 0.05 * H, y: 0.9 * H }, spot.seed + 3));
      break;
    }
    case 'bush': {
      foliage.push(blob(0.5 * H, { y: 0.32 * H, sy: 0.8 }, spot.seed, 0));
      foliage.push(blob(0.36 * H, { x: 0.38 * H, y: 0.24 * H, sy: 0.85 }, spot.seed + 1, 0));
      foliage.push(blob(0.3 * H, { x: -0.3 * H, y: 0.2 * H, z: 0.22 * H }, spot.seed + 2, 0));
      break;
    }
  }

  for (const g of foliage) {
    paintGradient(g, bottom, top, 0.15 * H, 1.0 * H);
    b.add(m.foliage, g);
  }

  const group = b.build();
  const depth = swayingDepth(1, 1.2);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.customDepthMaterial = depth;
  });
  const p = place(spot.s, spot.d);
  group.position.set(p.x, groundHeight(p.x, p.z) - 0.03, p.z);
  group.rotation.y = rnd.range(0, Math.PI * 2);
  group.name = `tree-${spot.kind}`;
  return group;
}

export function buildTrees(m: Materials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'trees';
  for (const spot of TREES) group.add(buildTree(spot, m));
  return group;
}
