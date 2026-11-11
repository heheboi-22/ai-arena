import * as THREE from 'three';
import { mulberry32 } from '../util/math';
import { PAL } from './palette';
import { standard, wetness } from './materials';

export const POND = { x: 1.80, z: 1.95, rx: 1.60, rz: 1.08, rot: -0.16 };

/** Ellipse membership, used by rain to know where a drop lands. */
export function inPond(x: number, z: number, shrink = 1): boolean {
  const dx = x - POND.x;
  const dz = z - POND.z;
  const c = Math.cos(POND.rot);
  const s = Math.sin(POND.rot);
  const u = (dx * c - dz * s) / (POND.rx * shrink);
  const v = (dx * s + dz * c) / (POND.rz * shrink);
  return u * u + v * v < 1;
}

export interface Pond {
  group: THREE.Group;
  spawnRipple(x: number, z: number, strength?: number): void;
  update(dt: number, elapsed: number, rain: number, night: number, skyColor: THREE.Color): void;
  activeRipples(): number;
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uRain;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vView;
void main() {
  vUv = uv;
  vec3 p = position;
  float w = sin(p.x * 6.0 + uTime * 1.25) * cos(p.z * 7.5 - uTime * 0.95) * 0.013
         + sin((p.x + p.z) * 11.0 - uTime * 1.8) * 0.008 * (0.35 + uRain);
  p.y += w;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uFoam;
uniform float uTime;
uniform float uRain;
uniform float uNight;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vView;
void main() {
  float r = clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0);
  vec3 base = mix(uDeep, uShallow, smoothstep(0.10, 1.0, r));
  float band = sin(vWorld.x * 8.0 + uTime * 1.6) * sin(vWorld.z * 9.0 - uTime * 1.15);
  float glint = smoothstep(0.62, 0.98, band) * 0.13;
  vec3 n = normalize(vec3(-0.06 * sin(vWorld.x * 6.0 + uTime), 1.0, -0.06 * cos(vWorld.z * 7.0 - uTime)));
  float fres = pow(1.0 - clamp(dot(n, normalize(vView)), 0.0, 1.0), 2.0);
  vec3 col = mix(base, uSky, clamp(fres * 0.45, 0.0, 0.34));
  col += glint * uFoam * (0.6 + 0.4 * uRain);
  col = mix(col, uDeep * 0.78, uRain * 0.32);
  // a quiet sandy edge where the water meets the shore
  col = mix(col, uShallow, smoothstep(0.93, 1.0, r) * 0.35);
  // Moonlit water is dimmer; it must not outshine the lit windows.
  col *= mix(1.0, 0.62, uNight);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface Ripple {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  size: number;
}

export function createPond(): Pond {
  const group = new THREE.Group();
  group.name = 'pond';
  group.position.set(POND.x, 0, POND.z);
  group.rotation.y = POND.rot;

  // --- shoreline: two concentric rings of sand and damp earth ---
  const ring = (inner: number, outer: number, y: number, mat: THREE.Material): THREE.Mesh => {
    const g = new THREE.RingGeometry(inner, outer, 64);
    g.rotateX(-Math.PI / 2);
    g.scale(POND.rx, 1, POND.rz);
    const m = new THREE.Mesh(g, mat);
    m.position.y = y;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const sand = wetness.track(standard(PAL.sand, { roughness: 1, side: THREE.DoubleSide }), 0.85);
  const damp = wetness.track(standard(PAL.soilDark, { roughness: 1, side: THREE.DoubleSide }), 0.8);
  ring(0.96, 1.20, 0.018, sand);
  ring(0.92, 0.99, 0.024, damp);

  // --- water ---
  const waterGeo = new THREE.CircleGeometry(0.94, 64, 1);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.scale(POND.rx, 1, POND.rz);
  const uniforms = {
    uTime: { value: 0 },
    uRain: { value: 0 },
    uNight: { value: 0 },
    uShallow: { value: PAL.waterShallow.clone() },
    uDeep: { value: PAL.waterDeep.clone() },
    uSky: { value: new THREE.Color('#ecdfc2') },
    uFoam: { value: PAL.waterFoam.clone() },
  };
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }),
  );
  water.position.y = 0.040;
  group.add(water);

