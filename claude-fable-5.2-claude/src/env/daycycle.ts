import * as THREE from 'three';
import { clamp01, lerp, smoothstep } from '../core/math';

/** Everything the scene needs to know about one moment of the day. */
export interface DayFrame {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  skyBottom: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  exposure: number;
  stars: number;
  /** Unit vector towards the sun. */
  sunDir: THREE.Vector3;
  /** 0 in daylight, 1 in full night. */
  night: number;
  /** 1 when the sun is up and lighting the scene. */
  sunUp: number;
  /** 1 when the moon has taken over as key light. */
  moonUp: number;
}

type Key = [
  hour: number,
  top: string,
  horizon: string,
  bottom: string,
  sun: string,
  sunIntensity: number,
  hemiSky: string,
  hemiGround: string,
  hemiIntensity: number,
  exposure: number,
  stars: number,
];

type KeyTail = [string, string, string, string, number, string, string, number, number, number];

const NIGHT: KeyTail = [
  '#0b1233', '#1f2f5e', '#121a3a', '#ffd9a0', 0, '#6b84d6', '#2b3152', 1.5, 1.08, 1,
];

// prettier-ignore
const KEYS: Key[] = [
  [0,    ...NIGHT],
  [4.7,  ...NIGHT],
  [5.6,  '#2f3d78', '#93748f', '#3d3c66', '#ff9e6b', 0.8, '#8a90c8', '#40384c', 1.3,  1.03, 0.3],
  [6.5,  '#6189c6', '#f7bd90', '#c99c98', '#ffb47c', 1.9, '#b8c2e2', '#7a655b', 1.25, 1.0,  0],
  [8.5,  '#6aa5de', '#d0e8f4', '#b5d7eb', '#fff0d6', 2.9, '#cfe2f7', '#8d9c6e', 1.35, 1.0,  0],
  [12.5, '#5a9bdc', '#c6e3f5', '#a9d0ec', '#fffaf0', 3.3, '#d6e8ff', '#95a272', 1.45, 1.0,  0],
  [16,   '#6da6da', '#e6e9d6', '#bdd7e0', '#ffe6bd', 3.2, '#d2e2f5', '#96996b', 1.35, 1.0,  0],
  [17.5, '#6c88bf', '#f6c690', '#d4a690', '#ffbd7c', 2.8, '#cbc4de', '#8c745f', 1.2,  1.0,  0],
  [18.4, '#4c5c9c', '#f49c64', '#bb756d', '#ff8a4c', 2.2, '#ac99c2', '#6d4d4b', 1.15, 1.0,  0.04],
  [19.2, '#272d65', '#8d5c86', '#453861', '#ff7a50', 0.6, '#7474b8', '#37334e', 1.3,  1.04, 0.5],
  [20.3, ...NIGHT],
  [24,   ...NIGHT],
];
interface Parsed {
  hour: number;
  top: THREE.Color;
  horizon: THREE.Color;
  bottom: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  exposure: number;
  stars: number;
}

const PARSED: Parsed[] = KEYS.map((k) => ({
  hour: k[0],
  top: new THREE.Color(k[1]),
  horizon: new THREE.Color(k[2]),
  bottom: new THREE.Color(k[3]),
  sun: new THREE.Color(k[4]),
  sunIntensity: k[5],
  hemiSky: new THREE.Color(k[6]),
  hemiGround: new THREE.Color(k[7]),
  hemiIntensity: k[8],
  exposure: k[9],
  stars: k[10],
}));

// The sun's path: rises on the viewer's right, arcs over the front of the
// island (so noon lights the faces we look at) and sets on the left.
const VIEW = new THREE.Vector3(0.62, 0, 0.78).normalize();
const RIGHT = new THREE.Vector3(0.78, 0, -0.62).normalize();
const TILT = THREE.MathUtils.degToRad(33);
const ARC_UP = new THREE.Vector3(0, Math.cos(TILT), 0).addScaledVector(VIEW, Math.sin(TILT));
export const SUNRISE = 5.7;
export const SUNSET = 18.7;

export function createDayFrame(): DayFrame {
  return {
    skyTop: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    skyBottom: new THREE.Color(),
    sunColor: new THREE.Color(),
    sunIntensity: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 1,
    exposure: 1,
    stars: 0,
    sunDir: new THREE.Vector3(0, 1, 0),
    night: 0,
    sunUp: 1,
    moonUp: 0,
  };
}

/** Sample the day at `hour` (0..24, fractional) into `out`. Allocation-free. */
export function sampleDay(hour: number, out: DayFrame): DayFrame {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < PARSED.length - 2 && PARSED[i + 1].hour <= h) i++;
  const a = PARSED[i], b = PARSED[i + 1];
  const t = clamp01((h - a.hour) / (b.hour - a.hour));

  out.skyTop.copy(a.top).lerp(b.top, t);
  out.skyHorizon.copy(a.horizon).lerp(b.horizon, t);
  out.skyBottom.copy(a.bottom).lerp(b.bottom, t);
  out.sunColor.copy(a.sun).lerp(b.sun, t);
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, t);
  out.exposure = lerp(a.exposure, b.exposure, t);
  out.stars = lerp(a.stars, b.stars, t);

  const angle = ((h - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI;
  out.sunDir
    .copy(RIGHT)
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(ARC_UP, Math.sin(angle))
    .normalize();
  const elevation = out.sunDir.y;
  out.sunUp = smoothstep(-0.01, 0.16, elevation);
  out.moonUp = smoothstep(-0.03, -0.2, elevation);
  out.night = smoothstep(0.1, -0.16, elevation);
  return out;
}

export function phaseName(hour: number): string {
  if (hour < 4.75) return 'Night';
  if (hour < 6.75) return 'Dawn';
  if (hour < 11) return 'Morning';
  if (hour < 14) return 'Midday';
  if (hour < 17.25) return 'Afternoon';
  if (hour < 19.25) return 'Sunset';
  if (hour < 20.5) return 'Dusk';
  return 'Night';
}
