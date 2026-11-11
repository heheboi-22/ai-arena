import { clamp, fbm2D, lerp, smoothstep } from '../utils/math';

export const ISLAND_BASE_RADIUS = 5.45;
export const POND_WATER_Y = -0.09;

export const LANDMARKS = {
  house: { x: 1.52, z: -0.68, rotY: -0.46, plateauY: 0.34 },
  windmill: { x: -2.22, z: -1.65, rotY: 0.48, plateauY: 0.86 },
  pond: { x: -1.12, z: 1.36, rx: 1.66, rz: 1.34 },
  cascadeOut: { x: -2.36, z: 3.92 },
} as const;

/**
 * Irregular, sculpted miniature island silhouette radius as a function of polar angle theta.
 * Produces gentle coves and promontories around ~5.45 units.
 */
export function getIslandOuterRadius(theta: number): number {
  const lobe2 = Math.cos(theta * 2 - 0.55) * 0.34;
  const lobe3 = Math.sin(theta * 3 + 0.85) * 0.28;
  const lobe4 = Math.cos(theta * 4 + 2.1) * 0.14;
  const lobe5 = Math.sin(theta * 5 - 1.2) * 0.09;

  // Gentle cove indentation where the pond's brook meets the front-left cliff edge
  const cascadeAngle = Math.atan2(LANDMARKS.cascadeOut.z, LANDMARKS.cascadeOut.x);
  let dAngle = theta - cascadeAngle;
  while (dAngle > Math.PI) dAngle -= Math.PI * 2;
  while (dAngle < -Math.PI) dAngle += Math.PI * 2;
  const coveIndent = -0.32 * Math.exp(-(dAngle * dAngle) / 0.11);

  return ISLAND_BASE_RADIUS + lobe2 + lobe3 + lobe4 + lobe5 + coveIndent;
}

/** Normalized radial coordinate [0..1+] relative to the irregular island rim */
export function getNormalizedIslandRadius(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < 1e-5) return 0;
  const theta = Math.atan2(z, x);
  return r / getIslandOuterRadius(theta);
}

/** Signed/normalized pond basin factor: 0 outside pond, 1 at deep center */
export function getPondBasinFactor(x: number, z: number): number {
  const dx = (x - LANDMARKS.pond.x) / LANDMARKS.pond.rx;
  const dz = (z - LANDMARKS.pond.z) / LANDMARKS.pond.rz;
  // Organic slight warp so pond shoreline feels natural rather than a geometric ellipse
  const warp = fbm2D(x * 0.85 + 7.1, z * 0.85 - 3.4, 3) * 0.14;
  const ellipDist = Math.hypot(dx, dz) + warp;
  return 1 - smoothstep(0.32, 1.05, ellipDist);
}

/** Shallow brook connecting pond south-west bank to the front-left cascade lip */
export function getBrookFactor(x: number, z: number): number {
  const ax = -1.62;
  const az = 2.15;
  const bx = LANDMARKS.cascadeOut.x;
  const bz = LANDMARKS.cascadeOut.z + 0.35;
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  const t = clamp(((x - ax) * abx + (z - az) * abz) / lenSq, 0, 1);
  const px = ax + abx * t;
  const pz = az + abz * t;
  // Slight meander
  const meander = Math.sin(t * Math.PI * 1.5) * 0.16;
  const dist = Math.hypot(x - (px + meander), z - pz);
  const width = lerp(0.42, 0.28, t);
  return 1 - smoothstep(width * 0.35, width, dist);
}

/**
 * Exact surface height Y of the grassy/shoreline top of the island at (x, z).
 * Shared across mesh generation, prop placement, and raindrop impact checks.
 */
