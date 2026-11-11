import * as THREE from 'three';
import { TAU, clamp01, fbm2, hash3, lerp, noise2, smoothstep } from '../core/math';
import { TriSoup, type P3 } from '../core/trisoup';
import { clay } from './materials';
import { C } from './palette';
import { groundHeight, islandRadius, islandRho } from './terrain';

type P = P3;

const SEGMENTS = 96;
const gBase = new THREE.Color(C.grass);
const gLight = new THREE.Color(C.grassLight);
const gDark = new THREE.Color(C.grassDark);
const gDry = new THREE.Color(C.grassDry);
const gSkirt = new THREE.Color(C.grassSkirt);
const cSoil = new THREE.Color(C.soil);
const cRock = new THREE.Color(C.rock);
const cRockDeep = new THREE.Color(C.rockDeep);
const cRockDark = new THREE.Color(C.rockDark);
const tmp = new THREE.Color();

function grassColor(x: number, y: number, z: number): THREE.Color {
  const n = fbm2(x * 0.55 + 10.3, z * 0.55 + 4.1);
  const patch = fbm2(x * 1.1 - 7.2, z * 1.1 + 2.6);
  tmp.copy(gBase)
    .lerp(gLight, smoothstep(0.38, 0.72, n) * 0.9)
    .lerp(gDark, smoothstep(0.52, 0.28, patch) * 0.55)
    .lerp(gDry, smoothstep(0.8, 1.0, islandRho(x, z)) * 0.45)
    .lerp(gLight, clamp01(y - 0.25) * 0.5);
  return tmp.multiplyScalar(0.96 + 0.08 * hash3(x, y, z));
}

function buildTop(soup: TriSoup): void {
  const RINGS = 26;
  const up = (_nx: number, ny: number): number => ny;
  const pt = (i: number, j: number): P => {
    const th = (j / SEGMENTS) * TAU;
    const r = Math.pow(i / RINGS, 0.9) * islandRadius(th);
    const x = r * Math.cos(th);
    const z = r * Math.sin(th);
    return [x, groundHeight(x, z), z];
  };
  const face = (a: P, b: P, c: P): void => {
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    soup.tri(a, b, c, grassColor(cx, cy, cz), up);
  };
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
      if (i === 0) {
        face(a, c, d);
      } else if ((i + j) % 2 === 0) {
        face(a, b, c);
        face(a, c, d);
      } else {
        face(a, b, d);
        face(b, c, d);
      }
    }
  }
}

/** The turf edge that drapes over the rock like a thick blanket. */
function buildSkirt(soup: TriSoup): void {
  const ring = (j: number): { t: P; m: P; l: P } => {
    const th = (j / SEGMENTS) * TAU;
    const R = islandRadius(th);
    const cx = Math.cos(th), cz = Math.sin(th);
    const y = groundHeight(R * cx, R * cz);
    const k = j % SEGMENTS;
    const drop = 0.5 + 0.5 * noise2(k * 0.37, 3.3) + (k % 2 === 0 ? 0.16 : 0);
    return {
      t: [R * cx, y, R * cz],
      m: [R * 1.03 * cx, y - 0.24, R * 1.03 * cz],
      l: [R * 0.925 * cx, y - drop, R * 0.925 * cz],
    };
  };
  for (let j = 0; j < SEGMENTS; j++) {
    const a = ring(j), b = ring(j + 1);
    const mx = (a.t[0] + b.t[0]) / 2, mz = (a.t[2] + b.t[2]) / 2;
    const out = (nx: number, _ny: number, nz: number): number => nx * mx + nz * mz;
    const shade = 0.95 + 0.1 * hash3(mx, 0, mz);
    const upper = tmp.copy(gBase).lerp(gSkirt, 0.35).multiplyScalar(shade).clone();
    const lower = tmp.copy(gSkirt).multiplyScalar(shade).clone();
    soup.tri(a.t, b.t, b.m, upper, out);
    soup.tri(a.t, b.m, a.m, upper, out);
    soup.tri(a.m, b.m, b.l, lower, out);
    soup.tri(a.m, b.l, a.l, lower, out);
  }
}

