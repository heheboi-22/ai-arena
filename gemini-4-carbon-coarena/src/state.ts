import { damp } from './utils/math';

export type WeatherKind = 'clear' | 'rain';

export interface WorldTargetState {
  /** Time of day in hours [0, 24] */
  time: number;
  /** Weather mode */
  weather: WeatherKind;
  /** Normalized wind strength [0, 1] */
  wind: number;
  /** Whether cottage interior & porch lights are switched on */
  houseLights: boolean;
  /** OS / user prefers-reduced-motion */
  reducedMotion: boolean;
}

export interface WorldSmoothedState {
  /** Smoothly interpolated hour [0, 24) */
  time: number;
  /** Smoothly interpolated rain transition [0, 1] */
  rainAmount: number;
  /** Smoothly interpolated wind strength [0, 1] */
  wind: number;
  /** Smoothly interpolated house light intensity [0, 1] */
  houseLightAmount: number;
}

export const INITIAL_STATE: Readonly<Omit<WorldTargetState, 'reducedMotion'>> = {
  time: 16.0,
  weather: 'clear',
  wind: 0.3,
  houseLights: false,
};

type Listener = (state: Readonly<WorldTargetState>) => void;
type ResetListener = () => void;

export class PocketWorldStore {
  public readonly target: WorldTargetState;
  public readonly smoothed: WorldSmoothedState;

  private readonly listeners = new Set<Listener>();
  private readonly resetListeners = new Set<ResetListener>();

  constructor(reducedMotion = false) {
    this.target = {
      time: INITIAL_STATE.time,
      weather: INITIAL_STATE.weather,
      wind: INITIAL_STATE.wind,
      houseLights: INITIAL_STATE.houseLights,
      reducedMotion,
    };

    this.smoothed = {
      time: INITIAL_STATE.time,
      rainAmount: INITIAL_STATE.weather === 'rain' ? 1 : 0,
      wind: INITIAL_STATE.wind,
      houseLightAmount: INITIAL_STATE.houseLights ? 1 : 0,
    };
  }

  public setTime(hours: number): void {
    const clamped = Math.max(0, Math.min(24, hours));
    if (Math.abs(this.target.time - clamped) < 1e-4) return;
    this.target.time = clamped;
    this.emit();
  }

  public setWeather(weather: WeatherKind): void {
    if (this.target.weather === weather) return;
    this.target.weather = weather;
    this.emit();
  }

  public setWind(wind: number): void {
    const clamped = Math.max(0, Math.min(1, wind));
    if (Math.abs(this.target.wind - clamped) < 1e-4) return;
    this.target.wind = clamped;
    this.emit();
  }

  public setHouseLights(on: boolean): void {
    if (this.target.houseLights === on) return;
    this.target.houseLights = on;
    this.emit();
  }

  public toggleHouseLights(): void {
    this.setHouseLights(!this.target.houseLights);
  }

  public setReducedMotion(reduced: boolean): void {
    if (this.target.reducedMotion === reduced) return;
    this.target.reducedMotion = reduced;
    this.emit();
  }

  public reset(): void {
    this.target.time = INITIAL_STATE.time;
    this.target.weather = INITIAL_STATE.weather;
    this.target.wind = INITIAL_STATE.wind;
    this.target.houseLights = INITIAL_STATE.houseLights;
    this.emit();
    for (const cb of this.resetListeners) {
      cb();
    }
  }

  public update(dt: number): void {
    // Shortest circular delta across 24-hour cycle so wrapping midnight never sweeps backward through noon
    const targetMod = this.target.time >= 24 ? 0 : this.target.time;
    let deltaHours = targetMod - this.smoothed.time;
    if (deltaHours > 12) deltaHours -= 24;
    if (deltaHours < -12) deltaHours += 24;

    const nextTime = this.smoothed.time + deltaHours * (1 - Math.exp(-9.5 * dt));
    this.smoothed.time = ((nextTime % 24) + 24) % 24;

    const targetRain = this.target.weather === 'rain' ? 1 : 0;
    this.smoothed.rainAmount = damp(this.smoothed.rainAmount, targetRain, 2.8, dt);
    this.smoothed.wind = damp(this.smoothed.wind, this.target.wind, 4.5, dt);

    const targetLight = this.target.houseLights ? 1 : 0;
    this.smoothed.houseLightAmount = damp(this.smoothed.houseLightAmount, targetLight, 6.5, dt);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.target);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onReset(listener: ResetListener): () => void {
    this.resetListeners.add(listener);
    return () => {
      this.resetListeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.target);
    }
  }
}
