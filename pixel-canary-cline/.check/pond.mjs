// src/pond.ts
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

// src/pond.ts
var RINGS = 22;
var SEG = 64;
function shoreline() {
  let shore = POND.r * 0.95;
  for (let k = 0; k < 24; k += 1) {
    const a = k / 24 * Math.PI * 2;
    for (let d = 0.08; d <= POND.r * 1.2; d += 0.015) {
      if (groundAt(POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d) >= WATER_LEVEL) {
        shore = Math.min(shore, d);
        break;
      }
    }
  }
  return shore;
}
function pebbles(shore) {
  const mesh = new THREE2.InstancedMesh(
    new THREE2.IcosahedronGeometry(0.075, 0),
    new THREE2.MeshStandardMaterial({ color: "#9d9484", roughness: 0.95, flatShading: true }),
    26
  );
  const rand = makeRandom(60312);
  const m = new THREE2.Matrix4();
  const q = new THREE2.Quaternion();
  const e = new THREE2.Euler();
  const pos = new THREE2.Vector3();
  const scale = new THREE2.Vector3();
  for (let i = 0; i < 26; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = shore * (0.86 + rand() * 0.3);
    const x = POND.x + Math.cos(a) * r;
    const z = POND.z + Math.sin(a) * r;
    pos.set(x, WATER_LEVEL + 0.012 + rand() * 0.02, z);
    e.set(rand() * 3, rand() * 3, rand() * 3);
    const s = 0.6 + rand() * 1.1;
    scale.set(s, s * 0.5, s);
    mesh.setMatrixAt(i, m.compose(pos, q.setFromEuler(e), scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function buildPond() {
  const shore = shoreline();
  const disc = shore * 1.16;
  const count = (RINGS + 1) * SEG;
  const positions = new Float32Array(count * 3);
  for (let ring = 0; ring <= RINGS; ring += 1) {
    const u = ring / RINGS;
    for (let seg = 0; seg < SEG; seg += 1) {
      const theta = seg / SEG * Math.PI * 2;
      const radius = u * disc * (1 + 0.075 * fbm2(Math.cos(theta) * 2.1 + 9, Math.sin(theta) * 2.1 - 3, 2));
      const i = (ring * SEG + seg) * 3;
      positions[i] = POND.x + Math.cos(theta) * radius;
      positions[i + 1] = WATER_LEVEL;
      positions[i + 2] = POND.z + Math.sin(theta) * radius;
    }
  }
  const WATER_VERT = (
    /* glsl */
    `
  uniform float uTime;
  uniform float uWind;
  uniform float uRain;
  uniform float uRadius;
  varying vec3 vWorld;
  varying vec2 vRad;

  void main() {
    vec3 p = position;
    float chop = 0.010 + 0.014 * uWind + 0.008 * uRain;
    p.y += sin(p.x * 7.0 + uTime * 1.9) * chop
         + sin(p.z * 8.4 - uTime * 2.4) * chop * 0.8
         + sin((p.x + p.z) * 15.0 + uTime * 4.1) * chop * 0.35;
    vRad = vec2(length(p.xz) / uRadius, atan(p.z, p.x));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
  );
  const WATER_FRAG = (
    /* glsl */
    `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform float uRain;
  varying vec3 vWorld;
  varying vec2 vRad;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float radial = clamp(vRad.x, 0.0, 1.0);
    vec3 up = vec3(0.0, 1.0, 0.0);

    // Shallow water brightens towards the shore.
    vec3 water = mix(uDeep, uShallow, smoothstep(0.42, 1.0, radial));

    // Fake reflected sky, stronger at grazing angles.
    float fres = pow(1.0 - clamp(dot(viewDir, up), 0.0, 1.0), 3.0);
    water = mix(water, uSky, fres * 0.55 + 0.08);

    // Sun glitter stretched by a ripple mask.
    vec3 halfVec = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(up, halfVec), 0.0), 42.0);
    float ripple = 0.55 + 0.45 * sin(vRad.x * 46.0 - uTime * 3.4 + sin(vRad.y * 6.0) * 2.0);
    water += uSunColor * spec * (1.15 * ripple);

    // Rain leaves concentric chatter across the surface.
    float chatter = 0.5 + 0.5 * sin(vRad.x * 120.0 - uTime * 9.0);
    water += uSunColor * chatter * uRain * 0.06;

    // Foam lip where the water meets the bank.
    float foam = smoothstep(0.82, 0.97, radial) * (1.0 - smoothstep(0.97, 1.05, radial));
    water = mix(water, vec3(0.90, 0.93, 0.90), foam * 0.42);

    gl_FragColor = vec4(water, 1.0);
  }
`
  );
  const indices = [];
  for (let ring = 0; ring < RINGS; ring += 1) {
    for (let seg = 0; seg < SEG; seg += 1) {
      const a = ring * SEG + seg;
      const b = ring * SEG + (seg + 1) % SEG;
      const d = (ring + 1) * SEG + (seg + 1) % SEG;
      const e = (ring + 1) * SEG + seg;
      indices.push(a, b, d, a, d, e);
    }
  }
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.3 },
    uRain: { value: 0 },
    uRadius: { value: shore },
    uDeep: { value: new THREE2.Color("#3a6b80") },
    uShallow: { value: new THREE2.Color("#7fa9ac") },
    uSky: { value: new THREE2.Color("#cfe6f2") },
    uSunColor: { value: new THREE2.Color("#fff2d6") },
    uSunDir: { value: new THREE2.Vector3(0.4, 0.7, 0.3) }
  };
  const water = new THREE2.Mesh(
    geometry,
    new THREE2.ShaderMaterial({ uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG })
  );
  water.renderOrder = 1;
  const group = new THREE2.Group();
  group.name = "pond";
  group.add(water, pebbles(shore));
  return {
    group,
    level: WATER_LEVEL,
    contains(x, z) {
      return Math.hypot(x - POND.x, z - POND.z) < shore * 0.94;
    },
    update(elapsed, wind, rain, sunDir, sunColor, skyColor, waterColor) {
      uniforms.uTime.value = elapsed;
      uniforms.uWind.value = wind;
      uniforms.uRain.value = rain;
      uniforms.uSunDir.value.copy(sunDir);
      uniforms.uSunColor.value.copy(sunColor);
      uniforms.uSky.value.copy(skyColor);
      uniforms.uDeep.value.copy(waterColor);
      uniforms.uShallow.value.copy(waterColor).lerp(skyColor, 0.45);
    }
  };
}
export {
  buildPond
};
