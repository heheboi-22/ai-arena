import { fbm2, smoothstep, lerp } from '../core/math';

/**
 * Layout and ground shape of the island. Everything that needs to know where
 * the ground is (props, rain, ripples) asks these functions, so nothing floats
 * or sinks when the layout is tuned.
 */

export const HOUSE = { x: -1.55, z: 0.55, rot: 0.32, y: 0.1 };
export const MILL = { x: 2.75, z: -2.55, rot: 0.56 };
export const POND = { x: 2.35, z: 2.5, r: 1.42, level: -0.06 };

/** Irregular island outline, radius as a function of angle. */
export function islandRadius(theta: number): number {
  return (
    6.25 *
    (1 +
      0.05 * Math.sin(2 * theta + 0.6) +
      0.045 * Math.sin(3 * theta + 2.1) +
      0.03 * Math.sin(5 * theta + 4.0) +
      0.015 * Math.sin(7 * theta + 1.0))
  );
}

/** 0 at the island centre, 1 on the rim. */
export function islandRho(x: number, z: number): number {
  return Math.hypot(x, z) / islandRadius(Math.atan2(z, x));
}

export function pondRadius(phi: number): number {
  return POND.r * (1 + 0.13 * Math.sin(2 * phi + 1.0) + 0.07 * Math.sin(3 * phi + 0.3));
}

/** Normalised distance to the pond: 0 at its centre, 1 on the waterline. */
export function pondS(x: number, z: number): number {
  const dx = x - POND.x;
  const dz = z - POND.z;
  return Math.hypot(dx, dz) / pondRadius(Math.atan2(dz, dx));
}

/** Height of the bare ground (pond basin included). */
export function groundHeight(x: number, z: number): number {
  let h = 0.05 + 0.2 * (fbm2(x * 0.42 + 3.1, z * 0.42 - 1.7) - 0.5);

  // Knoll under the windmill and a softer rise under the grove.
  const dm = (x - MILL.x) ** 2 + (z - MILL.z) ** 2;
  h += 0.62 * Math.exp(-dm / (2 * 1.35 * 1.35));
  const dg = (x + 3.5) ** 2 + (z + 2.4) ** 2;
  h += 0.28 * Math.exp(-dg / (2 * 1.7 * 1.7));

  // Level pad for the house.
  const dh = Math.hypot(x - HOUSE.x, z - HOUSE.z);
  h = lerp(h, HOUSE.y, smoothstep(2.5, 1.6, dh));

  // Pond: level the banks, then dig the basin.
  const s = pondS(x, z);
  h = lerp(h, 0.02, smoothstep(1.95, 1.25, s));
  h -= 0.64 * smoothstep(1.16, 0.85, s);

  // Round the rim over.
  const rim = smoothstep(0.78, 1.0, islandRho(x, z));
  h -= 0.24 * rim * rim;
  return h;
}

/** Sand bank and pond floor profile, used by the pond mesh. */
export function bankHeight(x: number, z: number): number {
  const s = pondS(x, z);
  if (s <= 1) return POND.level - 0.4 * Math.pow(1 - s * s, 0.8);
  const rise = smoothstep(1.0, 1.12, s);
  return Math.max(lerp(POND.level, 0.045, rise), groundHeight(x, z) + 0.022);
}
