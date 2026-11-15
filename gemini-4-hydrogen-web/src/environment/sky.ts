import * as THREE from "three";
import { computeSkyFactors, type SkyLightingFactors } from "../state";
import { lerp } from "../util/math";

export interface SkyRig {
  group: THREE.Group;
  update: (
    timeMinutes: number,
    rainMix: number,
    elapsed: number,
    reducedMotion: boolean
  ) => SkyLightingFactors;
  dispose: () => void;
}

const _zenith = new THREE.Color();
const _horizon = new THREE.Color();
const _sunGlow = new THREE.Color();
const _dayZenith = new THREE.Color("#3e7bb8");
const _dayHorizon = new THREE.Color("#cde2ed");
const _afternoonZenith = new THREE.Color("#4578aa");
const _afternoonHorizon = new THREE.Color("#e8dec8");
const _sunsetZenith = new THREE.Color("#2b365e");
const _sunsetHorizon = new THREE.Color("#e4875e");
const _nightZenith = new THREE.Color("#0c1428");
const _nightHorizon = new THREE.Color("#1f2f50");
const _rainZenithDay = new THREE.Color("#4d5d6d");
const _rainHorizonDay = new THREE.Color("#8896a3");
const _rainZenithNight = new THREE.Color("#0a101d");
const _rainHorizonNight = new THREE.Color("#182234");
const _sunColorDay = new THREE.Color("#fff3dc");
const _sunColorSunset = new THREE.Color("#ff9b54");
const _moonColor = new THREE.Color("#a8c2eb");
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();
const _hemiDay = new THREE.Color("#b8d9f0");
const _hemiTwilight = new THREE.Color("#e89b72");
const _hemiRain = new THREE.Color("#738291");
const _groundDay = new THREE.Color("#6b5c49");
const _groundRain = new THREE.Color("#444a52");
const _rimDay = new THREE.Color("#9cc0e4");
const _tmpZenithRain = new THREE.Color();
const _tmpHorizonRain = new THREE.Color();
const _sunDir = new THREE.Vector3();

