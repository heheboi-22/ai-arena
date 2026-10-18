import { damp } from './lib/math';

export const DEFAULTS = {
  hour: 16,
  wind: 0.3,
  rain: false,
  lightsOn: false,
} as const;

/**
 * Single coherent application state. The UI (and house clicks) write *target*
 * values; the render loop advances the smoothed values toward them with
 * frame-rate independent damping. Every scene effect reads the smoothed
 * values, so rapid control changes simply retarget the same glide - there are
 * never competing animations or half-applied states.
 */
export class AppState {
  // --- targets (written by UI / picks) -------------------------------------
  hourTarget: number = DEFAULTS.hour;
  windTarget: number = DEFAULTS.wind;
  rainTarget = DEFAULTS.rain ? 1 : 0;
  lightsOn = false;

  // --- smoothed values (read by the scene every frame) ----------------------
  hour: number = DEFAULTS.hour;
  /** 0 = dry, 1 = full rain; eased over ~2.4s so weather crossfades. */
  rainAmount = 0;
  /** Smoothed wind 0..1. */
  wind: number = DEFAULTS.wind;
  /** 0..1 glow of the house windows / porch light. */
  lightGlow = 0;

  /** Effective wind direction on the horizontal plane, shared by everything. */
  readonly windDir = { x: 0.83, z: 0.56 };

  reducedMotion = false;

  private listeners = new Set<() => void>();

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  setHour(hour: number): void {
    this.hourTarget = hour;
    this.emit();
  }

  setRain(rain: boolean): void {
    this.rainTarget = rain ? 1 : 0;
    this.emit();
  }

  setWind(wind: number): void {
    this.windTarget = Math.min(1, Math.max(0, wind));
    this.emit();
  }

  toggleLights(): void {
    this.lightsOn = !this.lightsOn;
    this.emit();
  }

  reset(): void {
    this.hourTarget = DEFAULTS.hour;
    this.rainTarget = 0;
    this.windTarget = DEFAULTS.wind;
    this.lightsOn = false;
    this.emit();
  }

  /** Advance smoothed values. `dt` is already clamped by the render loop. */
  update(dt: number): void {
    this.hour = damp(this.hour, this.hourTarget, 0.0005, dt);
    this.rainAmount = damp(this.rainAmount, this.rainTarget, 0.32, dt);
    this.wind = damp(this.wind, this.windTarget, 0.02, dt);
    this.lightGlow = damp(this.lightGlow, this.lightsOn ? 1 : 0, 0.002, dt);
  }
}
