// src/props.ts
import * as THREE2 from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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

// src/props.ts
var STONE = new THREE2.MeshStandardMaterial({ color: "#b3ab9c", roughness: 0.95, flatShading: true });
var FENCE_WOOD = new THREE2.MeshStandardMaterial({ color: "#8a6a49", roughness: 0.9 });
var ROCK = new THREE2.MeshStandardMaterial({ color: "#8d8577", roughness: 0.98, flatShading: true });
var up = new THREE2.Vector3(0, 1, 0);
var tmpNormal = new THREE2.Vector3();
function alignToGround(pos, quat, x, z, lift = 0) {
  pos.set(x, groundAt(x, z) + lift, z);
  quat.setFromUnitVectors(up, groundNormalAt(x, z, tmpNormal));
}
function buildPath() {
  const stones = 15;
  const p0 = new THREE2.Vector2(-1.48, 1);
  const p1 = new THREE2.Vector2(-2.05, 2.05);
  const p2 = new THREE2.Vector2(-1.2, 3.1);
  const geo = new THREE2.CircleGeometry(0.14, 7);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE2.InstancedMesh(geo, STONE, stones);
  const m = new THREE2.Matrix4();
  const q = new THREE2.Quaternion();
  const pos = new THREE2.Vector3();
  const scale = new THREE2.Vector3();
  const rand = makeRandom(4412);
  const curve = new THREE2.QuadraticBezierCurve3(
    new THREE2.Vector3(p0.x, 0, p0.y),
    new THREE2.Vector3(p1.x, 0, p1.y),
    new THREE2.Vector3(p2.x, 0, p2.y)
  );
  for (let i = 0; i < stones; i += 1) {
    const t = i / (stones - 1);
    const point = curve.getPoint(t);
    const jitter = (rand() - 0.5) * 0.1;
    const tangent = curve.getTangent(t);
    const px = point.x - tangent.z * jitter;
    const pz = point.z + tangent.x * jitter;
    alignToGround(pos, q, px, pz, 0.022);
    const s = 0.72 + rand() * 0.55;
    scale.set(s, 1, s * (0.8 + rand() * 0.4));
    mesh.setMatrixAt(i, m.compose(pos, q, scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
function buildFence() {
  const group = new THREE2.Group();
  const center = new THREE2.Vector2(1.5, 1.55);
  const radius = 1.32;
  const from = THREE2.MathUtils.degToRad(146);
  const to = THREE2.MathUtils.degToRad(232);
  const posts = 8;
  const points = [];
  for (let i = 0; i < posts; i += 1) {
    const a = from + (to - from) * i / (posts - 1);
    points.push(new THREE2.Vector2(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius));
  }
  for (const p of points) {
    const post = new THREE2.Mesh(new THREE2.BoxGeometry(0.055, 0.36, 0.055), FENCE_WOOD);
    post.position.set(p.x, groundAt(p.x, p.y) + 0.16, p.y);
    post.rotation.y = p.x * 2;
    post.castShadow = true;
    group.add(post);
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const length = Math.hypot(dx, dz);
    for (const [height, thin] of [[0.27, 0.045], [0.14, 0.035]]) {
      const rail = new THREE2.Mesh(new THREE2.BoxGeometry(length, thin, 0.028), FENCE_WOOD);
      const midX = (a.x + b.x) / 2;
      const midZ = (a.y + b.y) / 2;
      const y0 = groundAt(a.x, a.y) + height;
      const y1 = groundAt(b.x, b.y) + height;
      rail.position.set(midX, (y0 + y1) / 2, midZ);
      rail.quaternion.setFromUnitVectors(
        new THREE2.Vector3(1, 0, 0),
        new THREE2.Vector3(b.x - a.x, y1 - y0, b.y - a.y).normalize()
      );
      rail.castShadow = true;
      group.add(rail);
    }
  }
  return group;
}
function buildRocks() {
  const group = new THREE2.Group();
  const spots = [
    [-0.15, 2.55, 0.3, 0.5],
    [-2.75, -1.35, 0.42, 1.1],
    [2.35, -0.55, 0.26, 2.4],
    [-0.55, -2.5, 0.34, 3.6],
    [2.95, 0.35, 0.22, 5.1],
    [-3, 0.75, 0.28, 4.2]
  ];
  const rand = makeRandom(7781);
  spots.forEach(([x, z, size, spin], i) => {
    const geo = new THREE2.IcosahedronGeometry(size, 0);
    const positions = geo.attributes.position;
    for (let v = 0; v < positions.count; v += 1) {
      positions.setXYZ(
        v,
        positions.getX(v) * (0.82 + rand() * 0.4),
        positions.getY(v) * (0.6 + rand() * 0.4),
        positions.getZ(v) * (0.82 + rand() * 0.4)
      );
    }
    geo.computeVertexNormals();
    const rock = new THREE2.Mesh(geo, ROCK);
    rock.position.set(x, groundAt(x, z) - size * 0.24, z);
    rock.rotation.set(rand() * 0.5, spin + i, rand() * 0.4);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });
  return group;
}
function buildGroundCover(count = 240) {
  const group = new THREE2.Group();
  const rand = makeRandom(20260929);
  const tuftGeo = (() => {
    const parts = [];
    for (let i = 0; i < 3; i += 1) {
      const blade = new THREE2.ConeGeometry(0.017, 0.105, 4);
      blade.translate(0, 0.052, 0);
      blade.rotateZ((i - 1) * 0.34);
      blade.rotateY(i * 1.9);
      parts.push(blade);
    }
    return mergeGeometries(parts, false);
  })();
  const tufts = new THREE2.InstancedMesh(
    tuftGeo,
    new THREE2.MeshStandardMaterial({ color: "#79a457", roughness: 0.95, flatShading: true }),
    count
  );
  tufts.receiveShadow = true;
  const flowerCount = Math.round(count * 0.26);
  const headGeo = new THREE2.IcosahedronGeometry(0.028, 0);
  headGeo.translate(0, 0.115, 0);
  const stems = new THREE2.InstancedMesh(
    new THREE2.CylinderGeometry(6e-3, 8e-3, 0.11, 4).translate(0, 0.055, 0),
    new THREE2.MeshStandardMaterial({ color: "#5f8a49", roughness: 0.95 }),
    flowerCount
  );
  const heads = new THREE2.InstancedMesh(
    headGeo,
    new THREE2.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, flatShading: true }),
    flowerCount
  );
  const palette = ["#f3f0e2", "#e8b64b", "#ded7ea", "#f0dfae", "#e9a1a8"];
  const m = new THREE2.Matrix4();
  const q = new THREE2.Quaternion();
  const pos = new THREE2.Vector3();
  const scale = new THREE2.Vector3();
  const color = new THREE2.Color();
  const axis = new THREE2.Vector3(0, 1, 0);
  let placed = 0;
  let flowers = 0;
  let guard = 0;
  while ((placed < count || flowers < flowerCount) && guard < count * 60) {
    guard += 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * silhouette(theta) * 0.9;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    if (!isOnGrass(x, z, 0.3)) continue;
    if (groundAt(x, z) < -0.1 || groundSlope(x, z) > 0.85) continue;
    q.setFromAxisAngle(axis, rand() * Math.PI * 2);
    pos.set(x, groundAt(x, z) - 0.012, z);
    if (placed < count) {
      const s = 0.7 + rand() * 0.9;
      scale.set(s, 0.75 + rand() * 0.8, s);
      tufts.setMatrixAt(placed, m.compose(pos, q, scale));
      placed += 1;
    }
    if (flowers < flowerCount && rand() < 0.34) {
      const s = 0.8 + rand() * 0.7;
      scale.set(s, s, s);
      heads.setMatrixAt(flowers, m.compose(pos, q, scale));
      stems.setMatrixAt(flowers, m.compose(pos, q, scale));
      heads.setColorAt(flowers, color.set(palette[flowers % palette.length]).offsetHSL(0, 0, -0.06));
      flowers += 1;
    }
  }
  tufts.count = placed;
  heads.count = flowers;
  stems.count = flowers;
  tufts.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  stems.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  group.add(tufts, stems, heads);
  return group;
}
export {
  buildFence,
  buildGroundCover,
  buildPath,
  buildRocks
};
