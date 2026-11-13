export type WeatherMode = 'clear' | 'rain';

export interface WorldState {
  timeOfDay: number;
  weather: WeatherMode;
  windStrength: number;
  houseLights: boolean;
}

export interface WindVector {
  x: number;
  z: number;
}

export interface AnimatedWorldState {
  timeOfDay: number;
  rainFactor: number;
  windFactor: number;
  houseLightFactor: number;
  windDirection: WindVector;
}

export const DEFAULT_WORLD_STATE: Readonly<WorldState> = Object.freeze({
  timeOfDay: 16,
  weather: 'clear',
  windStrength: 30,
  houseLights: false,
});

const MAX_DELTA_SECONDS = 0.1;

// Normalized default breeze vector flowing gently left-to-right across the default 3/4 view
const DEFAULT_WIND_LEN = Math.hypot(0.78, -0.62);
const DEFAULT_WIND_DIRECTION: WindVector = {
  x: 0.78 / DEFAULT_WIND_LEN,
  z: -0.62 / DEFAULT_WIND_LEN,
};

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampDeltaTime(rawSeconds: number): number {
  if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) {
    return 0;
  }
  return Math.min(rawSeconds, MAX_DELTA_SECONDS);
}

export function dampValue(current: number, target: number, lambda: number, dt: number): number {
  if (dt <= 0 || current === target) {
    return current;
  }
  const factor = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * factor;
}

export function formatTimeOfDay(hours: number): string {
  const clamped = clampNumber(hours, 0, 24);
  const totalMinutes = Math.round(clamped * 60);
  if (totalMinutes >= 24 * 60) {
    return '24:00';
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type WorldStateListener = (state: Readonly<WorldState>) => void;

export class WorldStateStore {
  private state: WorldState;
  private listeners = new Set<WorldStateListener>();

  constructor(initial: Partial<WorldState> = {}) {
    this.state = {
      timeOfDay: clampNumber(initial.timeOfDay ?? DEFAULT_WORLD_STATE.timeOfDay, 0, 24),
      weather: initial.weather === 'rain' ? 'rain' : DEFAULT_WORLD_STATE.weather,
      windStrength: clampNumber(initial.windStrength ?? DEFAULT_WORLD_STATE.windStrength, 0, 100),
      houseLights: initial.houseLights ?? DEFAULT_WORLD_STATE.houseLights,
    };
  }

  getState(): Readonly<WorldState> {
    return { ...this.state };
  }

  subscribe(listener: WorldStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setTimeOfDay(hours: number): void {
    const next = clampNumber(hours, 0, 24);
    if (next === this.state.timeOfDay) return;
    this.state = { ...this.state, timeOfDay: next };
    this.emit();
  }

  setWeather(weather: WeatherMode): void {
    if (weather === this.state.weather) return;
    this.state = { ...this.state, weather };
    this.emit();
  }

  setWindStrength(strength: number): void {
    const next = clampNumber(Math.round(strength), 0, 100);
    if (next === this.state.windStrength) return;
    this.state = { ...this.state, windStrength: next };
    this.emit();
  }

  setHouseLights(enabled: boolean): void {
    if (enabled === this.state.houseLights) return;
    this.state = { ...this.state, houseLights: enabled };
    this.emit();
  }

  toggleHouseLights(): void {
    this.setHouseLights(!this.state.houseLights);
  }

  reset(): void {
    this.state = { ...DEFAULT_WORLD_STATE };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export function createAnimatedWorldState(initial: Readonly<WorldState>): AnimatedWorldState {
  return {
    timeOfDay: initial.timeOfDay,
    rainFactor: initial.weather === 'rain' ? 1 : 0,
    windFactor: clampNumber(initial.windStrength / 100, 0, 1),
    houseLightFactor: initial.houseLights ? 1 : 0,
    windDirection: { ...DEFAULT_WIND_DIRECTION },
  };
}

export function stepAnimatedState(
  anim: AnimatedWorldState,
  target: Readonly<WorldState>,
  rawDt: number
): void {
  const dt = clampDeltaTime(rawDt);
  if (dt <= 0) return;

  const targetRain = target.weather === 'rain' ? 1 : 0;
  const targetWind = clampNumber(target.windStrength / 100, 0, 1);
  const targetLights = target.houseLights ? 1 : 0;

  anim.timeOfDay = dampValue(anim.timeOfDay, target.timeOfDay, 10.0, dt);
  anim.rainFactor = clampNumber(dampValue(anim.rainFactor, targetRain, 2.8, dt), 0, 1);
  anim.windFactor = clampNumber(dampValue(anim.windFactor, targetWind, 4.5, dt), 0, 1);
  anim.houseLightFactor = clampNumber(dampValue(anim.houseLightFactor, targetLights, 9.0, dt), 0, 1);
}
