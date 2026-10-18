import * as THREE from 'three';
import { lerp, mulberry32, smoothstep } from '../util/math';
import { fbm2 } from '../util/noise';

/**
 * The plan of the island: where everything stands and how high the ground is.
 * One source of truth shared by the meshes, the painted ground texture, the
 * pond depth map and the rain collision map, so none of them can disagree.
 *
 * World axes: +x east, +z south (toward the default camera), +y up.
 */

export const ISLAND_RADIUS = 5.35;
export const ISLAND_DEPTH = 5.4;

export const HOUSE = { x: 1.25, z: -0.35, yaw: -0.32, width: 2.3, depth: 1.55 };
export const WINDMILL = { x: -2.35, z: -2.45, yaw: -0.78, hillTop: 0.4 };
export const POND = { x: -1.9, z: 1.5, rx: 1.75, rz: 1.25, rot: 0.5 };

const HOUSE_LEVEL = 0.1;
const POND_PLATEAU = 0.07;
const BASIN_DEPTH = 0.55;

/** Normalised radius of the shoreline, as a function of the pond's local angle. */
function pondWobble(phi: number): number {
  return 1 + 0.1 * Math.sin(2 * phi + 0.9) + 0.07 * Math.sin(3 * phi + 2.3) + 0.04 * Math.sin(5 * phi + 4.1);
}

const basinProfile = (d: number): number => BASIN_DEPTH * (1 - smoothstep(0.25, 1.65, d));

/** Height of the water surface. Chosen so the shoreline lands exactly at d = 1. */
export const WATER_Y = POND_PLATEAU - basinProfile(1);

const cosRot = Math.cos(POND.rot);
const sinRot = Math.sin(POND.rot);

/** Pond-local coordinates and the wobble-corrected normalised distance (1 = waterline). */
export function pondMetric(x: number, z: number): { u: number; v: number; d: number } {
  const dx = x - POND.x;
  const dz = z - POND.z;
  const u = dx * cosRot + dz * sinRot;
  const v = -dx * sinRot + dz * cosRot;
  const phi = Math.atan2(v / POND.rz, u / POND.rx);
  const d = Math.hypot(u / POND.rx, v / POND.rz) / pondWobble(phi);
  return { u, v, d };
}

/** A world point on the pond at angle `phi`, `scale` times the waterline radius. */
export function pondPoint(phi: number, scale = 1): { x: number; z: number } {
  const k = pondWobble(phi) * scale;
  const u = Math.cos(phi) * POND.rx * k;
  const v = Math.sin(phi) * POND.rz * k;
  return { x: POND.x + u * cosRot - v * sinRot, z: POND.z + u * sinRot + v * cosRot };
}

/** Silhouette of the island seen from above. */
export function rimRadius(theta: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const lumps = fbm2(c * 1.5 + 5, s * 1.5 + 9, 3, 11) - 0.5;
  return (
    ISLAND_RADIUS *
    (1 + 0.075 * Math.cos(2 * (theta - 0.35)) + 0.045 * Math.sin(3 * theta + 2) + 0.03 * Math.sin(5 * theta + 4.4) + 0.2 * lumps)
  );
}

/** 0 at the centre, 1 on the rim. */
export function islandRho(x: number, z: number): number {
  return Math.hypot(x, z) / rimRadius(Math.atan2(z, x));
}

const houseCos = Math.cos(HOUSE.yaw);
const houseSin = Math.sin(HOUSE.yaw);

/** Converts house-local coordinates (x along the facade, z out of the door) to world x/z. */
export function houseToWorld(lx: number, lz: number): { x: number; z: number } {
  return { x: HOUSE.x + lx * houseCos + lz * houseSin, z: HOUSE.z - lx * houseSin + lz * houseCos };
}

/** Converts world x/z to house-local coordinates. */
export function worldToHouse(x: number, z: number): { lx: number; lz: number } {
  const dx = x - HOUSE.x;
  const dz = z - HOUSE.z;
  return { lx: dx * houseCos - dz * houseSin, lz: dx * houseSin + dz * houseCos };
}

export function terrainHeight(x: number, z: number): number {
  const theta = Math.atan2(z, x);
  const rho = Math.hypot(x, z) / rimRadius(theta);

  // Soft dome with some rolling on top.
  let h = 0.15 * (1 - rho * rho);
  h += 0.18 * (fbm2(x * 0.42 + 3.1, z * 0.42 - 1.7, 3, 5) - 0.5);
  h += 0.05 * (fbm2(x * 1.35, z * 1.35, 2, 9) - 0.5);

  // The windmill stands on a small flat-topped hill.
  const dm = Math.hypot(x - WINDMILL.x, z - WINDMILL.z);
  h = lerp(h, WINDMILL.hillTop, 1 - smoothstep(0.8, 2.3, dm));

  // A level yard around the house.
  const { lx, lz } = worldToHouse(x, z);
  const dh = Math.hypot(lx / 1.35, (lz - 0.25) / 1.1);
  h = lerp(h, HOUSE_LEVEL, 1 - smoothstep(1.0, 2.1, dh));

  // The pond: flatten the surroundings, then dig the basin.
  const { d } = pondMetric(x, z);
  h = lerp(h, POND_PLATEAU, 1 - smoothstep(1.7, 2.8, d));
  h -= basinProfile(d);
  h += 0.03 * Math.exp(-Math.pow((d - 1.6) / 0.28, 2));

  // The turf rolls over the edge.
  h -= 0.32 * Math.pow(smoothstep(0.78, 1, rho), 1.4);
  return h;
}

