/** Small math helpers shared across the world and system modules. */

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Frame-rate independent exponential damping. `smoothing` is the fraction of
 * the remaining distance left after one second (smaller = snappier).
 */
export const damp = (
  current: number,
  target: number,
  smoothing: number,
  dt: number,
): number => lerp(current, target, 1 - Math.pow(smoothing, dt));

/** Deterministic pseudo-random generator so the island looks the same each run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap smooth-ish value noise built on a seeded random table. */
export function makeValueNoise(seed: number): (x: number, y: number) => number {
  const rand = mulberry32(seed);
  const size = 64;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = rand();

  const at = (ix: number, iy: number) =>
    table[(((ix % size) + size) % size) * size + (((iy % size) + size) % size)];

  return (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smoothstep(x - ix);
    const fy = smoothstep(y - iy);
    const a = lerp(at(ix, iy), at(ix + 1, iy), fx);
    const b = lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx);
    return lerp(a, b, fy);
  };
}

/** Formats decimal hours (0..24) as an "HH:MM" clock label. */
export function formatClock(hours: number): string {
  const h = Math.floor(((hours % 24) + 24) % 24);
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
