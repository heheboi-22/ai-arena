import { formatTime, timePeriod, windWord, type AppState, type WorldState } from '../state';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing control #${id}`);
  return el as T;
};

export interface Panel {
  sync(): void;
  setCollapsed(value: boolean): void;
  isCollapsed(): boolean;
}

export function createPanel(state: WorldState, onReset: () => void): Panel {
  const panel = $('panel');
  const time = $<HTMLInputElement>('time');
  const timeValue = $<HTMLOutputElement>('time-value');
  const timeNote = $<HTMLParagraphElement>('time-note');
  const bandThumb = $('dayband-thumb');
  const weatherClear = $<HTMLButtonElement>('weather-clear');
  const weatherRain = $<HTMLButtonElement>('weather-rain');
  const weatherValue = $('weather-value');
  const wind = $<HTMLInputElement>('wind');
  const windValue = $<HTMLOutputElement>('wind-value');
  const windNote = $<HTMLParagraphElement>('wind-note');
  const lights = $<HTMLButtonElement>('lights');
  const lightsWord = $('lights-word');
  const reset = $<HTMLButtonElement>('reset');
  const collapse = $<HTMLButtonElement>('collapse');

  const small = (): boolean => window.matchMedia('(max-width: 720px), (max-height: 520px)').matches;
  let userChoseCollapse = false;

  function sync(): void {
    const s: AppState = state.target;
    time.value = String(s.time);
    timeValue.value = formatTime(s.time);
    time.setAttribute('aria-valuetext', `${formatTime(s.time)}, ${timePeriod(s.time)}`);
    timeNote.textContent = timePeriod(s.time);
    bandThumb.style.left = `${(s.time / 24) * 100}%`;

    const clear = s.weather === 'clear';
    weatherClear.classList.toggle('is-active', clear);
    weatherRain.classList.toggle('is-active', !clear);
    weatherClear.setAttribute('aria-pressed', String(clear));
    weatherRain.setAttribute('aria-pressed', String(!clear));
    weatherValue.textContent = clear ? 'Clear skies' : 'Rain falling';

    wind.value = String(s.wind);
    windValue.value = `${Math.round(s.wind)}%`;
    wind.setAttribute('aria-valuetext', `${Math.round(s.wind)} percent, ${windWord(s.wind)}`);
    windNote.textContent = windWord(s.wind);

    lights.setAttribute('aria-checked', String(s.houseLights));
    lightsWord.textContent = s.houseLights ? 'On' : 'Off';
  }

  function setCollapsed(value: boolean): void {
    panel.classList.toggle('is-collapsed', value);
    collapse.setAttribute('aria-expanded', String(!value));
    collapse.setAttribute('aria-label', value ? 'Show controls' : 'Hide controls');
  }

  time.addEventListener('input', () => state.set({ time: Number(time.value) }));
  wind.addEventListener('input', () => state.set({ wind: Number(wind.value) }));
  weatherClear.addEventListener('click', () => state.set({ weather: 'clear' }));
  weatherRain.addEventListener('click', () => state.set({ weather: 'rain' }));
  lights.addEventListener('click', () => state.toggleLights());
  reset.addEventListener('click', () => { state.reset(); onReset(); });
  collapse.addEventListener('click', () => {
    userChoseCollapse = true;
    setCollapsed(!panel.classList.contains('is-collapsed'));
  });

  window.addEventListener('resize', () => {
    if (!userChoseCollapse) setCollapsed(small());
  });

  state.subscribe(sync);
  setCollapsed(small());
  sync();

  return {
    sync,
    setCollapsed,
    isCollapsed: () => panel.classList.contains('is-collapsed'),
  };
}
