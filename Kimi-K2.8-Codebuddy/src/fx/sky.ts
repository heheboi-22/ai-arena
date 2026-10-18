import * as THREE from 'three';
import { lerp, smoothstep } from '../utils';

interface SkyKey {
  t: number;
  zen: number;
  hor: number;
  sunC: number;
  sunI: number;
  hS: number;
  hG: number;
  hI: number;
  amb: number;
  ambI: number;
  fog: number;
  exp: number;
}

/** Keyframed palettes across a 24 h cycle (wrapped at both ends). */
const KEYS: SkyKey[] = [
  { t: 0,    zen: 0x0a1030, hor: 0x1b2a55, sunC: 0x334466, sunI: 0,    hS: 0x2a3a6e, hG: 0x1c2030, hI: 0.45, amb: 0x35406e, ambI: 0.55, fog: 0x131c3d, exp: 0.95 },
  { t: 4.5,  zen: 0x0d1538, hor: 0x27335f, sunC: 0x445588, sunI: 0,    hS: 0x33447c, hG: 0x20242f, hI: 0.5,  amb: 0x3a4470, ambI: 0.6,  fog: 0x18224a, exp: 0.97 },
  { t: 6,    zen: 0x2c4a7e, hor: 0xd98a5e, sunC: 0xffb27a, sunI: 1.4,  hS: 0x7a6a9e, hG: 0x3c3630, hI: 0.55, amb: 0x6a5f7e, ambI: 0.6,  fog: 0x9a7a68, exp: 1.0 },
  { t: 8,    zen: 0x4a92d8, hor: 0xa8cdec, sunC: 0xffe3b8, sunI: 2.6,  hS: 0xbcd8ee, hG: 0x6a7256, hI: 0.75, amb: 0x9fb6cc, ambI: 0.5,  fog: 0xc4d9e4, exp: 1.05 },
  { t: 12,   zen: 0x2f7fd0, hor: 0x9ec8ec, sunC: 0xfff3dd, sunI: 3.0,  hS: 0xc4e0f2, hG: 0x707a58, hI: 0.85, amb: 0xa8bdd0, ambI: 0.55, fog: 0xcadee8, exp: 1.06 },
  { t: 15.5, zen: 0x2f7ccc, hor: 0xa4cde8, sunC: 0xffedc9, sunI: 2.8,  hS: 0xbcd4e6, hG: 0x6e785a, hI: 0.8,  amb: 0xa2b6c8, ambI: 0.52, fog: 0xc8dade, exp: 1.05 },
  { t: 17.5, zen: 0x4a6aa8, hor: 0xf2b27a, sunC: 0xffc36e, sunI: 2.0,  hS: 0xb09ac0, hG: 0x5e5648, hI: 0.65, amb: 0x8a7c92, ambI: 0.55, fog: 0xdba87e, exp: 1.02 },
  { t: 19,   zen: 0x2c3a72, hor: 0xe97f52, sunC: 0xff9a52, sunI: 0.9,  hS: 0x6a5e96, hG: 0x3a3440, hI: 0.55, amb: 0x54507e, ambI: 0.6,  fog: 0x9a5f4e, exp: 0.98 },
  { t: 20.3, zen: 0x161f4c, hor: 0x5c4a78, sunC: 0xcc6644, sunI: 0.15, hS: 0x3c447e, hG: 0x262433, hI: 0.5,  amb: 0x424a78, ambI: 0.6,  fog: 0x2c2c50, exp: 0.96 },
  { t: 22,   zen: 0x0c1234, hor: 0x22305c, sunC: 0x334466, sunI: 0,    hS: 0x2e3c72, hG: 0x1e2230, hI: 0.45, amb: 0x38416e, ambI: 0.55, fog: 0x16204a, exp: 0.95 },
  { t: 24,   zen: 0x0a1030, hor: 0x1b2a55, sunC: 0x334466, sunI: 0,    hS: 0x2a3a6e, hG: 0x1c2030, hI: 0.45, amb: 0x35406e, ambI: 0.55, fog: 0x131c3d, exp: 0.95 },
];

export interface SkyEnv {
  dayFactor: number;
  nightFactor: number;
}

export interface SkyRefs {
  update: (hour: number, rainAmount: number, motionScale: number) => SkyEnv;
}

