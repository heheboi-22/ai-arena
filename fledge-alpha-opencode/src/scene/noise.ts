// Deterministic cheap pseudo-noise so object placement and terrain agree.

// Pond location (kept here so both terrain and props can use it without cycles)
export const POND_X = 2.3;
export const POND_Z = 1.8;
export const POND_R = 1.55;

export function bump(x: number, z: number): number {
  const pondD = Math.hypot(x - POND_X, z - POND_Z);
  const m = Math.min(1, Math.max(0, (pondD - 1.7) / 1.2));
  const mask = m * m * (3 - 2 * m);
  const v =
    0.085 * Math.sin(x * 0.9 + 1.3) * Math.cos(z * 1.1 + 0.4) +
    0.05 * Math.sin(x * 2.3 + 0.2) * Math.sin(z * 1.9 + 2.1);
  return v * mask;
}

export function rimNoise(angle: number, salt = 0): number {
  return (
    0.1 * Math.sin(angle * 3 + 1.7 + salt) +
    0.06 * Math.sin(angle * 5 + 0.5 + salt * 2.0) +
    0.04 * Math.sin(angle * 8 + 2.9 + salt * 0.7)
  );
}

export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
