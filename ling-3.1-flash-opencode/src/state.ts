import * as THREE from 'three';

/** Shared, normalized wind direction. Every wind-driven effect uses this vector. */
export const WIND_DIR = new THREE.Vector3(1, 0, 0.35).normalize();

export type Weather = 'clear' | 'rain';

export interface AppState {
  /** Hours, 0..24. */
  time: number;
  /** Target weather mode. */
  weather: Weather;
  /** Animated clear→rain blend, 0..1. Derived from `weather`. */
  weatherBlend: number;
  /** Wind strength, 0..1. */
  wind: number;
  /** House lights target state. */
  lightsOn: boolean;
  /** Animated lights blend, 0..1. Derived from `lightsOn`. */
  lightsBlend: number;
}

export const DEFAULTS = {
  time: 16,
  weather: 'clear' as Weather,
  wind: 0.3,
  lightsOn: false,
};

export function createState(): AppState {
  return { ...DEFAULTS, weatherBlend: 0, lightsBlend: 0 };
}
