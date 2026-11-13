import { clampNumber } from '../state/worldState';

export interface AtmosphereSample {
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  fogColor: string;
  sunColor: string;
  sunIntensity: number;
  sunDirection: [number, number, number];
  ambientSkyColor: string;
  ambientGroundColor: string;
  ambientIntensity: number;
  exposure: number;
  starOpacity: number;
  cloudColor: string;
  windowGlowStrength: number;
  houseLightMultiplier: number;
}

interface PaletteKeyframe {
  hour: number;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  sunColor: string;
  sunIntensity: number;
  ambientSkyColor: string;
  ambientGroundColor: string;
  ambientIntensity: number;
  exposure: number;
  starOpacity: number;
  cloudColor: string;
  windowGlowStrength: number;
  houseLightMultiplier: number;
}

const KEYFRAMES: PaletteKeyframe[] = [
  {
    hour: 0,
    skyTop: '#131e3d',
    skyHorizon: '#2a3d69',
    skyBottom: '#0f1830',
    sunColor: '#a2c3f5',
    sunIntensity: 0.78,
    ambientSkyColor: '#5672b0',
    ambientGroundColor: '#2d3b5c',
    ambientIntensity: 0.78,
    exposure: 1.04,
    starOpacity: 0.95,
    cloudColor: '#52658f',
    windowGlowStrength: 1.0,
    houseLightMultiplier: 1.35,
  },
  {
    hour: 4.5,
    skyTop: '#1a2447',
    skyHorizon: '#424b7a',
    skyBottom: '#141c38',
    sunColor: '#a8c2f0',
    sunIntensity: 0.68,
    ambientSkyColor: '#5a6fa6',
    ambientGroundColor: '#2f3957',
    ambientIntensity: 0.74,
    exposure: 1.02,
    starOpacity: 0.65,
    cloudColor: '#66749c',
    windowGlowStrength: 0.95,
    houseLightMultiplier: 1.2,
  },
  {
    hour: 6.2,
    skyTop: '#4c6596',
    skyHorizon: '#eba17f',
    skyBottom: '#39476b',
    sunColor: '#ffc28e',
    sunIntensity: 1.32,
    ambientSkyColor: '#9fb4de',
    ambientGroundColor: '#594e4e',
    ambientIntensity: 0.78,
    exposure: 1.04,
    starOpacity: 0.08,
    cloudColor: '#f2d5c4',
    windowGlowStrength: 0.55,
    houseLightMultiplier: 0.85,
  },
  {
    hour: 8.5,
    skyTop: '#5e99cc',
    skyHorizon: '#d6e7f2',
    skyBottom: '#6a8eae',
    sunColor: '#fff2db',
    sunIntensity: 2.08,
    ambientSkyColor: '#b8dbf2',
    ambientGroundColor: '#6d705a',
    ambientIntensity: 0.88,
    exposure: 1.05,
    starOpacity: 0,
    cloudColor: '#f8f5ef',
    windowGlowStrength: 0.15,
    houseLightMultiplier: 0.45,
  },
  {
    hour: 12.5,
    skyTop: '#5291c9',
    skyHorizon: '#cde3ef',
    skyBottom: '#6f96b5',
    sunColor: '#fff8ea',
    sunIntensity: 2.38,
    ambientSkyColor: '#c4e3f6',
    ambientGroundColor: '#767b5e',
    ambientIntensity: 0.92,
    exposure: 1.04,
    starOpacity: 0,
    cloudColor: '#fbfaf6',
    windowGlowStrength: 0.05,
    houseLightMultiplier: 0.35,
  },
  {
    hour: 16.0,
    skyTop: '#5b8fc2',
    skyHorizon: '#eadac3',
    skyBottom: '#6d87a1',
    sunColor: '#ffe0b0',
    sunIntensity: 2.22,
    ambientSkyColor: '#c9dcf0',
    ambientGroundColor: '#776855',
    ambientIntensity: 0.88,
    exposure: 1.06,
    starOpacity: 0,
    cloudColor: '#f9f1e4',
    windowGlowStrength: 0.28,
    houseLightMultiplier: 0.6,
  },
  {
    hour: 18.5,
    skyTop: '#3a4473',
    skyHorizon: '#ec8c61',
    skyBottom: '#2d3252',
    sunColor: '#ff9452',
    sunIntensity: 1.48,
    ambientSkyColor: '#9e81a1',
    ambientGroundColor: '#4f3f43',
    ambientIntensity: 0.78,
    exposure: 1.05,
    starOpacity: 0.14,
    cloudColor: '#f0b395',
    windowGlowStrength: 0.82,
    houseLightMultiplier: 1.15,
  },
  {
    hour: 20.2,
    skyTop: '#1a2548',
    skyHorizon: '#3c4570',
    skyBottom: '#131b36',
    sunColor: '#9cb3e6',
    sunIntensity: 0.72,
    ambientSkyColor: '#526699',
    ambientGroundColor: '#262e49',
    ambientIntensity: 0.68,
    exposure: 1.01,
    starOpacity: 0.78,
    cloudColor: '#526085',
    windowGlowStrength: 0.98,
    houseLightMultiplier: 1.3,
  },
  {
    hour: 24,
    skyTop: '#131e3d',
    skyHorizon: '#2a3d69',
    skyBottom: '#0f1830',
    sunColor: '#a2c3f5',
    sunIntensity: 0.78,
    ambientSkyColor: '#5672b0',
    ambientGroundColor: '#2d3b5c',
    ambientIntensity: 0.78,
    exposure: 1.04,
    starOpacity: 0.95,
    cloudColor: '#52658f',
    windowGlowStrength: 1.0,
    houseLightMultiplier: 1.35,
  },
];

