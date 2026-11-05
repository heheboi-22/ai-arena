import * as THREE from 'three';
import { clamp, lerp, wrap24 } from '../utils/math';

interface TimeKey {
  hour: number;
  zenith: THREE.Color;
  horizon: THREE.Color;
  below: THREE.Color;
  fog: THREE.Color;
  sunColor: THREE.Color;
  moonColor: THREE.Color;
  ambient: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  cloud: THREE.Color;
  waterDeep: THREE.Color;
  waterShallow: THREE.Color;
  sunIntensity: number;
  moonIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
  exposure: number;
  starAlpha: number;
  night: number;
  sunGlow: number;
}

const c = (hex: number): THREE.Color => new THREE.Color(hex);
const MOON_COLOR = c(0xb9cde8);

const TIME_KEYS: TimeKey[] = [
  {
    hour: 0,
    zenith: c(0x0b1527),
    horizon: c(0x1b2d46),
    below: c(0x0a1220),
    fog: c(0x162136),
    sunColor: c(0xffbe88),
    moonColor: MOON_COLOR,
    ambient: c(0x2c3f5e),
    hemiSky: c(0x324b6c),
    hemiGround: c(0x121923),
    cloud: c(0x626f83),
    waterDeep: c(0x122b3b),
    waterShallow: c(0x26495a),
    sunIntensity: 0,
    moonIntensity: 0.8,
    hemiIntensity: 0.52,
    ambientIntensity: 0.56,
    exposure: 1.18,
    starAlpha: 1,
    night: 1,
    sunGlow: 0
  },
  {
    hour: 5,
    zenith: c(0x1a2a48),
    horizon: c(0x6e5f71),
    below: c(0x16202e),
    fog: c(0x26324a),
    sunColor: c(0xf8b282),
    moonColor: MOON_COLOR,
    ambient: c(0x495573),
    hemiSky: c(0x536886),
    hemiGround: c(0x232630),
    cloud: c(0x8e8f9c),
    waterDeep: c(0x1b3a49),
    waterShallow: c(0x41606b),
    sunIntensity: 0,
    moonIntensity: 0.34,
    hemiIntensity: 0.38,
    ambientIntensity: 0.38,
    exposure: 1.12,
    starAlpha: 0.35,
    night: 0.8,
    sunGlow: 0
  },
  {
    hour: 6,
    zenith: c(0x617b99),
    horizon: c(0xefb184),
    below: c(0x5a6675),
    fog: c(0x8c8187),
    sunColor: c(0xffc490),
    moonColor: MOON_COLOR,
    ambient: c(0x6e6470),
    hemiSky: c(0xb0b9c4),
    hemiGround: c(0x5b5b4d),
    cloud: c(0xf0d4c2),
    waterDeep: c(0x294e5e),
    waterShallow: c(0x70949a),
    sunIntensity: 1.2,
    moonIntensity: 0.05,
    hemiIntensity: 0.62,
    ambientIntensity: 0.3,
    exposure: 1.06,
    starAlpha: 0,
    night: 0.28,
    sunGlow: 1.2
  },
  {
    hour: 8,
    zenith: c(0x6d9fb7),
    horizon: c(0xecdfc3),
    below: c(0x7b918e),
    fog: c(0xcdd8cc),
    sunColor: c(0xffe1b3),
    moonColor: MOON_COLOR,
    ambient: c(0x8c9a94),
    hemiSky: c(0xc2d9d8),
    hemiGround: c(0x7d7c5b),
    cloud: c(0xf6eee1),
    waterDeep: c(0x285e69),
    waterShallow: c(0x679a98),
    sunIntensity: 2.45,
    moonIntensity: 0,
    hemiIntensity: 0.85,
    ambientIntensity: 0.22,
    exposure: 1.02,
    starAlpha: 0,
    night: 0,
    sunGlow: 0.45
  },
  {
    hour: 12,
    zenith: c(0x5e94ae),
    horizon: c(0xe8e8d5),
    below: c(0x6d8988),
    fog: c(0xccd8cf),
    sunColor: c(0xfff3d6),
    moonColor: MOON_COLOR,
    ambient: c(0x9aa298),
    hemiSky: c(0xd0e1dd),
    hemiGround: c(0x828862),
    cloud: c(0xf7f5ee),
    waterDeep: c(0x255c69),
    waterShallow: c(0x5e9393),
    sunIntensity: 2.9,
    moonIntensity: 0,
    hemiIntensity: 0.9,
    ambientIntensity: 0.18,
    exposure: 1,
    starAlpha: 0,
    night: 0,
    sunGlow: 0.15
  },
  {
    hour: 16,
    zenith: c(0x6296b1),
    horizon: c(0xe7ddc5),
    below: c(0x5e7c80),
    fog: c(0xbfcfca),
    sunColor: c(0xffd2a0),
    moonColor: MOON_COLOR,
    ambient: c(0xa2947c),
    hemiSky: c(0xcfe0dd),
    hemiGround: c(0x958f76),
    cloud: c(0xf4f0e7),
    waterDeep: c(0x255862),
    waterShallow: c(0x5f9294),
    sunIntensity: 2.6,
    moonIntensity: 0,
    hemiIntensity: 0.72,
    ambientIntensity: 0.17,
    exposure: 0.99,
    starAlpha: 0,
    night: 0,
    sunGlow: 0.4
  },
  {
    hour: 18.2,
    zenith: c(0x5f748f),
    horizon: c(0xf0a46c),
    below: c(0x586274),
    fog: c(0xa88579),
    sunColor: c(0xffad62),
    moonColor: MOON_COLOR,
    ambient: c(0x6f5e60),
    hemiSky: c(0xc6a79b),
    hemiGround: c(0x6e5a48),
    cloud: c(0xf4c7a4),
    waterDeep: c(0x2b4f5e),
    waterShallow: c(0x6e8c8d),
    sunIntensity: 1.7,
    moonIntensity: 0.1,
    hemiIntensity: 0.58,
    ambientIntensity: 0.24,
    exposure: 1.04,
    starAlpha: 0.05,
    night: 0.15,
    sunGlow: 1.2
  },
  {
    hour: 19.4,
    zenith: c(0x34466a),
    horizon: c(0xcf8a6d),
    below: c(0x3c495c),
    fog: c(0x665d67),
    sunColor: c(0xff9862),
    moonColor: MOON_COLOR,
    ambient: c(0x5a5a72),
    hemiSky: c(0x77788e),
    hemiGround: c(0x3c3b40),
    cloud: c(0x9d93a0),
    waterDeep: c(0x1e3b50),
    waterShallow: c(0x506a76),
    sunIntensity: 0.5,
    moonIntensity: 0.24,
    hemiIntensity: 0.55,
    ambientIntensity: 0.34,
    exposure: 1.1,
    starAlpha: 0.35,
    night: 0.55,
    sunGlow: 0.7
  },
  {
    hour: 20.8,
    zenith: c(0x142138),
    horizon: c(0x31445d),
    below: c(0x101a29),
    fog: c(0x1d2939),
    sunColor: c(0xff9e6a),
    moonColor: MOON_COLOR,
    ambient: c(0x35496a),
    hemiSky: c(0x3b5373),
    hemiGround: c(0x151d26),
    cloud: c(0x626d80),
    waterDeep: c(0x163040),
    waterShallow: c(0x2b4d5d),
    sunIntensity: 0,
    moonIntensity: 0.68,
    hemiIntensity: 0.5,
    ambientIntensity: 0.52,
    exposure: 1.18,
    starAlpha: 0.95,
    night: 0.95,
    sunGlow: 0.1
  },
  {
    hour: 24,
    zenith: c(0x0b1527),
    horizon: c(0x1b2d46),
    below: c(0x0a1220),
    fog: c(0x162136),
    sunColor: c(0xffbe88),
    moonColor: MOON_COLOR,
    ambient: c(0x2c3f5e),
    hemiSky: c(0x324b6c),
    hemiGround: c(0x121923),
    cloud: c(0x626f83),
    waterDeep: c(0x122b3b),
    waterShallow: c(0x26495a),
    sunIntensity: 0,
    moonIntensity: 0.8,
    hemiIntensity: 0.52,
    ambientIntensity: 0.56,
    exposure: 1.18,
    starAlpha: 1,
    night: 1,
    sunGlow: 0
  }
];

