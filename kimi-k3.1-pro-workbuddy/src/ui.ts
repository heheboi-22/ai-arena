import { formatTime } from './state';
import type { Weather, WorldState } from './state';

export interface UI {
  sync: (state: Readonly<WorldState>) => void;
  toast: (message: string) => void;
}

type StateListener = (patch: Partial<WorldState>) => void;

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing interface element: ${id}`);
  return result as T;
}

function paintRange(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--value', `${value}%`);
}

export function createUI(initialState: Readonly<WorldState>, onState: StateListener, onReset: () => void): UI {
  const time = element<HTMLInputElement>('time');
  const timeLabel = element<HTMLOutputElement>('time-label');
  const wind = element<HTMLInputElement>('wind');
  const windLabel = element<HTMLOutputElement>('wind-label');
  const clear = element<HTMLButtonElement>('weather-clear');
  const rainy = element<HTMLButtonElement>('weather-rain');
  const lights = element<HTMLButtonElement>('lights');
  const lightState = element('light-state');
  const reset = element<HTMLButtonElement>('reset');
  const panel = document.querySelector<HTMLElement>('.control-panel')!;
  const panelToggle = element<HTMLButtonElement>('panel-toggle');
  const toastElement = element('toast');
  let toastTimer = 0;

  time.addEventListener('input', () => onState({ time: Number(time.value) }));
  wind.addEventListener('input', () => onState({ wind: Number(wind.value) / 100 }));
  clear.addEventListener('click', () => onState({ weather: 'clear' }));
  rainy.addEventListener('click', () => onState({ weather: 'rain' }));
  lights.addEventListener('click', () => onState({ lights: lights.getAttribute('aria-checked') !== 'true' }));
  reset.addEventListener('click', onReset);
  panelToggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    panelToggle.setAttribute('aria-expanded', String(!collapsed));
    panelToggle.setAttribute('aria-label', collapsed ? 'Expand controls' : 'Collapse controls');
  });

  const sync = (state: Readonly<WorldState>) => {
    time.value = String(state.time);
    timeLabel.value = formatTime(state.time);
    time.setAttribute('aria-valuetext', formatTime(state.time));
    wind.value = String(Math.round(state.wind * 100));
    windLabel.value = `${Math.round(state.wind * 100)}%`;
    wind.setAttribute('aria-valuetext', `${Math.round(state.wind * 100)} percent`);
    const weather: Weather = state.weather;
    clear.classList.toggle('active', weather === 'clear');
    rainy.classList.toggle('active', weather === 'rain');
    clear.setAttribute('aria-pressed', String(weather === 'clear'));
    rainy.setAttribute('aria-pressed', String(weather === 'rain'));
    lights.setAttribute('aria-checked', String(state.lights));
    lightState.textContent = state.lights ? 'On' : 'Off';
    paintRange(time);
    paintRange(wind);
  };

  const toast = (message: string) => {
    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.add('visible');
    toastTimer = window.setTimeout(() => toastElement.classList.remove('visible'), 1700);
  };

  if (window.innerWidth < 600 || (window.innerHeight < 500 && window.innerWidth < 900)) {
    panel.classList.add('collapsed');
    panelToggle.setAttribute('aria-expanded', 'false');
    panelToggle.setAttribute('aria-label', 'Expand controls');
  }
  sync(initialState);
  return { sync, toast };
}
