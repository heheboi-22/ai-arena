export type Weather = 'clear' | 'rain';

export interface WorldState {
  time: number;
  weather: Weather;
  wind: number;
  lights: boolean;
}

export const DEFAULT_STATE: Readonly<WorldState> = {
  time: 16,
  weather: 'clear',
  wind: 0.3,
  lights: false,
};

export function formatTime(value: number): string {
  const wrapped = ((value % 24) + 24) % 24;
  const hours = Math.floor(wrapped);
  const minutes = Math.round((wrapped - hours) * 60) % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-smoothing * dt));
}

export function dampTime(current: number, target: number, smoothing: number, dt: number): number {
  let difference = target - current;
  if (difference > 12) difference -= 24;
  if (difference < -12) difference += 24;
  return (current + difference * (1 - Math.exp(-smoothing * dt)) + 24) % 24;
}
