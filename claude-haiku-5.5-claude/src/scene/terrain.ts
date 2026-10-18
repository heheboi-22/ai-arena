import { lerp, smoothstep } from '../util/math';

// Shared layout for the whole diorama. Every prop reads its position from here
// so nothing is placed by guesswork, and the terrain height function below is
// the single source of truth for where the ground is.

export const ISLAND = {
  /** Radius of the grass top at its average rim. */
  radius: 6.1,
  /** How far the rock underside reaches below the rim. */
  depth: 5.2,
};

export const WATER_LEVEL = -0.12;
const PLATEAU_HEIGHT = 0.1;

export const HOUSE = { x: -0.9, z: 0.3, halfDepth: 0.65 };
export const POND = { x: 2.2, z: 1.7, radius: 1.35 };
export const WINDMILL = { x: -2.9, z: -2.0 };

/** Outer edge of the island for a given polar angle. Makes the silhouette irregular. */
export function rimRadius(theta: number): number {
  return (
    ISLAND.radius +
    0.32 * Math.sin(3 * theta + 0.7) +
    0.18 * Math.sin(5 * theta + 1.3) +
    0.08 * Math.sin(9 * theta + 0.4)
  );
}

/**
 * Height of the grass surface at (x, z). Rolls gently, meets the rim at y = 0,
 * flattens a plateau under the house, and carves a basin for the pond whose
 * contour sits just outside POND.radius * 0.87 (the shoreline).
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rim = rimRadius(Math.atan2(z, x));

  // Fade the hills to zero at the edge so the grass meets the rock at y = 0.
  const edge = smoothstep(0, 1.1, rim - r);
  let h =
    edge *
    (0.16 * Math.sin(0.62 * x + 0.4) * Math.cos(0.55 * z - 0.2) +
      0.1 * Math.sin(1.1 * x - 0.7 * z + 1.3) +
      0.05 * Math.cos(2.2 * x + 1.9 * z));

  const dh = Math.hypot(x - HOUSE.x, z - HOUSE.z);
  h = lerp(PLATEAU_HEIGHT, h, smoothstep(0.9, 1.7, dh));

  const dp = Math.hypot(x - POND.x, z - POND.z) / POND.radius;
  const basin = WATER_LEVEL - 0.22 + 1.3 * smoothstep(0.8, 1.06, dp);
  h = Math.min(h, basin);

  return h;
}

/** Normalised distance from the pond centre: 1 means on the shoreline. */
export function pondDistance(x: number, z: number): number {
  return Math.hypot(x - POND.x, z - POND.z) / POND.radius;
}

/** Keeps a point at least `margin` inside the island rim so props don't hang off the edge. */
export function insideIsland(x: number, z: number, margin: number): boolean {
  const r = Math.hypot(x, z);
  const rim = rimRadius(Math.atan2(z, x));
  return r < rim - margin;
}

