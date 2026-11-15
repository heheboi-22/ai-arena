// src/windmill.ts
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

// src/windmill.ts
function buildWindmill() {
  const group = new THREE2.Group();
  group.name = "windmill";
  const add = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const stone = new THREE2.MeshStandardMaterial({ color: "#a89a86", roughness: 0.95, flatShading: true });
  const wood = new THREE2.MeshStandardMaterial({ color: "#6d4f38", roughness: 0.85 });
  const woodPale = new THREE2.MeshStandardMaterial({ color: "#c9b08b", roughness: 0.9 });
  const base = add(new THREE2.Mesh(new THREE2.CylinderGeometry(0.32, 0.46, 1.5, 14, 3), stone));
  base.position.y = 0.75;
  for (const [y, r] of [[0.42, 0.42], [1.02, 0.36]]) {
    const band = add(new THREE2.Mesh(new THREE2.CylinderGeometry(r, r + 0.015, 0.07, 14), wood));
    band.position.y = y;
  }
  const balcony = add(new THREE2.Mesh(new THREE2.CylinderGeometry(0.46, 0.46, 0.06, 16), wood));
  balcony.position.y = 1.16;
  const railGeo = new THREE2.BoxGeometry(0.03, 0.16, 0.03);
  for (let i = 0; i < 10; i += 1) {
    const a = i / 10 * Math.PI * 2;
    const post = add(new THREE2.Mesh(railGeo, wood));
    post.position.set(Math.cos(a) * 0.43, 1.27, Math.sin(a) * 0.43);
  }
  const rail = add(new THREE2.Mesh(new THREE2.TorusGeometry(0.43, 0.017, 6, 20), wood));
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 1.35;
  const cap = add(new THREE2.Mesh(new THREE2.ConeGeometry(0.38, 0.4, 14), wood));
  cap.position.y = 1.68;
  const door = add(new THREE2.Mesh(new THREE2.BoxGeometry(0.22, 0.4, 0.05), new THREE2.MeshStandardMaterial({ color: "#4c3726", roughness: 0.8 })));
  door.position.set(0, 0.3, 0.42);
  const hub = new THREE2.Group();
  hub.position.set(0, 1.5, 0.42);
  hub.rotation.x = -0.12;
  group.add(hub);
  const shaft = new THREE2.Mesh(new THREE2.CylinderGeometry(0.05, 0.05, 0.34, 8), wood);
  shaft.rotation.x = Math.PI / 2;
  shaft.castShadow = true;
  hub.add(shaft);
  const blades = new THREE2.Group();
  hub.add(blades);
  const sailLen = 0.86;
  for (let i = 0; i < 4; i += 1) {
    const sail = new THREE2.Group();
    sail.rotation.z = i / 4 * Math.PI * 2;
    blades.add(sail);
    const arm = new THREE2.Mesh(new THREE2.BoxGeometry(0.045, sailLen + 0.16, 0.045), wood);
    arm.position.y = sailLen / 2 + 0.06;
    arm.castShadow = true;
    sail.add(arm);
    const lattice = new THREE2.MeshStandardMaterial({ color: "#ded1b6", roughness: 0.95, side: THREE2.DoubleSide });
    for (let s = 0; s < 5; s += 1) {
      const slat = new THREE2.Mesh(new THREE2.BoxGeometry(0.19, 0.045, 0.012), lattice);
      slat.position.set(0.12, 0.22 + s * 0.15, 0.01);
      slat.rotation.z = 0.09;
      slat.castShadow = true;
      sail.add(slat);
    }
    const brace = new THREE2.Mesh(new THREE2.BoxGeometry(0.02, 0.2, 0.02), woodPale);
    brace.position.set(0.12, 0.15, 0.012);
    brace.rotation.z = 0.5;
    sail.add(brace);
  }
  const hubCap = new THREE2.Mesh(new THREE2.SphereGeometry(0.075, 12, 10), wood);
  hubCap.position.z = 0.19;
  hubCap.castShadow = true;
  hub.add(hubCap);
  group.position.set(MILL_MOUND.x, groundAt(MILL_MOUND.x, MILL_MOUND.z) - 0.02, MILL_MOUND.z);
  group.rotation.y = 2.55;
  let angle = 0.4;
  const update = (dt, elapsed, wind, reduced) => {
    const gust = 1 + 0.14 * Math.sin(elapsed * 0.7) + 0.07 * Math.sin(elapsed * 1.9 + 1.2);
    const speed = (reduced ? 0.35 : 1) * (wind * 3.4 * gust + 0.05);
    angle += speed * dt;
    blades.rotation.z = angle;
  };
  return { group, update };
}
export {
  buildWindmill
};
