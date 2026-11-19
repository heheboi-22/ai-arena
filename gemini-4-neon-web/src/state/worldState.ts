export type WeatherMode = "clear" | "rain";

export interface WorldState {
  /** Minutes since midnight, range [0, 1440]. Default 16:00 = 960. */
  timeMinutes: number;
  weather: WeatherMode;
  /** Wind strength normalized in [0, 1]. Default 0.30 = 30%. */
  windStrength: number;
  houseLightsOn: boolean;
}

export const DEFAULT_WORLD_STATE: Readonly<WorldState> = Object.freeze({
  timeMinutes: 16 * 60, // 16:00
  weather: "clear",
  windStrength: 0.3, // 30%
  houseLightsOn: false,
});

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface AtmosphereSnapshot {
  hours: number;
  sunElevation: number; // -1..1
  daylight: number; // 0..1
  twilight: number; // 0..1 (peaks around sunrise/sunset)
  nightFactor: number; // 0..1
  sunAzimuthRad: number;
  sunDirection: { x: number; y: number; z: number };
  moonDirection: { x: number; y: number; z: number };
  skyZenith: RGB;
  skyHorizon: RGB;
  skyNadir: RGB;
  fogColor: RGB;
  sunLightColor: RGB;
  sunLightIntensity: number;
  hemiSkyColor: RGB;
  hemiGroundColor: RGB;
  hemiIntensity: number;
  rimColor: RGB;
  rimIntensity: number;
  cloudColor: RGB;
  waterDeepColor: RGB;
  waterShallowColor: RGB;
  starVisibility: number; // 0..1
  moonVisibility: number; // 0..1
  windowProminence: number; // 0.35..1.65 (stronger visual glow at dusk/night)
  exposure: number;
  environmentIntensity: number;
  uiTheme: "light" | "dark";
}

