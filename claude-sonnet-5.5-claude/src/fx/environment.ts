import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../util/math';

/**
 * Everything the sky and the lights need, as a pure function of the (smoothed)
 * hour of day and the (smoothed) rain amount. There is no stored "mode": noon,
 * sunset and midnight are just points along a continuous curve, which is why
 * dragging the time slider never produces a jump.
 */

export interface Environment {
  hour: number;
  rain: number;

  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  /** Sine of the sun's elevation: +1 overhead, 0 at the horizon, negative below it. */
  sunElevation: number;

  /** 0 at night, 1 in full daylight. */
  daylight: number;
  /** 1 at night, 0 by day. */
  night: number;
  /** Peaks around sunrise and sunset. */
  twilight: number;

  skyTop: THREE.Color;
  skyMid: THREE.Color;
  skyBottom: THREE.Color;

  /** Light that casts the shadows: the sun by day, the moon at night. */
  keyDir: THREE.Vector3;
  keyColor: THREE.Color;
  keyIntensity: number;
  keyShadow: number;

  fillColor: THREE.Color;
  fillIntensity: number;

  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;

  exposure: number;

  cloudLit: THREE.Color;
  cloudShade: THREE.Color;

  starVisibility: number;
  moonVisibility: number;
  sunVisibility: number;
  sunColor: THREE.Color;
}

interface Key {
  h: number;
  top: THREE.Color;
  mid: THREE.Color;
  bottom: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  cloud: THREE.Color;
}

const c = (hex: string): THREE.Color => new THREE.Color(hex);

const KEYS: Key[] = [
  { h: 0, top: c('#0c1636'), mid: c('#1a2c5e'), bottom: c('#31467f'), hemiSky: c('#5a73b4'), hemiGround: c('#2c3856'), cloud: c('#7c8fc2') },
  { h: 4.5, top: c('#101d42'), mid: c('#243a6c'), bottom: c('#425792'), hemiSky: c('#5d77b8'), hemiGround: c('#2f3b5a'), cloud: c('#8497c8') },
  { h: 5.5, top: c('#314a82'), mid: c('#8f82b4'), bottom: c('#f3a98b'), hemiSky: c('#9aa6d4'), hemiGround: c('#6a5d63'), cloud: c('#f5b9a2') },
  { h: 6.5, top: c('#5088c8'), mid: c('#f1c8a8'), bottom: c('#ffdca8'), hemiSky: c('#b4c9ea'), hemiGround: c('#8a8460'), cloud: c('#ffe7d0') },
  { h: 8.5, top: c('#5aa3e4'), mid: c('#a9d6f2'), bottom: c('#e9f3ee'), hemiSky: c('#c3dffa'), hemiGround: c('#93a06a'), cloud: c('#ffffff') },
  { h: 12, top: c('#3f90de'), mid: c('#8fcaf0'), bottom: c('#d9edf5'), hemiSky: c('#c2e1ff'), hemiGround: c('#96a56c'), cloud: c('#ffffff') },
  { h: 16, top: c('#5497dc'), mid: c('#a4d0ec'), bottom: c('#f4ecd9'), hemiSky: c('#c8e0f6'), hemiGround: c('#9c9c64'), cloud: c('#fff9ee') },
  { h: 17.6, top: c('#5d82c8'), mid: c('#f1c597'), bottom: c('#ffd7a0'), hemiSky: c('#d8c9c2'), hemiGround: c('#9a8556'), cloud: c('#ffe2c2') },
  { h: 18.3, top: c('#44509c'), mid: c('#e68f88'), bottom: c('#ffad68'), hemiSky: c('#b49cc4'), hemiGround: c('#806b5c'), cloud: c('#ffb49a') },
  { h: 19.1, top: c('#232f6c'), mid: c('#6e5c9e'), bottom: c('#e47d7c'), hemiSky: c('#6f72ac'), hemiGround: c('#4d4764'), cloud: c('#c98ba2') },
  { h: 19.9, top: c('#151f50'), mid: c('#30427f'), bottom: c('#5a67a0'), hemiSky: c('#586fb0'), hemiGround: c('#2b3452'), cloud: c('#8f9bc8') },
  { h: 21.5, top: c('#0c1636'), mid: c('#1a2c5e'), bottom: c('#31467f'), hemiSky: c('#5a73b4'), hemiGround: c('#2c3856'), cloud: c('#7c8fc2') },
  { h: 24, top: c('#0c1636'), mid: c('#1a2c5e'), bottom: c('#31467f'), hemiSky: c('#5a73b4'), hemiGround: c('#2c3856'), cloud: c('#7c8fc2') },
];

// The sun's path: rises in the east at 06:00, peaks in the south, sets in the west at 18:00.
const NOON_ELEVATION = 1.15;
const SUN_PATH_UP = new THREE.Vector3(0, Math.sin(NOON_ELEVATION), Math.cos(NOON_ELEVATION));

const RAIN_TOP = c('#56636f');
const RAIN_MID = c('#7a8793');
const RAIN_BOTTOM = c('#a3adb4');
const RAIN_CLOUD = c('#8a95a0');

const WARM_SUN = c('#ffe9c6');
const LOW_SUN = c('#ff8f4a');
const MOON_LIGHT = c('#9db4ff');
const NEUTRAL_RAIN_LIGHT = c('#dbe3ee');

const WHITE = new THREE.Color(1, 1, 1);
const tmpA = new THREE.Color();

