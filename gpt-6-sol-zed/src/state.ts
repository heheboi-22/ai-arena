export type Weather = 'clear' | 'rain';

export interface AppState {
  time: number;
  weather: Weather;
  wind: number;
  lights: boolean;
}

export const DEFAULT_STATE: Readonly<AppState> = {
  time: 16,
  weather: 'clear',
  wind: 30,
  lights: false,
};