export interface WindDerived {
  strength: number; // 0..1
  /** Unit XZ direction vector of the shared breeze (blowing NW -> SE). */
  dirX: number;
  dirZ: number;
  /** Windmill angular speed in rad/s (0 when wind === 0). */
  windmillRadPerSec: number;
  /** Tree sway amplitude in radians (0 when wind === 0). */
  treeSwayRadians: number;
  /** Tree sway primary frequency in rad/s. */
  treeSwayFrequency: number;
  /** Cloud drift speed in world units/sec (0 when wind === 0). */
  cloudSpeed: number;
  /** Rain horizontal drift in world units/sec (0 when wind === 0, vertical fall remains). */
  rainVelocityX: number;
  rainVelocityY: number;
  rainVelocityZ: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function hexToRgb(hex: number): RGB {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

export function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const k = clamp(t, 0, 1);
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

export function formatTimeMinutes(timeMinutes: number): string {
  const wrapped = ((Math.round(timeMinutes) % 1440) + 1440) % 1440;
  // Preserve 24:00 only when exact upper bound is chosen
  if (Math.round(timeMinutes) >= 1440) {
    return "24:00";
  }
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getTimePhaseLabel(timeMinutes: number): string {
  const hours = clamp(timeMinutes, 0, 1440) / 60;
  if (hours < 5 || hours >= 21) return "Night";
  if (hours < 7.25) return "Dawn";
  if (hours < 11.5) return "Morning";
  if (hours < 15.25) return "Midday";
  if (hours < 17.5) return "Afternoon";
  if (hours < 19.75) return "Sunset";
  return "Dusk";
}

interface ColorStop {
  hour: number;
  zenith: RGB;
  horizon: RGB;
  nadir: RGB;
  sun: RGB;
  hemiSky: RGB;
  hemiGround: RGB;
  cloud: RGB;
  waterDeep: RGB;
  waterShallow: RGB;
}

const SKY_STOPS: ColorStop[] = [
  {
    // 00:00 Midnight — atmospheric deep indigo, readable silver-blue bounce
    hour: 0,
    zenith: hexToRgb(0x0d172c),
    horizon: hexToRgb(0x1f3154),
    nadir: hexToRgb(0x0c1324),
    sun: hexToRgb(0x8eb4e6),
    hemiSky: hexToRgb(0x4a699e),
    hemiGround: hexToRgb(0x212c3c),
    cloud: hexToRgb(0x4a5d80),
    waterDeep: hexToRgb(0x1d3452),
    waterShallow: hexToRgb(0x325173),
  },
  {
    // 05:00 Pre-dawn violet blue
    hour: 5,
    zenith: hexToRgb(0x19274a),
    horizon: hexToRgb(0x4d4c6e),
    nadir: hexToRgb(0x182138),
    sun: hexToRgb(0xb3a5d1),
    hemiSky: hexToRgb(0x6978a6),
    hemiGround: hexToRgb(0x2d3240),
    cloud: hexToRgb(0x7c7b96),
    waterDeep: hexToRgb(0x263f5e),
    waterShallow: hexToRgb(0x43627f),
  },
  {
    // 06:30 Sunrise peach-gold
    hour: 6.5,
    zenith: hexToRgb(0x5279a8),
    horizon: hexToRgb(0xf0b58d),
    nadir: hexToRgb(0x6f7e91),
    sun: hexToRgb(0xffc98b),
    hemiSky: hexToRgb(0xd4c7d6),
    hemiGround: hexToRgb(0x635547),
    cloud: hexToRgb(0xfbe2cc),
    waterDeep: hexToRgb(0x436d8a),
    waterShallow: hexToRgb(0x729cad),
  },
  {
    // 09:00 Crisp morning
    hour: 9,
    zenith: hexToRgb(0x689fd1),
    horizon: hexToRgb(0xdbeaf2),
    nadir: hexToRgb(0x9fb8c9),
    sun: hexToRgb(0xfff1d6),
    hemiSky: hexToRgb(0xc2dff5),
    hemiGround: hexToRgb(0x736c58),
    cloud: hexToRgb(0xf9f7f2),
    waterDeep: hexToRgb(0x4c829e),
    waterShallow: hexToRgb(0x7ab0bf),
  },
  {
    // 13:00 Bright gentle midday
    hour: 13,
    zenith: hexToRgb(0x5c97cf),
    horizon: hexToRgb(0xd8ebf5),
    nadir: hexToRgb(0xa4bed1),
    sun: hexToRgb(0xfff7e6),
    hemiSky: hexToRgb(0xcce4f7),
    hemiGround: hexToRgb(0x7a745d),
    cloud: hexToRgb(0xfdfbf7),
    waterDeep: hexToRgb(0x4882a1),
    waterShallow: hexToRgb(0x7cb5c4),
  },
  {
    // 16:00 Default — Crisp azure upper sky warming into golden late-afternoon horizon
    hour: 16,
    zenith: hexToRgb(0x4b84bd),
    horizon: hexToRgb(0xf1dec2),
    nadir: hexToRgb(0x8fa4b8),
    sun: hexToRgb(0xffdfab),
    hemiSky: hexToRgb(0xc7dff5),
    hemiGround: hexToRgb(0x7c6e58),
    cloud: hexToRgb(0xfcf6eb),
    waterDeep: hexToRgb(0x467b99),
    waterShallow: hexToRgb(0x77abb9),
  },
  {
    // 18:30 Golden Sunset — rich amber & coral horizon
    hour: 18.5,
    zenith: hexToRgb(0x3a4d7d),
    horizon: hexToRgb(0xeb9268),
    nadir: hexToRgb(0x4d435c),
    sun: hexToRgb(0xff9c5c),
    hemiSky: hexToRgb(0xc79282),
    hemiGround: hexToRgb(0x5c473e),
    cloud: hexToRgb(0xf4baa0),
    waterDeep: hexToRgb(0x3c5875),
    waterShallow: hexToRgb(0x757f94),
  },
  {
    // 20:00 Blue hour twilight
    hour: 20,
    zenith: hexToRgb(0x182545),
    horizon: hexToRgb(0x4c4a6b),
    nadir: hexToRgb(0x161d33),
    sun: hexToRgb(0x9cb3de),
    hemiSky: hexToRgb(0x5b72a3),
    hemiGround: hexToRgb(0x283040),
    cloud: hexToRgb(0x646e8f),
    waterDeep: hexToRgb(0x243b59),
    waterShallow: hexToRgb(0x3d5978),
  },
  {
    // 24:00 Wrap cleanly back to 00:00
    hour: 24,
    zenith: hexToRgb(0x0d172c),
    horizon: hexToRgb(0x1f3154),
    nadir: hexToRgb(0x0c1324),
    sun: hexToRgb(0x8eb4e6),
    hemiSky: hexToRgb(0x4a699e),
    hemiGround: hexToRgb(0x212c3c),
    cloud: hexToRgb(0x4a5d80),
    waterDeep: hexToRgb(0x1d3452),
    waterShallow: hexToRgb(0x325173),
  },
];

function sampleSkyStops(hours: number): ColorStop {
  const h = clamp(hours, 0, 24);
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const a = SKY_STOPS[i];
    const b = SKY_STOPS[i + 1];
    if (h >= a.hour && h <= b.hour) {
      const span = b.hour - a.hour || 1;
      const raw = (h - a.hour) / span;
      const t = raw * raw * (3 - 2 * raw); // smoothstep for silky transitions
      return {
        hour: h,
        zenith: lerpRgb(a.zenith, b.zenith, t),
        horizon: lerpRgb(a.horizon, b.horizon, t),
        nadir: lerpRgb(a.nadir, b.nadir, t),
        sun: lerpRgb(a.sun, b.sun, t),
        hemiSky: lerpRgb(a.hemiSky, b.hemiSky, t),
        hemiGround: lerpRgb(a.hemiGround, b.hemiGround, t),
        cloud: lerpRgb(a.cloud, b.cloud, t),
        waterDeep: lerpRgb(a.waterDeep, b.waterDeep, t),
        waterShallow: lerpRgb(a.waterShallow, b.waterShallow, t),
      };
    }
  }
  return SKY_STOPS[0];
}

export function computeAtmosphere(
  timeMinutes: number,
  rainFactor: number
): AtmosphereSnapshot {
  const hours = clamp(timeMinutes, 0, 1440) / 60;
  const rain = clamp(rainFactor, 0, 1);

  // Sun arc: rises around 06:00, peaks at 12:30, sets around 19:00
  const sunAngle = ((hours - 6.25) / 24) * Math.PI * 2;
  const sunElevation = Math.sin(sunAngle); // -1 at ~00:15, +1 at ~12:15
  const sunAzimuthRad = ((hours - 12.25) / 12) * Math.PI * 0.72 + 0.55;

  const elevAngle = sunElevation * Math.PI * 0.44;
  const cosElev = Math.cos(elevAngle);
  const sunDirection = {
    x: Math.sin(sunAzimuthRad) * cosElev,
    y: Math.sin(elevAngle),
    z: Math.cos(sunAzimuthRad) * cosElev * 0.85,
  };

  // Moon travels roughly opposite the sun, kept above horizon at night for flattering shadows
  const moonElev = clamp(-sunElevation * 0.72 + 0.22, 0.24, 0.82);
  const moonAz = sunAzimuthRad + Math.PI * 0.85;
  const moonCos = Math.sqrt(Math.max(0.01, 1 - moonElev * moonElev));
  const moonDirection = {
    x: Math.sin(moonAz) * moonCos,
    y: moonElev,
    z: Math.cos(moonAz) * moonCos,
  };

  const daylight = smoothstep(-0.14, 0.24, sunElevation);
  const nightFactor = 1 - daylight;
  const sunrisePeak = Math.exp(-Math.pow((hours - 6.5) / 1.35, 2));
  const sunsetPeak = Math.exp(-Math.pow((hours - 18.45) / 1.45, 2));
  const twilight = clamp(Math.max(sunrisePeak, sunsetPeak), 0, 1);

  const base = sampleSkyStops(hours);

  // Rain desaturates & cools sky, darkens clouds, softens sun
  const rainZenith = lerpRgb(hexToRgb(0x162133), hexToRgb(0x4c5d6e), daylight);
  const rainHorizon = lerpRgb(hexToRgb(0x26354a), hexToRgb(0x7c8c99), daylight);
  const rainNadir = lerpRgb(hexToRgb(0x111926), hexToRgb(0x52616e), daylight);
  const rainCloud = lerpRgb(hexToRgb(0x2d384c), hexToRgb(0x6e7b8a), daylight);

  const skyZenith = lerpRgb(base.zenith, rainZenith, rain * 0.72);
  const skyHorizon = lerpRgb(base.horizon, rainHorizon, rain * 0.75);
  const skyNadir = lerpRgb(base.nadir, rainNadir, rain * 0.7);
  const fogColor = lerpRgb(skyHorizon, skyZenith, 0.28);
  const cloudColor = lerpRgb(base.cloud, rainCloud, rain * 0.82);

  // Keep lighting readable at night (cool moonlight key + luminous indigo hemisphere fill)
  const clearKeyIntensity = lerp(0.88, 2.35, daylight) + twilight * 0.25;
  const sunLightIntensity = clearKeyIntensity * lerp(1.0, 0.42, rain);
  const sunLightColor = lerpRgb(base.sun, hexToRgb(0xc6d3e0), rain * 0.55);

  const clearHemiIntensity = lerp(0.78, 1.05, daylight);
  const hemiIntensity = clearHemiIntensity * lerp(1.0, 0.86, rain);
  const hemiSkyColor = lerpRgb(base.hemiSky, rainHorizon, rain * 0.5);
  const hemiGroundColor = lerpRgb(base.hemiGround, hexToRgb(0x3a434a), rain * 0.4);

  const rimColor = lerpRgb(hexToRgb(0x7ea5db), hexToRgb(0xffdfba), daylight * 0.6 + twilight * 0.4);
  const rimIntensity = lerp(0.55, 0.42, daylight) * lerp(1.0, 0.55, rain);

  const starVisibility = smoothstep(0.45, 0.92, nightFactor) * (1 - rain * 0.85);
  const moonVisibility = smoothstep(0.28, 0.78, nightFactor) * (1 - rain * 0.65);

  // Window glow prominence increases naturally during sunset/night and rain
  const windowProminence = lerp(0.65, 1.55, clamp(nightFactor * 0.85 + twilight * 0.35 + rain * 0.2, 0, 1));
  const exposure = lerp(0.96, 1.08, daylight) * lerp(1.0, 0.94, rain);
  const environmentIntensity = lerp(0.26, 0.52, daylight) * lerp(1.0, 0.68, rain);

  const uiTheme: "light" | "dark" = daylight < 0.42 || (rain > 0.65 && daylight < 0.6) ? "dark" : "light";

  return {
    hours,
    sunElevation,
    daylight,
    twilight,
    nightFactor,
    sunAzimuthRad,
    sunDirection,
    moonDirection,
    skyZenith,
    skyHorizon,
    skyNadir,
    fogColor,
    sunLightColor,
    sunLightIntensity,
    hemiSkyColor,
    hemiGroundColor,
    hemiIntensity,
    rimColor,
    rimIntensity,
    cloudColor,
    waterDeepColor: lerpRgb(base.waterDeep, hexToRgb(0x394f61), rain * 0.45),
    waterShallowColor: lerpRgb(base.waterShallow, hexToRgb(0x5b7485), rain * 0.45),
    starVisibility,
    moonVisibility,
    windowProminence,
    exposure,
    environmentIntensity,
    uiTheme,
  };
}

// Shared coherent wind direction (from NW toward SE, normalized)
const WIND_DIR_X = 0.82;
const WIND_DIR_Z = 0.57236352; // sqrt(1 - 0.82^2)

export function deriveWindEffects(windStrength: number): WindDerived {
  const s = clamp(windStrength, 0, 1);
  // Zero wind truly halts wind-driven rotation/sway/cloud drift while rain still falls vertically
  const effective = s <= 0.002 ? 0 : s;
  const curved = Math.pow(effective, 1.15);

  return {
    strength: s,
    dirX: WIND_DIR_X,
    dirZ: WIND_DIR_Z,
    windmillRadPerSec: effective === 0 ? 0 : 0.35 + curved * 3.85,
    treeSwayRadians: effective === 0 ? 0 : 0.012 + curved * 0.095,
    treeSwayFrequency: 1.45 + curved * 2.1,
    cloudSpeed: effective === 0 ? 0 : 0.08 + curved * 0.72,
    rainVelocityX: WIND_DIR_X * curved * 4.4,
    rainVelocityY: -12.5 - curved * 2.2,
    rainVelocityZ: WIND_DIR_Z * curved * 4.4,
  };
}

export type WorldStateListener = (state: WorldState, changedKey: keyof WorldState | "reset") => void;

export class WorldStateStore {
  private state: WorldState;
  private listeners = new Set<WorldStateListener>();

  constructor(initial: Partial<WorldState> = {}) {
    this.state = {
      ...DEFAULT_WORLD_STATE,
      ...initial,
    };
  }

  getState(): Readonly<WorldState> {
    return this.state;
  }

  subscribe(listener: WorldStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setTimeMinutes(minutes: number): void {
    const clamped = clamp(minutes, 0, 1440);
    if (clamped === this.state.timeMinutes) return;
    this.state = { ...this.state, timeMinutes: clamped };
    this.emit("timeMinutes");
  }

  setWeather(weather: WeatherMode): void {
    if (weather === this.state.weather) return;
    this.state = { ...this.state, weather };
    this.emit("weather");
  }

  setWindStrength(strength: number): void {
    const clamped = clamp(strength, 0, 1);
    if (Math.abs(clamped - this.state.windStrength) < 1e-5) return;
    this.state = { ...this.state, windStrength: clamped };
    this.emit("windStrength");
  }

  setHouseLightsOn(on: boolean): void {
    if (on === this.state.houseLightsOn) return;
    this.state = { ...this.state, houseLightsOn: on };
    this.emit("houseLightsOn");
  }

  toggleHouseLights(): boolean {
    const next = !this.state.houseLightsOn;
    this.setHouseLightsOn(next);
    return next;
  }

  reset(): void {
    this.state = { ...DEFAULT_WORLD_STATE };
    this.emit("reset");
  }

  private emit(key: keyof WorldState | "reset"): void {
    for (const listener of this.listeners) {
      listener(this.state, key);
    }
  }
}
