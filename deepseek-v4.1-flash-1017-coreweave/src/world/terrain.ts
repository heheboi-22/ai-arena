import { smoothstep } from '../utils/math';

export const ISLAND_RADIUS = 5.2;
export const WATER_LEVEL = 0.14;

export const POND = {
  x: 1.52,
  z: 1.12,
  radius: 1.26
};

export const islandEdgeRadius = (angle: number): number => {
  return (
    ISLAND_RADIUS *
    (1 +
      0.07 * Math.sin(angle * 3 + 0.6) +
      0.04 * Math.sin(angle * 5 - 1.1) +
      0.022 * Math.sin(angle * 8 + 2.2))
  );
};

export const pondEdgeFactor = (angle: number): number =>
  1 + 0.055 * Math.sin(angle * 3 + 0.4) + 0.032 * Math.sin(angle * 5 - 1.4);

export const pondRadiusAt = (angle: number): number => POND.radius * pondEdgeFactor(angle);

export const pondDistance = (x: number, z: number): number =>
  Math.hypot(x - POND.x, z - POND.z);

const gaussian = (x: number, z: number, cx: number, cz: number, spread: number): number => {
  const dx = x - cx;
  const dz = z - cz;
  return Math.exp(-(dx * dx + dz * dz) / (2 * spread * spread));
};

export const terrainHeight = (x: number, z: number): number => {
  const angle = Math.atan2(z, x);
  const radius = Math.hypot(x, z);
  const edge = islandEdgeRadius(angle);

  let height = 0.17;
  height += 0.4 * gaussian(x, z, -1.5, -0.3, 1.55);
  height += 0.28 * gaussian(x, z, 2.7, -2.1, 1.25);
  height += 0.2 * gaussian(x, z, -3.0, 0.9, 1.2);
  height += 0.035 * Math.sin(x * 0.85 + 1.3) + 0.03 * Math.cos(z * 1.15 - 0.5);
  height += 0.018 * Math.sin(x * 2.4 + z * 1.9);

  const pd = pondDistance(x, z);
  const bowl = 1 - smoothstep(POND.radius * 0.75, POND.radius * 1.85, pd);
  height = height * (1 - bowl * 0.92) + 0.065 * (bowl * 0.92);

  const edgeFalloff = smoothstep(edge * 0.82, edge, radius);
  height -= edgeFalloff * 0.16;

  return height;
};

export const isInsideIsland = (x: number, z: number, margin = 0.3): boolean => {
  const angle = Math.atan2(z, x);
  return Math.hypot(x, z) < islandEdgeRadius(angle) - margin;
};

export const distanceToPondEdge = (x: number, z: number): number => {
  const angle = Math.atan2(z - POND.z, x - POND.x);
  return pondDistance(x, z) - pondRadiusAt(angle);
};
