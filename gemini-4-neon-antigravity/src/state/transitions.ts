import type { WorldState } from './worldState';

/** Maximum delta time per frame in seconds to prevent jumps after tab switches. */
export const MAX_FRAME_DELTA = 0.05;

/** Shared world wind direction angle in XZ plane (blowing left-to-right across the 3/4 hero view). */
export const WIND_DIRECTION_ANGLE = -0.48;
export const WIND_DIR_X = Math.cos(WIND_DIRECTION_ANGLE);
export const WIND_DIR_Z = Math.sin(WIND_DIRECTION_ANGLE);

export function clampDelta(rawDeltaSeconds: number): number {
  if (!Number.isFinite(rawDeltaSeconds) || rawDeltaSeconds <= 0) {
    return 0;
  }
  return Math.min(rawDeltaSeconds, MAX_FRAME_DELTA);
}

/** Frame-rate independent exponential smoothing (interruptible by design). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  if (dt <= 0) return current;
  const factor = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * factor;
}

export interface SmoothedEnvironment {
  timeMinutes: number;
  /** 0 = completely clear, 1 = full rain. */
  rainAmount: number;
  /** 0..1 smoothed wind strength driving windmill, trees, clouds, and rain slant. */
  windStrength: number;
  /** 0..1 smoothed house light intensity. */
  houseLightsAmount: number;
  windDirX: number;
  windDirZ: number;
}

export class EnvironmentTransitionController {
  private current: SmoothedEnvironment;

  constructor(initial: Readonly<WorldState>) {
    this.current = {
      timeMinutes: initial.timeMinutes,
      rainAmount: initial.weather === 'rain' ? 1 : 0,
      windStrength: initial.windStrength,
      houseLightsAmount: initial.houseLights ? 1 : 0,
      windDirX: WIND_DIR_X,
      windDirZ: WIND_DIR_Z,
    };
  }

  get values(): Readonly<SmoothedEnvironment> {
    return this.current;
  }

  update(target: Readonly<WorldState>, rawDeltaSeconds: number): Readonly<SmoothedEnvironment> {
    const dt = clampDelta(rawDeltaSeconds);
    const rainTarget = target.weather === 'rain' ? 1 : 0;
    const lightsTarget = target.houseLights ? 1 : 0;

    // Slightly snappier response in reduced motion while keeping visual shifts gentle
    const timeLambda = target.reducedMotion ? 16 : 9;
    const weatherLambda = target.reducedMotion ? 5.5 : 2.6;
    const windLambda = target.reducedMotion ? 10 : 4.2;
    const lightsLambda = target.reducedMotion ? 14 : 7.5;

    this.current.timeMinutes = damp(this.current.timeMinutes, target.timeMinutes, timeLambda, dt);
    this.current.rainAmount = damp(this.current.rainAmount, rainTarget, weatherLambda, dt);
    this.current.windStrength = damp(this.current.windStrength, target.windStrength, windLambda, dt);
    this.current.houseLightsAmount = damp(
      this.current.houseLightsAmount,
      lightsTarget,
      lightsLambda,
      dt,
    );

    // Snap tiny asymptotic tails cleanly to exact endpoints
    if (Math.abs(this.current.rainAmount - rainTarget) < 0.001) {
      this.current.rainAmount = rainTarget;
    }
    if (Math.abs(this.current.windStrength - target.windStrength) < 0.0005) {
      this.current.windStrength = target.windStrength;
    }
    if (Math.abs(this.current.houseLightsAmount - lightsTarget) < 0.001) {
      this.current.houseLightsAmount = lightsTarget;
    }
    if (Math.abs(this.current.timeMinutes - target.timeMinutes) < 0.05) {
      this.current.timeMinutes = target.timeMinutes;
    }

    return this.current;
  }
}
