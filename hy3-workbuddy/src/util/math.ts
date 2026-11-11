// Small math helpers used across the scene.

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Frame-rate independent damping (exponential smoothing).
 * `lambda` is the convergence rate; higher = snappier.
 */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number
): number => lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (
  edge0: number,
  edge1: number,
  x: number
): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Deterministic pseudo-noise as a function of an angle.
 * Used to give the island an irregular, hand-made silhouette that is stable
 * across reloads and shared between the grass rim and the rock top.
 */
export const angleNoise = (a: number): number =>
  1 +
  0.12 * Math.sin(a * 3.0) +
  0.08 * Math.sin(a * 7.0 + 1.3) +
  0.05 * Math.sin(a * 13.0 + 2.1) +
  0.03 * Math.sin(a * 5.0 + 4.0);

export const TAU = Math.PI * 2;
