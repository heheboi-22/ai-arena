export type Weather = 'clear' | 'rain';

export interface AppState {
  /** Minutes since midnight, 0..1439. */
  minutes: number;
  weather: Weather;
  /** Wind strength, 0..1. */
  wind: number;
  lights: boolean;
}

export const DEFAULTS: Readonly<AppState> = Object.freeze({
  minutes: 16 * 60,
  weather: 'clear',
  wind: 0.3,
  lights: false,
});

type Listener = (state: Readonly<AppState>) => void;

/**
 * The single source of truth. The UI and the 3D picker write to it; the UI
 * re-renders from it and the scene eases towards it every frame, so there is
 * never more than one "animation" per value to get out of sync.
 */
export class Store {
  private current: AppState = { ...DEFAULTS };
  private listeners = new Set<Listener>();
  private resetListeners = new Set<() => void>();

  get state(): Readonly<AppState> {
    return this.current;
  }

  set(patch: Partial<AppState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof AppState)[]) {
      if (patch[key] !== undefined && patch[key] !== this.current[key]) changed = true;
    }
    if (!changed) return;
    this.current = { ...this.current, ...patch };
    for (const fn of this.listeners) fn(this.current);
  }

  toggleLights(): void {
    this.set({ lights: !this.current.lights });
  }

  reset(): void {
    this.set({ ...DEFAULTS });
    for (const fn of this.resetListeners) fn();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.current);
    return () => this.listeners.delete(fn);
  }

  onReset(fn: () => void): void {
    this.resetListeners.add(fn);
  }
}
