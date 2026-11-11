import * as THREE from 'three';
import { lerp, smoothstep, clamp01 } from './lib/math';

/**
 * The palette of the whole world as a function of the hour (0..24) and the
 * amount of rain (0..1). Everything the lighting/sky system shows is derived
 * from one `sample()` call, so time and weather always move together.
 */

export interface EnvLighting {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  skyBottom: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  ambientIntensity: number;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  starAlpha: number;
  exposure: number;
}

interface Keyframe {
  h: number;
  top: number;
  horizon: number;
  bottom: number;
  sun: number;
  sunI: number;
  hemiI: number;
  amb: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  star: number;
  expo: number;
}

/** Hour-by-hour color script: night → dawn → day → golden hour → dusk → night. */
const KEYS: Keyframe[] = [
  { h: 0.0,  top: 0x0b1026, horizon: 0x1b2547, bottom: 0x05070f, sun: 0x8fa7d9, sunI: 0.0,  hemiI: 0.44, amb: 0.2,  fog: 0x131b30, fogNear: 30, fogFar: 85, star: 1.0,  expo: 1.02 },
  { h: 4.6,  top: 0x141d3a, horizon: 0x27305a, bottom: 0x070a14, sun: 0x8fa7d9, sunI: 0.0,  hemiI: 0.46, amb: 0.2,  fog: 0x1a2338, fogNear: 30, fogFar: 85, star: 0.9,  expo: 1.02 },
  { h: 6.0,  top: 0x3c4a78, horizon: 0xe6907a, bottom: 0x141629, sun: 0xffb073, sunI: 1.0,  hemiI: 0.55, amb: 0.2,  fog: 0xa88a8c, fogNear: 26, fogFar: 80, star: 0.15, expo: 1.04 },
  { h: 8.0,  top: 0x6f9fd8, horizon: 0xcfe0ea, bottom: 0x2c3550, sun: 0xffe0b0, sunI: 2.6,  hemiI: 0.72, amb: 0.22, fog: 0xc3d5e2, fogNear: 26, fogFar: 80, star: 0.0,  expo: 1.08 },
  { h: 12.0, top: 0x79b3e6, horizon: 0xdcecf4, bottom: 0x323b57, sun: 0xfff3d6, sunI: 3.1,  hemiI: 0.8,  amb: 0.24, fog: 0xd3e4ee, fogNear: 28, fogFar: 82, star: 0.0,  expo: 1.1 },
  { h: 16.0, top: 0x6ea6dd, horizon: 0xe9ddbd, bottom: 0x303a55, sun: 0xffe6b8, sunI: 2.8,  hemiI: 0.75, amb: 0.23, fog: 0xd6dbc9, fogNear: 27, fogFar: 80, star: 0.0,  expo: 1.08 },
  { h: 17.6, top: 0x5c7cbe, horizon: 0xf2b177, bottom: 0x262c4c, sun: 0xffb26b, sunI: 2.0,  hemiI: 0.64, amb: 0.22, fog: 0xe0bd9a, fogNear: 25, fogFar: 78, star: 0.0,  expo: 1.06 },
  { h: 18.6, top: 0x44518e, horizon: 0xef8a5f, bottom: 0x1b2140, sun: 0xff9a5a, sunI: 1.05, hemiI: 0.5,  amb: 0.2,  fog: 0xc08a78, fogNear: 24, fogFar: 76, star: 0.12, expo: 1.04 },
  { h: 19.6, top: 0x222a52, horizon: 0x6b4d77, bottom: 0x0c0f22, sun: 0xd98a70, sunI: 0.18, hemiI: 0.42, amb: 0.18, fog: 0x4a4266, fogNear: 26, fogFar: 78, star: 0.55, expo: 1.0 },
  { h: 21.0, top: 0x0d1229, horizon: 0x1e284b, bottom: 0x05070f, sun: 0x8fa7d9, sunI: 0.0,  hemiI: 0.44, amb: 0.2,  fog: 0x141c31, fogNear: 30, fogFar: 85, star: 1.0,  expo: 1.02 },
  { h: 24.0, top: 0x0b1026, horizon: 0x1b2547, bottom: 0x05070f, sun: 0x8fa7d9, sunI: 0.0,  hemiI: 0.44, amb: 0.2,  fog: 0x131b30, fogNear: 30, fogFar: 85, star: 1.0,  expo: 1.02 },
];

