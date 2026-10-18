export type WeatherMode = 'clear' | 'rain';

export interface WorldConfig {
  timeOfDay: number; // 0..24 (hours, e.g. 16.0 = 16:00)
  weather: WeatherMode;
  windStrength: number; // 0..100 (%)
  houseLights: boolean;
}

export interface SmoothedWorldState {
  target: WorldConfig;
  timeOfDay: number;
  rainFactor: number;
  windNormalized: number;
  houseLightFactor: number;
  reducedMotion: boolean;
  windPhase: number;
  elapsed: number;
}

export const DEFAULT_CONFIG: Readonly<WorldConfig> = Object.freeze({
  timeOfDay: 16.0,
  weather: 'clear',
  windStrength: 30,
  houseLights: false,
});

export type StateSubscriber = (
  config: Readonly<WorldConfig>,
  source: 'ui' | 'scene' | 'reset'
) => void;

export class WorldStateStore {
  public readonly state: SmoothedWorldState;
  private subscribers: Set<StateSubscriber> = new Set();
  private resetCallbacks: Set<() => void> = new Set();

  constructor() {
    const reducedMotionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    this.state = {
      target: { ...DEFAULT_CONFIG },
      timeOfDay: DEFAULT_CONFIG.timeOfDay,
      rainFactor: DEFAULT_CONFIG.weather === 'rain' ? 1 : 0,
      windNormalized: DEFAULT_CONFIG.windStrength / 100,
      houseLightFactor: DEFAULT_CONFIG.houseLights ? 1 : 0,
      reducedMotion: Boolean(reducedMotionQuery?.matches),
      windPhase: 0,
      elapsed: 0,
    };

    if (reducedMotionQuery && typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', (e: MediaQueryListEvent) => {
        this.state.reducedMotion = e.matches;
      });
    }
  }

  public subscribe(fn: StateSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.state.target, 'ui');
    return () => this.subscribers.delete(fn);
  }

  public onReset(fn: () => void): () => void {
    this.resetCallbacks.add(fn);
    return () => this.resetCallbacks.delete(fn);
  }

  private emit(source: 'ui' | 'scene' | 'reset'): void {
    const snapshot = { ...this.state.target };
    for (const sub of this.subscribers) {
      sub(snapshot, source);
    }
  }

  public setTimeOfDay(hours: number, source: 'ui' | 'scene' = 'ui'): void {
    const clamped = ((hours % 24) + 24) % 24;
    this.state.target.timeOfDay = hours === 24 ? 24 : Math.round(clamped * 60) / 60;
    this.emit(source);
  }

  public setWeather(weather: WeatherMode, source: 'ui' | 'scene' = 'ui'): void {
    if (this.state.target.weather === weather) return;
    this.state.target.weather = weather;
    this.emit(source);
  }

  public setWindStrength(percent: number, source: 'ui' | 'scene' = 'ui'): void {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.state.target.windStrength = clamped;
    this.emit(source);
  }

  public setHouseLights(on: boolean, source: 'ui' | 'scene' = 'ui'): void {
    if (this.state.target.houseLights === on) return;
    this.state.target.houseLights = on;
    this.emit(source);
  }

  public toggleHouseLights(source: 'ui' | 'scene' = 'scene'): boolean {
    this.state.target.houseLights = !this.state.target.houseLights;
    this.emit(source);
    return this.state.target.houseLights;
  }

  public reset(): void {
    this.state.target = { ...DEFAULT_CONFIG };
    this.emit('reset');
    for (const cb of this.resetCallbacks) {
      cb();
    }
  }

  public step(rawDeltaSeconds: number): number {
    const dt = Math.min(Math.max(rawDeltaSeconds, 0.0001), 0.05);
    this.state.elapsed += dt;

    const smoothSpeed = this.state.reducedMotion ? 16 : 6.5;
    const alpha = 1 - Math.exp(-smoothSpeed * dt);

    const targetTime = this.state.target.timeOfDay % 24;
    let currentTime = this.state.timeOfDay % 24;
    let diff = targetTime - currentTime;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;
    currentTime = Math.abs(diff) < 0.001 ? targetTime : (currentTime + diff * alpha + 24) % 24;
    this.state.timeOfDay = currentTime;

    const targetRain = this.state.target.weather === 'rain' ? 1 : 0;
    const rainAlpha = 1 - Math.exp(-(this.state.reducedMotion ? 10 : 3.2) * dt);
    this.state.rainFactor += (targetRain - this.state.rainFactor) * rainAlpha;
    if (Math.abs(targetRain - this.state.rainFactor) < 0.001) {
      this.state.rainFactor = targetRain;
    }

    const targetWind = this.state.target.windStrength / 100;
    this.state.windNormalized += (targetWind - this.state.windNormalized) * alpha;
    if (Math.abs(targetWind - this.state.windNormalized) < 0.0005) {
      this.state.windNormalized = targetWind;
    }

    const targetLight = this.state.target.houseLights ? 1 : 0;
    const lightAlpha = 1 - Math.exp(-(this.state.reducedMotion ? 14 : 7.5) * dt);
    this.state.houseLightFactor += (targetLight - this.state.houseLightFactor) * lightAlpha;
    if (Math.abs(targetLight - this.state.houseLightFactor) < 0.001) {
      this.state.houseLightFactor = targetLight;
    }

    const motionScale = this.state.reducedMotion ? 0.35 : 1.0;
    this.state.windPhase += dt * this.state.windNormalized * 4.2 * motionScale;

    return dt;
  }
}

export function formatTimeLabel(hours: number): string {
  const normalized = ((hours % 24) + 24) % 24;
  const totalMinutes = Math.round(normalized * 60) % (24 * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function getDayPeriodLabel(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 5 && h < 7.5) return 'Dawn';
  if (h >= 7.5 && h < 11.5) return 'Morning';
  if (h >= 11.5 && h < 15.5) return 'Midday';
  if (h >= 15.5 && h < 17.5) return 'Afternoon';
  if (h >= 17.5 && h < 20.0) return 'Sunset';
  if (h >= 20.0 && h < 21.5) return 'Dusk';
  return 'Night';
}
