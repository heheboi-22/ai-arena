import { HOUSE, POND, WINDMILL, insideIsland } from './terrain';

export type TreeKind = 'round' | 'conifer' | 'tall';

// Hand-placed so the silhouette balances around the house: trees frame the rim
// and leave the house, pond and windmill clear.
export const TREE_SITES: { kind: TreeKind; x: number; z: number }[] = [
  { kind: 'round', x: -4.5, z: -0.6 },
  { kind: 'conifer', x: -3.9, z: 3.1 },
  { kind: 'round', x: 1.0, z: -3.4 },
  { kind: 'tall', x: 4.2, z: -2.2 },
  { kind: 'round', x: 3.9, z: 0.2 },
  { kind: 'conifer', x: -0.6, z: -4.6 },
  { kind: 'tall', x: -4.8, z: 0.9 },
  { kind: 'round', x: -1.9, z: 4.6 },
];

/** Stone path from the front step out toward the rim. */
export const PATH: [number, number][] = [
  [HOUSE.x, HOUSE.z + 0.9],
  [-0.7, 2.2],
  [-0.5, 3.3],
  [-0.2, 4.4],
  [0.1, 5.3],
];

/** Short picket fence running beside the front garden, toward the pond. */
export const FENCE: [number, number][] = [
  [0.5, 1.3],
  [0.5, 2.7],
];

function distToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

export function distToPolyline(x: number, z: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distToSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return best;
}

/** True when (x, z) is on the island and clear of every building, path, fence, tree and the pond. */
export function isClear(x: number, z: number, margin: number): boolean {
  if (!insideIsland(x, z, margin + 0.2)) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + margin) return false;
  if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 1.0 + margin) return false;
  if (Math.abs(x - HOUSE.x) < 1.15 + margin && Math.abs(z - HOUSE.z) < 1.05 + margin) return false;
  if (distToPolyline(x, z, PATH) < 0.25 + margin) return false;
  if (distToPolyline(x, z, FENCE) < 0.2 + margin) return false;
  for (const tree of TREE_SITES) {
    if (Math.hypot(x - tree.x, z - tree.z) < 0.8 + margin) return false;
  }
  return true;
}
