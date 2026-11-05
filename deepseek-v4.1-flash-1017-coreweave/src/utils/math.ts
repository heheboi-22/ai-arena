import * as THREE from 'three';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

export const wrap24 = (hour: number): number => ((hour % 24) + 24) % 24;

export const shortestHourDelta = (from: number, to: number): number => {
  let delta = wrap24(to) - wrap24(from);
  if (delta > 12) delta -= 24;
  if (delta < -12) delta += 24;
  return delta;
};

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;


export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashNoise = (x: number, z: number): number => {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export const smoothNoise = (x: number, z: number): number => {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hashNoise(xi, zi);
  const b = hashNoise(xi + 1, zi);
  const c = hashNoise(xi, zi + 1);
  const d = hashNoise(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
};

export const sunDirection = (hour: number, target = new THREE.Vector3()): THREE.Vector3 => {
  const progress = (hour - 6) / 12;
  const angle = progress * Math.PI;
  const y = Math.sin(angle) * 0.95;
  const x = Math.cos(angle) * 0.92;
  return target.set(x, y, 0.34).normalize();
};

export const isReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
