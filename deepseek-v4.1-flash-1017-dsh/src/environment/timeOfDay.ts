import { Color, Vector3 } from 'three';
import { smoothstep } from '../lib/noise';

interface TimeKey {
  hour: number;
  skyTop: string;
  skyHorizon: string;
  hemiSky: string;
  hemiGround: string;
  light: string;
  cloud: string;
  fog: string;
  lightIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
  exposure: number;
  stars: number;
}

export interface TimeSample {
  skyTop: Color;
  skyHorizon: Color;
  hemiSky: Color;
  hemiGround: Color;
  lightColor: Color;
  cloudColor: Color;
  fogColor: Color;
  lightIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
  exposure: number;
  stars: number;
}

const KEYS: TimeKey[] = [
  {
    hour: 0,
    skyTop: '#0b1422',
    skyHorizon: '#1d2a3d',
    hemiSky: '#33445e',
    hemiGround: '#14181d',
    light: '#8ea5c8',
    cloud: '#5f6878',
    fog: '#141e2c',
    lightIntensity: 0.58,
    hemiIntensity: 0.64,
    ambientIntensity: 0.3,
    exposure: 1.11,
    stars: 1,
  },
  {
    hour: 4.4,
    skyTop: '#15253f',
    skyHorizon: '#4a4258',
    hemiSky: '#4c536a',
    hemiGround: '#2a2522',
    light: '#b9a694',
    cloud: '#6e6f7a',
    fog: '#2a2f3f',
    lightIntensity: 0.5,
    hemiIntensity: 0.7,
    ambientIntensity: 0.32,
    exposure: 1.1,
    stars: 0.7,
  },
  {
    hour: 6.3,
    skyTop: '#5b7796',
    skyHorizon: '#f0b184',
    hemiSky: '#c9b9ad',
    hemiGround: '#5f5648',
    light: '#ffc48e',
    cloud: '#d9b7ab',
    fog: '#c3a99d',
    lightIntensity: 1.65,
    hemiIntensity: 0.72,
    ambientIntensity: 0.24,
    exposure: 1.06,
    stars: 0,
  },
  {
    hour: 8,
    skyTop: '#84abc0',
    skyHorizon: '#ece2c8',
    hemiSky: '#cfdeda',
    hemiGround: '#6d7552',
    light: '#fff0d4',
    cloud: '#eee9dd',
    fog: '#d8d8c6',
    lightIntensity: 2.8,
    hemiIntensity: 0.95,
    ambientIntensity: 0.28,
    exposure: 1.01,
    stars: 0,
  },
  {
    hour: 12.5,
    skyTop: '#7fb1c4',
    skyHorizon: '#e8ece1',
    hemiSky: '#d7e6e1',
    hemiGround: '#74805a',
    light: '#fff8e8',
    cloud: '#f3f0e6',
    fog: '#dbe4dc',
    lightIntensity: 3.4,
    hemiIntensity: 1.05,
    ambientIntensity: 0.32,
    exposure: 1,
    stars: 0,
  },
  {
    hour: 16,
    skyTop: '#82aac0',
    skyHorizon: '#f3dfc1',
    hemiSky: '#dde1d0',
    hemiGround: '#7a7652',
    light: '#ffd9a2',
    cloud: '#f1e9db',
    fog: '#d8d5c1',
    lightIntensity: 3.1,
    hemiIntensity: 0.92,
    ambientIntensity: 0.3,
    exposure: 1.02,
    stars: 0,
  },
  {
    hour: 18.2,
    skyTop: '#6b7ea6',
    skyHorizon: '#f3a774',
    hemiSky: '#d8b49c',
    hemiGround: '#695a47',
    light: '#ffae68',
    cloud: '#ecc5ae',
    fog: '#c9a48d',
    lightIntensity: 2.2,
    hemiIntensity: 0.74,
    ambientIntensity: 0.25,
    exposure: 1.05,
    stars: 0.05,
  },
  {
    hour: 19.5,
    skyTop: '#2d3d5e',
    skyHorizon: '#a16d6c',
    hemiSky: '#776a77',
    hemiGround: '#35302b',
    light: '#d99c84',
    cloud: '#8c7c84',
    fog: '#5c5667',
    lightIntensity: 1.0,
    hemiIntensity: 0.62,
    ambientIntensity: 0.25,
    exposure: 1.09,
    stars: 0.35,
  },
  {
    hour: 21,
    skyTop: '#0e1a2d',
    skyHorizon: '#26334a',
    hemiSky: '#33435d',
    hemiGround: '#171b21',
    light: '#9cb0d4',
    cloud: '#566173',
    fog: '#1a2534',
    lightIntensity: 0.58,
    hemiIntensity: 0.64,
    ambientIntensity: 0.3,
    exposure: 1.11,
    stars: 0.9,
  },
  {
    hour: 24,
    skyTop: '#0b1422',
    skyHorizon: '#1d2a3d',
    hemiSky: '#33445e',
    hemiGround: '#14181d',
    light: '#8ea5c8',
    cloud: '#5f6878',
    fog: '#141e2c',
    lightIntensity: 0.58,
    hemiIntensity: 0.64,
    ambientIntensity: 0.3,
    exposure: 1.11,
    stars: 1,
  },
];