const RAIN_ZENITH_DAY = c(0x586669);
const RAIN_ZENITH_NIGHT = c(0x1d2733);
const RAIN_HORIZON_DAY = c(0x9aa4a2);
const RAIN_HORIZON_NIGHT = c(0x35414b);
const RAIN_CLOUD_DAY = c(0x7b8587);
const RAIN_CLOUD_NIGHT = c(0x3a444f);
const RAIN_WATER_DEEP = c(0x213c46);
const RAIN_WATER_SHALLOW = c(0x506d70);
const RAIN_BELOW = c(0x4b4f4e);

const scratchA = new THREE.Color();
const scratchB = new THREE.Color();

export class Palette {
  readonly zenith = new THREE.Color();
  readonly horizon = new THREE.Color();
  readonly below = new THREE.Color();
  readonly fog = new THREE.Color();
  readonly sunColor = new THREE.Color();
  readonly moonColor = new THREE.Color();
  readonly ambient = new THREE.Color();
  readonly hemiSky = new THREE.Color();
  readonly hemiGround = new THREE.Color();
  readonly cloud = new THREE.Color();
  readonly waterDeep = new THREE.Color();
  readonly waterShallow = new THREE.Color();
  sunIntensity = 0;
  moonIntensity = 0;
  hemiIntensity = 0;
  ambientIntensity = 0;
  exposure = 1;
  starAlpha = 0;
  night = 0;
  sunGlow = 0;
  fogDensity = 0.0055;

