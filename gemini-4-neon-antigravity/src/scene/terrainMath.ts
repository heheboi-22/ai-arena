export interface Point2D {
  x: number;
  z: number;
}

export const WATER_LEVEL = -0.02;

export const HOUSE_ANCHOR = { x: -1.38, z: -0.82, rotationY: 0.46, radius: 1.42 } as const;
export const WINDMILL_ANCHOR = { x: 2.38, z: -1.42, rotationY: -0.44, radius: 1.0 } as const;
export const POND_ANCHOR = {
  x: 1.42,
  z: 1.48,
  rx: 1.72,
  rz: 1.24,
  rotation: -0.26,
} as const;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Deterministic organic silhouette radius of the floating island at polar angle `angle`. */
export function getIslandRadius(angle: number): number {
  return (
    5.35 +
    0.42 * Math.sin(angle * 2 - 0.55) +
    0.26 * Math.cos(angle * 3 + 0.85) +
    0.13 * Math.sin(angle * 5 - 0.25)
  );
}

/** Normalized radial position (0 at center, 1 at grass cliff edge, >1 outside island). */
export function getNormalizedIslandRadius(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < 1e-6) return 0;
  const angle = Math.atan2(z, x);
  return r / getIslandRadius(angle);
}

/**
 * Normalized distance to pond center:
 * < 1.0 = underwater basin
 * 1.0..1.32 = visible pebbled/sandy shoreline slope
 */
export function getPondNormalizedDist(x: number, z: number): number {
  const dx = x - POND_ANCHOR.x;
  const dz = z - POND_ANCHOR.z;
  const cos = Math.cos(-POND_ANCHOR.rotation);
  const sin = Math.sin(-POND_ANCHOR.rotation);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const angle = Math.atan2(lz, lx);
  const organicWobble =
    1 + 0.065 * Math.sin(angle * 3 + 0.7) + 0.045 * Math.cos(angle * 2 - 0.4);
  const nx = lx / (POND_ANCHOR.rx * organicWobble);
  const nz = lz / (POND_ANCHOR.rz * organicWobble);
  return Math.hypot(nx, nz);
}

export function isInsidePond(x: number, z: number): boolean {
  return getPondNormalizedDist(x, z) < 0.97;
}

export function isInsideIsland(x: number, z: number, margin = 1.0): boolean {
  return getNormalizedIslandRadius(x, z) <= margin;
}

/** Deterministic top-surface height of the island meadow, hills, and pond basin. */
export function getTerrainHeight(x: number, z: number): number {
  // Subtle handcrafted hillock undulation
  const baseRoll =
    0.22 +
    0.09 * Math.sin(x * 0.58 + 0.35) * Math.cos(z * 0.54 - 0.2) +
    0.055 * Math.cos((x - z) * 0.48 + 0.4);

  // Cozy level terrace for the cottage
  const houseDistSq = (x - HOUSE_ANCHOR.x) ** 2 + (z - HOUSE_ANCHOR.z) ** 2;
  const housePlateau = 0.24 * Math.exp(-houseDistSq / 4.2);

  // Elevated knoll for the windmill
  const millDistSq = (x - WINDMILL_ANCHOR.x) ** 2 + (z - WINDMILL_ANCHOR.z) ** 2;
  const millKnoll = 0.76 * Math.exp(-millDistSq / 3.4);

  // Gentle back-left backdrop ridge behind the cottage for layered tree silhouettes
  const backRidgeDistSq = (x + 2.8) ** 2 + (z + 2.4) ** 2;
  const backRidge = 0.32 * Math.exp(-backRidgeDistSq / 4.5);

  let height = baseRoll + housePlateau + millKnoll + backRidge;

  // Flatten slightly right under the house foundation so the cottage sits cleanly
  const flatHouse = 1 - smoothstep(0.65, 1.85, Math.sqrt(houseDistSq));
  height = height * (1 - flatHouse * 0.65) + 0.46 * (flatHouse * 0.65);

  // Softly round down near the outer grass rim
  const normR = getNormalizedIslandRadius(x, z);
  const edgeRollOff = smoothstep(0.76, 1.03, normR);
  height = height * (1 - edgeRollOff * 0.72) + 0.08 * (edgeRollOff * 0.72);

  // Carve smooth pond depression + shoreline bank
  const pondDist = getPondNormalizedDist(x, z);
  if (pondDist < 1.38) {
    const basinFactor = 1 - smoothstep(0.32, 1.32, pondDist);
    const waterRim = 1 - smoothstep(0.88, 1.28, pondDist);
    // Target bottom around -0.44, crossing WATER_LEVEL (-0.02) right at pondDist ~ 1.0
    const carved = -0.44 * basinFactor - 0.06 * waterRim;
    const blend = 1 - smoothstep(0.95, 1.38, pondDist);
    height = height * (1 - blend) + carved * blend;
  }

  return height;
}

/** Sculpted rocky underside depth below y = 0 at a normalized radius `t` in [0, 1]. */
export function getUndersideDepth(angle: number, normR: number): number {
  // Asymmetric main floating spire centered slightly under the cottage/center mass
  const clamped = Math.min(1, Math.max(0, normR));
  const spireProfile = Math.pow(1 - clamped, 1.48);
  const ridgeNoise =
    0.34 * Math.sin(angle * 3 + 0.4) +
    0.24 * Math.cos(angle * 5 - 1.1) +
    0.16 * Math.sin(angle * 7 + 2.1);
  const crag = (1 - clamped) * (0.28 + 0.72 * clamped) * ridgeNoise;
  // Secondary rocky keel near the windmill weight
  const secondaryLobe = 0.55 * Math.max(0, Math.cos(angle + 0.45)) * Math.sin(clamped * Math.PI);
  return -(0.32 + 3.65 * spireProfile + crag + secondaryLobe * (1 - clamped * 0.45));
}

export interface RainCollision {
  floorY: number;
  hitPond: boolean;
  hitIsland: boolean;
}

/** Surface height where a falling 3D raindrop should terminate/recycle. */
export function getRainCollision(x: number, z: number): RainCollision {
  // Cottage roof collision approximation
  const hdx = x - HOUSE_ANCHOR.x;
  const hdz = z - HOUSE_ANCHOR.z;
  if (hdx * hdx + hdz * hdz < 1.32 * 1.32) {
    return { floorY: 2.35, hitPond: false, hitIsland: true };
  }

  // Windmill tower & cap collision approximation
  const mdx = x - WINDMILL_ANCHOR.x;
  const mdz = z - WINDMILL_ANCHOR.z;
  if (mdx * mdx + mdz * mdz < 0.85 * 0.85) {
    return { floorY: 3.4, hitPond: false, hitIsland: true };
  }

  if (isInsidePond(x, z)) {
    return { floorY: WATER_LEVEL, hitPond: true, hitIsland: true };
  }

  if (isInsideIsland(x, z, 0.98)) {
    return { floorY: getTerrainHeight(x, z), hitPond: false, hitIsland: true };
  }

  // Recycle off-island raindrops below the diorama silhouette so they don't fall endlessly
  return { floorY: -2.4, hitPond: false, hitIsland: false };
}
