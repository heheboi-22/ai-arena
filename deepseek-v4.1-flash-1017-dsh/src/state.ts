export type Weather = 'clear' | 'rain';

export interface WorldState {
  /** Decimal hour in [0, 24). */
  time: number;
  weather: Weather;
  /** Normalized wind strength in [0, 1]. */
  wind: number;
  houseLights: boolean;
}

export const DEFAULT_STATE: Readonly<WorldState> = Object.freeze({
  time: 16,
  weather: 'clear',
  wind: 0.3,
  houseLights: false,
});

type Listener = (state: WorldState, previous: WorldState) => void;

/**
 * One small store owns every setting. The scene and the panel both read from it,
 * so the 3D house and the UI switch can never disagree.
 */
export class WorldStore {
  private state: WorldState = { ...DEFAULT_STATE };
  private readonly listeners = new Set<Listener>();

  get(): Readonly<WorldState> {
    return this.state;
  }

  set(partial: Partial<WorldState>): void {
    const next: WorldState = { ...this.state, ...partial };
    next.time = ((Math.round(next.time * 4) / 4) % 24 + 24) % 24;
    next.wind = Math.min(1, Math.max(0, next.wind));

    if (
      next.time === this.state.time &&
      next.weather === this.state.weather &&
      next.wind === this.state.wind &&
      next.houseLights === this.state.houseLights
    ) {
      return;
    }

    const previous = this.state;
    this.state = next;
    for (const listener of this.listeners) listener(next, previous);
  }

  setWeather(weather: Weather): void {
    this.set({ weather });
  }

  toggleHouseLights(): void {
    this.set({ houseLights: !this.state.houseLights });
  }

  reset(): void {
    this.set({ ...DEFAULT_STATE });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state, this.state);
    return () => this.listeners.delete(listener);
  }
}

export function formatClock(hour: number): string {
  const totalMinutes = Math.round(hour * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function describeTimeOfDay(hour: number): string {
  if (hour < 5) return 'Night';
  if (hour < 7) return 'Dawn';
  if (hour < 11) return 'Morning';
  if (hour < 14) return 'Midday';
  if (hour < 18) return 'Afternoon';
  if (hour < 20) return 'Dusk';
  return 'Night';
}
