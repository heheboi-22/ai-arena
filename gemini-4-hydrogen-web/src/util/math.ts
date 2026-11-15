export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential damping. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Deterministic PRNG (Mulberry32). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

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

  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

export function fbm2D(x: number, z: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Organic irregular outer radius of the floating island at polar angle theta. */
export function islandRadiusAt(angle: number): number {
  return (
    7.35 +
    0.58 * Math.cos(2 * angle - 0.55) +
    0.42 * Math.sin(3 * angle + 1.1) +
    0.26 * Math.cos(5 * angle - 0.4) +
    0.14 * Math.sin(7 * angle + 2.2)
  );
}

export const POND_CENTER = { x: -0.68, z: 2.08 };
export const HOUSE_CENTER = { x: 1.92, z: -0.82 };
export const WINDMILL_CENTER = { x: -2.72, z: -1.52 };
export const WATER_LEVEL = 0.04;

/** Signed distance-like normalized factor for the organic kidney-shaped pond (< 1 inside pond). */
export function pondNormalizedRadius(x: number, z: number): number {
  const dx = x - POND_CENTER.x;
  const dz = z - POND_CENTER.z;
  // Slight rotation and organic lobe
  const cos = 0.94;
  const sin = -0.34;
  const rx = dx * cos - dz * sin;
  const rz = dx * sin + dz * cos;
  const angle = Math.atan2(rz, rx);
  const wobble = 1 + 0.09 * Math.sin(2 * angle + 0.6) + 0.06 * Math.cos(3 * angle - 0.8);
  const nx = rx / (2.08 * wobble);
  const nz = rz / (1.46 * wobble);
  return Math.sqrt(nx * nx + nz * nz);
}

/** Deterministic terrain surface elevation at world (x, z). */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const maxR = islandRadiusAt(angle);

  // Base gentle organic meadow undulation
  let h =
    0.24 +
    (fbm2D(x * 0.24 + 4.1, z * 0.24 - 2.3, 3) - 0.5) * 0.46;

  // Elevated knoll under the windmill
  const distWindmill = Math.hypot(x - WINDMILL_CENTER.x, z - WINDMILL_CENTER.z);
  const knoll = 1 - smoothstep(0.95, 2.85, distWindmill);
  h = lerp(h, 0.68, knoll * 0.82);

  // Level cozy terrace under the cottage
  const distHouse = Math.hypot(x - HOUSE_CENTER.x, z - HOUSE_CENTER.z);
  const housePad = 1 - smoothstep(1.25, 2.55, distHouse);
  h = lerp(h, 0.34, housePad * 0.92);

  // Gentle rim bevel sloping down toward the grass lip
  const rimStart = maxR * 0.78;
  const rimT = smoothstep(rimStart, maxR * 1.01, r);
  h -= rimT * 0.26;

  // Carved basin for the pond
  const pondR = pondNormalizedRadius(x, z);
  if (pondR < 1.35) {
    const basin = 1 - smoothstep(0.55, 1.32, pondR);
    const basinDepth = lerp(h, -0.46, basin);
    h = basinDepth;
  }

  return h;
}
