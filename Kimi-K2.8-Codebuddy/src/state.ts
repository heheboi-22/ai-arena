import { DEFAULTS, type WeatherName } from './config';
import { clamp } from './utils';

export interface WorldState {
  /** Time of day as a float, 0..24. */
  hour: number;
  weather: WeatherName;
  /** Normalised wind strength, 0..1. */
  wind: number;
  lightsOn: boolean;
}

type Listener = (state: WorldState) => void;

/**
 * Single source of truth for the world. The UI subscribes to keep its
 * controls in sync (reset, house clicks); the render loop reads the
 * state directly every frame and derives all scene effects from it.
 */
export class StateStore {
  private listeners = new Set<Listener>();

  readonly state: WorldState = { ...DEFAULTS };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  setHour(hour: number): void {
    this.state.hour = clamp(hour, 0, 24);
    this.emit();
  }

  setWeather(weather: WeatherName): void {
    if (this.state.weather === weather) return;
    this.state.weather = weather;
    this.emit();
  }

  setWind(wind: number): void {
    this.state.wind = clamp(wind, 0, 1);
    this.emit();
  }

  setLights(on: boolean): void {
    if (this.state.lightsOn === on) return;
    this.state.lightsOn = on;
    this.emit();
  }

  toggleLights(): void {
    this.setLights(!this.state.lightsOn);
  }

  reset(): void {
    const { hour, weather, wind, lightsOn } = DEFAULTS;
    this.state.hour = hour;
    this.state.weather = weather;
    this.state.wind = wind;
    this.state.lightsOn = lightsOn;
    this.emit();
  }
}
