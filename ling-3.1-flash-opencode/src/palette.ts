import * as THREE from 'three';
import { clamp, smoothstep } from './noise';

/** One sampled moment of the day: everything visual derives from this. */
export interface EnvSample {
  skyTop: THREE.Color;
  skyMid: THREE.Color;
  skyBot: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiIntensity: number;
  /** 0 = bright day, 1 = deep night. Drives windows, stars, moon. */
  nightFactor: number;
  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  sunElevation: number;
}

interface Key {
  h: number;
  top: string;
  mid: string;
  bot: string;
  sun: string;
  sunI: number;
  hemiI: number;
}

/** Hand-tuned keyframes across a full day; values are lerped between keys. */
const KEYS: Key[] = [
  { h: 0.0,  top: '#070b1a', mid: '#111b36', bot: '#1e2a4a', sun: '#b9ccff', sunI: 0.30, hemiI: 0.24 },
  { h: 4.5,  top: '#0a1128', mid: '#1b2648', bot: '#3c4160', sun: '#b9ccff', sunI: 0.24, hemiI: 0.21 },
  { h: 6.5,  top: '#2e3c6e', mid: '#e08a4e', bot: '#f6c47e', sun: '#ffb36b', sunI: 0.60, hemiI: 0.33 },
  { h: 9.0,  top: '#5fa8d3', mid: '#aad4e8', bot: '#e9f2ee', sun: '#fff1d6', sunI: 1.05, hemiI: 0.56 },
  { h: 12.0, top: '#6fb7e8', mid: '#bce0f2', bot: '#f0f8f6', sun: '#ffffff', sunI: 1.22, hemiI: 0.66 },
  { h: 16.0, top: '#64a9d8', mid: '#b4dbe9', bot: '#f3eddc', sun: '#ffedd0', sunI: 1.10, hemiI: 0.60 },
  { h: 18.5, top: '#3d3560', mid: '#e07a4a', bot: '#f7b06a', sun: '#ff9448', sunI: 0.62, hemiI: 0.37 },
  { h: 20.5, top: '#161d3d', mid: '#4a3f66', bot: '#6e5670', sun: '#c78aff', sunI: 0.28, hemiI: 0.28 },
  { h: 22.5, top: '#080d20', mid: '#131c38', bot: '#26304e', sun: '#b9ccff', sunI: 0.22, hemiI: 0.21 },
  { h: 24.0, top: '#070b1a', mid: '#111b36', bot: '#1e2a4a', sun: '#b9ccff', sunI: 0.30, hemiI: 0.24 },
];

const keyColors = KEYS.map((k) => ({
  top: new THREE.Color(k.top),
  mid: new THREE.Color(k.mid),
  bot: new THREE.Color(k.bot),
  sun: new THREE.Color(k.sun),
}));

/**
 * Sample the environment for a given hour. Pass `out` to reuse one object
 * and avoid per-frame allocations.
 */
export function sampleTimeOfDay(hours: number, out?: EnvSample): EnvSample {
  const result = out ?? createEmptySample();
  let h = hours % 24;
  if (h < 0) h += 24;

  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp((h - a.h) / (b.h - a.h), 0, 1);

  result.skyTop.lerpColors(keyColors[i].top, keyColors[i + 1].top, t);
  result.skyMid.lerpColors(keyColors[i].mid, keyColors[i + 1].mid, t);
  result.skyBot.lerpColors(keyColors[i].bot, keyColors[i + 1].bot, t);
  result.sunColor.lerpColors(keyColors[i].sun, keyColors[i + 1].sun, t);
  result.sunIntensity = a.sunI + (b.sunI - a.sunI) * t;
  result.hemiIntensity = a.hemiI + (b.hemiI - a.hemiI) * t;

  // Sun travels east→west over the day; the moon mirrors it at night.
  const theta = ((h - 6) / 12) * Math.PI;
  const elevation = Math.sin(theta);
  result.sunElevation = elevation;
  result.sunDir.set(Math.cos(theta), elevation, 0.35).normalize();
  result.moonDir.set(-Math.cos(theta), -elevation, -0.3).normalize();
  result.nightFactor = 1 - smoothstep(-0.08, 0.32, elevation);

  return result;
}

function createEmptySample(): EnvSample {
  return {
    skyTop: new THREE.Color(),
    skyMid: new THREE.Color(),
    skyBot: new THREE.Color(),
    sunColor: new THREE.Color(),
    sunIntensity: 0,
    hemiIntensity: 0,
    nightFactor: 0,
    sunDir: new THREE.Vector3(0, 1, 0),
    moonDir: new THREE.Vector3(0, -1, 0),
    sunElevation: 0,
  };
}
