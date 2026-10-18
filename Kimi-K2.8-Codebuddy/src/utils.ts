export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Coherent pseudo-noise for a given angle (radians). Returns roughly
 * [-1, 1] and is used to sculpt the island silhouette consistently:
 * the same angle always yields the same value, so stacked rings align.
 */
export function angleNoise(a: number): number {
  return (
    0.5 * Math.sin(3 * a + 1.7) +
    0.3 * Math.sin(7 * a + 0.4) +
    0.2 * Math.sin(11 * a + 2.9)
  );
}

/** Radial multiplier that gives the island its irregular outline. */
export const edgeFactor = (a: number): number => 1 + 0.07 * angleNoise(a);

/** Deterministic PRNG so the diorama layout is identical on every load. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic hash of a single number to [0, 1). */
export function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Format a float hour (0..24) as a HH:MM label. */
export function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
