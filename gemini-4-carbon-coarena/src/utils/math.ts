import * as THREE from 'three';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic PRNG (Mulberry32) so scene details remain composed and reproducible */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number): number {
  let n = ix * 374761393 + iz * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function hash3(ix: number, iy: number, iz: number): number {
  let n = ix * 374761393 + iy * 668265263 + iz * 2147483647;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

/** Smooth 2D value noise in [-1, 1] */
export function noise2D(x: number, z: number): number {
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

  const v = lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
  return v * 2 - 1;
}

/** Smooth 3D value noise in [-1, 1] */
export function noise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = lerp(n000, n100, ux);
  const nx10 = lerp(n010, n110, ux);
  const nx01 = lerp(n001, n101, ux);
  const nx11 = lerp(n011, n111, ux);

  const nxy0 = lerp(nx00, nx10, uy);
  const nxy1 = lerp(nx01, nx11, uy);

  return lerp(nxy0, nxy1, uz) * 2 - 1;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, z * frequency);
    norm += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value / norm;
}

export function fbm3D(x: number, y: number, z: number, octaves = 3): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
    norm += amplitude;
    frequency *= 2.05;
    amplitude *= 0.5;
  }
  return value / norm;
}

export function formatTimeLabel(hours: number): string {
  const clamped = clamp(hours, 0, 24);
  if (clamped >= 23.992) return '24:00';
  const totalMinutes = Math.round(clamped * 60) % 1440;
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function getDayPhaseLabel(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  if (h < 5) return 'Night';
  if (h < 7.2) return 'Dawn';
  if (h < 11.5) return 'Morning';
  if (h < 15.0) return 'Midday';
  if (h < 17.3) return 'Afternoon';
  if (h < 19.4) return 'Sunset';
  if (h < 21.0) return 'Dusk';
  return 'Night';
}

export function lerpColorHex(out: THREE.Color, hexA: number, hexB: number, t: number): THREE.Color {
  const cA = _tmpColorA.setHex(hexA);
  const cB = _tmpColorB.setHex(hexB);
  return out.copy(cA).lerp(cB, clamp(t, 0, 1));
}

const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();
