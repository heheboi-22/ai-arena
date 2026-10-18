import { fbm2 } from '../core/noise';
import { lerp, smoothstep } from '../core/math';
import { HOUSE, POND, WINDMILL, place, toLocal } from './layout';

/**
 * The island's shape as plain functions. The meshes, object placement and the rain
 * collision all read from here, so they can never disagree about where the ground is.
 */
export const ISLAND_RADIUS = 4.85;

export function rimRadius(theta: number): number {
  return (
    ISLAND_RADIUS *
    (1 +
      0.065 * Math.sin(3 * theta + 0.6) +
      0.045 * Math.sin(5 * theta + 2.1) +
      0.022 * Math.sin(8 * theta + 0.3) +
      0.015 * Math.sin(13 * theta + 4.0))
  );
}

/** Normalised distance from the pond centre: < 1 is water, 1 is the shoreline. */
export function pondQ(x: number, z: number): number {
  const l = toLocal(x, z, POND, POND.rot);
  const nx = l.x / POND.rx;
  const nz = l.z / POND.rz;
  const a = Math.atan2(nz, nx);
  const wobble = 1 + 0.07 * Math.sin(3 * a + 1.0) + 0.04 * Math.sin(5 * a + 2.7);
  return Math.hypot(nx, nz) * wobble;
}

const BACK_RISE = place(-2.6, 2.0);
const HOUSE_HALF = { x: 0.98, z: 0.82 };

function gauss(x: number, z: number, cx: number, cz: number, r: number): number {
  const dx = x - cx;
  const dz = z - cz;
  return Math.exp(-(dx * dx + dz * dz) / (2 * r * r));
}

function rolling(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const edge = r / rimRadius(Math.atan2(z, x));
  return (
    0.085 * fbm2(x * 0.42 + 3.1, z * 0.42 - 1.7, 3) +
    0.4 * gauss(x, z, WINDMILL.x, WINDMILL.z, 1.25) +
    0.3 * gauss(x, z, BACK_RISE.x, BACK_RISE.z, 1.8) -
    0.13 * smoothstep(0.62, 1.0, edge)
  );
}

const HOUSE_PAD_Y = rolling(HOUSE.x, HOUSE.z) + 0.02;
export const WINDMILL_BASE_Y = rolling(WINDMILL.x, WINDMILL.z);

export function groundHeight(x: number, z: number): number {
  let h = rolling(x, z);

  // Level pad under the house.
  const l = toLocal(x, z, HOUSE, HOUSE.yaw);
  const ox = Math.max(Math.abs(l.x) - HOUSE_HALF.x, 0);
  const oz = Math.max(Math.abs(l.z) - HOUSE_HALF.z, 0);
  h = lerp(h, HOUSE_PAD_Y, 1 - smoothstep(0, 0.75, Math.hypot(ox, oz)));

  // Flat meadow around the pond, then a bank that drops into the water.
  const q = pondQ(x, z);
  h = lerp(h, 0.02, 1 - smoothstep(1.12, 1.8, q));
  const w = POND.waterY;
  if (q >= 1 && q < 1.28) {
    const t = (q - 1) / 0.28;
    h = w + (h - w) * (1 - (1 - t) * (1 - t));
  } else if (q < 1) {
    const s = 1 - q;
    h = w - Math.min(s * 0.9, 0.08) - 0.36 * smoothstep(0.1, 0.75, s);
  }
  return h;
}

export function houseFloorY(): number {
  return HOUSE_PAD_Y;
}

/** Height of the island rim at a given angle, used to stitch the cliff to the grass. */
export function rimHeight(theta: number): number {
  const r = rimRadius(theta);
  return groundHeight(Math.cos(theta) * r, Math.sin(theta) * r);
}

export function insideIsland(x: number, z: number, scale = 1): boolean {
  return Math.hypot(x, z) < rimRadius(Math.atan2(z, x)) * scale;
}
