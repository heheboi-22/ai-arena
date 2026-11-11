import * as THREE from 'three';
import { hash3 } from '../core/math';

/**
 * A lumpy blob (rock, foliage, cloud puff): an icosphere whose vertices are
 * pushed in and out by a position hash, optionally squashed.
 */
export function lumpy(
  radius: number,
  detail: number,
  amount: number,
  seed: number,
  squash: [number, number, number] = [1, 1, 1],
): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = radius * (1 + amount * (hash3(x + seed, y - seed * 0.37, z + seed * 1.91) * 2 - 1));
    pos.setXYZ(i, x * k * squash[0], y * k * squash[1], z * k * squash[2]);
  }
  g.computeVertexNormals();
  return g;
}
