// src/rain.ts
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

// src/rain.ts
var FALL_SPEED = 7.4;
var WIND_DIR = new THREE2.Vector2(0.9, 0.44).normalize();
function buildRain(max = 460, splashes = 26) {
  const rand = makeRandom(8123);
  const group = new THREE2.Group();
  group.name = "rain";
  const streak = new THREE2.PlaneGeometry(0.016, 0.44);
  const material = new THREE2.MeshBasicMaterial({
    color: "#cfe3f2",
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE2.DoubleSide,
    fog: false
  });
  const drops = new THREE2.InstancedMesh(streak, material, max);
  drops.instanceMatrix.setUsage(THREE2.DynamicDrawUsage);
  drops.frustumCulled = false;
  drops.visible = false;
  group.add(drops);
  const px = new Float32Array(max);
  const py = new Float32Array(max);
  const pz = new Float32Array(max);
  const length = new Float32Array(max);
  for (let i = 0; i < max; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 6.4;
    px[i] = Math.cos(a) * r;
    pz[i] = Math.sin(a) * r;
    py[i] = rand() * 7.5;
    length[i] = 0.75 + rand() * 0.7;
  }
  const m = new THREE2.Matrix4();
  const q = new THREE2.Quaternion();
  const e = new THREE2.Euler();
  const pos = new THREE2.Vector3();
  const scl = new THREE2.Vector3();
  const splashGeo = new THREE2.RingGeometry(0.05, 0.075, 14);
  splashGeo.rotateX(-Math.PI / 2);
  const pool = [];
  for (let i = 0; i < splashes; i += 1) {
    const mat = new THREE2.MeshBasicMaterial({
      color: "#e6f2fa",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE2.AdditiveBlending,
      fog: false
    });
    const mesh = new THREE2.Mesh(splashGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    pool.push({ mesh, material: mat, age: 0, life: 0.6, active: false });
  }
  let cursor = 0;
  let budget = 0;
  const spawnSplash = (x, y, z, scale) => {
    const splash = pool[cursor % pool.length];
    cursor += 1;
    splash.active = true;
    splash.age = 0;
    splash.life = 0.5 + rand() * 0.35;
    splash.mesh.position.set(x, y + 0.012, z);
    splash.mesh.scale.setScalar(scale * (0.5 + rand() * 0.5));
    splash.mesh.visible = true;
  };
  return {
    group,
    update(dt, wind, amount, azimuth, tint) {
      const visible = amount > 4e-3;
      drops.visible = visible;
      if (!visible) {
        for (const splash of pool) {
          if (!splash.active) continue;
          splash.age += dt;
          const t = splash.age / splash.life;
          if (t >= 1) {
            splash.active = false;
            splash.mesh.visible = false;
            continue;
          }
          splash.material.opacity = (1 - t) * 0.3;
          splash.mesh.scale.multiplyScalar(1 + dt * 2.4);
        }
        return;
      }
      const activeDrops = Math.max(1, Math.round(max * amount));
      const driftX = WIND_DIR.x * wind * 3.6;
      const driftZ = WIND_DIR.y * wind * 3.6;
      const rightX = Math.cos(azimuth - Math.PI / 2);
      const rightZ = Math.sin(azimuth - Math.PI / 2);
      const tilt = Math.atan2(driftX * rightX + driftZ * rightZ, FALL_SPEED);
      q.setFromEuler(e.set(0, azimuth, tilt));
      material.color.copy(tint);
      material.opacity = 0.2 + amount * 0.26;
      for (let i = 0; i < activeDrops; i += 1) {
        py[i] -= FALL_SPEED * dt * (0.85 + length[i] * 0.25);
        px[i] += driftX * dt;
        pz[i] += driftZ * dt;
        const ground = groundAt(px[i], pz[i]);
        if (py[i] <= ground) {
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * 6.4;
          px[i] = Math.cos(a) * r;
          pz[i] = Math.sin(a) * r;
          py[i] = 6.4 + rand() * 1.6;
          budget += 1;
        }
        pos.set(px[i], py[i], pz[i]);
        scl.set(1, length[i] * (1 + wind * 0.5), 1);
        drops.setMatrixAt(i, m.compose(pos, q, scl));
      }
      drops.count = activeDrops;
      drops.instanceMatrix.needsUpdate = true;
      budget += dt * amount * 22;
      while (budget >= 1) {
        budget -= 1;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 4.4;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (r > silhouette(Math.atan2(z, x)) * 0.97) continue;
        const onWater = Math.hypot(x - POND.x, z - POND.z) < POND_SHORE;
        spawnSplash(x, onWater ? WATER_LEVEL : groundAt(x, z), z, onWater ? 1.1 : 0.7);
      }
      for (const splash of pool) {
        if (!splash.active) continue;
        splash.age += dt;
        const t = splash.age / splash.life;
        if (t >= 1) {
          splash.active = false;
          splash.mesh.visible = false;
          splash.material.opacity = 0;
          continue;
        }
        splash.material.opacity = (1 - t) * 0.34 * (0.4 + amount);
        splash.material.color.copy(tint).lerp(new THREE2.Color("#ffffff"), 0.5);
        splash.mesh.scale.multiplyScalar(1 + dt * 3.1);
      }
    }
  };
}
export {
  buildRain
};
