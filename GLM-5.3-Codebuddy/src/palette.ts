import * as THREE from 'three';
import { lerp } from './util';

/**
 * Keyframes for the full 24-hour day. The "dir" light is the dominant
 * celestial body: the warm sun by day, a pale moon through the night.
 */
export interface SkySample {
  h: number;
  skyTop: number;
  skyHorizon: number;
  dirColor: number;
  dirI: number;
  hemiI: number;
  hemiSky: number;
  hemiGround: number;
  fog: number;
  waterDeep: number;
  waterShallow: number;
}

export const SKY_SAMPLES: SkySample[] = [
  { h: 0.0,  skyTop: 0x101a38, skyHorizon: 0x1e2c4e, dirColor: 0x93a7cc, dirI: 0.26, hemiI: 0.30, hemiSky: 0x24335c, hemiGround: 0x141821, fog: 0x16203a, waterDeep: 0x14213a, waterShallow: 0x2a4058 },
  { h: 4.6,  skyTop: 0x131d3c, skyHorizon: 0x2a3a5e, dirColor: 0x9aa9c9, dirI: 0.22, hemiI: 0.30, hemiSky: 0x2a3a62, hemiGround: 0x161a24, fog: 0x1c2742, waterDeep: 0x17243e, waterShallow: 0x2c4260 },
  { h: 5.9,  skyTop: 0x3a4a74, skyHorizon: 0xe8a984, dirColor: 0xffb070, dirI: 0.55, hemiI: 0.42, hemiSky: 0x5a6a94, hemiGround: 0x2a2430, fog: 0x8a7484, waterDeep: 0x22405c, waterShallow: 0x7a6a74 },
  { h: 7.2,  skyTop: 0x7aa6dc, skyHorizon: 0xffd9a4, dirColor: 0xffc182, dirI: 1.05, hemiI: 0.60, hemiSky: 0x9ec2ea, hemiGround: 0x4a4238, fog: 0xe8d9bc, waterDeep: 0x2f6f9c, waterShallow: 0xd9b084 },
  { h: 10.0, skyTop: 0x7cb2e8, skyHorizon: 0xd6ecf8, dirColor: 0xfff0cd, dirI: 1.32, hemiI: 0.72, hemiSky: 0xbcd9f2, hemiGround: 0x55483c, fog: 0xd8e8f0, waterDeep: 0x2f83b4, waterShallow: 0x9fd0e4 },
  { h: 13.0, skyTop: 0x6fa9ec, skyHorizon: 0xdff0fa, dirColor: 0xfff8e8, dirI: 1.45, hemiI: 0.78, hemiSky: 0xc8e0f4, hemiGround: 0x5a4c40, fog: 0xdfeef4, waterDeep: 0x3386b8, waterShallow: 0xa8d8e8 },
  { h: 16.0, skyTop: 0x6aa1e0, skyHorizon: 0xffe2b2, dirColor: 0xffe6b0, dirI: 1.30, hemiI: 0.68, hemiSky: 0xb8d0e8, hemiGround: 0x54463a, fog: 0xecdfc0, waterDeep: 0x2c7cab, waterShallow: 0xe8c890 },
  { h: 17.6, skyTop: 0x5f74b0, skyHorizon: 0xffc088, dirColor: 0xffcf9a, dirI: 0.95, hemiI: 0.58, hemiSky: 0xa0aecf, hemiGround: 0x4e4238, fog: 0xe0c8a4, waterDeep: 0x2a6f9e, waterShallow: 0xf0b880 },
  { h: 18.2, skyTop: 0x4c5590, skyHorizon: 0xff9a62, dirColor: 0xff9d6f, dirI: 0.50, hemiI: 0.48, hemiSky: 0x8a86b0, hemiGround: 0x463a32, fog: 0xcc9878, waterDeep: 0x28597e, waterShallow: 0xf0a068 },
  { h: 18.9, skyTop: 0x2c3060, skyHorizon: 0xb06f78, dirColor: 0xb08a9a, dirI: 0.16, hemiI: 0.38, hemiSky: 0x5a5480, hemiGround: 0x302832, fog: 0x8a6878, waterDeep: 0x1e3a54, waterShallow: 0x6a5a68 },
  { h: 19.8, skyTop: 0x1a2348, skyHorizon: 0x4a4468, dirColor: 0x8fa5cf, dirI: 0.20, hemiI: 0.32, hemiSky: 0x343c60, hemiGround: 0x1c1e28, fog: 0x2c3350, waterDeep: 0x182844, waterShallow: 0x344860 },
  { h: 21.0, skyTop: 0x121c3a, skyHorizon: 0x243252, dirColor: 0x93a7cc, dirI: 0.25, hemiI: 0.30, hemiSky: 0x28365e, hemiGround: 0x151922, fog: 0x182238, waterDeep: 0x15223c, waterShallow: 0x2c4258 },
  { h: 24.0, skyTop: 0x101a38, skyHorizon: 0x1e2c4e, dirColor: 0x93a7cc, dirI: 0.26, hemiI: 0.30, hemiSky: 0x24335c, hemiGround: 0x141821, fog: 0x16203a, waterDeep: 0x14213a, waterShallow: 0x2a4058 },
];

/** Mutable, pre-allocated result of sampling the palette at some hour. */
export interface SkyState {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  dirColor: THREE.Color;
  dirI: number;
  hemiI: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  fog: THREE.Color;
  waterDeep: THREE.Color;
  waterShallow: THREE.Color;
}

export function createSkyState(): SkyState {
  return {
    skyTop: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    dirColor: new THREE.Color(),
    dirI: 1,
    hemiI: 0.6,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    fog: new THREE.Color(),
    waterDeep: new THREE.Color(),
    waterShallow: new THREE.Color(),
  };
}

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

/** Interpolate the palette at `hour` (wraps 0–24) into `out`. */
export function sampleSky(hour: number, out: SkyState): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let a = SKY_SAMPLES[0];
  let b = SKY_SAMPLES[SKY_SAMPLES.length - 1];
  for (let i = 0; i < SKY_SAMPLES.length - 1; i++) {
    if (h >= SKY_SAMPLES[i].h && h <= SKY_SAMPLES[i + 1].h) {
      a = SKY_SAMPLES[i];
      b = SKY_SAMPLES[i + 1];
      break;
    }
  }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const ts = t * t * (3 - 2 * t); // ease for softer keyframe transitions

  out.skyTop.copy(tmpA.setHex(a.skyTop)).lerp(tmpB.setHex(b.skyTop), ts);
  out.skyHorizon.copy(tmpA.setHex(a.skyHorizon)).lerp(tmpB.setHex(b.skyHorizon), ts);
  out.dirColor.copy(tmpA.setHex(a.dirColor)).lerp(tmpB.setHex(b.dirColor), ts);
  out.hemiSky.copy(tmpA.setHex(a.hemiSky)).lerp(tmpB.setHex(b.hemiSky), ts);
  out.hemiGround.copy(tmpA.setHex(a.hemiGround)).lerp(tmpB.setHex(b.hemiGround), ts);
  out.fog.copy(tmpA.setHex(a.fog)).lerp(tmpB.setHex(b.fog), ts);
  out.waterDeep.copy(tmpA.setHex(a.waterDeep)).lerp(tmpB.setHex(b.waterDeep), ts);
  out.waterShallow.copy(tmpA.setHex(a.waterShallow)).lerp(tmpB.setHex(b.waterShallow), ts);
  out.dirI = lerp(a.dirI, b.dirI, ts);
  out.hemiI = lerp(a.hemiI, b.hemiI, ts);
  return out;
}
