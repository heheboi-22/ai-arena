import * as THREE from 'three';
import { isSmallDevice } from '../config';
import { TAU, clamp, lerp, smoothstep } from '../util/math';

export interface EnvParams {
  time: number; // 0..24
  rain: number; // 0..1
  cloudMaterial: THREE.MeshBasicMaterial;
}

export interface Environment {
  sun: THREE.DirectionalLight;
  skyMat: THREE.ShaderMaterial;
  update: (p: EnvParams) => void;
}

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFrag = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform vec3 deepColor;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform float sunIntensity;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -1.0, 1.0);
    // A gentle exponent keeps the pale horizon haze from ending in a hard
    // line, so the sky reads as a gradient rather than two flat bands.
    float t = pow(clamp(h, 0.0, 1.0), 0.45);
    vec3 col = mix(bottomColor, topColor, t);

    // Below the horizon the sky deepens, so the backdrop reads as depth
    // rather than a flat sheet of colour.
    float below = pow(clamp(-h, 0.0, 1.0), 0.6);
    col = mix(col, deepColor, below * 0.9);

    // Horizon glow: the sun's light spills along the horizon at dawn/dusk.
    vec3 gdir = normalize(vec3(sunDir.x, max(sunDir.y, 0.04), sunDir.z));
    float g = max(dot(dir, gdir), 0.0);
    float glow = pow(g, 5.0);

    // The disc itself, only visible while the sun is above the horizon.
    float s = max(dot(dir, sunDir), 0.0);
    float disk = pow(s, 500.0);

    col += sunColor * (glow * 0.5 + disk * 2.2) * sunIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Palette anchors (tone mapping handles the rest).
const DAY_TOP = new THREE.Color('#5c9eeb');
const DAY_BOTTOM = new THREE.Color('#cfe8f2');
const NIGHT_TOP = new THREE.Color('#0d1428');
const NIGHT_BOTTOM = new THREE.Color('#222c4e');
const TWILIGHT_TOP = new THREE.Color('#26356e');
const SUNSET_TOP = new THREE.Color('#463e7e');
const SUNSET_BOTTOM = new THREE.Color('#ff9d5c');
const SUN_WARM = new THREE.Color('#ff9a4d');
const SUN_WHITE = new THREE.Color('#fff3df');
const RAIN_GRAY = new THREE.Color('#7a828f');
const NIGHT_CLOUD = new THREE.Color('#26304a');
const SUNSET_CLOUD = new THREE.Color('#ffd6ad');
const DEEP_TINT = new THREE.Color('#101a33');
const HEMI_FILL = new THREE.Color('#8fa6c8');
const GROUND_FILL = new THREE.Color('#9c8a70');