// ---------------------------------------------------------------------------
// Things that stand on the island
// ---------------------------------------------------------------------------

export type TreeKind = 'oak' | 'round' | 'pine' | 'poplar' | 'blossom';

export interface TreeSpec {
  kind: TreeKind;
  x: number;
  z: number;
  height: number;
  seed: number;
  /** Which foliage material variant to use. */
  tone: number;
}

export const TREES: TreeSpec[] = [
  { kind: 'oak', x: 3.35, z: -2.0, height: 2.75, seed: 3, tone: 0 },
  { kind: 'round', x: 2.3, z: 3.25, height: 1.65, seed: 8, tone: 1 },
  { kind: 'pine', x: -0.35, z: -3.65, height: 3.1, seed: 5, tone: 0 },
  { kind: 'pine', x: -4.35, z: 0.1, height: 2.1, seed: 12, tone: 1 },
  { kind: 'poplar', x: 4.45, z: -0.45, height: 2.5, seed: 21, tone: 2 },
  { kind: 'blossom', x: -0.85, z: -1.85, height: 1.6, seed: 33, tone: 0 },
  { kind: 'round', x: -4.0, z: 1.85, height: 1.3, seed: 14, tone: 2 },
  { kind: 'pine', x: 1.75, z: -3.45, height: 1.85, seed: 41, tone: 2 },
];

export interface RockSpec {
  x: number;
  z: number;
  size: number;
  seed: number;
}

export const ROCKS: RockSpec[] = [
  { x: -3.85, z: 0.55, size: 0.34, seed: 1 },
  { x: -3.3, z: -0.55, size: 0.2, seed: 2 },
  { x: 0.55, z: 2.95, size: 0.28, seed: 3 },
  { x: 0.95, z: 2.65, size: 0.15, seed: 4 },
  { x: -1.0, z: -0.75, size: 0.3, seed: 5 },
  { x: -3.95, z: -2.2, size: 0.42, seed: 6 },
  { x: 3.55, z: 3.05, size: 0.36, seed: 7 },
  { x: 4.05, z: 2.35, size: 0.22, seed: 8 },
  { x: -1.2, z: -4.1, size: 0.36, seed: 9 },
];

export interface FlowerPatch {
  x: number;
  z: number;
  radius: number;
  count: number;
}

export const FLOWER_PATCHES: FlowerPatch[] = [
  { x: 0.55, z: 1.75, radius: 0.7, count: 16 },
  { x: 2.45, z: 1.25, radius: 0.75, count: 20 },
  { x: -3.1, z: 3.25, radius: 0.8, count: 16 },
  { x: -3.7, z: -1.0, radius: 0.55, count: 10 },
  { x: 2.2, z: -3.1, radius: 0.6, count: 10 },
  { x: -0.1, z: -2.6, radius: 0.6, count: 10 },
];

/** Stepping-stone route, from the house door toward the pond and the windmill. */
export const PATH_POINTS: Array<[number, number]> = [
  [0.78, 1.08],
  [0.25, 0.72],
  [-0.45, 0.28],
  [-1.2, -0.22],
  [-1.98, -0.74],
  [-2.62, -1.2],
  [-3.05, -1.66],
];

/** Garden fence around the flower beds on the house's right-hand side, in house-local (lx, lz). */
const FENCE_LOCAL: Array<[number, number]> = [
  [1.32, 0.35],
  [1.32, 1.45],
  [1.95, 2.05],
  [2.8, 2.0],
  [3.1, 1.2],
  [3.05, 0.35],
];
export const FENCE_POINTS: Array<[number, number]> = FENCE_LOCAL.map(([lx, lz]) => {
  const p = houseToWorld(lx, lz);
  return [p.x, p.z];
});

export interface StoneSpec {
  x: number;
  z: number;
  r: number;
  rot: number;
}

/** Evenly spaced stepping stones along `PATH_POINTS`, with a little hand-placed wobble. */
export function computePathStones(): StoneSpec[] {
  const curve = new THREE.CatmullRomCurve3(
    PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  );
  const rng = mulberry32(77);
  const count = Math.max(2, Math.round(curve.getLength() / 0.47));
  const stones: StoneSpec[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const side = (rng() - 0.5) * 0.16;
    stones.push({
      x: p.x - tan.z * side,
      z: p.z + tan.x * side,
      r: 0.15 + rng() * 0.06,
      rot: rng() * Math.PI,
    });
  }
  return stones;
}

/** Rough radius of the shade a tree throws on the ground (also its collision radius). */
export function treeShadeRadius(tree: TreeSpec): number {
  switch (tree.kind) {
    case 'pine':
      return 0.2 * tree.height + 0.18;
    case 'poplar':
      return 0.16 * tree.height + 0.15;
    default:
      return 0.3 * tree.height + 0.25;
  }
}
