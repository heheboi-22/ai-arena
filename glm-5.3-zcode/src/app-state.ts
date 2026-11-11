import { damp } from './lib/math';

export type Weather = 'clear' | 'rain';

/** The one source of truth for every controllable aspect of the world. */
export const DEFAULTS = {
  hour: 16,
  weather: 'clear' as Weather,
  wind: 0.3, // 0..1
  lights: false,
};

/**
 * Targets are what the user asked for; the smoothed values are what the scene
 * shows. Every system reads the smoothed values, which converge on the
 * targets with exponential damping — so rapid control changes simply retarget
 * the same motion instead of fighting over animations.
 */
export class AppState {
  // user targets
  hour = DEFAULTS.hour;
  weather: Weather = DEFAULTS.weather;
  wind = DEFAULTS.wind;
  lights = DEFAULTS.lights;

  // smoothed scene values (updated in `update`)
  sHour = DEFAULTS.hour;
  sRain = 0;
  sWind = DEFAULTS.wind;
  sLights = 0;

  /** True once the user asked for reduced decorative motion. */
  reducedMotion = false;

  update(dt: number): void {
    const rainTarget = this.weather === 'rain' ? 1 : 0;
    this.sHour = damp(this.sHour, this.hour, 2.6, dt);
    this.sRain = damp(this.sRain, rainTarget, 1.5, dt);
    this.sWind = damp(this.sWind, this.wind, 2.4, dt);
    this.sLights = damp(this.sLights, this.lights ? 1 : 0, 7, dt);
  }

  reset(): void {
    this.hour = DEFAULTS.hour;
    this.weather = DEFAULTS.weather;
    this.wind = DEFAULTS.wind;
    this.lights = DEFAULTS.lights;
  }
}

export interface WorldContext {
  state: AppState;
  /** elapsed seconds (for cyclic animation phases) */
  time: number;
  /** clamped frame delta */
  dt: number;
}
