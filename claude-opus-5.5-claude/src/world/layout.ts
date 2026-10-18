import * as THREE from 'three';

/**
 * Where everything sits. Positions are authored in "view space" so the composition can be
 * reasoned about from the default camera: `s` runs to the right of the screen and `d` runs
 * away from the viewer. `place()` turns that into world x/z.
 */
export const VIEW_AZIMUTH = THREE.MathUtils.degToRad(38);

const sinA = Math.sin(VIEW_AZIMUTH);
const cosA = Math.cos(VIEW_AZIMUTH);

export interface XZ {
  x: number;
  z: number;
}

export function place(s: number, d: number): XZ {
  return { x: s * cosA - d * sinA, z: -s * sinA - d * cosA };
}

/** Yaw that turns an object's local +z toward the default camera, plus an offset in degrees. */
export const facingCamera = (offsetDeg = 0): number => VIEW_AZIMUTH + THREE.MathUtils.degToRad(offsetDeg);

export const HOUSE = { ...place(-0.75, 0.55), yaw: facingCamera(-26) };
/** Just outside the front door, in the house's own frame (door faces +z). */
export const DOOR_LOCAL = { x: 0.22, z: 0.93 };
export const WINDMILL = { ...place(2.5, 1.9), yaw: facingCamera(12) };
export const POND = { ...place(1.6, -1.5), rx: 1.4, rz: 0.98, rot: VIEW_AZIMUTH + 0.12, waterY: -0.07 };

/** Wind blows toward screen-right and slightly toward the viewer, so drift reads clearly. */
export const WIND_DIR = (() => {
  const a = place(1, -0.35);
  return new THREE.Vector3(a.x, 0, a.z).normalize();
})();

export type TreeKind = 'pine' | 'round' | 'poplar' | 'bush';

export interface TreeSpot {
  s: number;
  d: number;
  kind: TreeKind;
  size: number;
  seed: number;
}

export const TREES: TreeSpot[] = [
  { s: -3.05, d: 1.15, kind: 'pine', size: 2.35, seed: 11 },
  { s: -2.25, d: 2.45, kind: 'pine', size: 1.85, seed: 12 },
  { s: -3.55, d: -0.35, kind: 'round', size: 1.45, seed: 13 },
  { s: -1.2, d: 2.75, kind: 'poplar', size: 2.0, seed: 14 },
  { s: 0.75, d: 2.6, kind: 'round', size: 1.75, seed: 15 },
  { s: 3.55, d: -0.15, kind: 'round', size: 1.2, seed: 16 },
  { s: 3.35, d: -1.55, kind: 'pine', size: 1.25, seed: 17 },
  { s: 0.55, d: 0.15, kind: 'bush', size: 0.55, seed: 18 },
  { s: -2.6, d: -1.75, kind: 'bush', size: 0.6, seed: 19 },
  { s: 1.25, d: 1.15, kind: 'bush', size: 0.5, seed: 20 },
  { s: -0.15, d: -3.55, kind: 'bush', size: 0.45, seed: 21 },
];

/** Door step to the front rim, plus a short branch to the pond. In view space. */
const PATH_MAIN: [number, number][] = [
  [-0.95, -1.05],
  [-0.62, -1.85],
  [-0.48, -2.7],
  [-0.62, -3.55],
  [-0.8, -4.2],
];
const PATH_BRANCH: [number, number][] = [
  [-0.66, -1.75],
  [-0.2, -1.62],
  [0.18, -1.5],
];

function toCurve(points: [number, number][], start?: XZ): THREE.CatmullRomCurve3 {
  const pts = points.map(([s, d]) => {
    const p = place(s, d);
    return new THREE.Vector3(p.x, 0, p.z);
  });
  if (start) pts.unshift(new THREE.Vector3(start.x, 0, start.z));
  return new THREE.CatmullRomCurve3(pts);
}

/** Inverse of `toLocal`. */
export function toWorld(lx: number, lz: number, origin: XZ, yaw: number): XZ {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: origin.x + lx * c + lz * s, z: origin.z - lx * s + lz * c };
}

export const DOOR_WORLD = toWorld(DOOR_LOCAL.x, DOOR_LOCAL.z, HOUSE, HOUSE.yaw);

export const PATH_CURVES = [toCurve(PATH_MAIN, DOOR_WORLD), toCurve(PATH_BRANCH)];

const pathSamples: XZ[] = PATH_CURVES.flatMap((c) =>
  c.getSpacedPoints(60).map((p) => ({ x: p.x, z: p.z })),
);

/** Distance from a point to the nearest path centre line. */
export function pathDistance(x: number, z: number): number {
  let best = Infinity;
  for (const p of pathSamples) {
    const dx = x - p.x;
    const dz = z - p.z;
    const dist = dx * dx + dz * dz;
    if (dist < best) best = dist;
  }
  return Math.sqrt(best);
}

/** Converts a world point into a frame centred on `origin` and rotated by `yaw`. */
export function toLocal(x: number, z: number, origin: XZ, yaw: number): XZ {
  const dx = x - origin.x;
  const dz = z - origin.z;
  const c = Math.cos(-yaw);
  const s = Math.sin(-yaw);
  return { x: dx * c + dz * s, z: -dx * s + dz * c };
}
