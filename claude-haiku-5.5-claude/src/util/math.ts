export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Frame-rate independent exponential approach: `rate` is roughly 1/seconds.
// Calling it with a different dt gives the same curve, so it behaves the same
// at 30 fps and 144 fps, and retargeting mid-way never creates a second tween.
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

// Shortest signed distance on a 24-hour clock, in hours, within [-12, 12).
export function hourDelta(from: number, to: number): number {
  let d = (to - from) % 24;
  if (d >= 12) d -= 24;
  if (d < -12) d += 24;
  return d;
}

export function wrapHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

// Small seeded PRNG so the island looks identical on every load.
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