const RAIN = {
  top: 0x5a6472,
  horizon: 0x8d98a4,
  bottom: 0x3a4250,
  fog: 0x8b96a2,
  blend: 0.72,
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

const env: EnvLighting = {
  skyTop: new THREE.Color(),
  skyHorizon: new THREE.Color(),
  skyBottom: new THREE.Color(),
  sunColor: new THREE.Color(),
  sunIntensity: 2.8,
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  hemiIntensity: 0.8,
  ambientIntensity: 0.2,
  fogColor: new THREE.Color(),
  fogNear: 27,
  fogFar: 80,
  starAlpha: 0,
  exposure: 1.05,
};

/**
 * Fills and returns the shared `EnvLighting` for hour `h` and rain amount
 * `rain` (0..1). Callers must not keep the returned object — it is reused.
 */
export function sampleEnv(hour: number, rain: number): EnvLighting {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (hour >= KEYS[i].h && hour <= KEYS[i + 1].h) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const t = smoothstep(a.h, b.h, hour);

  env.skyTop.setHex(a.top).lerp(tmpA.setHex(b.top), t);
  env.skyHorizon.setHex(a.horizon).lerp(tmpA.setHex(b.horizon), t);
  env.skyBottom.setHex(a.bottom).lerp(tmpA.setHex(b.bottom), t);
  env.sunColor.setHex(a.sun).lerp(tmpA.setHex(b.sun), t);
  env.fogColor.setHex(a.fog).lerp(tmpA.setHex(b.fog), t);
  env.sunIntensity = lerp(a.sunI, b.sunI, t);
  env.hemiIntensity = lerp(a.hemiI, b.hemiI, t);
  env.ambientIntensity = lerp(a.amb, b.amb, t);
  env.fogNear = lerp(a.fogNear, b.fogNear, t);
  env.fogFar = lerp(a.fogFar, b.fogFar, t);
  env.starAlpha = lerp(a.star, b.star, t);
  env.exposure = lerp(a.expo, b.expo, t);

  // Rain pulls everything toward slate gray and swallows the sun.
  const r = clamp01(rain);
  env.skyTop.lerp(tmpB.setHex(RAIN.top), RAIN.blend * r);
  env.skyHorizon.lerp(tmpB.setHex(RAIN.horizon), RAIN.blend * r);
  env.skyBottom.lerp(tmpB.setHex(RAIN.bottom), RAIN.blend * r);
  env.fogColor.lerp(tmpB.setHex(RAIN.fog), 0.6 * r);
  env.sunIntensity *= 1 - 0.78 * r;
  env.hemiIntensity *= 1 - 0.28 * r;
  env.starAlpha *= 1 - r;

  env.hemiSky.copy(env.skyTop).lerp(tmpB.setHex(0xffffff), 0.3);
  env.hemiGround.setHex(0x5c5147).lerp(env.fogColor, 0.35);
  return env;
}

/** Sun angle at hour h: 6:00 → eastern horizon, 12:00 → zenith, 18:00 → west. */
export function sunAngle(hour: number): number {
  return ((hour - 6) / 12) * Math.PI;
}

export function dayFactor(hour: number): number {
  return smoothstep(-0.06, 0.12, Math.sin(sunAngle(hour)));
}

export function nightFactor(hour: number): number {
  return smoothstep(0.03, 0.22, -Math.sin(sunAngle(hour)));
}

/** Normalized direction toward the sun (may point below the horizon at night). */
export function sunDirection(hour: number, out: THREE.Vector3): THREE.Vector3 {
  const a = sunAngle(hour);
  return out.set(Math.cos(a), Math.sin(a), 0.32).normalize();
}

/** Fixed World palette for the miniature itself. */
export const WORLD = {
  grassLight: 0x99cc7a,
  grass: 0x82b966,
  grassDeep: 0x63a054,
  grassShade: 0x528f49,
  dirt: 0x8d7355,
  rock: 0x8d7f70,
  rockDeep: 0x6e6157,
  rockDark: 0x57493f,
  sand: 0xdcc79d,
  waterDeep: 0x2f6f8f,
  waterShallow: 0x7fc0d4,
  foam: 0xeaf6f9,
  wood: 0x8a5a3b,
  woodDark: 0x6f4630,
  cream: 0xf4e9d4,
  creamShade: 0xe4d4b8,
  roof: 0xc2603f,
  roofDark: 0xa34c33,
  stone: 0x9a8f80,
  windowGlass: 0x2a3947,
  windowGlow: 0xffb24d,
  lampGlow: 0xffd27a,
  cloud: 0xf7f4ec,
  cloudRain: 0x7d8794,
  trunk: 0x7a5233,
  leaf1: 0x6fae5a,
  leaf2: 0x86c168,
  leaf3: 0x5c9b52,
  pine: 0x4a8a58,
  pine2: 0x3f7a4d,
  flowerPink: 0xef8fa8,
  flowerYellow: 0xf2c94c,
  flowerWhite: 0xfaf3e3,
};
