import * as THREE from "three";
import { clamp, fbm2, smoothstep } from "./noise";
const EDGE = 0.95;
const RIM = 0.7;
const BASE = 0.2;
const POND = { x: 1.5, z: 1.55, r: 1.02, basin: 0.62 };
const HOUSE_PAD = { x: -1.3, z: 0.35, r: 1.55, height: 0.16 };
const MILL_MOUND = { x: 0.55, z: -1.35, r: 1.25, h: 0.4 };
function computeWaterLevel() {
  const floor = groundAt(POND.x, POND.z);
  let lip = Infinity;
  for (let k = 0; k < 16; k += 1) {
    const a = k / 16 * Math.PI * 2;
    lip = Math.min(lip, groundAt(POND.x + Math.cos(a) * POND.r * 1.12, POND.z + Math.sin(a) * POND.r * 1.12));
  }
  return floor + (lip - floor) * 0.42;
}
const WATER_LEVEL = computeWaterLevel();
function silhouette(theta) {
  const x = Math.cos(theta);
  const y = Math.sin(theta);
  return 3.9 * (1 + 0.118 * fbm2(x * 1.35 + 4.2, y * 1.35 - 2.7, 3) + 0.045 * fbm2(x * 3.1 - 1.1, y * 3.1 + 5.3, 2));
}
function pondBasin(x, z) {
  const d = Math.hypot(x - POND.x, z - POND.z) / POND.r;
  if (d >= 1) return 0;
  return -POND.basin * Math.pow(1 - d * d, 1.25);
}
function mound(x, z) {
  const dm = Math.hypot(x - MILL_MOUND.x, z - MILL_MOUND.z) / MILL_MOUND.r;
  return dm < 1 ? MILL_MOUND.h * Math.pow(1 - dm * dm, 1.3) : 0;
}
function rawGround(x, z) {
  const r = Math.hypot(x, z);
  const edge = clamp(r / (silhouette(Math.atan2(z, x)) * EDGE), 0, 1);
  const rim = smoothstep(RIM, 1, edge);
  let h = BASE;
  h += 0.4 * fbm2(x * 0.5 + 11.3, z * 0.5 - 7.9, 3);
  h += 0.13 * fbm2(x * 1.6 - 3.2, z * 1.6 + 8.1, 2);
  h += 0.55 * (1 - smoothstep(0.1, 1, edge)) - 0.95 * rim * rim;
  h += mound(x, z);
  return h + pondBasin(x, z);
}
function groundAt(x, z) {
  const h = rawGround(x, z);
  const dh = Math.hypot(x - HOUSE_PAD.x, z - HOUSE_PAD.z) / HOUSE_PAD.r;
  if (dh >= 1) return h;
  const w = 1 - smoothstep(0.42, 1, dh);
  const center = rawGround(HOUSE_PAD.x, HOUSE_PAD.z);
  return h + (center - HOUSE_PAD.height - h) * w;
}
function groundNormalAt(x, z, target = new THREE.Vector3()) {
  const e = 0.08;
  const dx = groundAt(x + e, z) - groundAt(x - e, z);
  const dz = groundAt(x, z + e) - groundAt(x, z - e);
  return target.set(-dx, e * 2, -dz).normalize();
}
function groundSlope(x, z) {
  const e = 0.12;
  const dx = (groundAt(x + e, z) - groundAt(x - e, z)) / (2 * e);
  const dz = (groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}
function isOnGrass(x, z, margin = 0.45) {
  const r = Math.hypot(x, z);
  if (r > silhouette(Math.atan2(z, x)) * EDGE - margin) return false;
  if (Math.hypot(x - POND.x, z - POND.z) / (POND.r * 1.2) < 1) return false;
  if (Math.hypot(x - HOUSE_PAD.x, z - HOUSE_PAD.z) < 1.2) return false;
  if (Math.hypot(x - MILL_MOUND.x, z - MILL_MOUND.z) < 0.72) return false;
  return groundSlope(x, z) < 0.75;
}
export {
  HOUSE_PAD,
  MILL_MOUND,
  POND,
  WATER_LEVEL,
  groundAt,
  groundNormalAt,
  groundSlope,
  isOnGrass,
  silhouette
};
