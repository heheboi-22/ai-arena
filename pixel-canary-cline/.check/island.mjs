// src/island.ts
import * as THREE from "three";

// src/noise.ts
var FOLD = Math.PI * 2;
function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const lattice = (ix, iy) => {
    const s = Math.sin(ix * 12.9898 + iy * 78.233 + 1.37) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = lattice(xi, yi);
  const b = lattice(xi + 1, yi);
  const c = lattice(xi, yi + 1);
  const d = lattice(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function fbm2(x, y, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(fx, fy) * amp;
    norm += amp;
    amp *= 0.5;
    fx *= 2.03;
    fy *= 2.03;
  }
  return sum / norm;
}
function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// src/island.ts
var EDGE = 0.95;
var RIM = 0.7;
var BASE = 0.2;
var POND = { x: 1.5, z: 1.55, r: 1.02, basin: 0.34 };
var HOUSE_PAD = { x: -1.3, z: 0.35, r: 1.55, height: 0.16 };
var MILL_MOUND = { x: 0.55, z: -1.35, r: 1.25, h: 0.4 };
var BOWL = { shoulder: 0.95, blendStart: 0.85, fade: 1.5, lip: 0.07, fill: 0.66 };
function openGround(x, z) {
  const r = Math.hypot(x, z);
  const edge = clamp(r / (silhouette(Math.atan2(z, x)) * EDGE), 0, 1);
  const rim = smoothstep(RIM, 1, edge);
  let h = BASE;
  h += 0.4 * fbm2(x * 0.5 + 11.3, z * 0.5 - 7.9, 3);
  h += 0.13 * fbm2(x * 1.6 - 3.2, z * 1.6 + 8.1, 2);
  h += 0.55 * (1 - smoothstep(0.1, 1, edge)) - 0.95 * rim * rim;
  return h + mound(x, z);
}
function pondRim() {
  let low = Infinity;
  for (let k = 0; k < 32; k += 1) {
    const a = k / 32 * Math.PI * 2;
    for (const ring of [0.85, 0.95, 1.05, 1.15]) {
      low = Math.min(
        low,
        openGround(POND.x + Math.cos(a) * POND.r * ring, POND.z + Math.sin(a) * POND.r * ring)
      );
    }
  }
  return low + BOWL.lip;
}
var POND_RIM = pondRim();
var POND_FLOOR = POND_RIM - POND.basin;
var WATER_LEVEL = POND_FLOOR + BOWL.fill * (POND_RIM - POND_FLOOR);
var POND_SHORE = POND.r * BOWL.shoulder * Math.sqrt(BOWL.fill);
function pondBowl(x, z, base) {
  const d = Math.hypot(x - POND.x, z - POND.z) / POND.r;
  if (d >= BOWL.fade) return base;
  const w = 1 - smoothstep(BOWL.blendStart, BOWL.fade, d);
  const t = Math.min(1, d / BOWL.shoulder);
  const bowl = POND_FLOOR + (POND_RIM - POND_FLOOR) * t * t;
  return base + (bowl - base) * w;
}
function silhouette(theta) {
  const x = Math.cos(theta);
  const y = Math.sin(theta);
  return 3.9 * (1 + 0.118 * fbm2(x * 1.35 + 4.2, y * 1.35 - 2.7, 3) + 0.045 * fbm2(x * 3.1 - 1.1, y * 3.1 + 5.3, 2));
}
function mound(x, z) {
  const dm = Math.hypot(x - MILL_MOUND.x, z - MILL_MOUND.z) / MILL_MOUND.r;
  return dm < 1 ? MILL_MOUND.h * Math.pow(1 - dm * dm, 1.3) : 0;
}
function rawGround(x, z) {
  const base = openGround(x, z);
  return pondBowl(x, z, base);
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
  POND_SHORE,
  WATER_LEVEL,
  groundAt,
  groundNormalAt,
  groundSlope,
  isOnGrass,
  silhouette
};