export function createEnvironment(scene: THREE.Scene): Environment {
  // --- Sky dome ---
  const skyGeo = new THREE.SphereGeometry(150, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: DAY_TOP.clone() },
      bottomColor: { value: DAY_BOTTOM.clone() },
      deepColor: { value: DAY_BOTTOM.clone().multiplyScalar(0.7) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: SUN_WHITE.clone() },
      sunIntensity: { value: 1.0 },
    },
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  // --- Lights ---
  const sun = new THREE.DirectionalLight('#ffffff', 1.2);
  sun.castShadow = true;
  const shadowSize = isSmallDevice ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -9;
  sc.right = 9;
  sc.top = 9;
  sc.bottom = -9;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // A warm, low-angle light that only glows around sunrise/sunset.
  const dusk = new THREE.DirectionalLight('#ff9a4d', 0);
  scene.add(dusk);
  scene.add(dusk.target);

  const hemi = new THREE.HemisphereLight(DAY_TOP.clone(), GROUND_FILL.clone(), 0.5);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight('#aac4ff', 0.0);
  scene.add(moon);
  scene.add(moon.target);

  const ambient = new THREE.AmbientLight('#33405e', 0.18);
  scene.add(ambient);

  // --- Moon disc (visible at night) ---
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 16),
    new THREE.MeshBasicMaterial({
      color: '#eef2ff',
      transparent: true,
      opacity: 0,
      fog: false,
    })
  );
  scene.add(moonMesh);

  // --- Stars ---
  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // Biased towards the upper hemisphere.
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const y = Math.abs(u) * 0.85 + 0.12;
    starPos[i * 3] = Math.cos(a) * r * 140;
    starPos[i * 3 + 1] = y * 140;
    starPos[i * 3 + 2] = Math.sin(a) * r * 140;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#e8efff',
    size: 2.1,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1;
  scene.add(stars);

  scene.fog = new THREE.FogExp2(DAY_BOTTOM.clone(), 0.006);

  // Reusable temporaries
  const top = new THREE.Color();
  const bottom = new THREE.Color();
  const deep = new THREE.Color();
  const base = new THREE.Color();
  const sunPos = new THREE.Vector3();
  const sunCol = new THREE.Color();
  const cloudCol = new THREE.Color();

  const update = (p: EnvParams): void => {
    const elev = ((p.time - 6) / 24) * TAU; // 0 = sunrise, PI/2 = noon, PI = sunset
    const R = 70;
    // The sun rides a tilted circle: it rises in direction SUN_AZ and sets
    // opposite it. The azimuth is chosen so the default 16:00 view is lit
    // from the camera side rather than silhouetted.
    const SUN_AZ = 2.9;
    const cosElev = Math.cos(elev);
    sunPos.set(
      cosElev * Math.cos(SUN_AZ) * R,
      Math.sin(elev) * R,
      cosElev * Math.sin(SUN_AZ) * R
    );
    const sunHeight = Math.sin(elev); // -1..1
    const h = Math.abs(sunHeight);

    // Three independent terms. Keeping them separate is what lets a sunset
    // be warm and bright while the sun is still on the horizon, and lets
    // night fall without the sky turning to mud on the way down.
    const dayAmount = smoothstep(-0.14, 0.26, sunHeight); // daylight strength
    const goldAmount = 1 - smoothstep(0.0, 0.42, h); // golden hour
    const nightAmount = smoothstep(0.0, -0.32, sunHeight); // true night
    const twilight = smoothstep(-0.55, 0.02, sunHeight) * (1 - dayAmount);
    // Direct sunlight only reaches the island while the sun is up.
    const sunPower = smoothstep(-0.1, 0.1, sunHeight);

    // Sky gradient
    base.copy(NIGHT_TOP).lerp(DAY_TOP, dayAmount);
    top.copy(base).lerp(SUNSET_TOP, goldAmount * 0.55).lerp(TWILIGHT_TOP, twilight * 0.7);

    // The camera looks down at the island, so the below-horizon band is
    // most of what the player actually sees — it carries the mood.
    base.copy(DAY_BOTTOM).lerp(SUNSET_BOTTOM, goldAmount * 0.9);
    base.lerp(NIGHT_BOTTOM, nightAmount * 0.85);
    base.lerp(TWILIGHT_TOP, twilight * 0.35);
    bottom.copy(base);

    // Rain desaturates & darkens the sky
    const rain = clamp(p.rain, 0, 1);
    top.lerp(RAIN_GRAY, rain * 0.35).multiplyScalar(1 - 0.4 * rain);
    bottom.lerp(RAIN_GRAY, rain * 0.3).multiplyScalar(1 - 0.45 * rain);

    // The band furthest below the horizon sinks into a deeper blue.
    deep.copy(bottom).multiplyScalar(0.7).lerp(DEEP_TINT, 0.28);

    (skyMat.uniforms.topColor.value as THREE.Color).copy(top);
    (skyMat.uniforms.bottomColor.value as THREE.Color).copy(bottom);
    (skyMat.uniforms.deepColor.value as THREE.Color).copy(deep);
    (skyMat.uniforms.sunDir.value as THREE.Vector3).copy(sunPos).normalize();

    // Sun light & glow
    sun.position.copy(sunPos);
    sunCol.copy(SUN_WHITE).lerp(SUN_WARM, goldAmount);
    sunCol.lerp(RAIN_GRAY, rain * 0.5);
    sun.color.copy(sunCol);
    sun.intensity = (0.55 + dayAmount * 1.0) * sunPower * (1 - 0.45 * rain);
    (skyMat.uniforms.sunColor.value as THREE.Color).copy(sunCol);
    (skyMat.uniforms.sunIntensity.value as number) =
      (0.35 + dayAmount * 1.0 + goldAmount * 0.75) * (1 - 0.5 * rain);

    // Low warm dusk glow, strongest while the sun sits on the horizon.
    dusk.position.set(
      cosElev * Math.cos(SUN_AZ) * R,
      4,
      cosElev * Math.sin(SUN_AZ) * R
    );
    dusk.color.copy(SUN_WARM);
    dusk.intensity = goldAmount * 1.05 * (1 - 0.4 * rain);

    // Hemisphere + ambient fill (keeps night and dusk readable)
    hemi.color.copy(top).lerp(HEMI_FILL, 0.35 + nightAmount * 0.3);
    hemi.groundColor.copy(GROUND_FILL);
    hemi.intensity = 0.3 + dayAmount * 0.46 + twilight * 0.26;
    ambient.intensity = 0.14 + twilight * 0.14 + nightAmount * 0.18;

    // Moon
    moon.position.copy(sunPos).multiplyScalar(-1);
    if (moon.position.y < 2) moon.position.y = Math.abs(moon.position.y) + 5;
    moon.intensity = nightAmount * 0.5;
    moonMesh.position.copy(moon.position).normalize().multiplyScalar(130);
    (moonMesh.material as THREE.MeshBasicMaterial).opacity = nightAmount * 0.9;

    // Stars
    starMat.opacity = nightAmount * 0.9 * (1 - rain * 0.8);

    // Clouds tint (unlit material, so we author the colour directly)
    cloudCol.set('#ffffff');
    cloudCol.lerp(SUNSET_CLOUD, goldAmount * 0.7);
    cloudCol.lerp(NIGHT_CLOUD, nightAmount * 0.95);
    cloudCol.lerp(RAIN_GRAY, rain * 0.7);
    p.cloudMaterial.color.copy(cloudCol);

    // Fog follows the horizon
    (scene.fog as THREE.FogExp2).color.copy(bottom);
    (scene.fog as THREE.FogExp2).density = 0.006 + rain * 0.02;
  };

  return { sun, skyMat, update };
}