export function getIslandSurfaceHeight(x: number, z: number): number {
  const normR = getNormalizedIslandRadius(x, z);

  // Rolling base meadow undulation
  let h = 0.22 + fbm2D(x * 0.34 + 2.3, z * 0.34 - 1.7, 3) * 0.22;

  // Back-right gentle woodland rise
  const woodlandDist = Math.hypot(x - 1.9, z + 2.55);
  h += (1 - smoothstep(0.4, 2.7, woodlandDist)) * 0.32;

  // Windmill breezy knoll (back-left)
  const wmDist = Math.hypot(x - LANDMARKS.windmill.x, z - LANDMARKS.windmill.z);
  const wmKnoll = 1 - smoothstep(0.85, 2.75, wmDist);
  h = lerp(h, LANDMARKS.windmill.plateauY, wmKnoll);

  // Cottage terrace plateau (smoothly leveled so walls/door sit flush)
  const houseDist = Math.hypot(x - LANDMARKS.house.x, z - LANDMARKS.house.z);
  const houseFlat = 1 - smoothstep(1.15, 2.35, houseDist);
  h = lerp(h, LANDMARKS.house.plateauY, houseFlat);

  // Softly rounded turf bevel near the island outer perimeter
  const rimTaper = smoothstep(0.8, 1.0, normR);
  h = lerp(h, -0.04, rimTaper * 0.88);

  // Carve pond basin & shoreline shelf
  const pondFactor = getPondBasinFactor(x, z);
  if (pondFactor > 0.001) {
    const basinDepth = lerp(0.03, -0.52, Math.pow(pondFactor, 0.85));
    const blend = smoothstep(0.0, 0.38, pondFactor);
    h = lerp(h, basinDepth, blend);
  }

  // Carve shallow brook channel out to the cascade rim
  const brookFactor = getBrookFactor(x, z);
  if (brookFactor > 0.001) {
    h = Math.min(h, lerp(h, POND_WATER_Y - 0.07, brookFactor));
  }

  return h;
}

export function isPointInWater(x: number, z: number): boolean {
  if (getNormalizedIslandRadius(x, z) > 0.96) return false;
  return getIslandSurfaceHeight(x, z) < POND_WATER_Y + 0.035;
}

/** Stepping-stone path curves used both to place stones and to keep grass/trees off the path */
export const PATH_WAYPOINTS_MAIN: ReadonlyArray<readonly [number, number]> = [
  [1.02, 0.22],
  [0.72, 0.68],
  [0.34, 1.02],
  [-0.08, 1.18],
];

export const PATH_WAYPOINTS_MILL: ReadonlyArray<readonly [number, number]> = [
  [0.74, 0.56],
  [0.24, 0.28],
  [-0.32, -0.08],
  [-0.88, -0.48],
  [-1.38, -0.92],
  [-1.76, -1.26],
];

export function isNearPath(x: number, z: number, threshold = 0.44): boolean {
  for (const [px, pz] of PATH_WAYPOINTS_MAIN) {
    if (Math.hypot(x - px, z - pz) < threshold) return true;
  }
  for (const [px, pz] of PATH_WAYPOINTS_MILL) {
    if (Math.hypot(x - px, z - pz) < threshold) return true;
  }
  return false;
}

/**
 * Returns the Y height where a falling 3D raindrop at (x, z) should stop/recycle,
 * or null if (x, z) is outside the floating island's silhouette (so open-air drops
 * fall past the island rim before recycling).
 */
export function getRainImpactHeight(x: number, z: number): number | null {
  const normR = getNormalizedIslandRadius(x, z);
  if (normR > 1.02) {
    return null;
  }

  let surfaceY = Math.max(getIslandSurfaceHeight(x, z), isPointInWater(x, z) ? POND_WATER_Y : -99);

  // Approximate cottage roof shield so rain never falls visibly inside the house
  const dxH = x - LANDMARKS.house.x;
  const dzH = z - LANDMARKS.house.z;
  const cosH = Math.cos(-LANDMARKS.house.rotY);
  const sinH = Math.sin(-LANDMARKS.house.rotY);
  const lx = dxH * cosH - dzH * sinH;
  const lz = dxH * sinH + dzH * cosH;
  if (Math.abs(lx) < 1.12 && Math.abs(lz) < 0.96) {
    const roofPeak = LANDMARKS.house.plateauY + 1.98 - Math.abs(lx) * 0.62;
    surfaceY = Math.max(surfaceY, roofPeak);
  }

  // Approximate windmill cap shield
  const dm = Math.hypot(x - LANDMARKS.windmill.x, z - LANDMARKS.windmill.z);
  if (dm < 0.78) {
    surfaceY = Math.max(surfaceY, LANDMARKS.windmill.plateauY + 2.55);
  }

  return surfaceY;
}