export function createTimeSample(): TimeSample {
  return {
    skyTop: new Color(),
    skyHorizon: new Color(),
    hemiSky: new Color(),
    hemiGround: new Color(),
    lightColor: new Color(),
    cloudColor: new Color(),
    fogColor: new Color(),
    lightIntensity: 1,
    hemiIntensity: 1,
    ambientIntensity: 1,
    exposure: 1,
    stars: 0,
  };
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Samples the 24-hour palette into an existing object, avoiding per-frame garbage. */
export function sampleTime(hour: number, out: TimeSample): TimeSample {
  const wrapped = ((hour % 24) + 24) % 24;
  let nextIndex = KEYS.findIndex((key) => key.hour > wrapped);
  if (nextIndex === -1) nextIndex = KEYS.length - 1;
  const next = KEYS[nextIndex];
  const previous = KEYS[Math.max(0, nextIndex - 1)];

  const span = next.hour - previous.hour;
  const rawT = span === 0 ? 0 : (wrapped - previous.hour) / span;
  // Soft interpolation keeps sunrise and sunset from landing as a hard cut.
  const t = rawT * rawT * (3 - 2 * rawT);

  out.skyTop.set(previous.skyTop).lerp(new Color(next.skyTop), t);
  out.skyHorizon.set(previous.skyHorizon).lerp(new Color(next.skyHorizon), t);
  out.hemiSky.set(previous.hemiSky).lerp(new Color(next.hemiSky), t);
  out.hemiGround.set(previous.hemiGround).lerp(new Color(next.hemiGround), t);
  out.lightColor.set(previous.light).lerp(new Color(next.light), t);
  out.cloudColor.set(previous.cloud).lerp(new Color(next.cloud), t);
  out.fogColor.set(previous.fog).lerp(new Color(next.fog), t);
  out.lightIntensity = lerpNumber(previous.lightIntensity, next.lightIntensity, t);
  out.hemiIntensity = lerpNumber(previous.hemiIntensity, next.hemiIntensity, t);
  out.ambientIntensity = lerpNumber(previous.ambientIntensity, next.ambientIntensity, t);
  out.exposure = lerpNumber(previous.exposure, next.exposure, t);
  out.stars = lerpNumber(previous.stars, next.stars, t);
  return out;
}

/** Sun travels from east at 06:00, overhead at noon, west at 18:00. */
export function sunDirectionAt(hour: number, target: Vector3): Vector3 {
  const angle = ((hour - 6) / 12) * Math.PI;
  target.set(Math.cos(angle), Math.sin(angle), -0.4).normalize();
  return target;
}

export function daylightAt(hour: number): number {
  const wrapped = ((hour % 24) + 24) % 24;
  const sunrise = smoothstep(4.9, 7.3, wrapped);
  const sunset = 1 - smoothstep(17.7, 20.1, wrapped);
  return Math.min(sunrise, sunset);
}