export function createSkyAndLighting(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  isCompactDevice: boolean
): SkyRig {
  const group = new THREE.Group();
  group.name = "SkyAndLighting";

  // Fog synced continuously to horizon color
  const fog = new THREE.FogExp2("#e8dec8", 0.011);
  scene.fog = fog;

  // 1. Procedural GLSL Sky Dome (Gradient + Sun Disc + Moon + Stars)
  const skyGeo = new THREE.SphereGeometry(68, 32, 24);
  const skyUniforms = {
    uZenith: { value: new THREE.Color("#4578aa") },
    uHorizon: { value: new THREE.Color("#e8dec8") },
    uSunGlow: { value: new THREE.Color("#ffcf87") },
    uSunDir: { value: new THREE.Vector3(0.6, 0.5, 0.6) },
    uNight: { value: 0 },
    uRain: { value: 0 },
    uTime: { value: 0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunGlow;
      uniform vec3 uSunDir;
      uniform float uNight;
      uniform float uRain;
      uniform float uTime;
      varying vec3 vWorldDir;

      float hash3(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float horizonGrad = smoothstep(0.42, 0.92, h);
        vec3 col = mix(uHorizon, uZenith, horizonGrad);

        // Lower hemisphere gently deepens below horizon
        float below = smoothstep(0.5, 0.15, h);
        col = mix(col, mix(uHorizon, uZenith, 0.55), below * 0.65);

        // Sun halo & crisp solar disc
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float sunVis = (1.0 - uRain * 0.88) * (1.0 - uNight * 0.92);
        float halo = pow(sunDot, 7.0) * 0.36 + pow(sunDot, 42.0) * 0.42;
        float disc = smoothstep(0.9972, 0.9988, sunDot);
        col += uSunGlow * (halo + disc * 1.15) * sunVis;

        // Moon disc opposite the sun at night
        vec3 moonDir = normalize(vec3(-uSunDir.x * 0.85, max(0.32, abs(uSunDir.y) + 0.25), -uSunDir.z * 0.85));
        float moonDot = max(dot(dir, moonDir), 0.0);
        float moonVis = uNight * (1.0 - uRain * 0.85);
        float moonDisc = smoothstep(0.9982, 0.9991, moonDot);
        float moonHalo = pow(moonDot, 36.0) * 0.22;
        col += vec3(0.78, 0.86, 1.0) * (moonDisc * 0.85 + moonHalo) * moonVis;

        // Subtle procedural starfield above horizon
        if (uNight > 0.05 && dir.y > 0.02) {
          vec3 grid = floor(dir * 175.0);
          float starVal = hash3(grid);
          if (starVal > 0.9945) {
            float twinkle = 0.72 + 0.28 * sin(uTime * 1.8 + starVal * 120.0);
            float skyFade = smoothstep(0.02, 0.25, dir.y);
            col += vec3(0.88, 0.92, 1.0) * twinkle * skyFade * uNight * (1.0 - uRain * 0.9) * 0.85;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyMesh);

  // 2. Three-Point Atmospheric Lighting Rig
  const hemiLight = new THREE.HemisphereLight("#b7d9f2", "#5d5044", 0.85);
  group.add(hemiLight);

  const keyLight = new THREE.DirectionalLight("#fff1d6", 1.85);
  keyLight.position.set(11, 10, 9);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    const shadowRes = isCompactDevice ? 1024 : 2048;
    keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 42;
    const d = 10.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.022;
  }
  group.add(keyLight);
  group.add(keyLight.target);

  // Cool rim & under-island bounce light so the rocky underside stays legible at all hours
  const rimLight = new THREE.DirectionalLight("#95b8df", 0.45);
  rimLight.position.set(-9, -4, -10);
  group.add(rimLight);

  const update = (
    timeMinutes: number,
    rainMix: number,
    elapsed: number,
    reducedMotion: boolean
  ): SkyLightingFactors => {
    const f = computeSkyFactors(timeMinutes);

    // Sun direction vector
    const cosEl = Math.cos(f.sunElevation);
    _sunDir.set(
      Math.cos(f.sunAzimuth) * cosEl,
      Math.sin(f.sunElevation),
      Math.sin(f.sunAzimuth) * cosEl
    ).normalize();
    skyUniforms.uSunDir.value.copy(_sunDir);

    // Compute clear sky colors across night -> twilight -> golden afternoon -> midday
    _zenith.copy(_nightZenith).lerp(_dayZenith, f.daylight);
    _horizon.copy(_nightHorizon).lerp(_dayHorizon, f.daylight);

    // Afternoon warmth around 14:00-17:00
    const afternoonWeight = Math.max(0, 1 - Math.abs(timeMinutes - 960) / 180) * f.daylight;
    _zenith.lerp(_afternoonZenith, afternoonWeight * 0.6);
    _horizon.lerp(_afternoonHorizon, afternoonWeight * 0.72);

    // Sunrise / sunset blend
    _zenith.lerp(_sunsetZenith, f.twilight * 0.72);
    _horizon.lerp(_sunsetHorizon, f.twilight * 0.85);

    // Overcast rain blend
    _tmpZenithRain.copy(_rainZenithNight).lerp(_rainZenithDay, f.daylight);
    _tmpHorizonRain.copy(_rainHorizonNight).lerp(_rainHorizonDay, f.daylight);
    _zenith.lerp(_tmpZenithRain, rainMix * 0.82);
    _horizon.lerp(_tmpHorizonRain, rainMix * 0.82);

    skyUniforms.uZenith.value.copy(_zenith);
    skyUniforms.uHorizon.value.copy(_horizon);
    _sunGlow.copy(_sunColorDay).lerp(_sunColorSunset, f.twilight * 0.9);
    skyUniforms.uSunGlow.value.copy(_sunGlow);
    skyUniforms.uNight.value = f.nightness;
    skyUniforms.uRain.value = rainMix;
    skyUniforms.uTime.value = reducedMotion ? 0 : elapsed;

    // Sync scene fog & background fallback
    fog.color.copy(_horizon);
    fog.density = 0.008 + rainMix * 0.011 + f.nightness * 0.003;

    // Key light switches smoothly between sun and cool readable moonlight
    if (f.sunElevation > -0.05) {
      keyLight.position.copy(_sunDir).multiplyScalar(18);
      keyLight.position.y = Math.max(2.6, keyLight.position.y);
      keyLight.color.copy(_sunColorDay).lerp(_sunColorSunset, f.twilight * 0.85);
      const clearIntensity = lerp(0.55, 2.05, f.daylight) * (1 - f.twilight * 0.15);
      keyLight.intensity = clearIntensity * (1 - rainMix * 0.56);
    } else {
      keyLight.position.set(
        -_sunDir.x * 15,
        Math.max(8, Math.abs(_sunDir.y) * 14 + 6),
        -_sunDir.z * 15
      );
      keyLight.color.copy(_moonColor);
      keyLight.intensity = (0.62 + 0.14 * (1 - f.nightness)) * (1 - rainMix * 0.35);
    }

    // Hemisphere bounce keeps nighttime readable without flattening shadows
    _hemiSky
      .set("#5c74a6")
      .lerp(_hemiDay, f.daylight)
      .lerp(_hemiTwilight, f.twilight * 0.55)
      .lerp(_hemiRain, rainMix * 0.6);

    _hemiGround
      .set("#283042")
      .lerp(_groundDay, f.daylight)
      .lerp(_groundRain, rainMix * 0.5);

    hemiLight.color.copy(_hemiSky);
    hemiLight.groundColor.copy(_hemiGround);
    hemiLight.intensity = lerp(0.52, 0.92, f.daylight) * (1 - rainMix * 0.18);

    // Subtle rim light to sculpt the floating underside
    rimLight.color.set("#4d6b99").lerp(_rimDay, f.daylight);
    rimLight.intensity = lerp(0.46, 0.38, f.daylight);

    // Modulate studio environment reflection intensity smoothly
    scene.environmentIntensity = lerp(0.36, 0.88, f.daylight) * (1 - rainMix * 0.35);

    return f;
  };

  const dispose = () => {
    skyGeo.dispose();
    skyMat.dispose();
  };

  return {
    group,
    update,
    dispose,
  };
}

