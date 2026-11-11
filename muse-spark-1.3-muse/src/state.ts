// The single source of truth for the world's controls.
// Scene code never reads the DOM; the UI never touches the scene.
// Everything goes through this store.

export type Weather = 'clear' | 'rain';

export interface WorldState {
  /** Hour of day, 0..24 (float). */
  hour: number;
  weather: Weather;
  /** Wind strength, 0..1. */
  wind: number;
  /** House lights on/off. */
  lights: boolean;
}

export const DEFAULTS: WorldState = {
  hour: 16,
  weather: 'clear',
  wind: 0.3,
  lights: false,
};

type Listener = (s: WorldState) => void;

class Store {
  state: WorldState = { ...DEFAULTS };
  private listeners = new Set<Listener>();

  set(patch: Partial<WorldState>): void {
    Object.assign(this.state, patch);
    this.listeners.forEach((fn) => fn(this.state));
  }

  reset(): void {
    this.set({ ...DEFAULTS });
  }

  /** Subscribe; fn is called immediately with the current state. */
  on(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const store = new Store();
