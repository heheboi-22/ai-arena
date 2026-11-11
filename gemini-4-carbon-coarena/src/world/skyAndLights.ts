import * as THREE from 'three';
import { createRng, clamp, lerp, smoothstep } from '../utils/math';

export interface SkySample {
  dayFactor: number;
  nightFactor: number;
  twilightFactor: number;
}

export interface SkyAndLightsRig {
  update: (timeHours: number, rainAmount: number, elapsed: number, reducedMotion: boolean) => SkySample;
}

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uBottomColor;
  uniform vec3 uSunDir;
  uniform vec3 uHaloColor;
  uniform float uHaloStrength;

  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    float y = dir.y;

    // Smooth vertical atmospheric dome gradient
    float upperMix = pow(clamp(y, 0.0, 1.0), 0.58);
    float lowerMix = pow(clamp(-y, 0.0, 1.0), 0.65);

    vec3 col = mix(uHorizonColor, uTopColor, upperMix);
    col = mix(col, uBottomColor, lowerMix);

    // Warm solar / twilight atmospheric scattering halo
    float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
    float wideGlow = pow(sunCos, 5.0) * 0.34;
    float tightGlow = pow(sunCos, 36.0) * 0.52;
    col += uHaloColor * (wideGlow + tightGlow) * uHaloStrength;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSkyAndLights(
  scene: THREE.Scene,
  isCompactDevice = false
): SkyAndLightsRig {
  // 1. Procedural Gradient Sky Dome
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x5288c4) },
    uHorizonColor: { value: new THREE.Color(0xe6dfd2) },
    uBottomColor: { value: new THREE.Color(0x9fb8c9) },
    uSunDir: { value: new THREE.Vector3(0.6, 0.5, 0.5) },
    uHaloColor: { value: new THREE.Color(0xffd7a3) },
    uHaloStrength: { value: 0.75 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(72, 32, 24), skyMat);
  skyDome.name = 'SkyDome';
  skyDome.renderOrder = -10;
  scene.add(skyDome);

  // Atmospheric exponential fog blended seamlessly to sky horizon
  const fog = new THREE.FogExp2(0xdce6ee, 0.011);
  scene.fog = fog;

  // 2. Nighttime Starfield inside Sky Dome
  const starGeo = new THREE.BufferGeometry();
  const rng = createRng(1907);
  const starCount = 260;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const tmpStarC = new THREE.Color();

  for (let i = 0; i < starCount; i++) {
    // Upper + mid celestial hemisphere
    const u = rng();
    const v = rng();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(lerp(-0.18, 0.98, v));
    const r = 64;

    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const warmth = rng();
    if (warmth < 0.35) tmpStarC.setHex(0xfff1d6);
    else if (warmth < 0.75) tmpStarC.setHex(0xe8f1ff);
    else tmpStarC.setHex(0xc4dbff);

    const bright = 0.65 + rng() * 0.35;
    starColors[i * 3] = tmpStarC.r * bright;
    starColors[i * 3 + 1] = tmpStarC.g * bright;
    starColors[i * 3 + 2] = tmpStarC.b * bright;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: isCompactDevice ? 1.5 : 1.85,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const stars = new THREE.Points(starGeo, starMat);
  stars.name = 'NightStars';
  scene.add(stars);

  // 3. Celestial Sun & Moon Orbs
  const sunOrbMat = new THREE.MeshBasicMaterial({
    color: 0xfff3d1,
    transparent: true,
    opacity: 1,
    fog: false,
  });
  const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(2.15, 18, 14), sunOrbMat);
  scene.add(sunOrb);

  const moonOrbMat = new THREE.MeshBasicMaterial({
    color: 0xe6effc,
    transparent: true,
    opacity: 0,
    fog: false,
  });
  const moonOrb = new THREE.Mesh(new THREE.SphereGeometry(1.55, 16, 12), moonOrbMat);
  scene.add(moonOrb);

  // 4. Primary Shadow-Casting Directional Light (transitions smoothly between Sun and Moon)
  const keyLight = new THREE.DirectionalLight(0xffe6c2, 2.05);
  keyLight.castShadow = true;
  const shadowRes = isCompactDevice ? 1024 : 2048;
  keyLight.shadow.mapSize.set(shadowRes, shadowRes);
  keyLight.shadow.camera.near = 1.5;
  keyLight.shadow.camera.far = 34;
  const d = 6.9;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.00045;
  keyLight.shadow.normalBias = 0.024;
  scene.add(keyLight);
  scene.add(keyLight.target);
  keyLight.target.position.set(0, -0.25, 0);

  // 5. Sky/Ground Hemisphere Light (keeps shadows & nighttime atmospheric and readable)
  const hemiLight = new THREE.HemisphereLight(0xaad4ff, 0x7c6a58, 0.85);
  scene.add(hemiLight);

  // 6. Gentle Underside Rim Fill so the sculpted floating rock spire always retains depth
  const underFill = new THREE.DirectionalLight(0x7ca2c4, 0.34);
  underFill.position.set(-4.5, -7.5, 5.0);
  scene.add(underFill);

  const sunVec = new THREE.Vector3();
  const moonVec = new THREE.Vector3();
  const activeKeyDir = new THREE.Vector3();

  return {
    update(timeHours, rainAmount, elapsed, reducedMotion) {
      // Continuous 24-hour orbital angle:
      // 06:00 sunrise, 12:00 high midday, 16:00 golden afternoon (front-right), ~18:35 sunset, 00:00 midnight
      const solarAngle = ((timeHours - 6.0) / 24.0) * Math.PI * 2;
      const sunElev = Math.sin(solarAngle) * 0.86 + 0.08;
      const azimuth = 0.62 - (solarAngle - (10 / 24) * Math.PI * 2);

      const horizLen = Math.sqrt(Math.max(0.04, 1 - sunElev * sunElev));
      sunVec.set(Math.cos(azimuth) * horizLen, sunElev, Math.sin(azimuth) * horizLen).normalize();

      // Moon sits opposite the sun with reliable nighttime elevation
      const moonElev = Math.max(0.26, -sunElev * 0.85 + 0.18);
      const moonAz = azimuth + Math.PI * 0.92;
      const moonHoriz = Math.sqrt(Math.max(0.04, 1 - moonElev * moonElev));
      moonVec.set(Math.cos(moonAz) * moonHoriz, moonElev, Math.sin(moonAz) * moonHoriz).normalize();

      // Blend factors
      const dayFactor = smoothstep(-0.1, 0.28, sunElev);
      const nightFactor = 1 - smoothstep(-0.18, 0.12, sunElev);
      const twilightBand = Math.max(0, 1 - Math.abs(sunElev - 0.03) / 0.32);
      const twilightFactor = smoothstep(0, 1, twilightBand);

      // Position celestial discs on inner sky shell
      sunOrb.position.copy(sunVec).multiplyScalar(58);
      const sunAboveHorizon = smoothstep(-0.06, 0.12, sunElev);
      sunOrbMat.opacity = sunAboveHorizon * (1 - rainAmount * 0.88);
      sunOrbMat.color.copy(_cNoonSunOrb).lerp(_cSunsetSunOrb, twilightFactor * 0.85);

      moonOrb.position.copy(moonVec).multiplyScalar(58);
      moonOrbMat.opacity = nightFactor * (1 - rainAmount * 0.78);

      // Twinkle stars gently at night, dim behind storm clouds
      const twinkle = reducedMotion ? 1 : 0.92 + Math.sin(elapsed * 1.7) * 0.08;
      starMat.opacity = smoothstep(0.15, 0.85, nightFactor) * (1 - rainAmount * 0.88) * twinkle;
      if (!reducedMotion) {
        stars.rotation.y = elapsed * 0.004;
      }

      // Sky Dome Palette Interpolation (Night -> Sunset/Dawn -> Crisp Day/Afternoon, plus Rain overcast)
      _topClear.copy(_cNightTop).lerp(_cDayTop, dayFactor);
      _topClear.lerp(_cTwilightTop, twilightFactor * 0.58);

      _horClear.copy(_cNightHorizon).lerp(_cDayHorizon, dayFactor);
      _horClear.lerp(_cTwilightHorizon, twilightFactor * 0.86);

      _botClear.copy(_cNightBottom).lerp(_cDayBottom, dayFactor);
      _botClear.lerp(_cTwilightBottom, twilightFactor * 0.55);

      // Rain overcast sky palette (cooler slate-blue during day, deep storm indigo at night)
      _topRain.copy(_cNightRainTop).lerp(_cDayRainTop, dayFactor);
      _horRain.copy(_cNightRainHor).lerp(_cDayRainHor, dayFactor);
      _botRain.copy(_cNightRainBot).lerp(_cDayRainBot, dayFactor);

      skyUniforms.uTopColor.value.copy(_topClear).lerp(_topRain, rainAmount * 0.88);
      skyUniforms.uHorizonColor.value.copy(_horClear).lerp(_horRain, rainAmount * 0.88);
      skyUniforms.uBottomColor.value.copy(_botClear).lerp(_botRain, rainAmount * 0.88);

      // Halo tracks sun by day/sunset, soft moon glow at night, softened strongly in rain
      const haloDir = dayFactor > 0.12 ? sunVec : moonVec;
      skyUniforms.uSunDir.value.copy(haloDir);
      _haloC.copy(_cMoonHalo).lerp(_cDayHalo, dayFactor);
      _haloC.lerp(_cSunsetHalo, twilightFactor * 0.9);
      skyUniforms.uHaloColor.value.copy(_haloC);
      skyUniforms.uHaloStrength.value =
        lerp(0.28, 0.95, clamp(dayFactor * 0.65 + twilightFactor * 0.85, 0, 1)) *
        (1 - rainAmount * 0.82);

      // Fog matches horizon color & thickens gently in rain
      fog.color.copy(skyUniforms.uHorizonColor.value);
      fog.density = lerp(0.0085, 0.021, rainAmount);

      // Smoothly transition key directional light from Sun (day/sunset) to Moon (night)
      const sunMoonMix = smoothstep(-0.08, 0.14, sunElev); // 1 = sun, 0 = moon
      activeKeyDir.copy(moonVec).lerp(sunVec, sunMoonMix).normalize();
      // Clamp minimum shadow-caster elevation so shadows never stretch infinitely flat at horizon crossover
      activeKeyDir.y = Math.max(0.2, activeKeyDir.y);
      activeKeyDir.normalize();
      keyLight.position.copy(activeKeyDir).multiplyScalar(16);

      // Key light color & intensity (softened in rain; atmospheric silver-blue at night so world stays readable!)
      _sunColor.copy(_cNoonLight).lerp(_cGoldenLight, smoothstep(0.75, 0.25, sunElev));
      _sunColor.lerp(_cSunsetLight, twilightFactor * 0.82);
      _keyColor.copy(_cMoonLight).lerp(_sunColor, sunMoonMix);
      _keyColor.lerp(_cOvercastLight, rainAmount * 0.55 * sunMoonMix);
      keyLight.color.copy(_keyColor);

      const clearSunIntensity = lerp(0.68, 2.25, sunMoonMix) * (1 - twilightFactor * 0.18);
      // Soften direct sunlight during rain while keeping gentle relief
      const rainAttenuation = lerp(1.0, 0.44, rainAmount * sunMoonMix + rainAmount * 0.25);
      keyLight.intensity = clearSunIntensity * rainAttenuation;

      // Hemisphere ambient bounce keeps nighttime readable & boosts soft overcast fill during rain
      _hemiSky.copy(_cNightHemiSky).lerp(_cDayHemiSky, dayFactor);
      _hemiSky.lerp(_cTwilightHemiSky, twilightFactor * 0.5);
      _hemiSky.lerp(_cRainHemiSky, rainAmount * 0.65 * dayFactor);

      _hemiGround.copy(_cNightHemiGround).lerp(_cDayHemiGround, dayFactor);

      hemiLight.color.copy(_hemiSky);
      hemiLight.groundColor.copy(_hemiGround);
      hemiLight.intensity = lerp(0.84, 0.96, dayFactor) + rainAmount * 0.22;

      underFill.color.copy(_cNightUnderFill).lerp(skyUniforms.uBottomColor.value, dayFactor);
      underFill.intensity = lerp(0.72, 0.45, dayFactor);

      return { dayFactor, nightFactor, twilightFactor };
    },
  };
}

