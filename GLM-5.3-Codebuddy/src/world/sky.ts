import * as THREE from 'three';
import { Rng, jitterFacets, mergePainted, clamp, radialTexture, TAU } from '../util';
import type { SkyState } from '../palette';
import type { WorldState } from '../state';

/**
 * Sky dome, sun/moon disc, stars and drifting clouds. Everything derives
 * from the shared WorldState + the sampled SkyState palette.
 */

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
varying vec3 vDir;
void main() {
  float t = clamp(vDir.y, -1.0, 1.0);
  // soft gradient above the horizon, gentle falloff below it
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.42, t));
  col = mix(uHorizon * 0.82, col, smoothstep(-0.32, 0.02, t));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

interface Cloud {
  group: THREE.Group;
  angle: number;
  radius: number;
  height: number;
  speed: number;
  bob: number;
}

export interface SkyBuild {
  group: THREE.Group;
  skyMat: THREE.ShaderMaterial;
  starMat: THREE.PointsMaterial;
  disc: THREE.Sprite;
  discMat: THREE.SpriteMaterial;
  clouds: Cloud[];
  cloudMat: THREE.MeshStandardMaterial;
}

function buildClouds(rng: Rng, mat: THREE.MeshStandardMaterial): Cloud[] {
  const clouds: Cloud[] = [];
  const specs = [
    { angle: 0.6, radius: 10.4, height: 5.2, s: 1.0, speed: 0.032 },
    { angle: 2.4, radius: 13.2, height: 6.6, s: 1.35, speed: 0.026 },
    { angle: 4.1, radius: 9.6, height: 4.6, s: 0.8, speed: 0.038 },
    { angle: 5.4, radius: 15.6, height: 7.4, s: 1.15, speed: 0.021 },
  ];
  for (const spec of specs) {
    const parts: THREE.BufferGeometry[] = [];
    const blobs = 3 + Math.floor(rng.next() * 2);
    let off = 0;
    for (let i = 0; i < blobs; i++) {
      const r = (0.55 + rng.next() * 0.5) * spec.s;
      const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed();
      g.scale(1.25, 0.62, 1);
      jitterFacets(g, 0.05 * spec.s, rng);
      g.translate(off + rng.range(-0.2, 0.2), rng.range(-0.1, 0.12), rng.range(-0.25, 0.25));
      off += r * 1.15;
      parts.push(g);
    }
    const mesh = new THREE.Mesh(mergePainted(parts), mat);
    mesh.position.x = -off * 0.42; // recenter
    const group = new THREE.Group();
    group.add(mesh);
    clouds.push({
      group,
      angle: spec.angle,
      radius: spec.radius,
      height: spec.height,
      speed: spec.speed,
      bob: rng.range(0, TAU),
    });
  }
  return clouds;
}

export function buildSky(): SkyBuild {
  const rng = new Rng(777);
  const group = new THREE.Group();

  // ---- gradient dome -------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x6aa1e0) },
      uHorizon: { value: new THREE.Color(0xffe2b2) },
    },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(46, 32, 20), skyMat);
  group.add(dome);

  // ---- stars ----------------------------------------------------------
  const starCount = 260;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // only the upper dome, away from the horizon glow
    const a = rng.range(0, TAU);
    const y = rng.range(0.18, 0.98);
    const rr = Math.sqrt(1 - y * y);
    starPos[i * 3] = Math.sin(a) * rr * 43;
    starPos[i * 3 + 1] = y * 43;
    starPos[i * 3 + 2] = Math.cos(a) * rr * 43;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xfff6e0,
    size: 0.28,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1;
  group.add(stars);

  // ---- sun / moon disc -------------------------------------------------
  const discMat = new THREE.SpriteMaterial({
    map: radialTexture([
      [0.0, 'rgba(255,255,255,1)'],
      [0.32, 'rgba(255,250,235,0.95)'],
      [0.55, 'rgba(255,235,190,0.32)'],
      [1.0, 'rgba(255,235,190,0)'],
    ]),
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const disc = new THREE.Sprite(discMat);
  disc.scale.setScalar(5.2);
  group.add(disc);

  // ---- clouds -----------------------------------------------------------
  const cloudMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });
  const clouds = buildClouds(rng, cloudMat);
  for (const c of clouds) group.add(c.group);

  return { group, skyMat, starMat, disc, discMat, clouds, cloudMat };
}

/** Direction the dominant light comes from at the given hour. */
export function celestialDir(hour: number, out: THREE.Vector3): THREE.Vector3 {
  // sun: rises around 6:00, sets around 18:00, sweeping across the sky
  const sunT = ((hour - 6) / 12) * Math.PI; // 0..PI across the day
  const night = hour < 6 || hour > 18;
  // by night the same arc is walked by a pale moon, offset so it isn't a mirror
  const t = night ? ((hour + 6) / 12) * Math.PI : sunT;
  const y = Math.sin(t);
  const x = Math.cos(t) * (night ? -1 : 1);
  return out.set(x, Math.max(y, 0.06), night ? -0.35 : 0.3).normalize();
}

const tmpColor = new THREE.Color();
const tmpVec = new THREE.Vector3();

/**
 * Per-frame environment refresh: sky colors, fog, stars, the celestial
 * disc, cloud drift and cloud tint all read from the shared state.
 */
export function updateSky(
  sky: SkyBuild,
  state: WorldState,
  sampled: SkyState,
  night: number,
  elapsed: number,
  dt: number,
  reduced: boolean,
): void {
  const wet = state.wet.value;
  const wind = state.windS.value;

  // dome + fog
  sky.skyMat.uniforms.uTop.value.copy(sampled.skyTop);
  sky.skyMat.uniforms.uHorizon.value.copy(sampled.skyHorizon);
  sky.discMat.opacity = clamp(0.55 + 0.45 * (1 - night), 0, 1) * (1 - wet * 0.75);

  // stars
  sky.starMat.opacity = night * (1 - wet * 0.85);

  // celestial disc: follow the light direction, tinted by the palette
  celestialDir(state.timeS.value, tmpVec);
  sky.disc.position.copy(tmpVec).multiplyScalar(40);
  sky.discMat.color.copy(sampled.dirColor).lerp(tmpColor.setHex(0xffffff), 0.55);

  // clouds: orbit the island, speed and tilt scale with wind; rain darkens them
  for (const c of sky.clouds) {
    c.angle += dt * c.speed * (0.25 + wind * 1.6);
    const x = Math.sin(c.angle) * c.radius;
    const z = Math.cos(c.angle) * c.radius;
    const bobY = reduced ? 0 : Math.sin(elapsed * 0.4 + c.bob) * 0.18;
    c.group.position.set(x, c.height + bobY - wet * 0.7, z);
  }
  tmpColor.setHex(0xf5f2ec).lerp(
    new THREE.Color(0x5a6472),
    clamp(night * 0.6 + wet * 0.7, 0, 1),
  );
  sky.cloudMat.color.copy(tmpColor);
}