function sampleKeys(hour: number, out: Omit<Key, 'h'>): void {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smoothstep(0, 1, (hour - a.h) / (b.h - a.h));
  out.top.copy(a.top).lerp(b.top, t);
  out.mid.copy(a.mid).lerp(b.mid, t);
  out.bottom.copy(a.bottom).lerp(b.bottom, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.cloud.copy(a.cloud).lerp(b.cloud, t);
}

export function createEnvironment(): Environment {
  return {
    hour: 0,
    rain: 0,
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    sunElevation: 0,
    daylight: 0,
    night: 1,
    twilight: 0,
    skyTop: new THREE.Color(),
    skyMid: new THREE.Color(),
    skyBottom: new THREE.Color(),
    keyDir: new THREE.Vector3(),
    keyColor: new THREE.Color(),
    keyIntensity: 0,
    keyShadow: 1,
    fillColor: new THREE.Color(),
    fillIntensity: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 1,
    exposure: 1,
    cloudLit: new THREE.Color(),
    cloudShade: new THREE.Color(),
    starVisibility: 0,
    moonVisibility: 0,
    sunVisibility: 0,
    sunColor: new THREE.Color(),
  };
}

const scratch = {
  top: new THREE.Color(),
  mid: new THREE.Color(),
  bottom: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  cloud: new THREE.Color(),
};

export function computeEnvironment(hourIn: number, rainIn: number, env: Environment): Environment {
  const hour = clamp(hourIn, 0, 24);
  const rain = clamp(rainIn);
  env.hour = hour;
  env.rain = rain;

  // --- Where the sun and moon are -------------------------------------------
  const a = ((hour - 6) / 12) * Math.PI;
  env.sunDir
    .set(Math.cos(a), 0, 0)
    .addScaledVector(SUN_PATH_UP, Math.sin(a))
    .normalize();
  env.moonDir.copy(env.sunDir).negate();
  const e = env.sunDir.y;
  env.sunElevation = e;

  env.daylight = smoothstep(-0.08, 0.3, e);
  env.night = 1 - smoothstep(-0.26, 0.0, e);
  env.twilight = smoothstep(-0.2, 0.0, e) * (1 - smoothstep(0.0, 0.34, e));

  // --- Sky colours: keyframes by hour, washed grey by rain ---------------------
  sampleKeys(hour, scratch);
  const grey = lerp(0.3, 1, env.daylight);
  const wash = 0.86 * rain;
  env.skyTop.copy(scratch.top).lerp(tmpA.copy(RAIN_TOP).multiplyScalar(grey), wash);
  env.skyMid.copy(scratch.mid).lerp(tmpA.copy(RAIN_MID).multiplyScalar(grey), wash);
  env.skyBottom.copy(scratch.bottom).lerp(tmpA.copy(RAIN_BOTTOM).multiplyScalar(grey), wash);

  // --- Key light: the sun until it is gone, then the moon ----------------------
  const sunFade = smoothstep(-0.22, 0.16, e);
  const moonElevation = -e;
  const moonFade = smoothstep(0.22, 0.55, moonElevation);
  const sunUp = e > -0.22;
  // Near the horizon the key light is held a little higher, so sunset still reaches the grass.
  const keyElev = sunUp ? Math.max(e, 0.2) : Math.max(moonElevation, 0.28);
  const horizontal = sunUp ? env.sunDir : env.moonDir;
  const hLen = Math.hypot(horizontal.x, horizontal.z) || 1;
  const k = Math.sqrt(Math.max(0, 1 - keyElev * keyElev)) / hLen;
  env.keyDir.set(horizontal.x * k, keyElev, horizontal.z * k);

  env.sunColor.copy(LOW_SUN).lerp(WARM_SUN, smoothstep(0.04, 0.5, e));
  if (sunUp) {
    env.keyColor.copy(env.sunColor);
    env.keyIntensity = 3.4 * Math.pow(sunFade, 0.8);
  } else {
    env.keyColor.copy(MOON_LIGHT);
    env.keyIntensity = 1.25 * moonFade;
  }
  env.keyColor.lerp(NEUTRAL_RAIN_LIGHT, 0.65 * rain);
  env.keyIntensity *= 1 - 0.72 * rain;
  env.keyShadow = sunUp ? 1 - 0.78 * rain : 0.75 * (1 - 0.7 * rain);

  // --- Ambient light: hemisphere from the sky, plus a cool fill ------------------
  env.hemiSky.copy(scratch.hemiSky).lerp(tmpA.copy(RAIN_MID).multiplyScalar(lerp(0.55, 1.1, env.daylight)), 0.6 * rain);
  env.hemiGround.copy(scratch.hemiGround).multiplyScalar(1 - 0.15 * rain);
  env.hemiIntensity = lerp(0.9, 0.98, env.daylight) * (1 + 0.28 * rain);

  env.fillColor.copy(env.skyMid).lerp(WHITE, 0.35);
  env.fillIntensity = lerp(0.42, 0.3, env.daylight) * (1 + 0.2 * rain);

  env.exposure = lerp(1.18, 1, env.daylight) * (1 - 0.1 * rain);

  // --- Clouds -------------------------------------------------------------------
  env.cloudLit.copy(scratch.cloud).lerp(tmpA.copy(RAIN_CLOUD).multiplyScalar(lerp(0.4, 1, env.daylight)), 0.88 * rain);
  env.cloudShade.copy(env.cloudLit).multiplyScalar(0.62).lerp(env.skyMid, 0.2);

  // --- Celestial bodies ---------------------------------------------------------
  env.starVisibility = smoothstep(0.35, 0.95, env.night) * (1 - rain);
  env.moonVisibility = smoothstep(-0.05, 0.12, moonElevation) * (1 - 0.88 * rain) * smoothstep(0.1, 0.6, env.night);
  env.sunVisibility = smoothstep(-0.12, 0.02, e) * (1 - 0.95 * rain);
  return env;
}
