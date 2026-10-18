import * as THREE from 'three';
import { smoothstep, wrap24 } from '../core/math';
import { VIEW_AZIMUTH } from '../world/layout';

/** Everything about the light and sky at one moment, before weather is applied. */
export interface EnvSample {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  skyBottom: THREE.Color;
  /** Sun or moon colour and intensity for the key light. */
  key: THREE.Color;
  keyIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  cloud: THREE.Color;
  water: THREE.Color;
  /** 0 in full daylight, 1 at night. Drives window glow, stars and fireflies. */
  night: number;
  exposure: number;
}

interface Key {
  t: number;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  key: string;
  keyIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  cloud: string;
  water: string;
  night: number;
  exposure: number;
}

const NIGHT: Omit<Key, 't'> = {
  skyTop: '#0d1733',
  skyHorizon: '#34497c',
  skyBottom: '#141d42',
  key: '#a6b9f2',
  keyIntensity: 0.75,
  hemiSky: '#5b70b4',
  hemiGround: '#2c3557',
  hemiIntensity: 1.15,
  cloud: '#5b6789',
  water: '#2a4062',
  night: 1,
  exposure: 1.18,
};

// Hand-tuned stops. The key light fades to zero at 5:30 and 19:05, which is where it
// switches between sun and moon, so the direction change is never visible.
const KEYS: Key[] = [
  { t: 0, ...NIGHT },
  { t: 4.6, ...NIGHT, skyHorizon: '#34477a' },
  {
    t: 5.5,
    skyTop: '#26356a',
    skyHorizon: '#9a7f9f',
    skyBottom: '#4a5986',
    key: '#ffb07a',
    keyIntensity: 0,
    hemiSky: '#7383b5',
    hemiGround: '#4a4762',
    hemiIntensity: 1.0,
    cloud: '#9a8fa8',
    water: '#46597e',
    night: 0.65,
    exposure: 1.12,
  },
  {
    t: 6.4,
    skyTop: '#5f80bf',
    skyHorizon: '#f2b28c',
    skyBottom: '#b9a8bc',
    key: '#ffb47e',
    keyIntensity: 1.0,
    hemiSky: '#aab6d8',
    hemiGround: '#8b7a6e',
    hemiIntensity: 0.95,
    cloud: '#f6d2c0',
    water: '#6c84a6',
    night: 0.15,
    exposure: 1.05,
  },
  {
    t: 8,
    skyTop: '#6ca5dd',
    skyHorizon: '#d2e6ef',
    skyBottom: '#bad5e7',
    key: '#ffeacc',
    keyIntensity: 2.3,
    hemiSky: '#bdd7ee',
    hemiGround: '#8c9a70',
    hemiIntensity: 1.0,
    cloud: '#fbf8f2',
    water: '#6f9aae',
    night: 0,
    exposure: 1.0,
  },
  {
    t: 12,
    skyTop: '#5e9fe0',
    skyHorizon: '#d6ecf7',
    skyBottom: '#c0dcef',
    key: '#fff6e8',
    keyIntensity: 2.8,
    hemiSky: '#c8e0f5',
    hemiGround: '#95a476',
    hemiIntensity: 1.0,
    cloud: '#ffffff',
    water: '#6f9cb0',
    night: 0,
    exposure: 1.0,
  },
  {
    t: 16,
    skyTop: '#6aa2d9',
    skyHorizon: '#f2e3cb',
    skyBottom: '#c9d9e6',
    key: '#ffe2b6',
    keyIntensity: 2.65,
    hemiSky: '#c4d8ec',
    hemiGround: '#a39a76',
    hemiIntensity: 1.0,
    cloud: '#fdf6ec',
    water: '#6f97a8',
    night: 0,
    exposure: 1.0,
  },
  {
    t: 17.6,
    skyTop: '#7893c6',
    skyHorizon: '#f6c592',
    skyBottom: '#c9c0cf',
    key: '#ffbd7c',
    keyIntensity: 2.1,
    hemiSky: '#c9c8d9',
    hemiGround: '#a68c6c',
    hemiIntensity: 0.95,
    cloud: '#fde3cc',
    water: '#7290a6',
    night: 0,
    exposure: 1.0,
  },
  {
    t: 18.4,
    skyTop: '#4d5e9d',
    skyHorizon: '#f0966c',
    skyBottom: '#8d7ea8',
    key: '#ff9256',
    keyIntensity: 1.2,
    hemiSky: '#aaa4c6',
    hemiGround: '#8a6b64',
    hemiIntensity: 0.95,
    cloud: '#f2b39c',
    water: '#5f7698',
    night: 0.2,
    exposure: 1.03,
  },
  {
    t: 19.05,
    skyTop: '#2b376f',
    skyHorizon: '#8f6087',
    skyBottom: '#5a4f7b',
    key: '#ff9256',
    keyIntensity: 0,
    hemiSky: '#7d81b2',
    hemiGround: '#4a4159',
    hemiIntensity: 1.0,
    cloud: '#8f7f9f',
    water: '#3e4f78',
    night: 0.7,
    exposure: 1.1,
  },
  { t: 20.3, ...NIGHT },
];

