export type WeatherMode = "clear" | "rain";

export interface WorldState {
  /** Minutes since midnight in [0, 1440]. Default 960 (16:00). */
  timeMinutes: number;
  weather: WeatherMode;
  /** Wind strength normalized in [0, 1]. Default 0.30 (30%). */
  windStrength: number;
  houseLights: boolean;
}

export interface DefaultWorldConfig {
  readonly timeMinutes: number;
  readonly weather: WeatherMode;
  readonly windStrength: number;
  readonly houseLights: boolean;
}

export const DEFAULT_WORLD_STATE: DefaultWorldConfig = {
  timeMinutes: 16 * 60,
  weather: "clear",
  windStrength: 0.3,
  houseLights: false,
};

export function createInitialState(): WorldState {
  return { ...DEFAULT_WORLD_STATE };
}

export function formatTimeMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
  const wrapped = clamped === 1440 ? 0 : clamped;
  const hrs = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return String(hrs).padStart(2, "0") + ":" + String(mins).padStart(2, "0");
}

export function describeTimePhase(minutes: number): string {
  const hours = ((minutes % 1440) + 1440) % 1440 / 60;
  if (hours >= 5 && hours < 7.5) return "Dawn";
  if (hours >= 7.5 && hours < 12) return "Morning";
  if (hours >= 12 && hours < 16.5) return "Afternoon";
  if (hours >= 16.5 && hours < 19.75) return "Sunset";
  return "Night";
}

export interface SkyLightingFactors {
  /** Sun elevation angle in radians (-PI/2 .. PI/2). */
  sunElevation: number;
  /** Sun azimuth angle in radians. */
  sunAzimuth: number;
  /** [0, 1] daylight factor (0 at night, 1 at midday). */
  daylight: number;
  /** [0, 1] golden hour / twilight factor peaking around sunrise & sunset. */
  twilight: number;
  /** [0, 1] night factor (1 at deep night). */
  nightness: number;
}

export function computeSkyFactors(timeMinutes: number): SkyLightingFactors {
  const hours = ((timeMinutes % 1440) + 1440) % 1440 / 60;
  // Peak elevation around 12:30, horizon crossings near 06:00 and 18:45
  const dayAngle = ((hours - 6.25) / 24) * Math.PI * 2;
  const sunElevation = Math.sin(dayAngle) * 1.05;
  const sunAzimuth = 0.65 + (hours / 24) * Math.PI * 1.85;

  const rawDay = Math.max(0, Math.min(1, (sunElevation + 0.14) / 0.68));
  const daylight = rawDay * rawDay * (3 - 2 * rawDay);

  const twilightBand = Math.exp(-Math.pow((sunElevation - 0.03) / 0.22, 2));
  const twilight = Math.max(0, Math.min(1, twilightBand));

  const rawNight = Math.max(0, Math.min(1, (-sunElevation + 0.08) / 0.42));
  const nightness = rawNight * rawNight * (3 - 2 * rawNight);

  return {
    sunElevation,
    sunAzimuth,
    daylight,
    twilight,
    nightness,
  };
}
