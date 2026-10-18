export type Weather = 'clear' | 'rain';

export interface AppState {
  /** Hours since midnight, 0..24 */
  time: number;
  weather: Weather;
  /** 0..1 */
  wind: number;
  lights: boolean;
}

export const DEFAULTS: AppState = {
  time: 16,
  weather: 'clear',
  wind: 0.3,
  lights: false,
};

export function stateFromQuery(): AppState {
  const s = { ...DEFAULTS };
  try {
    const p = new URLSearchParams(window.location.search);
    const t = parseFloat(p.get('time') ?? '');
    if (!Number.isNaN(t)) s.time = ((t % 24) + 24) % 24;
    const w = p.get('weather');
    if (w === 'rain' || w === 'clear') s.weather = w;
    const wind = parseFloat(p.get('wind') ?? '');
    if (!Number.isNaN(wind)) s.wind = Math.min(1, Math.max(0, wind > 1 ? wind / 100 : wind));
    if (p.get('lights') === '1' || p.get('lights') === 'on') s.lights = true;
  } catch {
    /* ignore */
  }
  return s;
}
