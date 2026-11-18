import { defaults, type Settings } from './environment';

export function bindControls(resetView: () => void) {
  const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
  const time = get<HTMLInputElement>('time');
  const wind = get<HTMLInputElement>('wind');
  const clear = get<HTMLButtonElement>('clear');
  const rain = get<HTMLButtonElement>('rain');
  const light = get<HTMLButtonElement>('lights');
  const reset = get<HTMLButtonElement>('reset');
  const timeValue = get<HTMLOutputElement>('time-value');
  const windValue = get<HTMLOutputElement>('wind-value');
  const lightValue = get<HTMLSpanElement>('lights-state');
  const settings: Settings = { ...defaults };

  function sync() {
    time.value = String(settings.minutes);
    const hours = String(Math.floor(settings.minutes / 60)).padStart(2, '0');
    const minutes = String(settings.minutes % 60).padStart(2, '0');
    timeValue.value = hours + ':' + minutes;
    time.setAttribute('aria-valuetext', timeValue.value);

    wind.value = String(Math.round(settings.wind * 100));
    windValue.value = wind.value + '%';
    wind.setAttribute('aria-valuetext', windValue.value);

    clear.setAttribute('aria-pressed', String(!settings.rainy));
    rain.setAttribute('aria-pressed', String(settings.rainy));
    light.setAttribute('aria-pressed', String(settings.lit));
    lightValue.textContent = settings.lit ? 'On' : 'Off';
  }

  function toggleLights() {
    settings.lit = !settings.lit;
    sync();
  }

  time.addEventListener('input', () => {
    settings.minutes = time.valueAsNumber;
    sync();
  });
  wind.addEventListener('input', () => {
    settings.wind = wind.valueAsNumber / 100;
    sync();
  });
  clear.addEventListener('click', () => {
    settings.rainy = false;
    sync();
  });
  rain.addEventListener('click', () => {
    settings.rainy = true;
    sync();
  });
  light.addEventListener('click', toggleLights);
  reset.addEventListener('click', () => {
    Object.assign(settings, defaults);
    sync();
    resetView();
  });
  sync();

  return { settings, toggleLights };
}
