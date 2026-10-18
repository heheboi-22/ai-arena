import type { AppState } from './state';

function fmtTime(hours: number): string {
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Fill percentage behind range thumbs (webkit track gradient). */
function setFill(el: HTMLInputElement): void {
  const pct = ((parseFloat(el.value) - parseFloat(el.min)) / (parseFloat(el.max) - parseFloat(el.min))) * 100;
  el.style.setProperty('--fill', `${pct}%`);
}

/** Push the full app state into every control. Used on start and after reset. */
export function syncUI(state: AppState): void {
  const timeSlider = document.getElementById('timeSlider') as HTMLInputElement;
  const timeLabel = document.getElementById('timeLabel')!;
  const windSlider = document.getElementById('windSlider') as HTMLInputElement;
  const windLabel = document.getElementById('windLabel')!;
  const weatherClear = document.getElementById('weatherClear') as HTMLButtonElement;
  const weatherRain = document.getElementById('weatherRain') as HTMLButtonElement;
  const lightsToggle = document.getElementById('lightsToggle') as HTMLButtonElement;

  timeSlider.value = String(state.time);
  timeLabel.textContent = fmtTime(state.time);
  setFill(timeSlider);
  windSlider.value = String(Math.round(state.wind * 100));
  windLabel.textContent = `${Math.round(state.wind * 100)}%`;
  setFill(windSlider);

  const clear = state.weather === 'clear';
  weatherClear.classList.toggle('active', clear);
  weatherRain.classList.toggle('active', !clear);
  weatherClear.setAttribute('aria-pressed', String(clear));
  weatherRain.setAttribute('aria-pressed', String(!clear));

  lightsToggle.setAttribute('aria-checked', String(state.lightsOn));
}

export function setupUI(state: AppState, actions: { onReset: () => void }): void {
  const panel = document.getElementById('panel')!;
  const timeSlider = document.getElementById('timeSlider') as HTMLInputElement;
  const timeLabel = document.getElementById('timeLabel')!;
  const weatherClear = document.getElementById('weatherClear') as HTMLButtonElement;
  const weatherRain = document.getElementById('weatherRain') as HTMLButtonElement;
  const windSlider = document.getElementById('windSlider') as HTMLInputElement;
  const windLabel = document.getElementById('windLabel')!;
  const lightsToggle = document.getElementById('lightsToggle') as HTMLButtonElement;
  const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
  const collapseBtn = document.getElementById('collapseBtn') as HTMLButtonElement;

  timeSlider.addEventListener('input', () => {
    state.time = parseFloat(timeSlider.value);
    timeLabel.textContent = fmtTime(state.time);
    setFill(timeSlider);
  });

  const setWeather = (weather: AppState['weather']) => {
    state.weather = weather;
    const clear = weather === 'clear';
    weatherClear.classList.toggle('active', clear);
    weatherRain.classList.toggle('active', !clear);
    weatherClear.setAttribute('aria-pressed', String(clear));
    weatherRain.setAttribute('aria-pressed', String(!clear));
  };
  weatherClear.addEventListener('click', () => setWeather('clear'));
  weatherRain.addEventListener('click', () => setWeather('rain'));

  windSlider.addEventListener('input', () => {
    state.wind = parseFloat(windSlider.value) / 100;
    windLabel.textContent = `${Math.round(state.wind * 100)}%`;
    setFill(windSlider);
  });

  lightsToggle.addEventListener('click', () => {
    state.lightsOn = !state.lightsOn;
    lightsToggle.setAttribute('aria-checked', String(state.lightsOn));
  });

  resetBtn.addEventListener('click', actions.onReset);

  collapseBtn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });

  // On small screens start collapsed so the island stays visible,
  // and follow breakpoint changes on resize.
  const mq = window.matchMedia('(max-width: 720px)');
  const applyBreakpoint = () => panel.classList.toggle('collapsed', mq.matches);
  applyBreakpoint();
  mq.addEventListener('change', applyBreakpoint);
}