  sample(hour: number, rain: number): this {
    const h = wrap24(hour);
    let index = TIME_KEYS.length - 2;
    for (let i = 0; i < TIME_KEYS.length - 1; i += 1) {
      const current = TIME_KEYS[i]!;
      const next = TIME_KEYS[i + 1]!;
      if (h >= current.hour && h <= next.hour) {
        index = i;
        break;
      }
    }
    const a = TIME_KEYS[index]!;
    const b = TIME_KEYS[index + 1]!;
    const t = clamp((h - a.hour) / Math.max(0.0001, b.hour - a.hour), 0, 1);
    const wet = clamp(rain, 0, 1);

    this.zenith.copy(a.zenith).lerp(b.zenith, t);
    this.horizon.copy(a.horizon).lerp(b.horizon, t);
    this.below.copy(a.below).lerp(b.below, t);
    this.fog.copy(a.fog).lerp(b.fog, t);
    this.sunColor.copy(a.sunColor).lerp(b.sunColor, t);
    this.moonColor.copy(a.moonColor);
    this.ambient.copy(a.ambient).lerp(b.ambient, t);
    this.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
    this.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
    this.cloud.copy(a.cloud).lerp(b.cloud, t);
    this.waterDeep.copy(a.waterDeep).lerp(b.waterDeep, t);
    this.waterShallow.copy(a.waterShallow).lerp(b.waterShallow, t);
    this.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, t);
    this.moonIntensity = lerp(a.moonIntensity, b.moonIntensity, t);
    this.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, t);
    this.ambientIntensity = lerp(a.ambientIntensity, b.ambientIntensity, t);
    this.exposure = lerp(a.exposure, b.exposure, t);
    this.starAlpha = lerp(a.starAlpha, b.starAlpha, t);
    this.night = lerp(a.night, b.night, t);
    this.sunGlow = lerp(a.sunGlow, b.sunGlow, t);

    if (wet > 0.0001) {
      scratchA.copy(RAIN_ZENITH_DAY).lerp(RAIN_ZENITH_NIGHT, this.night);
      this.zenith.lerp(scratchA, wet * 0.72);
      scratchB.copy(RAIN_HORIZON_DAY).lerp(RAIN_HORIZON_NIGHT, this.night);
      this.horizon.lerp(scratchB, wet * 0.76);
      this.fog.lerp(scratchB, wet * 0.62);
      this.below.lerp(RAIN_BELOW, wet * 0.4);
      scratchA.copy(RAIN_CLOUD_DAY).lerp(RAIN_CLOUD_NIGHT, this.night);
      this.cloud.lerp(scratchA, wet * 0.82);
      this.waterDeep.lerp(RAIN_WATER_DEEP, wet * 0.45);
      this.waterShallow.lerp(RAIN_WATER_SHALLOW, wet * 0.38);
      this.sunIntensity *= 1 - wet * 0.78;
      this.moonIntensity *= 1 - wet * 0.5;
      this.hemiIntensity *= 1 - wet * 0.24;
      this.ambientIntensity *= 1 + wet * 0.22;
      this.exposure *= 1 - wet * 0.05;
      this.starAlpha *= 1 - wet * 0.92;
      this.sunGlow *= 1 - wet * 0.85;
    }

    this.fogDensity = 0.0048 + wet * 0.0175;
    return this;
  }
}

export const formatClock = (hour: number): string => {
  const totalMinutes = Math.round(wrap24(hour) * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const phaseForHour = (hour: number): string => {
  const h = wrap24(hour);
  if (h < 4.6) return 'Night';
  if (h < 6.5) return 'Dawn';
  if (h < 10.5) return 'Morning';
  if (h < 13.5) return 'Midday';
  if (h < 17.2) return 'Afternoon';
  if (h < 18.8) return 'Golden hour';
  if (h < 20.4) return 'Dusk';
  return 'Night';
};

export const windLabel = (wind: number): string => {
  if (wind < 0.02) return 'Still';
  if (wind < 0.32) return 'Light breeze';
  if (wind < 0.62) return 'Breezy';
  if (wind < 0.85) return 'Fresh';
  return 'Gusty';
};
