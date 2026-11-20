import { Color, Vector3 } from 'three'
import { clamp, lerp } from '../util/math'
import { TAU } from '../util/math'

interface SkyKey {
  t: number
  top: number
  horizon: number
  bottom: number
  fog: number
  sun: number
  sunIntensity: number
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  ambient: number
  moonIntensity: number
  stars: number
  exposure: number
}

/** A continuous 24-hour grade. Each entry is a painted "frame" of the sky. */
const KEYS: SkyKey[] = [
  { t: 0, top: 0x101a35, horizon: 0x1e2c4b, bottom: 0x33415e, fog: 0x263550, sun: 0x9fb6e0, sunIntensity: 0.06, hemiSky: 0x506490, hemiGround: 0x273046, hemiIntensity: 0.4, ambient: 0.2, moonIntensity: 0.55, stars: 1, exposure: 1.16 },
  { t: 4.5, top: 0x13203c, horizon: 0x2b3959, bottom: 0x43506c, fog: 0x303e59, sun: 0xa8b9e2, sunIntensity: 0.1, hemiSky: 0x5b6f98, hemiGround: 0x2e364a, hemiIntensity: 0.45, ambient: 0.23, moonIntensity: 0.45, stars: 0.9, exposure: 1.12 },
  { t: 6.2, top: 0x445d84, horizon: 0xce927c, bottom: 0xe2b18e, fog: 0xa18b8d, sun: 0xffb880, sunIntensity: 0.75, hemiSky: 0x9ca9be, hemiGround: 0x7c6652, hemiIntensity: 0.72, ambient: 0.36, moonIntensity: 0.12, stars: 0.2, exposure: 1.03 },
  { t: 8.5, top: 0x6caacf, horizon: 0xe8d9bf, bottom: 0xeee3cd, fog: 0xcfd9d3, sun: 0xfff1d6, sunIntensity: 1.6, hemiSky: 0xbcd9e8, hemiGround: 0x908368, hemiIntensity: 1.02, ambient: 0.46, moonIntensity: 0, stars: 0, exposure: 0.96 },
  { t: 12, top: 0x62a6d4, horizon: 0xd7e6e3, bottom: 0xe8e8d8, fog: 0xcadcd9, sun: 0xfff7e6, sunIntensity: 1.85, hemiSky: 0xc8e3f0, hemiGround: 0x948c6e, hemiIntensity: 1.15, ambient: 0.5, moonIntensity: 0, stars: 0, exposure: 0.93 },
  { t: 16, top: 0x6d9ec2, horizon: 0xe9dabd, bottom: 0xe0d8c1, fog: 0xced5c9, sun: 0xffe7bc, sunIntensity: 1.5, hemiSky: 0xb9d3e0, hemiGround: 0x908466, hemiIntensity: 1.0, ambient: 0.43, moonIntensity: 0, stars: 0, exposure: 0.98 },
  { t: 18.5, top: 0x5a6d9d, horizon: 0xf2a970, bottom: 0xe5b68f, fog: 0xd4ab9c, sun: 0xffa96a, sunIntensity: 1.15, hemiSky: 0xb4a8b6, hemiGround: 0x9d6d52, hemiIntensity: 0.86, ambient: 0.41, moonIntensity: 0.04, stars: 0.1, exposure: 1.0 },
  { t: 20.2, top: 0x2d3d65, horizon: 0xa06f7d, bottom: 0x7e6973, fog: 0x73677a, sun: 0xd99077, sunIntensity: 0.25, hemiSky: 0x7685a7, hemiGround: 0x4c485b, hemiIntensity: 0.62, ambient: 0.31, moonIntensity: 0.28, stars: 0.6, exposure: 1.08 },
  { t: 22, top: 0x172545, horizon: 0x273857, bottom: 0x3d4a68, fog: 0x2b3a55, sun: 0xa6b8e0, sunIntensity: 0.08, hemiSky: 0x586c96, hemiGround: 0x2b3448, hemiIntensity: 0.44, ambient: 0.22, moonIntensity: 0.5, stars: 0.94, exposure: 1.14 },
  { t: 24, top: 0x101a35, horizon: 0x1e2c4b, bottom: 0x33415e, fog: 0x263550, sun: 0x9fb6e0, sunIntensity: 0.06, hemiSky: 0x506490, hemiGround: 0x273046, hemiIntensity: 0.4, ambient: 0.2, moonIntensity: 0.55, stars: 1, exposure: 1.16 },
]

