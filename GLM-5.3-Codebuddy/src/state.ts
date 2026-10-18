import { smoothstep } from './util';

export type Weather = 'clear' | 'rain';

export const DEFAULTS = {
  time: 16,
  weather: 'clear' as Weather,
  wind: 0.3,
  lightsOn: false,
};

/**
 * Exponential smoother — every animation routes through these, which makes
 * transitions interruptible: changing a target mid-flight just bends the
 * motion toward the new value, no competing tweens.
 */
export class Smoother {
  value: number;
  target: number;
  constructor(value: number) {
    this.value = value;
    this.target = value;
  }
  update(dt: number, rate: number): void {
    this.value += (this.target - this.value) * (1 - Math.exp(-rate * dt));
    if (Math.abs(this.target - this.value) < 1e-4) this.value = this.target;
  }
}

/** The single source of truth for the whole diorama. */
export class WorldState {
  time = DEFAULTS.time;
  weather: Weather = DEFAULTS.weather;
  wind = DEFAULTS.wind;
  lightsOn = DEFAULTS.lightsOn;

  /** Smoothed values actually driving the scene. */
  readonly timeS = new Smoother(DEFAULTS.time);
  readonly wet = new Smoother(0);
  readonly windS = new Smoother(DEFAULTS.wind);
  readonly glow = new Smoother(0);

  reset(): void {
    this.time = DEFAULTS.time;
    this.weather = DEFAULTS.weather;
    this.wind = DEFAULTS.wind;
    this.lightsOn = DEFAULTS.lightsOn;
    this.timeS.target = DEFAULTS.time;
    this.wet.target = 0;
    this.windS.target = DEFAULTS.wind;
    this.glow.target = 0;
  }

  update(dt: number): void {
    this.timeS.update(dt, 6);
    this.wet.update(dt, this.weather === 'rain' ? 1.5 : 1.1);
    this.windS.update(dt, 3);
    this.glow.update(dt, 4.5);
  }

  /** Sun elevation, roughly -1..1 (> 0 is day). */
  sunElevation(): number {
    return Math.sin(((this.timeS.value - 6) / 12) * Math.PI);
  }

  /** 0 by day, 1 at night. */
  nightFactor(): number {
    return smoothstep(0.1, -0.06, this.sunElevation());
  }
}
