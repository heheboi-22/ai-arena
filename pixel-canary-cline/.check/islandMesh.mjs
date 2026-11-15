// src/islandMesh.ts
import * as THREE2 from "three";

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
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
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

// src/islandMesh.ts
var GRASS_HIGH = new THREE2.Color("#a5c471");
var GRASS_LOW = new THREE2.Color("#58824a");
var SOIL = new THREE2.Color("#7b5636");
var ROOT = new THREE2.Color("#4c3524");
var ROCK = new THREE2.Color("#8c8271");
var ROCK_DEEP = new THREE2.Color("#463f38");
var RING = 128;
function polarIndex(ring, seg) {
  return ring * RING + (seg % RING + RING) % RING;
}
function colorAttribute(count) {
  return new THREE2.BufferAttribute(new Float32Array(count * 3), 3);
}
function quadRing(indices, rings, mirrored) {
  for (let ring = 0; ring < rings; ring += 1) {
    for (let seg = 0; seg < RING; seg += 1) {
      const a = polarIndex(ring, seg);
      const b = polarIndex(ring, seg + 1);
      const d = polarIndex(ring + 1, seg + 1);
      const e = polarIndex(ring + 1, seg);
      if (mirrored) indices.push(a, d, b, a, e, d);
      else indices.push(a, b, d, a, d, e);
    }
  }
}
function buildCap() {
  const rings = 34;
  const count = (rings + 1) * RING;
  const positions = new Float32Array(count * 3);
  const colors = colorAttribute(count);
  const c = new THREE2.Color();
  for (let ring = 0; ring <= rings; ring += 1) {
    const u = ring / rings;
    for (let seg = 0; seg < RING; seg += 1) {
      const theta = seg / RING * Math.PI * 2;
      const radius = u * silhouette(theta) * 0.985;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const y = groundAt(x, z);
      const i = polarIndex(ring, seg) * 3;
      positions[i] = x;
      positions[i + 1] = y;
      positions[i + 2] = z;
      const rise = groundAt(x + 0.12, z) - y + (groundAt(x, z + 0.12) - y);
      c.copy(GRASS_LOW).lerp(GRASS_HIGH, clamp(1 - rise / 1.2, 0, 1) * 0.72 + 0.2);
      c.offsetHSL(0, 0, 0.05 * fbm2(x * 2.4 + 5, z * 2.4 - 3, 2));
      c.lerp(SOIL, clamp((u - 0.9) / 0.1, 0, 1) * 0.85);
      if (y < WATER_LEVEL + 0.16) c.lerp(SOIL, 0.7);
      colors.setXYZ(i / 3, c.r, c.g, c.b);
    }
  }
  const indices = [];
  quadRing(indices, rings, false);
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(positions, 3));
  geometry.setAttribute("color", colors);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function undersideRing(t) {
  if (t < 0.18) {
    return { y: 0.18 - t * 1.35, scale: 1.02 - t * 0.04, lumps: 0.05, freq: 2.2 };
  }
  const s = clamp((t - 0.18) / 0.82, 0, 1);
  return {
    y: -0.06 - 3.62 * Math.pow(s, 1.18),
    scale: 0.98 * Math.pow(1 - s, 0.72) * (1 + 0.16 * Math.sin(s * 7.4)),
    lumps: 0.05 + 0.34 * Math.sin(s * 5.1 + 0.6),
    freq: 2.2 + 2.6 * s
  };
}
function buildUnderside() {
  const rings = 26;
  const count = (rings + 1) * RING;
  const positions = new Float32Array(count * 3);
  const colors = colorAttribute(count);
  const tmp = new THREE2.Color();
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const prof = undersideRing(t);
    for (let seg = 0; seg < RING; seg += 1) {
      const theta = seg / RING * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const lump = prof.lumps * fbm2(cos * prof.freq + t * 1.7, sin * prof.freq - t * 2.3, 3) + 0.06 * fbm2(cos * 6.1, sin * 6.1 + t * 4, 2);
      const radius = silhouette(theta) * 0.965 * // Top rings hug the inside of the grass cap so no rock peeks through the rim;
      // lower ones are free to bulge past the silhouette.
      Math.min(t < 0.12 ? 0.97 : 1.06, Math.max(2e-3, prof.scale + lump));
      const i = polarIndex(ring, seg);
      positions[i * 3] = cos * radius;
      positions[i * 3 + 1] = prof.y;
      positions[i * 3 + 2] = sin * radius;
      tmp.copy(SOIL).lerp(ROOT, clamp(t / 0.3, 0, 1));
      tmp.lerp(ROCK, clamp((t - 0.14) / 0.34, 0, 1));
      tmp.lerp(ROCK_DEEP, clamp((t - 0.55) / 0.5, 0, 1) * 0.75);
      tmp.offsetHSL(0, 0, 0.05 * fbm2(cos * 5 + 2, sin * 5 - 4, 2));
      colors.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
  }
  const indices = [];
  quadRing(indices, rings, true);
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(positions, 3));
  geometry.setAttribute("color", colors);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function danglingRocks() {
  const geo = new THREE2.IcosahedronGeometry(1, 0);
  const mat = new THREE2.MeshStandardMaterial({ color: "#6f6659", roughness: 0.98, flatShading: true });
  const mesh = new THREE2.InstancedMesh(geo, mat, 11);
  const rand = makeRandom(9127);
  const m = new THREE2.Matrix4();
  const q = new THREE2.Quaternion();
  const e = new THREE2.Euler();
  const pos = new THREE2.Vector3();
  const scale = new THREE2.Vector3();
  for (let i = 0; i < 11; i += 1) {
    const theta = rand() * Math.PI * 2;
    const t = 0.26 + rand() * 0.46;
    const prof = undersideRing(t);
    const radius = silhouette(theta) * 0.9 * Math.max(0.02, prof.scale) * (0.55 + rand() * 0.35);
    const s = 0.12 + rand() * 0.28;
    pos.set(Math.cos(theta) * radius, prof.y - s * 0.6, Math.sin(theta) * radius);
    scale.set(s * (0.8 + rand() * 0.6), s * (0.7 + rand() * 0.8), s * (0.8 + rand() * 0.6));
    e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    mesh.setMatrixAt(i, m.compose(pos, q.setFromEuler(e), scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}
function buildIsland() {
  const group = new THREE2.Group();
  group.name = "island";
  const cap = new THREE2.Mesh(
    buildCap(),
    new THREE2.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true })
  );
  cap.receiveShadow = true;
  cap.castShadow = true;
  group.add(cap);
  const underside = new THREE2.Mesh(
    buildUnderside(),
    new THREE2.MeshStandardMaterial({ vertexColors: true, roughness: 0.99, metalness: 0, flatShading: true })
  );
  underside.castShadow = true;
  underside.receiveShadow = true;
  group.add(underside);
  group.add(danglingRocks());
  return group;
}
export {
  buildIsland
};
