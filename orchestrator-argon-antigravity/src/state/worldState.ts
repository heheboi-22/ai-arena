import * as THREE from 'three';

export type WeatherMode = 'clear' | 'rain';

export interface WorldState {
  timeOfDay: number;
  weather: WeatherMode;
  windStrength: number;
  houseLightsOn: boolean;
  reducedMotion: boolean;
}

export interface SmoothedWorldState {
  timeOfDay: number;
  rainFactor: number;
  windFactor: number;
  houseLightFactor: number;
  windmillAngle: number;
  cloudPhase: number;
  swayTime: number;
  islandBobTime: number;
}

export interface EnvironmentLighting {
  sunPosition: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  skyTopHex: string;
  skyHorizonHex: string;
  skyBottomHex: string;
  fogColorHex: number;
  nightFactor: number;
  sunsetFactor: number;
  windowEmissiveIntensity: number;
  houseLightIntensity: number;
  cloudColorHex: number;
  waterColorHex: number;
}

export const MAX_FRAME_DELTA = 0.1;

export const DEFAULT_WORLD_STATE: Readonly<WorldState> = Object.freeze({
  timeOfDay: 16,
  weather: 'clear',
  windStrength: 30,
  houseLightsOn: false,
  reducedMotion: false,
});

export const POND_CENTER = Object.freeze({
  x: 1.55,
  z: 1.05,
  radius: 1.42,
});

export const POND_WATER_Y = 0.04;

export const WINDMILL_KNOLL = Object.freeze({
  x: -2.45,
  z: 0.25,
});

export const HOUSE_ANCHOR = Object.freeze({
  x: -0.25,
  z: 0.35,
});

export function clampFrameDelta(rawDeltaSeconds: number): number {
  if (!Number.isFinite(rawDeltaSeconds) || rawDeltaSeconds <= 0) {
    return 0;
  }
  return Math.min(rawDeltaSeconds, MAX_FRAME_DELTA);
}

