import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic tiny PRNG (mulberry32) so the world builds identically every load. */
export class Rng {
  private s: number;
  constructor(seed = 7) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/** Give every vertex of a geometry a (linear-space) color attribute. */
export function paintGeometry(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0): void {
  const base = new THREE.Color(color);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    if (jitter > 0) {
      const f = 1 + (Math.random() - 0.5) * jitter;
      arr[i * 3] = base.r * f;
      arr[i * 3 + 1] = base.g * f;
      arr[i * 3 + 2] = base.b * f;
    } else {
      arr[i * 3] = base.r;
      arr[i * 3 + 1] = base.g;
      arr[i * 3 + 2] = base.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

/**
 * Faceted jitter: every triangle of a non-indexed geometry drifts by the same
 * random offset, so faces stay flat but the silhouette turns hand-cut.
 */
export function jitterFacets(geo: THREE.BufferGeometry, amount: number, rng: Rng): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const dx = rng.range(-amount, amount);
    const dy = rng.range(-amount, amount);
    const dz = rng.range(-amount, amount);
    for (let j = 0; j < 3; j++) {
      pos.setXYZ(i + j, pos.getX(i + j) + dx, pos.getY(i + j) + dy, pos.getZ(i + j) + dz);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Soft radial glow sprite drawn on a canvas. */
export function radialTexture(stops: Array<[number, string]>, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [stop, color] of stops) g.addColorStop(stop, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Merge geometries into one, painting any part that lacks a color attribute. */
export function mergePainted(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const g of parts) {
    if (!g.attributes.color) paintGeometry(g, 0xffffff);
  }
  return mergeGeometries(parts, false)!;
}
