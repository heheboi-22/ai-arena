import { DEFAULTS, Weather } from './config';

/**
 * Single source of truth for everything the user can change.
 * Scene effects are *derived* from this object each frame.
 */
export interface AppState {
  time: number; // 0..24 hours
  weather: Weather;
  wind: number; // 0..1
  houseLights: boolean;
}

export function createState(): AppState {
  return {
    time: DEFAULTS.time,
    weather: DEFAULTS.weather,
    wind: DEFAULTS.wind,
    houseLights: DEFAULTS.houseLights,
  };
}

/** Restore every control and the world to the documented defaults. */
export function resetState(s: AppState): void {
  s.time = DEFAULTS.time;
  s.weather = DEFAULTS.weather;
  s.wind = DEFAULTS.wind;
  s.houseLights = DEFAULTS.houseLights;
}
