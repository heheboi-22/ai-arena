import * as THREE from 'three';
import { smoothstep } from './terrainMath';

export interface RGBTuple {
  r: number;
  g: number;
  b: number;
}

export interface AtmosphereSample {
  zenith: RGBTuple;
  horizon: RGBTuple;
  nadir: RGBTuple;
  sunDir: { x: number; y: number; z: number };
  moonDir: { x: number; y: number; z: number };
  keyLightDir: { x: number; y: number; z: number };
  keyLightColor: RGBTuple;
  keyLightIntensity: number;
  hemiSky: RGBTuple;
  hemiGround: RGBTuple;
  hemiIntensity: number;
  rimColor: RGBTuple;
  rimIntensity: number;
  nightFactor: number;
  sunsetFactor: number;
  sunGlowStrength: number;
  starVisibility: number;
  moonVisibility: number;
}

interface TimeStop {
  hour: number;
  zenith: RGBTuple;
  horizon: RGBTuple;
  nadir: RGBTuple;
  sunColor: RGBTuple;
  sunIntensity: number;
  hemiSky: RGBTuple;
  hemiGround: RGBTuple;
  hemiIntensity: number;
}

function rgb(hex: number): RGBTuple {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  };
}

function lerpRgb(a: RGBTuple, b: RGBTuple, t: number): RGBTuple {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function normalize3(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

/** Curated 24-hour palette keyframes ensuring distinct, readable, painterly transitions. */
const TIME_STOPS: TimeStop[] = [
  {
    hour: 0.0, // Midnight — deep readable moonlight indigo
    zenith: rgb(0x0f1830),
    horizon: rgb(0x223354),
    nadir: rgb(0x131d33),
    sunColor: rgb(0x95b6e6),
    sunIntensity: 0.62,
    hemiSky: rgb(0x415b8c),
    hemiGround: rgb(0x232b3b),
    hemiIntensity: 0.68,
  },
  {
    hour: 4.5, // Pre-dawn
    zenith: rgb(0x192544),
    horizon: rgb(0x3a4a6e),
    nadir: rgb(0x1c253d),
    sunColor: rgb(0x9cb4db),
    sunIntensity: 0.65,
    hemiSky: rgb(0x4f648e),
    hemiGround: rgb(0x2c3342),
    hemiIntensity: 0.72,
  },
  {
    hour: 6.2, // Dawn
    zenith: rgb(0x4f6d9e),
    horizon: rgb(0xecae8b),
    nadir: rgb(0x7c7b8c),
    sunColor: rgb(0xffbf88),
    sunIntensity: 1.55,
    hemiSky: rgb(0x9eb4d4),
    hemiGround: rgb(0x6c655d),
    hemiIntensity: 0.86,
  },
  {
    hour: 8.8, // Fresh Morning
    zenith: rgb(0x5592c6),
    horizon: rgb(0xcde2ee),
    nadir: rgb(0x9ec0d4),
    sunColor: rgb(0xfff1d6),
    sunIntensity: 2.15,
    hemiSky: rgb(0xb8d9ee),
    hemiGround: rgb(0x7d846c),
    hemiIntensity: 0.96,
  },
  {
    hour: 12.5, // Bright Midday
    zenith: rgb(0x4889c4),
    horizon: rgb(0xd7e8f3),
    nadir: rgb(0xa8c9dc),
    sunColor: rgb(0xfff8ea),
    sunIntensity: 2.35,
    hemiSky: rgb(0xc4e1f5),
    hemiGround: rgb(0x888f75),
    hemiIntensity: 1.02,
  },
  {
    hour: 16.0, // Default Golden Late Afternoon
    zenith: rgb(0x5688bd),
    horizon: rgb(0xf0d6b2),
    nadir: rgb(0xb8bfbc),
    sunColor: rgb(0xffdfa3),
    sunIntensity: 2.2,
    hemiSky: rgb(0xc7d6e6),
    hemiGround: rgb(0x847a66),
    hemiIntensity: 0.96,
  },
  {
    hour: 18.4, // Warm Sunset
    zenith: rgb(0x3a4878),
    horizon: rgb(0xee8d5e),
    nadir: rgb(0x75596a),
    sunColor: rgb(0xff9254),
    sunIntensity: 1.75,
    hemiSky: rgb(0x9685a8),
    hemiGround: rgb(0x634d49),
    hemiIntensity: 0.85,
  },
  {
    hour: 20.2, // Blue Hour Dusk
    zenith: rgb(0x1b2647),
    horizon: rgb(0x445178),
    nadir: rgb(0x212942),
    sunColor: rgb(0x9cb4e0),
    sunIntensity: 0.72,
    hemiSky: rgb(0x506694),
    hemiGround: rgb(0x2c3244),
    hemiIntensity: 0.74,
  },
  {
    hour: 24.0, // Wraps cleanly back to midnight
    zenith: rgb(0x0f1830),
    horizon: rgb(0x223354),
    nadir: rgb(0x131d33),
    sunColor: rgb(0x95b6e6),
    sunIntensity: 0.62,
    hemiSky: rgb(0x415b8c),
    hemiGround: rgb(0x232b3b),
    hemiIntensity: 0.68,
  },
];

export function computeAtmosphereSample(
  timeMinutes: number,
  rainAmount: number,
): AtmosphereSample {
  const hour = (((timeMinutes % 1440) + 1440) % 1440) / 60;
  const rain = Math.min(1, Math.max(0, rainAmount));

  // Find bounding stops
  let a = TIME_STOPS[0];
  let b = TIME_STOPS[TIME_STOPS.length - 1];
  for (let i = 0; i < TIME_STOPS.length - 1; i++) {
    if (hour >= TIME_STOPS[i].hour && hour <= TIME_STOPS[i + 1].hour) {
      a = TIME_STOPS[i];
      b = TIME_STOPS[i + 1];
      break;
    }
  }
  const span = Math.max(1e-4, b.hour - a.hour);
  const rawT = (hour - a.hour) / span;
  const t = rawT * rawT * (3 - 2 * rawT); // smooth cubic easing between stops

  let zenith = lerpRgb(a.zenith, b.zenith, t);
  let horizon = lerpRgb(a.horizon, b.horizon, t);
  let nadir = lerpRgb(a.nadir, b.nadir, t);
  let keyLightColor = lerpRgb(a.sunColor, b.sunColor, t);
  let keyLightIntensity = lerpNum(a.sunIntensity, b.sunIntensity, t);
  let hemiSky = lerpRgb(a.hemiSky, b.hemiSky, t);
  let hemiGround = lerpRgb(a.hemiGround, b.hemiGround, t);
  let hemiIntensity = lerpNum(a.hemiIntensity, b.hemiIntensity, t);

  // Celestial arc: rises ~06:00, high noon 12:00, golden afternoon 16:00, sets ~18:30
  const sunPhase = ((hour - 6.0) / 12.4) * Math.PI;
  const sunDir = normalize3(
    Math.cos(sunPhase) * 0.85,
    Math.sin(sunPhase) * 0.88,
    0.62 + 0.14 * Math.sin(sunPhase),
  );

  // Moon arcs cleanly opposite the sun, always staying high enough at night for graceful shadows
  const moonPhase = sunPhase - Math.PI;
  const moonDir = normalize3(
    Math.cos(moonPhase) * 0.72 + 0.24,
    Math.sin(moonPhase) * 0.85,
    0.55,
  );

  // Compute day / sunset / night factors smoothly from sun elevation
  const nightFactor = 1 - smoothstep(-0.14, 0.22, sunDir.y);
  const sunsetWindow =
    smoothstep(-0.14, 0.08, sunDir.y) * (1 - smoothstep(0.18, 0.52, sunDir.y));
  // Bias sunsetFactor slightly stronger in the evening (golden hour -> sunset)
  const eveningBias = hour > 13 ? 1.0 : 0.65;
  const sunsetFactor = sunsetWindow * eveningBias;

  // Smoothly select sun or moon as directional key light without jarring shadow flips
  const useMoon = smoothstep(-0.04, -0.18, sunDir.y);
  const clampedSunDir = normalize3(sunDir.x, Math.max(0.24, sunDir.y), sunDir.z);
  const clampedMoonDir = normalize3(moonDir.x, Math.max(0.32, moonDir.y), moonDir.z);
  const keyLightDir = normalize3(
    lerpNum(clampedSunDir.x, clampedMoonDir.x, useMoon),
    lerpNum(clampedSunDir.y, clampedMoonDir.y, useMoon),
    lerpNum(clampedSunDir.z, clampedMoonDir.z, useMoon),
  );

  // Overcast rain adaptation: cooler desaturated mist, softened direct sun, balanced readable ambient
  const rainZenithDay = rgb(0x526478);
  const rainHorizonDay = rgb(0x8899a8);
  const rainNadirDay = rgb(0x637382);
  const rainZenithNight = rgb(0x111928);
  const rainHorizonNight = rgb(0x222f42);
  const rainNadirNight = rgb(0x161f2e);

  const overcastZenith = lerpRgb(rainZenithDay, rainZenithNight, nightFactor);
  const overcastHorizon = lerpRgb(rainHorizonDay, rainHorizonNight, nightFactor);
  const overcastNadir = lerpRgb(rainNadirDay, rainNadirNight, nightFactor);

  zenith = lerpRgb(zenith, overcastZenith, rain * 0.8);
  horizon = lerpRgb(horizon, overcastHorizon, rain * 0.82);
  nadir = lerpRgb(nadir, overcastNadir, rain * 0.78);

  keyLightColor = lerpRgb(keyLightColor, lerpRgb(rgb(0xd4dfe8), rgb(0x7e96b8), nightFactor), rain * 0.55);
  keyLightIntensity *= lerpNum(1.0, 0.48, rain);
  hemiSky = lerpRgb(hemiSky, overcastHorizon, rain * 0.55);
  hemiIntensity = lerpNum(hemiIntensity, Math.max(hemiIntensity * 0.94, 0.76 - nightFactor * 0.12), rain);

  // Gentle warm/cool underside bounce light keeps sculpted floating rocks readable at all hours
  const rimColor = lerpRgb(rgb(0xd4cbbd), rgb(0x6382b5), nightFactor);
  const rimIntensity = lerpNum(0.68, 0.56, nightFactor) * lerpNum(1.0, 0.88, rain);

  const sunGlowStrength = smoothstep(-0.08, 0.2, sunDir.y) * (1 - rain * 0.85);
  const starVisibility = smoothstep(0.35, 0.88, nightFactor) * (1 - rain * 0.88);
  const moonVisibility = smoothstep(0.05, 0.35, moonDir.y) * smoothstep(0.25, 0.75, nightFactor) * (1 - rain * 0.72);

  return {
    zenith,
    horizon,
    nadir,
    sunDir,
    moonDir,
    keyLightDir,
    keyLightColor,
    keyLightIntensity,
    hemiSky,
    hemiGround,
    hemiIntensity,
    rimColor,
    rimIntensity,
    nightFactor,
    sunsetFactor,
    sunGlowStrength,
    starVisibility,
    moonVisibility,
  };
}

export interface AtmosphereBundle {
  group: THREE.Group;
  keyLight: THREE.DirectionalLight;
  update: (
    timeMinutes: number,
    rainAmount: number,
    elapsed: number,
    reducedMotion: boolean,
  ) => AtmosphereSample;
  dispose: () => void;
}

export function createAtmosphere(
  scene: THREE.Scene,
  shadowMapSize: number,
): AtmosphereBundle {
  const group = new THREE.Group();
  group.name = 'sky-and-atmosphere';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // --- 1. Procedural Gradient Sky Dome Shader ---
  const skyGeo = new THREE.SphereGeometry(72, 32, 20);
  geometries.push(skyGeo);

  const skyUniforms = {
    uZenith: { value: new THREE.Color(0x5688bd) },
    uHorizon: { value: new THREE.Color(0xf0d6b2) },
    uNadir: { value: new THREE.Color(0xb8bfbc) },
    uSunDir: { value: new THREE.Vector3(-0.6, 0.5, 0.5).normalize() },
    uSunColor: { value: new THREE.Color(0xffe0a8) },
    uSunGlow: { value: 1.0 },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.6, 0.5).normalize() },
    uMoonGlow: { value: 0.0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uNadir;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunGlow;
      uniform vec3 uMoonDir;
      uniform float uMoonGlow;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        // Slightly lower apparent horizon so elevated 3/4 diorama views display rich sky blue above & soft haze below
        float h = dir.y + 0.22;

        // Smooth sky gradient above & below horizon
        vec3 col;
        if (h >= 0.0) {
          float t = pow(clamp(h / 1.1, 0.0, 1.0), 0.52);
          col = mix(uHorizon, uZenith, t);
        } else {
          float t = pow(clamp(-h / 0.85, 0.0, 1.0), 0.65);
          col = mix(uHorizon, uNadir, t);
        }

        // Subtle atmospheric solar halo
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float halo = pow(sunDot, 10.0) * 0.24 + pow(sunDot, 110.0) * 0.45;
        col += uSunColor * halo * uSunGlow;

        // Soft moon halo at night
        float moonDot = max(dot(dir, normalize(uMoonDir)), 0.0);
        float moonHalo = pow(moonDot, 22.0) * 0.14 + pow(moonDot, 180.0) * 0.35;
        col += vec3(0.75, 0.86, 1.0) * moonHalo * uMoonGlow;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  materials.push(skyMat);
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // --- 2. Stylized Sun & Moon Discs ---
  const sunGeo = new THREE.SphereGeometry(2.1, 16, 12);
  geometries.push(sunGeo);
  const sunMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c4,
    transparent: true,
    opacity: 0.92,
    fog: false,
  });
  materials.push(sunMat);
  const sunDisc = new THREE.Mesh(sunGeo, sunMat);
  group.add(sunDisc);

  const moonGeo = new THREE.SphereGeometry(1.55, 16, 12);
  geometries.push(moonGeo);
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xe6eefc,
    transparent: true,
    opacity: 0,
    fog: false,
  });
  materials.push(moonMat);
  const moonDisc = new THREE.Mesh(moonGeo, moonMat);
  group.add(moonDisc);

  // --- 3. Procedural Night Starfield ---
  const starCount = 240;
  const starPositions = new Float32Array(starCount * 3);
  const starPhases = new Float32Array(starCount);
  let seed = 9187;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(0.08 + rand() * 0.92); // Upper hemisphere above horizon
    const r = 58 + rand() * 6;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starPhases[i] = rand() * Math.PI * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
  geometries.push(starGeo);

  const starUniforms = {
    uOpacity: { value: 0 },
    uTime: { value: 0 },
    uTwinkle: { value: 1 },
  };
  const starMat = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying float vPhase;
      void main() {
        vPhase = aPhase;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(120.0 / -mvPos.z, 1.5, 3.6);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uTime;
      uniform float uTwinkle;
      varying float vPhase;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float core = smoothstep(0.5, 0.08, dist);
        float twinkle = mix(1.0, 0.72 + 0.28 * sin(uTime * 1.9 + vPhase), uTwinkle);
        gl_FragColor = vec4(0.92, 0.95, 1.0, core * uOpacity * twinkle);
      }
    `,
  });
  materials.push(starMat);
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // --- 4. Directional Key Light (Sun / Moon) with Clean Shadows ---
  const keyLight = new THREE.DirectionalLight(0xffdfa3, 2.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 36;
  const shadowExtent = 8.4;
  keyLight.shadow.camera.left = -shadowExtent;
  keyLight.shadow.camera.right = shadowExtent;
  keyLight.shadow.camera.top = shadowExtent;
  keyLight.shadow.camera.bottom = -shadowExtent;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.028;
  group.add(keyLight);
  group.add(keyLight.target);

  // --- 5. Hemisphere Sky/Ground Fill + Subtle Underside Rim Light ---
  const hemiLight = new THREE.HemisphereLight(0xc7d6e6, 0x847a66, 0.96);
  group.add(hemiLight);

  const rimLight = new THREE.DirectionalLight(0xd4cbbd, 0.68);
  rimLight.position.set(7.5, -6.5, 9.5);
  group.add(rimLight);

  // Subtle atmospheric distance fog matched to sky horizon
  const fog = new THREE.Fog(0xf0d6b2, 26, 66);
  scene.fog = fog;
  scene.background = new THREE.Color(0x5688bd);

  const update: AtmosphereBundle['update'] = (
    timeMinutes,
    rainAmount,
    elapsed,
    reducedMotion,
  ) => {
    const sample = computeAtmosphereSample(timeMinutes, rainAmount);

    skyUniforms.uZenith.value.setRGB(sample.zenith.r, sample.zenith.g, sample.zenith.b);
    skyUniforms.uHorizon.value.setRGB(sample.horizon.r, sample.horizon.g, sample.horizon.b);
    skyUniforms.uNadir.value.setRGB(sample.nadir.r, sample.nadir.g, sample.nadir.b);
    skyUniforms.uSunDir.value.set(sample.sunDir.x, sample.sunDir.y, sample.sunDir.z);
    skyUniforms.uSunColor.value.setRGB(
      sample.keyLightColor.r,
      sample.keyLightColor.g,
      sample.keyLightColor.b,
    );
    skyUniforms.uSunGlow.value = sample.sunGlowStrength;
    skyUniforms.uMoonDir.value.set(sample.moonDir.x, sample.moonDir.y, sample.moonDir.z);
    skyUniforms.uMoonGlow.value = sample.moonVisibility;

    // Sync scene fog & fallback background color to horizon
    fog.color.setRGB(sample.horizon.r, sample.horizon.g, sample.horizon.b);
    if (scene.background instanceof THREE.Color) {
      scene.background.setRGB(sample.horizon.r, sample.horizon.g, sample.horizon.b);
    }

    // Celestial disc placement
    sunDisc.position.set(sample.sunDir.x * 54, sample.sunDir.y * 54, sample.sunDir.z * 54);
    sunMat.color.setRGB(
      Math.min(1, sample.keyLightColor.r * 1.06),
      Math.min(1, sample.keyLightColor.g * 1.03),
      sample.keyLightColor.b,
    );
    sunMat.opacity = sample.sunGlowStrength * 0.92;
    sunDisc.visible = sunMat.opacity > 0.02;

    moonDisc.position.set(sample.moonDir.x * 52, sample.moonDir.y * 52, sample.moonDir.z * 52);
    moonMat.opacity = sample.moonVisibility * 0.92;
    moonDisc.visible = moonMat.opacity > 0.02;

    // Night starfield
    starUniforms.uOpacity.value = sample.starVisibility * 0.9;
    starUniforms.uTime.value = elapsed;
    starUniforms.uTwinkle.value = reducedMotion ? 0.0 : 1.0;
    stars.visible = sample.starVisibility > 0.01;

    // Lights
    keyLight.position.set(
      sample.keyLightDir.x * 16,
      sample.keyLightDir.y * 16,
      sample.keyLightDir.z * 16,
    );
    keyLight.color.setRGB(
      sample.keyLightColor.r,
      sample.keyLightColor.g,
      sample.keyLightColor.b,
    );
    keyLight.intensity = sample.keyLightIntensity;

    hemiLight.color.setRGB(sample.hemiSky.r, sample.hemiSky.g, sample.hemiSky.b);
    hemiLight.groundColor.setRGB(
      sample.hemiGround.r,
      sample.hemiGround.g,
      sample.hemiGround.b,
    );
    hemiLight.intensity = sample.hemiIntensity;

    rimLight.color.setRGB(sample.rimColor.r, sample.rimColor.g, sample.rimColor.b);
    rimLight.intensity = sample.rimIntensity;

    return sample;
  };

  return {
    group,
    keyLight,
    update,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