interface SkyTargets {
  waterMaterial: THREE.MeshStandardMaterial;
  cloudMaterial: THREE.MeshStandardMaterial;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 3.2 + 0.22, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
    float below = clamp(-vDir.y * 2.0, 0.0, 1.0);
    col = mix(col, uZenith * 0.5, below * 0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const colorA = new THREE.Color();
const colorB = new THREE.Color();

/**
 * Everything that makes the sky: gradient dome, sun + moon discs,
 * stars, the directional sun (with shadows) and moon fill lights,
 * hemisphere/ambient fill, fog and exposure. All of it is derived
 * from the hour of day plus the smoothed rain amount, so scrubbing
 * the time slider produces continuous day → sunset → night states.
 */
export function createSky(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  targets: SkyTargets,
  highQuality: boolean,
): SkyRefs {
  // --- dome ---
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uZenith: { value: new THREE.Color(0x64abe0) },
      uHorizon: { value: new THREE.Color(0xd8ecf5) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 18), skyMat);
  dome.name = 'skyDome';
  scene.add(dome);

  // --- sun & moon discs ---
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 32),
    new THREE.MeshBasicMaterial({ color: '#fff0c4', transparent: true, opacity: 0.95, fog: false, depthWrite: false }),
  );
  scene.add(sunDisc);
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 32),
    new THREE.MeshBasicMaterial({ color: '#e6ecf7', transparent: true, opacity: 0, fog: false, depthWrite: false }),
  );
  scene.add(moonDisc);

  // --- stars ---
  const starCount = 550;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const az = Math.random() * Math.PI * 2;
    const el = 0.06 + Math.pow(Math.random(), 0.7) * 0.94;
    const r = 132;
    starPos[i * 3] = Math.cos(az) * Math.cos(el * Math.PI * 0.5) * r;
    starPos[i * 3 + 1] = Math.sin(el * Math.PI * 0.5) * r;
    starPos[i * 3 + 2] = Math.sin(az) * Math.cos(el * Math.PI * 0.5) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#dfe8ff',
    size: 1.7,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- lights ---
  const sun = new THREE.DirectionalLight('#fff3dd', 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(highQuality ? 2048 : 1024);
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight('#93a7e8', 0);
  scene.add(moon, moon.target);

  const hemi = new THREE.HemisphereLight('#c4e0f2', '#707a58', 0.8);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight('#a8bdd0', 0.5);
  scene.add(ambient);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();

  const update = (hour: number, rainAmount: number, motionScale: number): SkyEnv => {
    const h = ((hour % 24) + 24) % 24;

    // find bracketing keys
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= h) i++;
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    let f = (h - k0.t) / (k1.t - k0.t);
    f = f * f * (3 - 2 * f);

    // sun geometry: rises at 6h (+x), noon overhead, sets at 18h
    const a = ((h - 6) / 12) * Math.PI;
    const elev = Math.sin(a);
    sunDir.set(Math.cos(a), Math.sin(a), 0.42).normalize();
    moonDir.set(-Math.cos(a), -Math.sin(a), -0.32).normalize();

    const day = smoothstep(-0.05, 0.18, elev);
    const night = 1 - day;
    const sunUp = smoothstep(-0.08, 0.04, elev);

    // --- dome ---
    colorA.setHex(k0.zen).lerp(colorB.setHex(k1.zen), f);
    (skyMat.uniforms.uZenith.value as THREE.Color).copy(colorA);
    colorA.setHex(k0.hor).lerp(colorB.setHex(k1.hor), f);
    (skyMat.uniforms.uHorizon.value as THREE.Color).copy(colorA);

    // --- sun ---
    sun.position.copy(sunDir).multiplyScalar(30);
    colorA.setHex(k0.sunC).lerp(colorB.setHex(k1.sunC), f);
    sun.color.copy(colorA);
    const sunI = lerp(k0.sunI, k1.sunI, f) * sunUp * (1 - 0.72 * rainAmount);
    sun.intensity = sunI;
    sun.visible = sunI > 0.01;

    // --- moon ---
    moon.position.copy(moonDir).multiplyScalar(30);
    moon.intensity = 0.42 * night * (1 - 0.55 * rainAmount);
    moon.visible = moon.intensity > 0.01;

    // --- fills ---
    hemi.color.setHex(k0.hS).lerp(colorB.setHex(k1.hS), f);
    hemi.groundColor.setHex(k0.hG).lerp(colorB.setHex(k1.hG), f);
    hemi.intensity = lerp(k0.hI, k1.hI, f) * (1 + 0.22 * rainAmount);

    ambient.color.setHex(k0.amb).lerp(colorB.setHex(k1.amb), f);
    ambient.intensity = lerp(k0.ambI, k1.ambI, f);

    // --- fog & exposure ---
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.setHex(k0.fog).lerp(colorB.setHex(k1.fog), f);
    }
    renderer.toneMappingExposure = lerp(k0.exp, k1.exp, f) * (1 - 0.12 * rainAmount);

    // --- discs & stars ---
    sunDisc.position.copy(sunDir).multiplyScalar(118);
    sunDisc.lookAt(0, 0, 0);
    sunDisc.material.opacity = 0.95 * smoothstep(-0.05, 0.06, elev);
    sunDisc.visible = sunDisc.material.opacity > 0.01;

    moonDisc.position.copy(moonDir).multiplyScalar(118);
    moonDisc.lookAt(0, 0, 0);
    moonDisc.material.opacity = 0.95 * night * (1 - 0.65 * rainAmount);
    moonDisc.visible = moonDisc.material.opacity > 0.01;

    starMat.opacity = Math.pow(night, 1.4) * (1 - 0.88 * rainAmount) * 0.9;
    stars.rotation.y += 0.004 * motionScale * (1 / 60);

    // --- shared tints ---
    // water: day blue → night ink, muted toward rain grey-blue
    colorA.set('#4d9cc2').lerp(colorB.set('#16283e'), night);
    targets.waterMaterial.color.copy(colorA).lerp(colorB.set('#3d7186'), rainAmount * 0.55);

    // clouds: white → overcast grey in rain → dusky blue at night
    colorA.set('#ffffff').lerp(colorB.set('#6f7887'), rainAmount * 0.8);
    colorA.lerp(colorB.set('#39415c'), night * 0.5);
    targets.cloudMaterial.color.copy(colorA);

    return { dayFactor: day, nightFactor: night };
  };

  return { update };
}
