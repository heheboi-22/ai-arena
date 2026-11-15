// src/vegetation.ts
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
var POND = { x: 1.5, z: 1.55, r: 1.02, basin: 0.4 };
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

// src/vegetation.ts
var TRUNK = new THREE2.MeshStandardMaterial({ color: "#6b4a30", roughness: 0.92 });
var LEAF_DARK = new THREE2.MeshStandardMaterial({ color: "#3f6f45", roughness: 0.95, flatShading: true });
var LEAF_MID = new THREE2.MeshStandardMaterial({ color: "#4f8451", roughness: 0.95, flatShading: true });
var LEAF_LIGHT = new THREE2.MeshStandardMaterial({ color: "#6f9c54", roughness: 0.95, flatShading: true });
var LEAF_WARM = new THREE2.MeshStandardMaterial({ color: "#8a9448", roughness: 0.95, flatShading: true });
function conifer(scale, foliage) {
  const g = new THREE2.Group();
  const trunk = new THREE2.Mesh(new THREE2.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.5 * scale, 7), TRUNK);
  trunk.position.y = 0.25 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  const tiers = 4;
  for (let i = 0; i < tiers; i += 1) {
    const t = i / (tiers - 1);
    const cone = new THREE2.Mesh(
      new THREE2.ConeGeometry((0.44 - t * 0.24) * scale, (0.5 - t * 0.12) * scale, 8),
      foliage
    );
    cone.position.y = (0.55 + i * 0.32) * scale;
    cone.rotation.y = i * 0.4;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
  }
  return g;
}
function broadleaf(scale, foliage) {
  const g = new THREE2.Group();
  const trunk = new THREE2.Mesh(new THREE2.CylinderGeometry(0.07 * scale, 0.11 * scale, 0.62 * scale, 7), TRUNK);
  trunk.position.y = 0.31 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  const rand = makeRandom(Math.round(scale * 1e3) + 17);
  const blobs = 4;
  for (let i = 0; i < blobs; i += 1) {
    const r = (0.32 + rand() * 0.2) * scale;
    const blob = new THREE2.Mesh(new THREE2.IcosahedronGeometry(r, 0), foliage);
    const a = i / blobs * Math.PI * 2 + rand();
    blob.position.set(Math.cos(a) * 0.2 * scale, (0.82 + rand() * 0.28) * scale, Math.sin(a) * 0.2 * scale);
    blob.scale.set(1, 0.82 + rand() * 0.3, 1);
    blob.rotation.set(rand() * 2, rand() * 2, rand() * 2);
    blob.castShadow = true;
    blob.receiveShadow = true;
    g.add(blob);
  }
  return g;
}
function slim(scale, foliage) {
  const g = new THREE2.Group();
  const trunk = new THREE2.Mesh(new THREE2.CylinderGeometry(0.045 * scale, 0.08 * scale, 1.05 * scale, 6), TRUNK);
  trunk.position.y = 0.52 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 3; i += 1) {
    const blob = new THREE2.Mesh(new THREE2.IcosahedronGeometry((0.26 - i * 0.05) * scale, 0), foliage);
    blob.position.set((i - 1) * 0.12 * scale, (1.05 + i * 0.24) * scale, i % 2 === 0 ? 0.08 : -0.07);
    blob.scale.set(1.15, 0.9, 1.15);
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}
function buildVegetation() {
  const group = new THREE2.Group();
  group.name = "vegetation";
  const swayables = [];
  const spots = [
    [-2.65, -0.55, 1.15, "conifer", LEAF_DARK],
    [-2.25, 1.65, 0.95, "broadleaf", LEAF_MID],
    [-0.6, -1.95, 1.3, "conifer", LEAF_MID],
    [1, -2.3, 0.8, "slim", LEAF_WARM],
    [2.75, -1.55, 1.05, "broadleaf", LEAF_LIGHT],
    [3.05, 0.95, 0.72, "slim", LEAF_MID],
    [-0.15, 2.95, 0.62, "broadleaf", LEAF_LIGHT]
  ];
  for (const [x, z, scale, kind, foliage] of spots) {
    const tree = kind === "conifer" ? conifer(scale, foliage) : kind === "broadleaf" ? broadleaf(scale, foliage) : slim(scale, foliage);
    tree.position.set(x, groundAt(x, z) - 0.03, z);
    tree.rotation.y = (x * 3.1 + z * 1.7) % Math.PI;
    group.add(tree);
    swayables.push({
      object: tree,
      amplitude: (kind === "slim" ? 0.055 : kind === "broadleaf" ? 0.04 : 0.026) * (1.25 - scale * 0.35),
      phase: (x + z) * 2.3,
      speed: 1.15 + scale % 0.4
    });
  }
  return {
    group,
    swayables,
    update(elapsed, wind, reduced) {
      const strength = reduced ? 0.3 : 1;
      for (const item of swayables) {
        const sway = Math.sin(elapsed * item.speed + item.phase) * 0.7 + Math.sin(elapsed * item.speed * 2.3 + item.phase * 1.7) * 0.3;
        const lean = sway * item.amplitude * wind * strength;
        item.object.rotation.z = lean;
        item.object.rotation.x = lean * 0.45;
      }
    }
  };
}
export {
  buildVegetation
};