const _cNightUnderFill = new THREE.Color(0x5b7da8);

// Curated palette constants
const _cDayTop = new THREE.Color(0x4c86c6);
const _cDayHorizon = new THREE.Color(0xe5ecf2);
const _cDayBottom = new THREE.Color(0x9cb9ce);

const _cTwilightTop = new THREE.Color(0x384d7d);
const _cTwilightHorizon = new THREE.Color(0xf29368);
const _cTwilightBottom = new THREE.Color(0x6b5d78);

const _cNightTop = new THREE.Color(0x0d172b);
const _cNightHorizon = new THREE.Color(0x1f3352);
const _cNightBottom = new THREE.Color(0x132036);

const _cDayRainTop = new THREE.Color(0x58697a);
const _cDayRainHor = new THREE.Color(0x95a4b2);
const _cDayRainBot = new THREE.Color(0x6c7c8b);

const _cNightRainTop = new THREE.Color(0x131d30);
const _cNightRainHor = new THREE.Color(0x283a52);
const _cNightRainBot = new THREE.Color(0x1b293d);

const _cNoonSunOrb = new THREE.Color(0xfff7de);
const _cSunsetSunOrb = new THREE.Color(0xff9a5c);

const _cDayHalo = new THREE.Color(0xffe6bd);
const _cSunsetHalo = new THREE.Color(0xff8c52);
const _cMoonHalo = new THREE.Color(0x7aa4d6);

const _cNoonLight = new THREE.Color(0xfff4e0);
const _cGoldenLight = new THREE.Color(0xffe0b2);
const _cSunsetLight = new THREE.Color(0xff9654);
const _cMoonLight = new THREE.Color(0x8cb4e8);
const _cOvercastLight = new THREE.Color(0xb8c8d8);

const _cDayHemiSky = new THREE.Color(0xa6d2fa);
const _cTwilightHemiSky = new THREE.Color(0xd99b8c);
const _cNightHemiSky = new THREE.Color(0x3b5884);
const _cRainHemiSky = new THREE.Color(0x8fa3b5);

const _cDayHemiGround = new THREE.Color(0x85715c);
const _cNightHemiGround = new THREE.Color(0x2b3344);

// Scratch temporaries (zero per-frame allocations)
const _topClear = new THREE.Color();
const _horClear = new THREE.Color();
const _botClear = new THREE.Color();
const _topRain = new THREE.Color();
const _horRain = new THREE.Color();
const _botRain = new THREE.Color();
const _haloC = new THREE.Color();
const _sunColor = new THREE.Color();
const _keyColor = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();