function parseHex(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = Number.parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function formatHex(r: number, g: number, b: number): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = (v: number) => clampByte(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return formatHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothCosine(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clampNumber(t, 0, 1));
}

function normalizeVec3(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function computeLightDirection(hour: number): [number, number, number] {
  const moonDir = normalizeVec3(0.42, 0.72, 0.55);

  // Daytime solar arc runs smoothly from ~05:30 to ~19:00
  if (hour >= 5.5 && hour <= 19.0) {
    const progress = (hour - 5.5) / (19.0 - 5.5);
    const angle = progress * Math.PI;
    const sunX = Math.cos(angle) * 0.92;
    const sunY = Math.max(0.14, Math.sin(angle) * 0.92);
    const sunZ = 0.44 + Math.sin(angle) * 0.1;
    const sunDir = normalizeVec3(sunX, sunY, sunZ);

    // Blend gently into/from moonlight at dawn & dusk boundaries
    let dayBlend = 1;
    if (hour < 6.4) {
      dayBlend = smoothCosine((hour - 5.5) / 0.9);
    } else if (hour > 18.1) {
      dayBlend = smoothCosine((19.0 - hour) / 0.9);
    }

    return normalizeVec3(
      lerp(moonDir[0], sunDir[0], dayBlend),
      lerp(moonDir[1], sunDir[1], dayBlend),
      lerp(moonDir[2], sunDir[2], dayBlend)
    );
  }

  return moonDir;
}

export function evaluateAtmosphere(rawTimeOfDay: number, rawRainFactor: number): AtmosphereSample {
  const wrappedHour = ((rawTimeOfDay % 24) + 24) % 24;
  const hour = rawTimeOfDay === 24 ? 24 : wrappedHour;
  const rain = clampNumber(rawRainFactor, 0, 1);

  let k0 = KEYFRAMES[0];
  let k1 = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (hour >= KEYFRAMES[i].hour && hour <= KEYFRAMES[i + 1].hour) {
      k0 = KEYFRAMES[i];
      k1 = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, k1.hour - k0.hour);
  const t = smoothCosine((hour - k0.hour) / span);

  let skyTop = lerpHex(k0.skyTop, k1.skyTop, t);
  let skyHorizon = lerpHex(k0.skyHorizon, k1.skyHorizon, t);
  let skyBottom = lerpHex(k0.skyBottom, k1.skyBottom, t);
  let sunColor = lerpHex(k0.sunColor, k1.sunColor, t);
  let sunIntensity = lerp(k0.sunIntensity, k1.sunIntensity, t);
  let ambientSkyColor = lerpHex(k0.ambientSkyColor, k1.ambientSkyColor, t);
  const ambientGroundColor = lerpHex(k0.ambientGroundColor, k1.ambientGroundColor, t);
  let ambientIntensity = lerp(k0.ambientIntensity, k1.ambientIntensity, t);
  const exposure = lerp(k0.exposure, k1.exposure, t);
  let starOpacity = lerp(k0.starOpacity, k1.starOpacity, t);
  let cloudColor = lerpHex(k0.cloudColor, k1.cloudColor, t);
  const windowGlowStrength = lerp(k0.windowGlowStrength, k1.windowGlowStrength, t);
  const houseLightMultiplier = lerp(k0.houseLightMultiplier, k1.houseLightMultiplier, t);

  if (rain > 0) {
    // Smooth overcast modulation keyed to daytime vs nighttime brightness
    const daylightness = clampNumber((sunIntensity - 0.75) / 1.55, 0, 1);
    const rainSkyTop = lerpHex('#182138', '#4d5d73', daylightness);
    const rainSkyHorizon = lerpHex('#25314d', '#7a8899', daylightness);
    const rainSkyBottom = lerpHex('#131b2e', '#3b4759', daylightness);
    const rainCloud = lerpHex('#415275', '#637185', daylightness);
    const rainSunColor = lerpHex('#8aa1cc', '#cfd9e6', daylightness);

    skyTop = lerpHex(skyTop, rainSkyTop, rain * 0.85);
    skyHorizon = lerpHex(skyHorizon, rainSkyHorizon, rain * 0.85);
    skyBottom = lerpHex(skyBottom, rainSkyBottom, rain * 0.85);
    cloudColor = lerpHex(cloudColor, rainCloud, rain * 0.85);
    sunColor = lerpHex(sunColor, rainSunColor, rain * 0.65);
    ambientSkyColor = lerpHex(ambientSkyColor, rainSkyHorizon, rain * 0.55);

    sunIntensity *= 1 - 0.54 * rain;
    ambientIntensity *= 1 - 0.06 * rain;
    starOpacity *= 1 - 0.92 * rain;
  }

  return {
    skyTop,
    skyHorizon,
    skyBottom,
    fogColor: skyHorizon,
    sunColor,
    sunIntensity,
    sunDirection: computeLightDirection(hour),
    ambientSkyColor,
    ambientGroundColor,
    ambientIntensity,
    exposure,
    starOpacity,
    cloudColor,
    windowGlowStrength,
    houseLightMultiplier,
  };
}
