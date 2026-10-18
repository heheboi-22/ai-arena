import { clamp } from './util/math';

export type Weather = 'clear' | 'rain';

/** The only things the user can change. Everything on screen derives from this. */
export interface WorldState {
  /** Hour of the day, 0 to 24. */
  hour: number;
  weather: Weather;
  /** Wind strength, 0 to 1. */
  wind: number;
  /** Whether the house lights are on. */
  lights: boolean;
}

export const DEFAULT_STATE: Readonly<WorldState> = Object.freeze({
  hour: 16,
  weather: 'clear',
  wind: 0.3,
  lights: false,
});

type Listener = (state: Readonly<WorldState>) => void;

/**
 * One shared state object. The panel and the 3D picking both write to it, and
 * both read from it, so they cannot drift apart. The scene never animates the
 * state itself: it eases its own smoothed copy toward whatever is stored here,
 * which is what keeps every transition interruptible.
 */
export class Store {
  private current: WorldState = { ...DEFAULT_STATE };
  private readonly listeners = new Set<Listener>();

  get state(): Readonly<WorldState> {
    return this.current;
  }

  set(patch: Partial<WorldState>): void {
    const next: WorldState = { ...this.current, ...patch };
    next.hour = clamp(next.hour, 0, 24);
    next.wind = clamp(next.wind, 0, 1);
    if (
      next.hour === this.current.hour &&
      next.wind === this.current.wind &&
      next.weather === this.current.weather &&
      next.lights === this.current.lights
    ) {
      return;
    }
    this.current = next;
    for (const listener of this.listeners) listener(this.current);
  }

  toggleLights(): void {
    this.set({ lights: !this.current.lights });
  }

  reset(): void {
    this.set({ ...DEFAULT_STATE });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function formatHour(hour: number): string {
  const totalMinutes = Math.round(clamp(hour, 0, 24) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** A short human label for the time of day. */
export function describeHour(hour: number): string {
  const h = clamp(hour, 0, 24) % 24;
  if (h < 4.5) return 'Deep night';
  if (h < 5.75) return 'Before dawn';
  if (h < 7) return 'Sunrise';
  if (h < 11) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 16.75) return 'Afternoon';
  if (h < 17.75) return 'Golden hour';
  if (h < 18.75) return 'Sunset';
  if (h < 19.75) return 'Dusk';
  return 'Night';
}
