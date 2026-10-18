export type WeatherType = 'clear' | 'rain';

export interface WorldState {
  timeOfDay: number;       // 0.0 to 24.0 (hours)
  weather: WeatherType;    // 'clear' | 'rain'
  windStrength: number;    // 0 to 100 (%)
  houseLightsOn: boolean;  // true | false
}

export interface SmoothedWorldValues {
  /** Smoothly interpolated rain intensity (0 = clear, 1 = full rain) */
  rainFactor: number;
  /** Smoothly interpolated wind normalized (0.0 to 1.0) */
  windFactor: number;
  /** Smoothly interpolated house lights intensity (0.0 to 1.0) */
  houseLightsFactor: number;
  /** Smoothly interpolated time of day in hours (0.0 to 24.0) */
  timeOfDay: number;
  /** Whether the user prefers reduced motion */
  reducedMotion: boolean;
}

export const DEFAULT_STATE: Readonly<WorldState> = Object.freeze({
  timeOfDay: 16.0,
  weather: 'clear',
  windStrength: 30,
  houseLightsOn: false,
});

type StateListener = (state: Readonly<WorldState>) => void;

export class StateStore {
  private state: WorldState = { ...DEFAULT_STATE };
  private listeners: Set<StateListener> = new Set();

  public smoothed: SmoothedWorldValues = {
    rainFactor: 0,
    windFactor: DEFAULT_STATE.windStrength / 100,
    houseLightsFactor: 0,
    timeOfDay: DEFAULT_STATE.timeOfDay,
    reducedMotion: false,
  };

  private resetCallbacks: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.smoothed.reducedMotion = mq.matches;
      mq.addEventListener('change', (e) => {
        this.smoothed.reducedMotion = e.matches;
      });
    }
  }

  public getState(): Readonly<WorldState> {
    return this.state;
  }

  public setTimeOfDay(hours: number): void {
    const clamped = Math.max(0, Math.min(24, hours));
    if (Math.abs(this.state.timeOfDay - clamped) > 0.0001) {
      this.state = { ...this.state, timeOfDay: clamped };
      this.notify();
    }
  }

  public setWeather(weather: WeatherType): void {
    if (this.state.weather !== weather) {
      this.state = { ...this.state, weather };
      this.notify();
    }
  }

  public setWindStrength(windStrength: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(windStrength)));
    if (this.state.windStrength !== clamped) {
      this.state = { ...this.state, windStrength: clamped };
      this.notify();
    }
  }

  public setHouseLights(on: boolean): void {
    if (this.state.houseLightsOn !== on) {
      this.state = { ...this.state, houseLightsOn: on };
      this.notify();
    }
  }

  public toggleHouseLights(): void {
    this.setHouseLights(!this.state.houseLightsOn);
  }

  public reset(): void {
    this.state = { ...DEFAULT_STATE };
    this.notify();
    for (const cb of this.resetCallbacks) {
      cb();
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onReset(callback: () => void): () => void {
    this.resetCallbacks.add(callback);
    return () => {
      this.resetCallbacks.delete(callback);
    };
  }

  /**
   * Updates smoothed continuous parameters using frame-rate-independent damping.
   * Handles wrap-around for 24-hour time if needed and supports instant interruption.
   */
  public updateSmoothed(dt: number): void {
    const targetRain = this.state.weather === 'rain' ? 1 : 0;
    const targetWind = this.state.windStrength / 100;
    const targetLights = this.state.houseLightsOn ? 1 : 0;
    const targetTime = this.state.timeOfDay;

    const rainSpeed = this.smoothed.reducedMotion ? 8.0 : 2.6;
    const windSpeed = this.smoothed.reducedMotion ? 10.0 : 5.0;
    const lightSpeed = this.smoothed.reducedMotion ? 12.0 : 7.0;
    const timeSpeed = this.smoothed.reducedMotion ? 16.0 : 9.0;

    this.smoothed.rainFactor = damp(this.smoothed.rainFactor, targetRain, rainSpeed, dt);
    this.smoothed.windFactor = damp(this.smoothed.windFactor, targetWind, windSpeed, dt);
    this.smoothed.houseLightsFactor = damp(this.smoothed.houseLightsFactor, targetLights, lightSpeed, dt);
    this.smoothed.timeOfDay = damp(this.smoothed.timeOfDay, targetTime, timeSpeed, dt);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  if (Math.abs(target - current) < 0.0005) {
    return target;
  }
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function formatTimeLabel(hours: number): string {
  const normalized = ((hours % 24) + 24) % 24;
  let totalMinutes = Math.round(normalized * 60);
  if (totalMinutes >= 24 * 60) {
    totalMinutes = 0;
  }
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function getTimePhaseLabel(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  if (h < 4.5) return 'Night';
  if (h < 6.5) return 'Dawn';
  if (h < 11.0) return 'Morning';
  if (h < 14.5) return 'Midday';
  if (h < 17.2) return 'Afternoon';
  if (h < 19.5) return 'Sunset';
  if (h < 21.0) return 'Dusk';
  return 'Night';
}