export interface EnvironmentSample {
  top: Color
  horizon: Color
  bottom: Color
  fog: Color
  sunColor: Color
  hemiSky: Color
  hemiGround: Color
  sunIntensity: number
  hemiIntensity: number
  ambient: number
  moonIntensity: number
  stars: number
  exposure: number
  sunDirection: Vector3
  moonDirection: Vector3
  solarElevation: number
  night: number
}

const c = (value: number) => new Color(value)

function sampleKeys(hour: number, rain: number): EnvironmentSample {
  const time = clamp(hour, 0, 24)
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].t < time) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = clamp((time - a.t) / (b.t - a.t), 0, 1)
  // Smooth the transition so slider drags never show a hard seam between keys.
  const eased = t * t * (3 - 2 * t)
  const mix = (x: number, y: number) => lerp(x, y, eased)
  const mixColor = (x: number, y: number) => c(x).lerp(c(y), eased)

  const top = mixColor(a.top, b.top)
  const horizon = mixColor(a.horizon, b.horizon)
  const bottom = mixColor(a.bottom, b.bottom)
  const fog = mixColor(a.fog, b.fog)
  const sunColor = mixColor(a.sun, b.sun)
  const hemiSky = mixColor(a.hemiSky, b.hemiSky)
  const hemiGround = mixColor(a.hemiGround, b.hemiGround)

  // Rain washes the palette toward cool grey and takes the punch out of the sun.
  const wash = rain * 0.42
  const grey = c(0x83969d)
  top.lerp(grey, wash * 0.75)
  horizon.lerp(grey, wash)
  bottom.lerp(grey, wash * 0.85)
  fog.lerp(c(0x7d8f99), rain * 0.55)
  hemiSky.lerp(grey, wash * 0.5)

  const elevation = Math.sin(((time - 6) / 12) * Math.PI)
  const azimuth = ((time - 6) / 12) * Math.PI * 0.8 + 0.4
  const sunDirection = new Vector3(
    Math.cos(azimuth) * 0.85,
    clamp(elevation, -0.22, 1) * 1.25 + 0.08,
    Math.sin(azimuth) * 0.85,
  ).normalize()
  const moonDirection = new Vector3(-sunDirection.x * 0.75, 0.68, -sunDirection.z * 0.75).normalize()

  return {
    top,
    horizon,
    bottom,
    fog,
    sunColor,
    hemiSky,
    hemiGround,
    sunIntensity: mix(a.sunIntensity, b.sunIntensity) * (1 - rain * 0.62),
    hemiIntensity: mix(a.hemiIntensity, b.hemiIntensity) * (1 - rain * 0.12) + rain * 0.08,
    ambient: mix(a.ambient, b.ambient) * (1 - rain * 0.08) + rain * 0.06,
    moonIntensity: mix(a.moonIntensity, b.moonIntensity) * (1 - rain * 0.7),
    stars: mix(a.stars, b.stars) * (1 - rain),
    exposure: mix(a.exposure, b.exposure) - rain * 0.05,
    sunDirection,
    moonDirection,
    solarElevation: elevation,
    night: clamp(0.5 - elevation * 1.1, 0, 1),
  }
}

/** Exposed for the sky shader's subtle daylight shimmer. */
export function dayPhase(time: number): number {
  return Math.sin(((clamp(time, 0, 24) - 5.5) / 13) * Math.PI)
}

export { sampleKeys as sampleEnvironment, TAU }
