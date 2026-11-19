import { clamp, smoothstep } from "../state/worldState";

export const WATER_LEVEL = -0.06;

export const LANDMARKS = {
  house: { x: -1.85, z: -1.05, rotationY: 0.42 },
  windmill: { x: 2.55, z: -1.85, rotationY: -0.38 },
  pond: { x: 1.55, z: 1.9, rx: 2.25, rz: 1.62, rot: -0.26 },
  dock: { x: -0.05, z: 1.48, rotationY: -0.24 },
} as const;

/** Deterministic Mulberry32 PRNG for reproducible handcrafted placement. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/** Smooth 2D value noise in [0, 1]. */
export function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Fractal Brownian Motion noise in [-1, 1]. */
export function fbm2D(x: number, z: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += (valueNoise2D(x * freq, z * freq) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

/**
 * Irregular handmade silhouette radius of the floating island at polar angle `theta`.
 * Deliberately organic and asymmetric, averaging ~7.15 units.
 */
export function getIslandRadiusAtAngle(theta: number): number {
  return (
    7.15 +
    0.58 * Math.cos(theta * 2 - 0.55) +
    0.42 * Math.sin(theta * 3 + 0.9) +
    0.26 * Math.cos(theta * 4 + 1.7) +
    0.18 * Math.sin(theta * 5 - 0.65)
  );
}

/** Normalized radial distance from island center (0 = center, 1 = grassy rim). */
export function getNormalizedIslandRadius(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const maxR = getIslandRadiusAtAngle(theta);
  return r / maxR;
}

export function isInsideIsland(x: number, z: number, margin = 1.0): boolean {
  return getNormalizedIslandRadius(x, z) <= margin;
}

/**
 * Normalized radial metric inside the kidney-shaped pond (< 1.0 means inside pond).
 */
export function getPondMetric(x: number, z: number): number {
  const dx = x - LANDMARKS.pond.x;
  const dz = z - LANDMARKS.pond.z;
  const c = Math.cos(LANDMARKS.pond.rot);
  const s = Math.sin(LANDMARKS.pond.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;

  // Gentle kidney indentation on the north-west edge near the meadow center
  const indent = 0.16 * Math.exp(-Math.pow((lx + 0.35) / 1.05, 2)) * (lz < 0 ? 1 : 0);
  const nx = lx / LANDMARKS.pond.rx;
  const nz = (lz + indent * 0.85) / LANDMARKS.pond.rz;

  // Slight organic wobble on the shoreline
  const angle = Math.atan2(nz, nx);
  const wobble = 1 + 0.065 * Math.sin(angle * 3 + 0.4) + 0.04 * Math.cos(angle * 2 - 0.9);
  return Math.hypot(nx, nz) / wobble;
}

export function isInsidePond(x: number, z: number, threshold = 0.96): boolean {
  return getPondMetric(x, z) < threshold;
}

/**
 * Ground surface height Y of the island top at world (x, z).
 * Smoothly incorporates the cottage plateau, windmill ridge, pond basin, and tapered turf rim.
 */
export function getIslandTopHeight(x: number, z: number): number {
  const normR = getNormalizedIslandRadius(x, z);

  // Soft rolling base hills
  const hillNoise = fbm2D(x * 0.22 + 3.1, z * 0.22 - 1.7, 3) * 0.26;
  const northSlope = clamp(-z * 0.045, -0.18, 0.28);
  let y = 0.36 + hillNoise + northSlope;

  // Gentle plateau for the cottage (level pad so plinth sits flush)
  const houseDist = Math.hypot(x - LANDMARKS.house.x, z - LANDMARKS.house.z);
  const houseBlend = 1 - smoothstep(1.45, 2.85, houseDist);
  y = y * (1 - houseBlend) + 0.56 * houseBlend;

  // Elevated knoll for the windmill (clear vertical hierarchy)
  const millDist = Math.hypot(x - LANDMARKS.windmill.x, z - LANDMARKS.windmill.z);
  const millBlend = 1 - smoothstep(1.05, 2.75, millDist);
  y = y * (1 - millBlend) + 0.94 * millBlend;

  // Carve smooth pond basin with visible sandy shoreline shelf
  const pondM = getPondMetric(x, z);
  const shoreMask = 1 - smoothstep(0.88, 1.38, pondM);
  const basinMask = 1 - smoothstep(0.28, 1.04, pondM);
  // Bring outer shore down gently near water level, then dip into basin
  y = y * (1 - shoreMask * 0.65) + 0.14 * (shoreMask * 0.65);
  y -= basinMask * 0.72;

  // Cushion-like turf bevel right at the outer cliff rim
  const rimDrop = smoothstep(0.86, 1.02, normR);
  y -= rimDrop * 0.26;

  return y;
}

/**
 * Sculpted underside rock surface Y at polar coordinates (normR in [0..1], theta).
 * Used to shape the craggy floating island underside tapering to an asymmetric rock spire.
 */
export function getIslandUndersideHeight(normR: number, theta: number): number {
  const t = clamp(normR, 0, 1);
  // Steep sheer cliff wall near the rim (t ~ 0.85..1.0) transitioning into a chunky faceted rock keel
  const baseProfile = -5.6 * Math.pow(1 - t, 0.92) - 0.55;

  // Stratified geological rock shelves
  const strata = Math.sin(t * Math.PI * 4.5) * 0.24 * Math.sin(t * Math.PI);

  // Angular sculpted crag ribs radiating down the underside
  const crags =
    (0.55 * Math.sin(theta * 5 + 0.4) +
      0.38 * Math.cos(theta * 7 - 1.1) +
      0.24 * Math.sin(theta * 11 + 2.3)) *
    Math.sin(t * Math.PI) *
    (0.45 + 0.55 * t);

  return baseProfile + strata + crags;
}

/**
 * Computes the effective vertical stop height for falling 3D rain particles at (x, z).
 * Returns null when outside the island silhouette (rain continues past the rim and recycles low).
 */
export function getRainStopHeightAt(x: number, z: number): number | null {
  if (!isInsideIsland(x, z, 0.99)) {
    return null;
  }
  const terrainY = getIslandTopHeight(x, z);
  return Math.max(terrainY, WATER_LEVEL);
}

/** Sample a smooth point along the main curved cottage-to-pond & windmill path for color tinting. */
export function getDistanceToPath(x: number, z: number): number {
  // Segment 1: Cottage front door -> Pond dock
  const ptsA: Array<[number, number]> = [
    [-1.12, 0.18],
    [-0.78, 0.62],
    [-0.45, 1.02],
    [-0.12, 1.38],
  ];
  // Segment 2: Spur from path junction -> Windmill entrance
  const ptsB: Array<[number, number]> = [
    [-0.58, 0.78],
    [0.12, 0.32],
    [0.82, -0.22],
    [1.45, -0.74],
    [1.98, -1.16],
  ];

  let minDist = Infinity;
  const checkPolyline = (pts: Array<[number, number]>) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const abx = bx - ax;
      const abz = bz - az;
      const lenSq = abx * abx + abz * abz || 1;
      const t = clamp(((x - ax) * abx + (z - az) * abz) / lenSq, 0, 1);
      const px = ax + abx * t;
      const pz = az + abz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < minDist) minDist = d;
    }
  };

  checkPolyline(ptsA);
  checkPolyline(ptsB);
  return minDist;
}
