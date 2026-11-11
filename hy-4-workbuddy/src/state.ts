import { clamp, damp, smoothstep } from './util/math';

export type Weather = 'clear' | 'rain';

export interface AppState {
  /** Hours, 0..24. 16:00 is the composed default. */
  time: number;
  weather: Weather;
  /** 0..100 percent. */
  wind: number;
  houseLights: boolean;
}

export const DEFAULT_STATE: AppState = {
  time: 16,
  weather: 'clear',
  wind: 30,
  houseLights: false,
};

/** Values the renderer actually uses: every change is eased, never stepped. */
export interface SmoothState {
  time: number;
  rain: number;
  wind: number;
  lights: number;
}

type Listener = (s: AppState) => void;

export class WorldState {
  readonly target: AppState = { ...DEFAULT_STATE };
  readonly smooth: SmoothState = {
    time: DEFAULT_STATE.time,
    rain: 0,
    wind: DEFAULT_STATE.wind / 100,
    lights: 0,
  };
  private listeners: Listener[] = [];

  subscribe(fn: Listener): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn({ ...this.target });
  }

  set(patch: Partial<AppState>): void {
    let changed = false;
    if (patch.time !== undefined) {
      const t = clamp(patch.time, 0, 24);
      if (t !== this.target.time) { this.target.time = t; changed = true; }
    }
    if (patch.wind !== undefined) {
      const w = clamp(patch.wind, 0, 100);
      if (w !== this.target.wind) { this.target.wind = w; changed = true; }
    }
    if (patch.weather !== undefined && patch.weather !== this.target.weather) {
      this.target.weather = patch.weather; changed = true;
    }
    if (patch.houseLights !== undefined && patch.houseLights !== this.target.houseLights) {
      this.target.houseLights = patch.houseLights; changed = true;
    }
    if (changed) this.notify();
  }

  toggleLights(): void {
    this.set({ houseLights: !this.target.houseLights });
  }

  reset(): void {
    this.set({ ...DEFAULT_STATE });
  }

  /** Snap smoothing instantly (used after a tab was hidden for a long time). */
  settle(): void {
    this.smooth.time = this.target.time;
    this.smooth.rain = this.target.weather === 'rain' ? 1 : 0;
    this.smooth.wind = this.target.wind / 100;
    this.smooth.lights = this.target.houseLights ? 1 : 0;
  }

  update(dt: number): void {
    const s = this.smooth;
    // Time lives on a 24h circle: ease along the shortest arc so 23:00 -> 01:00
    // does not rewind through the whole afternoon.
    let delta = this.target.time - s.time;
    delta = ((delta + 12) % 24 + 24) % 24 - 12;
    s.time = (s.time + delta * (1 - Math.exp(-4.5 * dt)) + 24) % 24;
    s.rain = damp(s.rain, this.target.weather === 'rain' ? 1 : 0, 2.6, dt);
    s.wind = damp(s.wind, this.target.wind / 100, 4.0, dt);
    s.lights = damp(s.lights, this.target.houseLights ? 1 : 0, 5.0, dt);
  }
}

/** Sine of the sun's elevation: > 0 by day, < 0 at night. */
export const solarHeight = (time: number): number =>
  Math.sin(((time - 6) / 12) * Math.PI);

export const dayFactor = (time: number): number =>
  smoothstep(-0.14, 0.30, solarHeight(time));

export const nightFactor = (time: number): number =>
  1 - smoothstep(-0.30, 0.10, solarHeight(time));

/** Warm low-sun light, peaking just after dawn and just before dusk. */
export const goldenFactor = (time: number): number => {
  const h = solarHeight(time);
  const d = h - 0.16;
  return Math.exp(-(d * d) / (2 * 0.21 * 0.21)) * smoothstep(-0.35, -0.05, h);
};

export function formatTime(time: number): string {
  const total = Math.round(time * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timePeriod(time: number): string {
  const t = ((time % 24) + 24) % 24;
  if (t >= 20.5 || t < 4.5) return 'Deep night';
  if (t < 6.2) return 'Before dawn';
  if (t < 8.5) return goldenFactor(t) > 0.42 ? 'Sunrise' : 'Morning';
  if (t < 11) return 'Morning';
  if (t < 14.5) return 'Midday light';
  if (t < 16.8) return 'Afternoon';
  if (t < 19.2) return goldenFactor(t) > 0.38 ? 'Golden hour' : 'Late afternoon';
  return 'Dusk';
}

export function windWord(wind: number): string {
  if (wind < 4) return 'Still air';
  if (wind < 25) return 'A faint breeze';
  if (wind < 50) return 'A light breeze';
  if (wind < 75) return 'Breezy';
  return 'A stiff wind';
}