export function formatTimeOfDay(hours: number): { timeText: string; periodText: string } {
  const clamped = Math.max(0, Math.min(24, Number.isFinite(hours) ? hours : 16));
  const totalMinutes = Math.round(clamped * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const timeText = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  const wrapped = clamped >= 24 ? 0 : clamped;
  let periodText = 'Night';
  if (wrapped >= 5 && wrapped < 7.5) {
    periodText = 'Dawn';
  } else if (wrapped >= 7.5 && wrapped < 11.5) {
    periodText = 'Morning';
  } else if (wrapped >= 11.5 && wrapped < 15.5) {
    periodText = 'Midday';
  } else if (wrapped >= 15.5 && wrapped < 17.5) {
    periodText = 'Afternoon';
  } else if (wrapped >= 17.5 && wrapped < 20) {
    periodText = 'Sunset';
  } else if (wrapped >= 20 && wrapped < 21.5) {
    periodText = 'Dusk';
  }

  return { timeText, periodText };
}

export function createInitialSmoothedState(state: WorldState = DEFAULT_WORLD_STATE): SmoothedWorldState {
  return {
    timeOfDay: state.timeOfDay,
    rainFactor: state.weather === 'rain' ? 1 : 0,
    windFactor: Math.max(0, Math.min(1, state.windStrength / 100)),
    houseLightFactor: state.houseLightsOn ? 1 : 0,
    windmillAngle: 0,
    cloudPhase: 0,
    swayTime: 0,
    islandBobTime: 0,
  };
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

export function stepSmoothedState(
  current: SmoothedWorldState,
  target: WorldState,
  rawDeltaSeconds: number,
): SmoothedWorldState {
  const dt = clampFrameDelta(rawDeltaSeconds);
  const targetRain = target.weather === 'rain' ? 1 : 0;
  const targetWind = Math.max(0, Math.min(1, target.windStrength / 100));
  const targetLights = target.houseLightsOn ? 1 : 0;
  const clampedTime = Math.max(0, Math.min(24, target.timeOfDay));

  const timeOfDay = damp(current.timeOfDay, clampedTime, 9.5, dt);
  const rainFactor = damp(current.rainFactor, targetRain, 3.6, dt);
  const windFactor = damp(current.windFactor, targetWind, 4.5, dt);
  const houseLightFactor = damp(current.houseLightFactor, targetLights, 7.5, dt);

  const motionScale = target.reducedMotion ? 0.25 : 1;
  // Windmill stops smoothly when windFactor ~ 0
  const windmillSpeed = windFactor < 0.01 ? 0 : (0.35 + windFactor * 3.1) * motionScale;
  const cloudSpeed = (0.04 + windFactor * 0.45) * motionScale;
  const swaySpeed = (0.8 + windFactor * 2.4) * motionScale;

  return {
    timeOfDay,
    rainFactor,
    windFactor,
    houseLightFactor,
    windmillAngle: current.windmillAngle + windmillSpeed * dt,
    cloudPhase: current.cloudPhase + cloudSpeed * dt,
    swayTime: current.swayTime + swaySpeed * dt,
    islandBobTime: target.reducedMotion ? current.islandBobTime : current.islandBobTime + dt,
  };
}

/**
 * Irregular organic silhouette radius of the floating island at polar angle theta.
 */
export function getIslandBoundaryRadius(theta: number): number {
  return (
    4.55 +
    0.42 * Math.cos(theta * 2 - 0.5) +
    0.26 * Math.sin(theta * 3 + 0.9) +
    0.16 * Math.cos(theta * 5 + 0.3)
  );
}

/**
 * Shared heightfield for the grassy island top, elevated windmill knoll,
 * flat cottage pad, and carved pond basin.
 */
export function getIslandSurfaceHeight(x: number, z: number): number {
  const theta = Math.atan2(z, x);
  const r = Math.hypot(x, z);
  const boundary = getIslandBoundaryRadius(theta);
  const normR = Math.min(1.2, r / boundary);

  // Base gentle crown with beveled outer rim
  let height = 0.26 * (1 - Math.pow(Math.min(1, normR), 2.2));
  height += 0.05 * Math.sin(x * 0.75 + 0.3) * Math.cos(z * 0.65 - 0.2);

  // Windmill knoll in the northwest
  const dxKnoll = x - WINDMILL_KNOLL.x;
  const dzKnoll = z - WINDMILL_KNOLL.z;
  const distKnollSq = dxKnoll * dxKnoll + dzKnoll * dzKnoll;
  height += 0.68 * Math.exp(-distKnollSq / 2.2);

  // Subtle cottage garden pad smoothing toward y ~ 0.28
  const dxHouse = x - HOUSE_ANCHOR.x;
  const dzHouse = z - HOUSE_ANCHOR.z;
  const houseWeight = Math.exp(-(dxHouse * dxHouse + dzHouse * dzHouse) / 2.5);
  height = THREE.MathUtils.lerp(height, 0.28, houseWeight * 0.75);

  // Pond basin depression in the southeast
  const dxPond = x - POND_CENTER.x;
  const dzPond = z - POND_CENTER.z;
  const pondDist = Math.hypot(dxPond, dzPond);
  const pondNorm = pondDist / POND_CENTER.radius;
  if (pondNorm < 1.35) {
    const basinT = Math.max(0, 1 - pondNorm / 1.35);
    const smoothBasin = basinT * basinT * (3 - 2 * basinT);
    height -= 0.54 * smoothBasin;
  }

  // Soft edge drop right at the grassy lip
  if (normR > 0.86) {
    const lipT = Math.min(1, (normR - 0.86) / 0.14);
    height -= 0.16 * lipT * lipT;
  }

  return height;
}

export function getIslandSurfaceStopY(
  x: number,
  z: number,
): { stopY: number; hitsIsland: boolean; hitsPond: boolean } {
  const theta = Math.atan2(z, x);
  const r = Math.hypot(x, z);
  const boundary = getIslandBoundaryRadius(theta);

  if (r > boundary * 0.98) {
    return { stopY: -12, hitsIsland: false, hitsPond: false };
  }

  const pondDist = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
  const terrainY = getIslandSurfaceHeight(x, z);
  const hitsPond = pondDist <= POND_CENTER.radius * 0.95 && terrainY <= POND_WATER_Y + 0.03;
  const stopY = hitsPond ? POND_WATER_Y : terrainY;

  return { stopY, hitsIsland: true, hitsPond };
}

export function isClickGesture(
  downX: number,
  downY: number,
  upX: number,
  upY: number,
  durationMs: number,
): boolean {
  const dist = Math.hypot(upX - downX, upY - downY);
  return dist < 6 && durationMs < 500;
}

interface SkyKeyframe {
  hour: number;
  top: string;
  horizon: string;
  bottom: string;
  sunColor: number;
  sunIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
}

const SKY_KEYFRAMES: SkyKeyframe[] = [
  {
    hour: 0,
    top: '#0c1528',
    horizon: '#1a2b4a',
    bottom: '#101a2d',
    sunColor: 0x9cb8ec,
    sunIntensity: 0.48,
    ambientColor: 0x3b4f78,
    ambientIntensity: 0.56,
    hemiSky: 0x5d7bb0,
    hemiGround: 0x2a2f3d,
    hemiIntensity: 0.72,
  },
  {
    hour: 5,
    top: '#182442',
    horizon: '#45486e',
    bottom: '#20263b',
    sunColor: 0xdba58b,
    sunIntensity: 0.55,
    ambientColor: 0x4f5a7c,
    ambientIntensity: 0.52,
    hemiSky: 0x7783ac,
    hemiGround: 0x343542,
    hemiIntensity: 0.68,
  },
  {
    hour: 6.8,
    top: '#4e78a8',
    horizon: '#f3b38c',
    bottom: '#d28f78',
    sunColor: 0xffc694,
    sunIntensity: 1.45,
    ambientColor: 0x998e9d,
    ambientIntensity: 0.45,
    hemiSky: 0xffcfb0,
    hemiGround: 0x5c5145,
    hemiIntensity: 0.72,
  },
  {
    hour: 9.5,
    top: '#609ad0',
    horizon: '#cce6f5',
    bottom: '#a7d0ea',
    sunColor: 0xfff5e0,
    sunIntensity: 1.95,
    ambientColor: 0xa4bdd1,
    ambientIntensity: 0.42,
    hemiSky: 0xcbe8ff,
    hemiGround: 0x6b604e,
    hemiIntensity: 0.76,
  },
  {
    hour: 13,
    top: '#5394cf',
    horizon: '#d8eef9',
    bottom: '#b4d8ec',
    sunColor: 0xfff8ea,
    sunIntensity: 2.15,
    ambientColor: 0xb0c8db,
    ambientIntensity: 0.44,
    hemiSky: 0xdbf0ff,
    hemiGround: 0x706450,
    hemiIntensity: 0.78,
  },
  {
    hour: 16,
    top: '#5b92c6',
    horizon: '#f2dec5',
    bottom: '#cde0e8',
    sunColor: 0xffe4b8,
    sunIntensity: 1.9,
    ambientColor: 0xaab9c7,
    ambientIntensity: 0.42,
    hemiSky: 0xffe9ca,
    hemiGround: 0x6b5b49,
    hemiIntensity: 0.74,
  },
  {
    hour: 18.3,
    top: '#3e5388',
    horizon: '#f49a6c',
    bottom: '#c96f68',
    sunColor: 0xff9f66,
    sunIntensity: 1.55,
    ambientColor: 0x896c7c,
    ambientIntensity: 0.46,
    hemiSky: 0xf4aa84,
    hemiGround: 0x4c3f3d,
    hemiIntensity: 0.72,
  },
  {
    hour: 20.2,
    top: '#1c2848',
    horizon: '#5b4b72',
    bottom: '#2c2c48',
    sunColor: 0x99b4e8,
    sunIntensity: 0.56,
    ambientColor: 0x49567d,
    ambientIntensity: 0.52,
    hemiSky: 0x687eb2,
    hemiGround: 0x2c3040,
    hemiIntensity: 0.68,
  },
  {
    hour: 24,
    top: '#0c1528',
    horizon: '#1a2b4a',
    bottom: '#101a2d',
    sunColor: 0x9cb8ec,
    sunIntensity: 0.48,
    ambientColor: 0x3b4f78,
    ambientIntensity: 0.56,
    hemiSky: 0x5d7bb0,
    hemiGround: 0x2a2f3d,
    hemiIntensity: 0.72,
  },
];

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _rainTop = new THREE.Color('#445364');
const _rainHorizon = new THREE.Color('#6a7b8c');
const _rainBottom = new THREE.Color('#516070');
const _rainNightTop = new THREE.Color('#09111f');
const _rainNightHorizon = new THREE.Color('#162338');
const _rainNightBottom = new THREE.Color('#0d1626');

function lerpColorNumber(a: number, b: number, t: number): number {
  _c1.setHex(a);
  _c2.setHex(b);
  _c1.lerp(_c2, t);
  return _c1.getHex();
}

function lerpHexString(a: string, b: string, t: number): string {
  _c1.set(a);
  _c2.set(b);
  _c1.lerp(_c2, t);
  return `#${_c1.getHexString()}`;
}

export function computeEnvironmentLighting(smoothed: SmoothedWorldState): EnvironmentLighting {
  const hour = ((smoothed.timeOfDay % 24) + 24) % 24;
  let k0 = SKY_KEYFRAMES[0];
  let k1 = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1];

  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (hour >= SKY_KEYFRAMES[i].hour && hour <= SKY_KEYFRAMES[i + 1].hour) {
      k0 = SKY_KEYFRAMES[i];
      k1 = SKY_KEYFRAMES[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, k1.hour - k0.hour);
  const rawT = (hour - k0.hour) / span;
  const t = rawT * rawT * (3 - 2 * rawT);

  // Night factor: smooth 0 in daytime, 1 at deep night
  let nightFactor = 0;
  if (hour < 5.2) {
    nightFactor = 1;
  } else if (hour < 7.5) {
    nightFactor = 1 - (hour - 5.2) / 2.3;
  } else if (hour > 18.2 && hour < 20.8) {
    nightFactor = (hour - 18.2) / 2.6;
  } else if (hour >= 20.8) {
    nightFactor = 1;
  }
  nightFactor = Math.max(0, Math.min(1, nightFactor));

  // Sunset / dawn factor for warm silhouettes
  const dawnPeak = Math.exp(-Math.pow((hour - 6.7) / 1.1, 2));
  const duskPeak = Math.exp(-Math.pow((hour - 18.3) / 1.1, 2));
  const sunsetFactor = Math.min(1, dawnPeak + duskPeak);

  // Sun / moon orbit position
  const dayAngle = ((hour - 6) / 12) * Math.PI;
  const isDaySun = hour >= 5.6 && hour <= 18.8;
  const orbitAngle = isDaySun ? dayAngle : ((hour - 18) / 12) * Math.PI;
  const elevation = isDaySun
    ? Math.max(2.6, Math.sin(Math.max(0.14, Math.min(Math.PI - 0.14, orbitAngle))) * 14.5)
    : Math.max(5.5, Math.sin(Math.max(0.35, Math.min(Math.PI - 0.35, orbitAngle))) * 12.0);
  const azimuthRadius = 12.5;
  const sunX = Math.cos(orbitAngle) * azimuthRadius;
  const sunZ = 7.2 + Math.sin(orbitAngle) * 3.2;

  let skyTop = lerpHexString(k0.top, k1.top, t);
  let skyHorizon = lerpHexString(k0.horizon, k1.horizon, t);
  let skyBottom = lerpHexString(k0.bottom, k1.bottom, t);

  const rain = smoothed.rainFactor;
  if (rain > 0.001) {
    const rTop = _rainTop.clone().lerp(_rainNightTop, nightFactor);
    const rHor = _rainHorizon.clone().lerp(_rainNightHorizon, nightFactor);
    const rBot = _rainBottom.clone().lerp(_rainNightBottom, nightFactor);
    skyTop = lerpHexString(skyTop, `#${rTop.getHexString()}`, rain * 0.78);
    skyHorizon = lerpHexString(skyHorizon, `#${rHor.getHexString()}`, rain * 0.82);
    skyBottom = lerpHexString(skyBottom, `#${rBot.getHexString()}`, rain * 0.8);
  }

  const sunColor = lerpColorNumber(
    lerpColorNumber(k0.sunColor, k1.sunColor, t),
    0x9db4cc,
    rain * 0.45,
  );
  const baseSunIntensity = THREE.MathUtils.lerp(k0.sunIntensity, k1.sunIntensity, t);
  const sunIntensity = baseSunIntensity * (1 - rain * 0.48);

  const ambientColor = lerpColorNumber(k0.ambientColor, k1.ambientColor, t);
  const ambientIntensity =
    THREE.MathUtils.lerp(k0.ambientIntensity, k1.ambientIntensity, t) * (1 + rain * 0.12);

  const hemiSkyColor = lerpColorNumber(
    lerpColorNumber(k0.hemiSky, k1.hemiSky, t),
    0x7e92a8,
    rain * 0.45,
  );
  const hemiGroundColor = lerpColorNumber(k0.hemiGround, k1.hemiGround, t);
  const hemiIntensity =
    THREE.MathUtils.lerp(k0.hemiIntensity, k1.hemiIntensity, t) * (1 - rain * 0.12);

  _c1.set(skyHorizon);
  const fogColorHex = _c1.getHex();

  // Clouds adapt from crisp cream (day) to peach-gold (sunset) to cool slate (night/rain)
  let cloudColorHex = lerpColorNumber(0xf8f4ec, 0xf2b595, sunsetFactor * 0.75);
  cloudColorHex = lerpColorNumber(cloudColorHex, 0x7e94b8, nightFactor * 0.72);
  cloudColorHex = lerpColorNumber(cloudColorHex, 0x5c6878, rain * 0.72);

  // Water adapts smoothly from muted teal-blue to dusk slate to deep moonlit navy
  let waterColorHex = lerpColorNumber(0x5296ab, 0x6f7f99, sunsetFactor * 0.55);
  waterColorHex = lerpColorNumber(waterColorHex, 0x2c4b6e, nightFactor * 0.82);
  waterColorHex = lerpColorNumber(waterColorHex, 0x416478, rain * 0.55);

  // Window glow: always warm when house lights are ON, stronger contrast at dusk/night
  const ambientWindowGlow = nightFactor * 0.12; // subtle unlit hint or reflection
  const activeGlow = smoothed.houseLightFactor * (1.25 + nightFactor * 1.15);
  const windowEmissiveIntensity = ambientWindowGlow + activeGlow;
  const houseLightIntensity = smoothed.houseLightFactor * (2.2 + nightFactor * 2.1);

  return {
    sunPosition: [sunX, elevation, sunZ],
    sunColor,
    sunIntensity,
    ambientColor,
    ambientIntensity,
    hemiSkyColor,
    hemiGroundColor,
    hemiIntensity,
    skyTopHex: skyTop,
    skyHorizonHex: skyHorizon,
    skyBottomHex: skyBottom,
    fogColorHex,
    nightFactor,
    sunsetFactor,
    windowEmissiveIntensity,
    houseLightIntensity,
    cloudColorHex,
    waterColorHex,
  };
}