/** Hanging spurs that give the underside its silhouette: x, z, length, width. */
const SPURS: [number, number, number, number][] = [
  [0.2, -0.1, 2.3, 1.25],
  [-2.5, 1.2, 1.5, 0.8],
  [2.3, 1.7, 1.25, 0.72],
  [1.3, -2.7, 1.35, 0.78],
  [-1.7, -2.3, 1.0, 0.62],
  [-0.4, 2.9, 0.8, 0.55],
];

function rockDepth(x: number, z: number, rho: number): number {
  const body = Math.pow(Math.max(0, 1 - Math.pow(rho, 2.4)), 0.72);
  let d = 4.3 * body * (0.72 + 0.56 * fbm2(x * 0.36 + 5.5, z * 0.36 - 2.2));
  for (const [sx, sz, len, w] of SPURS) {
    d += len * Math.exp(-((x - sx) ** 2 + (z - sz) ** 2) / (2 * w * w)) * body;
  }
  return d;
}

function buildRock(soup: TriSoup): void {
  const RINGS = 20;
  const down = (_nx: number, ny: number): number => -ny;
  const cache = new Map<number, P>();
  const pt = (i: number, j: number): P => {
    const jj = j % SEGMENTS;
    const key = i * 1000 + jj;
    const hit = cache.get(key);
    if (hit) return hit;
    const th = (jj / SEGMENTS) * TAU;
    const rho = Math.pow(i / RINGS, 0.8);
    const r = rho * islandRadius(th) * 0.955;
    let x = r * Math.cos(th);
    let z = r * Math.sin(th);
    const rimY = groundHeight(x, z) - 0.3;
    // Loosen the grid so the facets read as chipped stone, not a lathe.
    const wobble = 0.34 * smoothstep(1.0, 0.8, rho) * (i > 0 ? 1 : 0);
    x += (hash3(x, 1.7, z) - 0.5) * wobble;
    z += (hash3(x, 4.2, z) - 0.5) * wobble;
    let y = -rockDepth(x, z, rho);
    // Pull heights towards terraces for a layered, sedimentary feel.
    y = lerp(y, Math.round(y / 0.85) * 0.85, 0.34 * smoothstep(1.0, 0.9, rho));
    y += (hash3(x, 9.1, z) - 0.5) * 0.22 * smoothstep(1.0, 0.85, rho);
    const p: P = [x, rimY + y, z];
    cache.set(key, p);
    return p;
  };
  const color = (a: P, b: P, c: P): THREE.Color => {
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    const t = clamp01(-cy / 6.2);
    tmp.copy(cSoil)
      .lerp(cRock, smoothstep(0.1, 0.24, t))
      .lerp(cRockDeep, smoothstep(0.3, 0.7, t))
      .lerp(cRockDark, smoothstep(0.7, 1.0, t));
    const strata = Math.sin(cy * 5.4 + noise2(cx * 0.6, cz * 0.6) * 2.5) > 0.55 ? 1.09 : 1;
    return tmp.multiplyScalar((0.9 + 0.2 * hash3(cx, cy, cz)) * strata);
  };
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
      if (i === 0) {
        soup.tri(a, c, d, color(a, c, d), down);
      } else if ((i + j) % 2 === 0) {
        soup.tri(a, b, c, color(a, b, c), down);
        soup.tri(a, c, d, color(a, c, d), down);
      } else {
        soup.tri(a, b, d, color(a, b, d), down);
        soup.tri(b, c, d, color(b, c, d), down);
      }
    }
  }
}

export function createIsland(): THREE.Mesh {
  const soup = new TriSoup();
  buildTop(soup);
  buildSkirt(soup);
  buildRock(soup);
  const mesh = new THREE.Mesh(soup.geometry(), clay);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'island';
  return mesh;
}
