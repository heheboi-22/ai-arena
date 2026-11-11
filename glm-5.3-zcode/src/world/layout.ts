/**
 * One place for every placement decision on the island. The composition:
 * the house is the focal point front-right, the windmill balances it
 * back-left, and the pond with its spilling stream anchors the front-left.
 */

export const ISLAND_R = 5.6;

export const POND = {
  x: -1.5,
  z: 1.85,
  /** carved radius in the terrain */
  r: 1.48,
  /** water surface height */
  waterY: -0.1,
};

export const HOUSE = { x: 1.55, z: -0.35, rot: 0.55 };
export const WINDMILL = { x: -2.95, z: -2.35, rot: 0.62 };
export const LAMP = { x: 2.45, z: 0.75 };
export const BENCH = { x: 0.55, z: 2.75, rot: -1.9 };

export interface TreeSpec {
  kind: 'puff' | 'pine';
  x: number;
  z: number;
  s: number;
  rot: number;
}

export const TREES: TreeSpec[] = [
  { kind: 'puff', x: 2.75, z: -2.35, s: 1.25, rot: 0.5 },
  { kind: 'puff', x: 3.7, z: 0.85, s: 1.0, rot: 2.1 },
  { kind: 'puff', x: -0.75, z: -3.6, s: 0.92, rot: 4.0 },
  { kind: 'puff', x: 1.35, z: 3.05, s: 0.78, rot: 1.2 },
  { kind: 'puff', x: -3.85, z: 1.35, s: 0.7, rot: 5.2 },
  { kind: 'pine', x: -4.05, z: -0.75, s: 1.15, rot: 0.8 },
  { kind: 'pine', x: 3.25, z: -3.35, s: 1.3, rot: 2.6 },
  { kind: 'pine', x: 0.3, z: -4.15, s: 1.05, rot: 3.9 },
  { kind: 'pine', x: -1.95, z: 3.65, s: 0.9, rot: 5.5 },
];

export const BUSHES = [
  { x: 2.9, z: 1.9, s: 1.0 },
  { x: -0.9, z: -2.6, s: 0.8 },
  { x: 4.35, z: -1.3, s: 0.7 },
  { x: -3.3, z: -3.3, s: 0.9 },
];

export const ROCKS = [
  { x: 4.3, z: -1.75, s: 0.42, rot: 1.0 },
  { x: -2.85, z: 3.45, s: 0.3, rot: 2.4 },
  { x: 0.9, z: -3.1, s: 0.22, rot: 4.1 },
  { x: -4.35, z: -1.95, s: 0.34, rot: 5.0 },
];

/** Flower clusters: [center, spread, count]. */
export const FLOWER_PATCHES = [
  { x: 1.05, z: 0.75, spread: 0.55, n: 6 },
  { x: -0.55, z: 3.2, spread: 0.5, n: 5 },
  { x: -2.3, z: -1.45, spread: 0.45, n: 4 },
  { x: 2.9, z: -0.4, spread: 0.4, n: 4 },
];

/** Stepping-stone paths: door → pond side, with a fork to the windmill. */
export const PATHS: { from: [number, number]; ctrl: [number, number]; to: [number, number]; n: number }[] = [
  { from: [1.95, 0.35], ctrl: [1.35, 1.75], to: [-0.1, 2.85], n: 8 },
  { from: [1.7, 0.1], ctrl: [-0.1, -0.7], to: [-2.25, -1.6], n: 7 },
];

/** Fence follows the front-right rim. */
export const FENCE = { from: 0.12, to: 0.55, inset: 0.55, posts: 6 };

export const CAMERA_START = {
  pos: [11.4, 3.9, 13.5] as const,
  target: [0, -0.95, 0] as const,
  fov: 42,
};

/** Companion mini-rocks bobbing around the island. */
export const COMPANIONS = [
  { x: 6.9, y: -1.4, z: -3.1, s: 0.72, phase: 0.0 },
  { x: -7.6, y: -2.6, z: 2.1, s: 0.95, phase: 2.1 },
  { x: 5.0, y: -4.3, z: 4.3, s: 0.55, phase: 4.2 },
  { x: 1.1, y: -6.2, z: -7.2, s: 0.4, phase: 5.4 },
];