  // --- stones, reeds and lily pads around the rim ---
  const rng = mulberry32(323);
  const stoneMat = wetness.track(standard(PAL.stone, { flatShading: true, roughness: 1 }), 0.8);
  const stoneGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 19; i++) {
    const a = (i / 19) * Math.PI * 2 + rng() * 0.20;
    const s = 0.09 + rng() * 0.14;
    const rock = new THREE.Mesh(stoneGeo, stoneMat);
    rock.position.set(Math.cos(a) * POND.rx * (1.00 + rng() * 0.14), 0.055, Math.sin(a) * POND.rz * (1.00 + rng() * 0.14));
    rock.scale.set(s * 1.3, s * 0.8, s);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    group.add(rock);
  }
  const reedMat = wetness.track(standard(PAL.grassDark, { roughness: 1, side: THREE.DoubleSide }), 0.8);
  const reedGeo = new THREE.ConeGeometry(0.028, 0.42, 4);
  for (let i = 0; i < 15; i++) {
    const a = rng() * Math.PI * 2;
    const reed = new THREE.Mesh(reedGeo, reedMat);
    reed.position.set(Math.cos(a) * POND.rx * 0.96, 0.23, Math.sin(a) * POND.rz * 0.96);
    reed.rotation.z = (rng() - 0.5) * 0.45;
    reed.rotation.x = (rng() - 0.5) * 0.30;
    group.add(reed);
  }
  const padMat = wetness.track(standard(PAL.leafDark, { roughness: 0.9, side: THREE.DoubleSide }), 0.7);
  for (let i = 0; i < 4; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.15 + rng() * 0.06, 16), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((rng() - 0.5) * 1.9, 0.049, (rng() - 0.5) * 1.15);
    group.add(pad);
  }

  // --- a small arched footbridge over the narrow end ---
  const wood = wetness.track(standard(PAL.wood, { roughness: 0.9 }), 0.8);
  const woodDark = wetness.track(standard(PAL.woodDark, { roughness: 0.9 }), 0.8);
  const bridge = new THREE.Group();
  bridge.position.set(-0.05, 0, 0);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.055, 0.62), wood);
    plank.position.set(-0.84 + t * 1.68, 0.16 + 0.11 * Math.sin(Math.PI * t), 0);
    bridge.add(plank);
  }
  for (const z of [-0.33, 0.33]) {
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), woodDark);
      post.position.set(-0.84 + t * 1.68, 0.34 + 0.11 * Math.sin(Math.PI * t), z);
      bridge.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.045, 0.05), woodDark);
    rail.position.set(0, 0.50, z);
    bridge.add(rail);
  }
  bridge.scale.set(0.90, 0.85, 0.85);
  bridge.position.set(-0.10, 0, -0.30);
  group.add(bridge);

  // --- pooled ripple rings ---
  const ripples: Ripple[] = [];
  const rippleGeo = new THREE.RingGeometry(0.80, 1.0, 28);
  rippleGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 28; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: PAL.waterFoam, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.position.y = 0.052;
    mesh.visible = false;
    group.add(mesh);
    ripples.push({ mesh, mat, age: 0, life: 1, size: 0 });
  }
  let rippleCursor = 0;
  let ambientClock = 0;

  function spawnRipple(worldX: number, worldZ: number, strength = 1): void {
    // Convert from world space into the pond's rotated local space.
    const dx = worldX - POND.x;
    const dz = worldZ - POND.z;
    const c = Math.cos(POND.rot);
    const s = Math.sin(POND.rot);
    const r = ripples[rippleCursor];
    rippleCursor = (rippleCursor + 1) % ripples.length;
    r.mesh.position.x = dx * c - dz * s;
    r.mesh.position.z = dx * s + dz * c;
    r.mesh.position.y = 0.052;
    r.age = 0;
    r.life = 1.1 + Math.random() * 0.6;
    r.size = (0.16 + Math.random() * 0.18) * strength;
    r.mesh.visible = true;
    r.mesh.scale.setScalar(r.size);
  }

  function activeRipples(): number {
    return ripples.filter((r) => r.mesh.visible).length;
  }

  function update(dt: number, elapsed: number, rain: number, night: number, skyColor: THREE.Color): void {
    uniforms.uTime.value = elapsed;
    uniforms.uRain.value = rain;
    uniforms.uNight.value = night;
    uniforms.uSky.value.copy(skyColor);

    ambientClock += dt;
    if (rain > 0.18 && ambientClock > 0.085) {
      ambientClock = 0;
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * 0.85;
      spawnRipple(POND.x + Math.cos(a) * POND.rx * rr, POND.z + Math.sin(a) * POND.rz * rr, 0.8);
    }
    for (const r of ripples) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) { r.mesh.visible = false; r.mat.opacity = 0; continue; }
      r.mesh.scale.setScalar(r.size + t * 0.55);
      r.mat.opacity = 0.42 * (1 - t) * (0.5 + rain * 0.5);
    }
  }

  return { group, spawnRipple, update, activeRipples };
}
