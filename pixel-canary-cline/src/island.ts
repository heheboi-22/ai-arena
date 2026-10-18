import * as THREE from 'three';
import { clamp, fbm2, smoothstep } from './noise';

/**
 * The island is generated in polar space: one radius curve for the silhouette,
 * one height field for the grass cap. Props are placed with the same functions,
 * which is how trees, the house and the windmill end up standing on the ground
 * instead of hovering above it.
 */

const EDGE = 0.95;
const RIM = 0.7;
const BASE = 0.2;

export const POND = { x: 1.5, z: 1.55, r: 1.02, basin: 0.34 };
export const HOUSE_PAD = { x: -1.3, z: 0.35, r: 1.55, height: 0.16 };
export const MILL_MOUND = { x: 0.55, z: -1.35, r: 1.25, h: 0.4 };

/**
 * Bowl shape, measured in units of POND.r. Inside `shoulder` the ground is the bowl
 * and nothing else, so no noise bump can poke through the water; the override then
 * feathers away to the natural ground by `fade`. `fill` is how full the bowl runs.
 */
const BOWL = { shoulder: 0.95, blendStart: 0.85, fade: 1.5, lip: 0.07, fill: 0.66 };

/**
 * Open ground: rolling noise, the fall-off at the island edge and the mill mound.
 * Everything the pond is *not*, so the bowl can be measured against it.
 */
function openGround(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const edge = clamp(r / (silhouette(Math.atan2(z, x)) * EDGE), 0, 1);
  const rim = smoothstep(RIM, 1, edge);
  let h = BASE;
  h += 0.4 * fbm2(x * 0.5 + 11.3, z * 0.5 - 7.9, 3);
  h += 0.13 * fbm2(x * 1.6 - 3.2, z * 1.6 + 8.1, 2);
  h += 0.55 * (1 - smoothstep(0.1, 1, edge)) - 0.95 * rim * rim;
  return h + mound(x, z);
}

/**
 * Height of the bank the pond sits in: the lowest natural ground found in a ring
 * around the hole, lifted by a lip. The pond is cut into a hillside, so the water
 * line is measured against the *lowest* point of that bank — the surface can then
 * never spill over the bank downhill, which is what made the pond look dry.
 */
function pondRim(): number {
  let low = Infinity;
  for (let k = 0; k < 32; k += 1) {
    const a = (k / 32) * Math.PI * 2;
    for (const ring of [0.85, 0.95, 1.05, 1.15]) {
      low = Math.min(
        low,
        openGround(POND.x + Math.cos(a) * POND.r * ring, POND.z + Math.sin(a) * POND.r * ring),
      );
    }
  }
  return low + BOWL.lip;
}

const POND_RIM = pondRim();
const POND_FLOOR = POND_RIM - POND.basin;

/** Water surface height: every mesh that touches the pond reads this. */
export const WATER_LEVEL = POND_FLOOR + BOWL.fill * (POND_RIM - POND_FLOOR);

/** Where the water meets the bank, so splashes can land on the right thing. */
export const POND_SHORE = POND.r * BOWL.shoulder * Math.sqrt(BOWL.fill);

/** Replace the ground inside the pond footprint with a clean paraboloid bowl. */
function pondBowl(x: number, z: number, base: number): number {
  const d = Math.hypot(x - POND.x, z - POND.z) / POND.r;
  if (d >= BOWL.fade) return base;
  const w = 1 - smoothstep(BOWL.blendStart, BOWL.fade, d);
  const t = Math.min(1, d / BOWL.shoulder);
  const bowl = POND_FLOOR + (POND_RIM - POND_FLOOR) * t * t;
  return base + (bowl - base) * w;
}

/** Irregular, lobed island outline. */
export function silhouette(theta: number): number {
  const x = Math.cos(theta);
  const y = Math.sin(theta);
  return (
    3.9 *
    (1 +
      0.118 * fbm2(x * 1.35 + 4.2, y * 1.35 - 2.7, 3) +
      0.045 * fbm2(x * 3.1 - 1.1, y * 3.1 + 5.3, 2))
  );
}

function mound(x: number, z: number): number {
  const dm = Math.hypot(x - MILL_MOUND.x, z - MILL_MOUND.z) / MILL_MOUND.r;
  return dm < 1 ? MILL_MOUND.h * Math.pow(1 - dm * dm, 1.3) : 0;
}

/** Rolling ground, mill mound and the carved pond bowl. */
function rawGround(x: number, z: number): number {
  const base = openGround(x, z);
  return pondBowl(x, z, base);
}

/** Grass surface height at a world position (x, z). */
export function groundAt(x: number, z: number): number {
  const h = rawGround(x, z);
  const dh = Math.hypot(x - HOUSE_PAD.x, z - HOUSE_PAD.z) / HOUSE_PAD.r;
  if (dh >= 1) return h;
  const w = 1 - smoothstep(0.42, 1, dh);
  const center = rawGround(HOUSE_PAD.x, HOUSE_PAD.z);
  return h + (center - HOUSE_PAD.height - h) * w;
}

/** Approximate surface normal, handy for seating rocks, flowers and stones. */
export function groundNormalAt(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
  const e = 0.08;
  const dx = groundAt(x + e, z) - groundAt(x - e, z);
  const dz = groundAt(x, z + e) - groundAt(x, z - e);
  return target.set(-dx, e * 2, -dz).normalize();
}

/** Grass slope magnitude, used to keep flowers off the steep rim. */
export function groundSlope(x: number, z: number): number {
  const e = 0.12;
  const dx = (groundAt(x + e, z) - groundAt(x - e, z)) / (2 * e);
  const dz = (groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

export function isOnGrass(x: number, z: number, margin = 0.45): boolean {
  const r = Math.hypot(x, z);
  if (r > silhouette(Math.atan2(z, x)) * EDGE - margin) return false;
  if (Math.hypot(x - POND.x, z - POND.z) / (POND.r * 1.2) < 1) return false;
  if (Math.hypot(x - HOUSE_PAD.x, z - HOUSE_PAD.z) < 1.2) return false;
  if (Math.hypot(x - MILL_MOUND.x, z - MILL_MOUND.z) < 0.72) return false;
  return groundSlope(x, z) < 0.75;
}
