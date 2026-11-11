import * as THREE from 'three';
import { clamp } from '../util/math';
import { goldenFactor, solarHeight } from '../state';

const C = (hex: string): THREE.Color => new THREE.Color(hex);

/** The whole world draws from one small, warm, slightly dusty palette. */
export const PAL = {
  grass: C('#7eaa61'),
  grassLight: C('#94bb70'),
  grassDark: C('#639451'),
  grassEdge: C('#6b9750'),
  soil: C('#916547'),
  soilDark: C('#6a4933'),
  rockHigh: C('#8a6b50'),
  rockMid: C('#6a5140'),
  rockLow: C('#47382f'),
  rockDeep: C('#332a26'),
  wall: C('#f0e2c6'),
  wallShade: C('#dfcfb0'),
  timber: C('#79543a'),
  timberDark: C('#5e402d'),
  roof: C('#b25c3e'),
  roofDark: C('#8f4631'),
  chimney: C('#a3654c'),
  door: C('#7c4d31'),
  brass: C('#d8a95c'),
  glassDark: C('#4b6572'),
  windowLight: C('#ffcb78'),
  wood: C('#ab7b4f'),
  woodDark: C('#765134'),
  sand: C('#d9bd8d'),
  stone: C('#a9a396'),
  stoneDark: C('#7c7970'),
  waterShallow: C('#82bcc0'),
  waterDeep: C('#35778e'),
  waterFoam: C('#d6ece8'),
  pine: C('#4a7d58'),
  pineDark: C('#3b6849'),
  leaf: C('#72a55e'),
  leafLight: C('#8fbc6d'),
  leafDark: C('#588a4e'),
  blossom: C('#e3aab5'),
  blossomLight: C('#f1c8ce'),
  trunk: C('#70503a'),
  cloud: C('#fbf3e4'),
  cloudShadow: C('#d9d2c4'),
  cloudRain: C('#83939c'),
  flowerYellow: C('#e8c15f'),
  flowerRed: C('#d8756a'),
  flowerWhite: C('#f2ece0'),
  flowerViolet: C('#9d89bb'),
  moon: C('#e7e5d6'),
};

interface SkyStop {
  t: number;
  top: string;
  horizon: string;
  bottom: string;
  sun: string;
  /** directional light intensity at local noon */
  power: number;
  /** ambient / hemisphere fill */
  fill: number;
}

/** A hand-picked 24h sky, sampled continuously by hour. */
const STOPS: SkyStop[] = [
  { t: 0,  top: '#101d38', horizon: '#2a3b58', bottom: '#1a2940', sun: '#8fa9d0', power: 0.30, fill: 0.62 },
  { t: 4.5, top: '#182746', horizon: '#3d4c68', bottom: '#28374f', sun: '#99adcb', power: 0.32, fill: 0.64 },
  { t: 6,  top: '#3b5378', horizon: '#e3a07c', bottom: '#7d8b9b', sun: '#ffb27c', power: 1.25, fill: 0.80 },
  { t: 7.5, top: '#6f9dc0', horizon: '#f6c995', bottom: '#bdc9c3', sun: '#ffd0a0', power: 1.90, fill: 0.88 },
  { t: 12, top: '#77aecd', horizon: '#ecdfc2', bottom: '#b9cfd0', sun: '#fff3da', power: 2.35, fill: 1.00 },
  { t: 16, top: '#79a9c6', horizon: '#efdcb9', bottom: '#bcd0cb', sun: '#ffe7bb', power: 2.05, fill: 0.96 },
  { t: 18, top: '#6a89b4', horizon: '#f0b57c', bottom: '#c4bfae', sun: '#ffae70', power: 1.85, fill: 0.92 },
  { t: 19.2, top: '#3c4e78', horizon: '#d67f66', bottom: '#6c778a', sun: '#ff9466', power: 1.00, fill: 0.80 },
  { t: 21, top: '#15233f', horizon: '#2d3f5e', bottom: '#1b2a43', sun: '#8fa9d0', power: 0.30, fill: 0.62 },
  { t: 24, top: '#101d38', horizon: '#2a3b58', bottom: '#1a2940', sun: '#8fa9d0', power: 0.30, fill: 0.62 },
];

export interface Atmosphere {
  top: THREE.Color;
  horizon: THREE.Color;
  bottom: THREE.Color;
  sunColor: THREE.Color;
  sunPower: number;
  fill: number;
  sunDir: THREE.Vector3;
  sunUp: number;
  golden: number;
  night: number;
  day: number;
}

const RAIN_TOP = C('#697b88');
const RAIN_HORIZON = C('#aab4b3');
const RAIN_BOTTOM = C('#8d9a9c');
const RAIN_TOP_NIGHT = C('#131f33');
const RAIN_HORIZON_NIGHT = C('#283851');
const RAIN_BOTTOM_NIGHT = C('#1c2a40');

export function sampleAtmosphere(time: number, rain: number): Atmosphere {
  const t = clamp(time, 0, 24);
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1].t < t) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const k = clamp((t - a.t) / (b.t - a.t), 0, 1);

  const top = C(a.top).lerp(C(b.top), k);
  const horizon = C(a.horizon).lerp(C(b.horizon), k);
  const bottom = C(a.bottom).lerp(C(b.bottom), k);
  const sunColor = C(a.sun).lerp(C(b.sun), k);
  let sunPower = a.power + (b.power - a.power) * k;
  let fill = a.fill + (b.fill - a.fill) * k;

  const night = 1 - clamp((solarHeight(t) + 0.30) / 0.42, 0, 1);
  const golden = goldenFactor(t);
  const day = clamp((solarHeight(t) + 0.14) / 0.44, 0, 1);

  // Overcast: flatter, cooler and dimmer, but never black at night.
  const rainTop = RAIN_TOP.clone().lerp(RAIN_TOP_NIGHT, night);
  const rainHorizon = RAIN_HORIZON.clone().lerp(RAIN_HORIZON_NIGHT, night);
  const rainBottom = RAIN_BOTTOM.clone().lerp(RAIN_BOTTOM_NIGHT, night);
  const overcast = rain * 0.82;
  top.lerp(rainTop, overcast);
  horizon.lerp(rainHorizon, overcast);
  bottom.lerp(rainBottom, overcast);
  sunColor.lerp(C('#c8d2d2'), rain * 0.55);
  sunPower *= 1 - rain * 0.58;
  // Low sun needs extra sky fill: a purely horizontal sun leaves upward-facing
  // grass unlit, which reads as night rather than golden hour.
  fill *= (1 + rain * 0.10) * (1 + golden * 0.16);

  // One arc across the sky: east at dawn, overhead at noon, west at dusk.
  const arc = ((t - 6) / 12) * Math.PI;
  const up = Math.sin(arc);
  const sunDir = new THREE.Vector3(
    Math.cos(arc) * 0.86,
    Math.max(up, -0.35),
    0.48 + 0.20 * Math.cos(arc * 0.65),
  ).normalize();

  return { top, horizon, bottom, sunColor, sunPower, fill, sunDir, sunUp: up, golden, night, day };
}
