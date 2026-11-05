export type Weather = 'clear' | 'rain';

export interface WorldState {
  hour: number;
  weather: Weather;
  wind: number;
  houseLights: boolean;
}

export const DEFAULT_STATE: WorldState = {
  hour: 16,
  weather: 'clear',
  wind: 0.3,
  houseLights: false
};

type Listener = (state: Readonly<WorldState>) => void;

export class PocketStore {
  private state: WorldState = { ...DEFAULT_STATE };
  private listeners = new Set<Listener>();

  get snapshot(): Readonly<WorldState> {
    return this.state;
  }

  set(patch: Partial<WorldState>): void {
    const next = { ...this.state, ...patch };
    if (
      next.hour === this.state.hour &&
      next.weather === this.state.weather &&
      next.wind === this.state.wind &&
      next.houseLights === this.state.houseLights
    ) {
      return;
    }
    this.state = next;
    this.emit();
  }

  reset(): void {
    this.state = { ...DEFAULT_STATE };
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}
