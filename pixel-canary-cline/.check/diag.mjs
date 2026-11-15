import * as THREE from '/home/aorus/Project/testing/pixel-canary-cline/node_modules/three/build/three.module.js';
const isl = await import('./island.mjs');
const { groundAt, POND, WATER_LEVEL, POND_SHORE, MILL_MOUND } = isl;
console.log('WATER_LEVEL', WATER_LEVEL.toFixed(4), 'POND_SHORE', POND_SHORE.toFixed(3));

const pond = await import('./pond.mjs');
const handle = pond.buildPond();
const water = handle.group.children.find((o) => o.geometry);
const pos = water.geometry.attributes.position;
let rMin = Infinity, rMax = 0, yMin = Infinity, yMax = -Infinity;
for (let i = 0; i < pos.count; i += 1) {
  const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
  rMin = Math.min(rMin, Math.hypot(x - POND.x, z - POND.z));
  rMax = Math.max(rMax, Math.hypot(x - POND.x, z - POND.z));
  yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
}
console.log('water disc radius', rMin.toFixed(3), '..', rMax.toFixed(3), 'y', yMin.toFixed(3), yMax.toFixed(3));

// Bank height around the whole rim, and depth under the water at the centre.
let rimLow = Infinity, rimHigh = -Infinity;
for (let k = 0; k < 48; k += 1) {
  const a = (k / 48) * Math.PI * 2;
  for (const rr of [1.0, 1.1, 1.2]) {
    const g = groundAt(POND.x + Math.cos(a) * rr, POND.z + Math.sin(a) * rr);
    rimLow = Math.min(rimLow, g); rimHigh = Math.max(rimHigh, g);
  }
}
console.log('bank at r1.0-1.2:', rimLow.toFixed(3), '..', rimHigh.toFixed(3), '| margin above water', (rimLow - WATER_LEVEL).toFixed(3));
console.log('floor under water', (WATER_LEVEL - groundAt(POND.x, POND.z)).toFixed(3), 'deep');

// Any ground poking through the water disc?
let pokes = 0, worst = 0;
for (let x = POND.x - rMax; x <= POND.x + rMax; x += 0.02) for (let z = POND.z - rMax; z <= POND.z + rMax; z += 0.02) {
  const r = Math.hypot(x - POND.x, z - POND.z);
  if (r > POND_SHORE * 0.98) continue;
  const d = groundAt(x, z) - WATER_LEVEL;
  if (d > 0.005) { pokes += 1; worst = Math.max(worst, d); }
}
console.log('dry spots inside waterline:', pokes, 'worst', worst.toFixed(3));
console.log('mill mound ground', groundAt(MILL_MOUND.x, MILL_MOUND.z).toFixed(3));
const floor = groundAt(POND.x, POND.z);
let lip = Infinity;
for (let k = 0; k < 16; k += 1) {
  const a = (k / 16) * Math.PI * 2;
  lip = Math.min(lip, groundAt(POND.x + Math.cos(a) * POND.r * 1.12, POND.z + Math.sin(a) * POND.r * 1.12));
}
console.log('pond', JSON.stringify(POND));
console.log('floor', floor.toFixed(4), 'lip', lip.toFixed(4), 'WATER_LEVEL', WATER_LEVEL.toFixed(4));
// shore replica
let shore = POND.r * 0.95; const shorePerDir = [];
for (let k = 0; k < 24; k += 1) {
  const a = (k / 24) * Math.PI * 2; let hit = null;
  for (let d = 0.08; d <= POND.r * 1.2; d += 0.015) {
    if (groundAt(POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d) >= WATER_LEVEL) { hit = d; break; }
  }
  shorePerDir.push(hit === null ? 'none' : hit.toFixed(3));
  if (hit !== null) shore = Math.min(shore, hit);
}
console.log('shorePerDir', shorePerDir.join(' '));
console.log('shore(min)', shore.toFixed(3), 'disc', (shore * 1.16).toFixed(3))
;
// how much of the basin is under water
let under = 0, tot = 0, minG = Infinity, maxG = -Infinity;
for (let x = POND.x - POND.r; x <= POND.x + POND.r; x += 0.02) for (let z = POND.z - POND.r; z <= POND.z + POND.r; z += 0.02) {
  if (Math.hypot(x - POND.x, z - POND.z) > POND.r) continue;
  const g = groundAt(x, z); tot++; minG = Math.min(minG, g); maxG = Math.max(maxG, g);
  if (g < WATER_LEVEL) under++;
}
console.log('basin ground min/max', minG.toFixed(4), maxG.toFixed(4), 'submerged fraction', (under / tot).toFixed(3));
