import * as THREE from 'three';
import { groundAt, POND, WATER_LEVEL } from './island';
import { fbm2, makeRandom } from './noise';

export interface PondHandle {
  group: THREE.Group;
  /** Water surface height, so splashes can land on it. */
  level: number;
  contains: (x: number, z: number) => boolean;
  update: (
    elapsed: number,
    wind: number,
    rain: number,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
    skyColor: THREE.Color,
    waterColor: THREE.Color,
  ) => void;
}

const RINGS = 22;
const SEG = 64;

/**
 * Distance from the pond centre to the real waterline: walk outwards in twenty-four
 * directions and keep the first radius where the ground climbs back above the water.
 */
function shoreline(): number {
  let shore = POND.r * 0.95;
  for (let k = 0; k < 24; k += 1) {
    const a = (k / 24) * Math.PI * 2;
    for (let d = 0.08; d <= POND.r * 1.2; d += 0.015) {
      if (groundAt(POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d) >= WATER_LEVEL) {
        shore = Math.min(shore, d);
        break;
      }
    }
  }
  return shore;
}

function pebbles(shore: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.075, 0),
    new THREE.MeshStandardMaterial({ color: '#9d9484', roughness: 0.95, flatShading: true }),
    26,
  );
  const rand = makeRandom(60312);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
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

export function buildPond(): PondHandle {
  /** Where the water actually meets the bank, and how far the mesh has to reach past it. */
  const shore = shoreline();
  const disc = shore * 1.16;

  const count = (RINGS + 1) * SEG;
  const positions = new Float32Array(count * 3);
  for (let ring = 0; ring <= RINGS; ring += 1) {
    const u = ring / RINGS;
    for (let seg = 0; seg < SEG; seg += 1) {
      const theta = (seg / SEG) * Math.PI * 2;
      const radius =
        u * disc *
        (1 + 0.075 * fbm2(Math.cos(theta) * 2.1 + 9, Math.sin(theta) * 2.1 - 3, 2));
      const i = (ring * SEG + seg) * 3;
      positions[i] = POND.x + Math.cos(theta) * radius;
      positions[i + 1] = WATER_LEVEL;
      positions[i + 2] = POND.z + Math.sin(theta) * radius;
    }
  }

/** Stylised water: depth fade, fake sky reflection, sun glitter, travelling ripples. */
const WATER_VERT = /* glsl */ `
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
`;

const WATER_FRAG = /* glsl */ `
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
`;

  const indices: number[] = [];
  for (let ring = 0; ring < RINGS; ring += 1) {
    for (let seg = 0; seg < SEG; seg += 1) {
      const a = ring * SEG + seg;
      const b = ring * SEG + ((seg + 1) % SEG);
      const d = (ring + 1) * SEG + ((seg + 1) % SEG);
      const e = (ring + 1) * SEG + seg;
      indices.push(a, b, d, a, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.3 },
    uRain: { value: 0 },
    uRadius: { value: shore },
    uDeep: { value: new THREE.Color('#3a6b80') },
    uShallow: { value: new THREE.Color('#7fa9ac') },
    uSky: { value: new THREE.Color('#cfe6f2') },
    uSunColor: { value: new THREE.Color('#fff2d6') },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
  };

  const water = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG }),
  );
  water.renderOrder = 1;

  const group = new THREE.Group();
  group.name = 'pond';
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
    },
  };
}
