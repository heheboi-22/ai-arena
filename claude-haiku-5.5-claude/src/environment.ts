import { Color, Vector3 } from 'three';
import { lerp, smoothstep } from './util/math';

// Keyframed palette for one day. Hour 24 repeats hour 0 so the sampler never
// has to wrap. Colours are sRGB hex values; Three converts them on `set`.
interface RawKey {
  hour: number;
  sun: number;
  sunI: number;
  moon: number;
  moonI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  zenith: number;
  horizon: number;
  cloud: number;
  tint: number;
}

const RAW_KEYS: RawKey[] = [
  { hour: 0, sun: 0xffe2b8, sunI: 0, moon: 0xaec4ff, moonI: 1.0, hemiSky: 0x46598f, hemiGround: 0x3b4566, hemiI: 1.0, zenith: 0x13254a, horizon: 0x30437a, cloud: 0x4a5778, tint: 0x8c9ccb },
  { hour: 4.5, sun: 0xffe2b8, sunI: 0, moon: 0xaec4ff, moonI: 1.0, hemiSky: 0x4c6396, hemiGround: 0x3e4869, hemiI: 1.0, zenith: 0x17294e, horizon: 0x36497f, cloud: 0x52608a, tint: 0x9aa8d4 },
  { hour: 5.5, sun: 0xffb98a, sunI: 0.5, moon: 0xaec4ff, moonI: 0.45, hemiSky: 0x8c9fcb, hemiGround: 0x5a5366, hemiI: 0.95, zenith: 0x4a6696, horizon: 0xf2a88f, cloud: 0xa597b3, tint: 0xa8b4dc },
  { hour: 6.8, sun: 0xffb27a, sunI: 1.7, moon: 0xaec4ff, moonI: 0, hemiSky: 0xd0dbef, hemiGround: 0x86705a, hemiI: 1.0, zenith: 0x6f98c7, horizon: 0xffc69b, cloud: 0xf3d8c3, tint: 0xd5dcea },
  { hour: 8.5, sun: 0xfff0d6, sunI: 2.3, moon: 0xaec4ff, moonI: 0, hemiSky: 0xdaeaff, hemiGround: 0x96866a, hemiI: 1.05, zenith: 0x7db3df, horizon: 0xd7ebf4, cloud: 0xfbf5ea, tint: 0xffffff },
  { hour: 12.5, sun: 0xfff4e3, sunI: 2.7, moon: 0xaec4ff, moonI: 0, hemiSky: 0xe2f0ff, hemiGround: 0xa29374, hemiI: 1.1, zenith: 0x72aadb, horizon: 0xd3eaf4, cloud: 0xffffff, tint: 0xffffff },
  { hour: 15.5, sun: 0xffe9c2, sunI: 2.4, moon: 0xaec4ff, moonI: 0, hemiSky: 0xdce9f2, hemiGround: 0x948362, hemiI: 1.05, zenith: 0x7aaed6, horizon: 0xf0e8d6, cloud: 0xfdf8ef, tint: 0xffffff },
  { hour: 17.4, sun: 0xffc27a, sunI: 1.9, moon: 0xaec4ff, moonI: 0, hemiSky: 0xf1d4b5, hemiGround: 0x88735a, hemiI: 1.0, zenith: 0x7a8fc2, horizon: 0xffc487, cloud: 0xf6d7b7, tint: 0xfff1e0 },
  { hour: 18.6, sun: 0xff9a5c, sunI: 1.0, moon: 0xaec4ff, moonI: 0.25, hemiSky: 0xd9b6b2, hemiGround: 0x75605a, hemiI: 0.9, zenith: 0x6c6fae, horizon: 0xff9c76, cloud: 0xeca08e, tint: 0xefd2c4 },
  { hour: 19.8, sun: 0xff8c6e, sunI: 0.2, moon: 0xaec4ff, moonI: 0.5, hemiSky: 0x7b88b4, hemiGround: 0x4a4a5e, hemiI: 0.75, zenith: 0x2e3a70, horizon: 0xc9807f, cloud: 0x6c6592, tint: 0xa0a8cc },
  { hour: 21, sun: 0xffe2b8, sunI: 0, moon: 0xaec4ff, moonI: 1.0, hemiSky: 0x46598f, hemiGround: 0x3b4566, hemiI: 1.0, zenith: 0x13254a, horizon: 0x30437a, cloud: 0x4a5778, tint: 0x8c9ccb },
  { hour: 24, sun: 0xffe2b8, sunI: 0, moon: 0xaec4ff, moonI: 1.0, hemiSky: 0x46598f, hemiGround: 0x3b4566, hemiI: 1.0, zenith: 0x13254a, horizon: 0x30437a, cloud: 0x4a5778, tint: 0x8c9ccb },
];

