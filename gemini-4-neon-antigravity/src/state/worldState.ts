export type WeatherMode = 'clear' | 'rain';

export interface WorldState {
  /** Minutes since midnight, in [0, 1440]. Default 960 (16:00). */
  timeMinutes: number;
  weather: WeatherMode;
  /** Normalized wind strength in [0, 1]. Default 0.3 (30%). */
  windStrength: number;
  houseLights: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_TIME_MINUTES = 16 * 60; // 16:00
export const DEFAULT_WEATHER: WeatherMode = 'clear';
export const DEFAULT_WIND_STRENGTH = 0.3; // 30%
export const DEFAULT_HOUSE_LIGHTS = false;

export type WorldStateListener = (state: Readonly<WorldState>) => void;
export type ResetListener = () => void;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function formatTimeLabel(timeMinutes: number): string {
  const clamped = Math.round(clamp(timeMinutes, 0, 1440));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getTimePeriodLabel(timeMinutes: number): string {
  const wrapped = clamp(timeMinutes, 0, 1440) % 1440;
  if (wrapped < 300 || wrapped >= 1290) return 'Night';
  if (wrapped < 420) return 'Dawn';
  if (wrapped < 660) return 'Morning';
  if (wrapped < 870) return 'Midday';
  if (wrapped < 1050) return 'Afternoon';
  if (wrapped < 1170) return 'Sunset';
  return 'Dusk';
}

export class WorldStateStore {
  private state: WorldState;
  private listeners = new Set<WorldStateListener>();
  private resetListeners = new Set<ResetListener>();

  constructor(initial?: Partial<WorldState>) {
    this.state = {
      timeMinutes: clamp(initial?.timeMinutes ?? DEFAULT_TIME_MINUTES, 0, 1440),
      weather: initial?.weather ?? DEFAULT_WEATHER,
      windStrength: clamp(initial?.windStrength ?? DEFAULT_WIND_STRENGTH, 0, 1),
      houseLights: initial?.houseLights ?? DEFAULT_HOUSE_LIGHTS,
      reducedMotion: initial?.reducedMotion ?? false,
    };
  }

  getState(): Readonly<WorldState> {
    return this.state;
  }

  setTimeMinutes(minutes: number): void {
    const next = clamp(minutes, 0, 1440);
    if (next === this.state.timeMinutes) return;
    this.state = { ...this.state, timeMinutes: next };
    this.emit();
  }

  setWeather(weather: WeatherMode): void {
    if (weather === this.state.weather) return;
    this.state = { ...this.state, weather };
    this.emit();
  }

  setWindStrength(strength: number): void {
    const next = clamp(strength, 0, 1);
    if (Math.abs(next - this.state.windStrength) < 1e-6) return;
    this.state = { ...this.state, windStrength: next };
    this.emit();
  }

  setHouseLights(on: boolean): void {
    if (on === this.state.houseLights) return;
    this.state = { ...this.state, houseLights: on };
    this.emit();
  }

  toggleHouseLights(): void {
    this.setHouseLights(!this.state.houseLights);
  }

  setReducedMotion(reducedMotion: boolean): void {
    if (reducedMotion === this.state.reducedMotion) return;
    this.state = { ...this.state, reducedMotion };
    this.emit();
  }

  reset(): void {
    this.state = {
      ...this.state,
      timeMinutes: DEFAULT_TIME_MINUTES,
      weather: DEFAULT_WEATHER,
      windStrength: DEFAULT_WIND_STRENGTH,
      houseLights: DEFAULT_HOUSE_LIGHTS,
    };
    this.emit();
    for (const listener of this.resetListeners) {
      listener();
    }
  }

  subscribe(listener: WorldStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onReset(listener: ResetListener): () => void {
    this.resetListeners.add(listener);
    return () => {
      this.resetListeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
