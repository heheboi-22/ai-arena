import { clamp, wrap24 } from './core/math';

export type Weather = 'clear' | 'rain';

/** The whole user-facing state of the world. Every visual effect is derived from this. */
export interface WorldState {
  /** Hour of day, 0 to 24 (24 is shown as midnight). */
  time: number;
  weather: Weather;
  /** Wind strength, 0 to 1. */
  wind: number;
  lights: boolean;
}

export const DEFAULT_STATE: Readonly<WorldState> = Object.freeze({
  time: 16,
  weather: 'clear',
  wind: 0.3,
  lights: false,
});

type Listener = (state: Readonly<WorldState>, prev: Readonly<WorldState>) => void;

export class Store {
  private state: WorldState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: Readonly<WorldState>) {
    this.state = { ...initial };
  }

  get(): Readonly<WorldState> {
    return this.state;
  }

  set(patch: Partial<WorldState>): void {
    const prev = this.state;
    const next: WorldState = { ...prev, ...patch };
    next.time = next.time === 24 ? 24 : wrap24(next.time);
    next.wind = clamp(next.wind, 0, 1);
    if (
      next.time === prev.time &&
      next.weather === prev.weather &&
      next.wind === prev.wind &&
      next.lights === prev.lights
    ) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) listener(next, prev);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