interface Key {
  hour: number;
  sun: Color;
  sunI: number;
  moon: Color;
  moonI: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiI: number;
  zenith: Color;
  horizon: Color;
  cloud: Color;
  tint: Color;
}

const KEYS: Key[] = RAW_KEYS.map((k) => ({
  hour: k.hour,
  sun: new Color(k.sun),
  sunI: k.sunI,
  moon: new Color(k.moon),
  moonI: k.moonI,
  hemiSky: new Color(k.hemiSky),
  hemiGround: new Color(k.hemiGround),
  hemiI: k.hemiI,
  zenith: new Color(k.zenith),
  horizon: new Color(k.horizon),
  cloud: new Color(k.cloud),
  tint: new Color(k.tint),
}));

export interface Environment {
  sunDir: Vector3;
  moonDir: Vector3;
  sunColor: Color;
  sunIntensity: number;
  moonColor: Color;
  moonIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  zenith: Color;
  horizon: Color;
  cloud: Color;
  /** Multiplies the grass colour: neutral by day, blue-shifted at night. */
  tint: Color;
  /** 0 at night, 1 in full daylight. Drives the stars, windows and fireflies. */
  day: number;
  night: number;
}

export function createEnvironment(): Environment {
  return {
    sunDir: new Vector3(0, 1, 0),
    moonDir: new Vector3(0, -1, 0),
    sunColor: new Color(),
    sunIntensity: 0,
    moonColor: new Color(),
    moonIntensity: 0,
    hemiSky: new Color(),
    hemiGround: new Color(),
    hemiIntensity: 1,
    zenith: new Color(),
    horizon: new Color(),
    cloud: new Color(),
    tint: new Color(),
    day: 1,
    night: 0,
  };
}

/**
 * Samples the day palette and sun/moon directions for an hour in [0, 24).
 * Writes into `out` so the render loop never allocates.
 */
export function sampleEnvironment(hour: number, out: Environment): Environment {
  const h = ((hour % 24) + 24) % 24;

  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1].hour) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.hour) / (b.hour - a.hour);

  // The sun travels a tilted arc: rising due east at 06:00, overhead at noon,
  // setting in the west at 18:00. The z tilt keeps shadows falling across the
  // island instead of straight back, which reads better from the default camera.
  const angle = ((h - 6) / 24) * Math.PI * 2;
  out.sunDir.set(Math.cos(angle) * 0.92, Math.sin(angle), 0.42).normalize();
  out.moonDir.copy(out.sunDir).negate();

  out.day = smoothstep(-0.1, 0.12, out.sunDir.y);
  out.night = 1 - out.day;

  // Direct sunlight lingers a little past the horizon so the golden hour has
  // warm side-light. It still fades out before the sun can shine from below.
  const sunGate = smoothstep(-0.16, 0.05, out.sunDir.y);
  out.sunIntensity = lerp(a.sunI, b.sunI, t) * sunGate;
  out.moonIntensity = lerp(a.moonI, b.moonI, t) * out.night;

  out.sunColor.copy(a.sun).lerp(b.sun, t);
  out.moonColor.copy(a.moon).lerp(b.moon, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.hemiIntensity = lerp(a.hemiI, b.hemiI, t);
  out.zenith.copy(a.zenith).lerp(b.zenith, t);
  out.horizon.copy(a.horizon).lerp(b.horizon, t);
  out.cloud.copy(a.cloud).lerp(b.cloud, t);
  out.tint.copy(a.tint).lerp(b.tint, t);

  return out;
}