type ColorKey = 'skyTop' | 'skyHorizon' | 'skyBottom' | 'key' | 'hemiSky' | 'hemiGround' | 'cloud' | 'water';
const COLOR_KEYS: ColorKey[] = ['skyTop', 'skyHorizon', 'skyBottom', 'key', 'hemiSky', 'hemiGround', 'cloud', 'water'];

const parsed = KEYS.map((k) => {
  const colors = {} as Record<ColorKey, THREE.Color>;
  for (const name of COLOR_KEYS) colors[name] = new THREE.Color(k[name]);
  return { k, colors };
});

export function createSample(): EnvSample {
  return {
    skyTop: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    skyBottom: new THREE.Color(),
    key: new THREE.Color(),
    keyIntensity: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 0,
    cloud: new THREE.Color(),
    water: new THREE.Color(),
    night: 0,
    exposure: 1,
  };
}

/** Interpolates the keyframes for an hour of day (eased, wrapping past midnight). */
export function sampleTime(hour: number, out: EnvSample): EnvSample {
  const h = wrap24(hour);
  let i = parsed.length - 1;
  for (let j = 0; j < parsed.length; j++) {
    if (parsed[j].k.t <= h) i = j;
  }
  const a = parsed[i];
  const b = parsed[(i + 1) % parsed.length];
  const span = (b.k.t > a.k.t ? b.k.t : b.k.t + 24) - a.k.t;
  const t = smoothstep(0, 1, (h - a.k.t) / span);
  for (const name of COLOR_KEYS) out[name].copy(a.colors[name]).lerp(b.colors[name], t);
  out.keyIntensity = a.k.keyIntensity + (b.k.keyIntensity - a.k.keyIntensity) * t;
  out.hemiIntensity = a.k.hemiIntensity + (b.k.hemiIntensity - a.k.hemiIntensity) * t;
  out.night = a.k.night + (b.k.night - a.k.night) * t;
  out.exposure = a.k.exposure + (b.k.exposure - a.k.exposure) * t;
  return out;
}

const SUN_UP = 5.5;
const SUN_DOWN = 19.05;

/** Whether the key light currently represents the sun (true) or the moon. */
export const isSunHour = (hour: number): boolean => {
  const h = wrap24(hour);
  return h >= SUN_UP && h < SUN_DOWN;
};

const deg = THREE.MathUtils.degToRad;

/**
 * Direction toward the sun. It rises behind-right of the default view, passes in front
 * around noon and sets to the left, so the front of the house is lit for most of the day.
 */
export function sunDirection(hour: number, out: THREE.Vector3): THREE.Vector3 {
  const arc = ((wrap24(hour) - 6) / 12) * Math.PI;
  const elevation = Math.sin(arc) * deg(62);
  const azimuth = deg(-10) + VIEW_AZIMUTH + deg(108) * ((arc - Math.PI / 2) / (Math.PI / 2));
  return out.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation));
}

/** The moon hangs high on the viewer's left and drifts slowly across the night. */
export function moonDirection(hour: number, out: THREE.Vector3): THREE.Vector3 {
  const h = wrap24(hour);
  const nightT = ((h < 12 ? h + 24 : h) - 19) / 11;
  const azimuth = VIEW_AZIMUTH + deg(150) - deg(70) * nightT;
  const elevation = deg(38) + Math.sin(nightT * Math.PI) * deg(16);
  return out.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation));
}

/** Short word for the time label. */
export function phaseName(hour: number): string {
  const h = wrap24(hour);
  if (h < 5) return 'Night';
  if (h < 7) return 'Dawn';
  if (h < 11.5) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 17.5) return 'Afternoon';
  if (h < 19.25) return 'Sunset';
  if (h < 20.5) return 'Dusk';
  return 'Night';
}

export function formatHour(hour: number): string {
  const total = Math.round(wrap24(hour) * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const grey = new THREE.Color();

/** Overcast version of a sample: greyer sky, softer sun, a little more diffuse light. */
export function applyRain(s: EnvSample, rain: number): EnvSample {
  if (rain <= 0) return s;
  const desat = (c: THREE.Color, amount: number, darken: number) => {
    const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    grey.setRGB(l * 0.92, l * 0.97, l * 1.06).multiplyScalar(darken);
    c.lerp(grey, amount);
  };
  desat(s.skyTop, 0.78 * rain, 0.72);
  desat(s.skyHorizon, 0.72 * rain, 0.78);
  desat(s.skyBottom, 0.72 * rain, 0.74);
  desat(s.hemiSky, 0.5 * rain, 0.95);
  desat(s.water, 0.4 * rain, 0.85);
  desat(s.cloud, 0.85 * rain, 0.66);
  desat(s.key, 0.35 * rain, 1);
  s.keyIntensity *= 1 - 0.68 * rain;
  s.hemiIntensity *= 1 + 0.12 * rain;
  return s;
}
