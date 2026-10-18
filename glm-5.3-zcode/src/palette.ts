import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './lib/math';

/**
 * One palette entry per key moment of the day. Everything the renderer needs
 * (sky gradient, fog, sun, ambient moods, stars) is derived by interpolating
 * between these rows, so any time of day resolves to a coherent look.
 */
interface PaletteKey {
  hour: number;
  skyTop: number;
  skyHorizon: number;
  fog: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  starOpacity: number;
}

const KEYS: PaletteKey[] = [
  // hour  skyTop   horizon  fog      sun      sunI  hemiSky  hemiGnd  hemiI  stars
  { hour: 0.0, skyTop: 0x0c1226, skyHorizon: 0x1b2542, fog: 0x161f36, sunColor: 0x8fa8d8, sunIntensity: 0.0, hemiSky: 0x27334f, hemiGround: 0x141b2b, hemiIntensity: 0.5, starOpacity: 1.0 },
  { hour: 4.6, skyTop: 0x101a33, skyHorizon: 0x2a3050, fog: 0x1e2540, sunColor: 0x9fb4d9, sunIntensity: 0.0, hemiSky: 0x2d3a58, hemiGround: 0x171e2e, hemiIntensity: 0.55, starOpacity: 0.9 },
  { hour: 6.1, skyTop: 0x3b4d76, skyHorizon: 0xe0896a, fog: 0x9a6f6a, sunColor: 0xffab73, sunIntensity: 0.75, hemiSky: 0x6a6f96, hemiGround: 0x3a3242, hemiIntensity: 0.7, starOpacity: 0.15 },
  { hour: 7.6, skyTop: 0x6ea6c8, skyHorizon: 0xffd9a4, fog: 0xd9c3a8, sunColor: 0xffd9a0, sunIntensity: 1.5, hemiSky: 0x9fc3dd, hemiGround: 0x6a5b4a, hemiIntensity: 0.75, starOpacity: 0.0 },
  { hour: 12.0, skyTop: 0x77b4da, skyHorizon: 0xd6ecf4, fog: 0xcfe2ea, sunColor: 0xfff4e2, sunIntensity: 1.9, hemiSky: 0xbdd9ea, hemiGround: 0x77695a, hemiIntensity: 0.8, starOpacity: 0.0 },
  { hour: 16.0, skyTop: 0x7cb0d4, skyHorizon: 0xf3e2bd, fog: 0xe0d3b6, sunColor: 0xffe7bd, sunIntensity: 1.7, hemiSky: 0xb4cfe0, hemiGround: 0x74664f, hemiIntensity: 0.78, starOpacity: 0.0 },
  { hour: 18.4, skyTop: 0x59618e, skyHorizon: 0xf5a561, fog: 0xc98d72, sunColor: 0xff9950, sunIntensity: 1.05, hemiSky: 0x8c7d9c, hemiGround: 0x4c3f42, hemiIntensity: 0.68, starOpacity: 0.08 },
  { hour: 19.9, skyTop: 0x2c3763, skyHorizon: 0xa96870, fog: 0x6a4f5c, sunColor: 0xffb98a, sunIntensity: 0.3, hemiSky: 0x4e5480, hemiGround: 0x2a2637, hemiIntensity: 0.58, starOpacity: 0.5 },
  { hour: 21.2, skyTop: 0x121a31, skyHorizon: 0x232c4c, fog: 0x1a2238, sunColor: 0x93a9d6, sunIntensity: 0.0, hemiSky: 0x2a3552, hemiGround: 0x161d2d, hemiIntensity: 0.52, starOpacity: 1.0 },
  { hour: 24.0, skyTop: 0x0c1226, skyHorizon: 0x1b2542, fog: 0x161f36, sunColor: 0x8fa8d8, sunIntensity: 0.0, hemiSky: 0x27334f, hemiGround: 0x141b2b, hemiIntensity: 0.5, starOpacity: 1.0 },
];

export interface PaletteSample {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fog: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  starOpacity: number;
  /** 0 at night, 1 in full day - handy for gates like window glow or rain darkening. */
  dayFactor: number;
}

const scratch = {
  skyTop: new THREE.Color(),
  skyHorizon: new THREE.Color(),
  fog: new THREE.Color(),
  sunColor: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
};

export function samplePalette(hourRaw: number): PaletteSample {
  const hour = ((hourRaw % 24) + 24) % 24;

  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].hour <= hour) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smoothstep((hour - a.hour) / (b.hour - a.hour));

  return {
    skyTop: scratch.skyTop.setHex(a.skyTop).lerp(new THREE.Color(b.skyTop), t).clone(),
    skyHorizon: scratch.skyHorizon.setHex(a.skyHorizon).lerp(new THREE.Color(b.skyHorizon), t).clone(),
    fog: scratch.fog.setHex(a.fog).lerp(new THREE.Color(b.fog), t).clone(),
    sunColor: scratch.sunColor.setHex(a.sunColor).lerp(new THREE.Color(b.sunColor), t).clone(),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    hemiSky: scratch.hemiSky.setHex(a.hemiSky).lerp(new THREE.Color(b.hemiSky), t).clone(),
    hemiGround: scratch.hemiGround.setHex(a.hemiGround).lerp(new THREE.Color(b.hemiGround), t).clone(),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    starOpacity: lerp(a.starOpacity, b.starOpacity, t),
    dayFactor: dayFactorFor(hour),
  };
}

/** Sun height above the horizon normalized to 0..1 over the 06:00-18:00 arc. */
export function dayFactorFor(hour: number): number {
  const x = (((hour % 24) + 24) % 24 - 6) / 12;
  return clamp(Math.sin(Math.PI * x), 0, 1);
}

/**
 * Sun and moon directions. Both travel tilted circles: the sun rides the
 * 06->18 arc, the moon the 18->06 arc, so exactly one is above the horizon
 * at any moment (twilight handover included).
 */
export function sunDirection(hourRaw: number, out = new THREE.Vector3()): THREE.Vector3 {
  const hour = ((hourRaw % 24) + 24) % 24;
  const arc = (hour - 6) / 12; // 0 at sunrise, 1 at sunset
  const elev = Math.sin(Math.PI * arc) * THREE.MathUtils.degToRad(58);
  const azim = lerp(-THREE.MathUtils.degToRad(115), THREE.MathUtils.degToRad(115), arc);
  return out.set(Math.cos(azim) * Math.cos(elev), Math.sin(elev), Math.sin(azim) * Math.cos(elev));
}

export function moonDirection(hourRaw: number, out = new THREE.Vector3()): THREE.Vector3 {
  return sunDirection(hourRaw + 12, out);
}
