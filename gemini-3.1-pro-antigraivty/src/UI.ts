import { state } from './State';

export function initUI() {
  const timeSlider = document.getElementById('time-slider') as HTMLInputElement;
  const timeDisplay = document.getElementById('time-display') as HTMLElement;
  const weatherClear = document.getElementById('weather-clear') as HTMLButtonElement;
  const weatherRain = document.getElementById('weather-rain') as HTMLButtonElement;
  const windSlider = document.getElementById('wind-slider') as HTMLInputElement;
  const windDisplay = document.getElementById('wind-display') as HTMLElement;
  const lightsToggle = document.getElementById('lights-toggle') as HTMLInputElement;
  const resetButton = document.getElementById('reset-button') as HTMLButtonElement;

  function formatTime(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  timeSlider.addEventListener('input', (e) => {
    state.set('time', parseFloat((e.target as HTMLInputElement).value));
  });

  weatherClear.addEventListener('click', () => state.set('weather', 'clear'));
  weatherRain.addEventListener('click', () => state.set('weather', 'rain'));

  windSlider.addEventListener('input', (e) => {
    state.set('wind', parseInt((e.target as HTMLInputElement).value, 10) / 100);
  });

  lightsToggle.addEventListener('change', (e) => {
    state.set('houseLights', (e.target as HTMLInputElement).checked);
  });

  resetButton.addEventListener('click', () => {
    state.reset();
    if (typeof (window as any).resetWorldCamera === 'function') {
      (window as any).resetWorldCamera();
    }
  });

  state.subscribe((appState, key) => {
    if (key === 'time') {
      timeSlider.value = appState.time.toString();
      timeDisplay.textContent = formatTime(appState.time);
    } else if (key === 'weather') {
      if (appState.weather === 'clear') {
        weatherClear.classList.add('active');
        weatherRain.classList.remove('active');
        weatherClear.setAttribute('aria-pressed', 'true');
        weatherRain.setAttribute('aria-pressed', 'false');
      } else {
        weatherRain.classList.add('active');
        weatherClear.classList.remove('active');
        weatherRain.setAttribute('aria-pressed', 'true');
        weatherClear.setAttribute('aria-pressed', 'false');
      }
    } else if (key === 'wind') {
      windSlider.value = (appState.wind * 100).toString();
      windDisplay.textContent = `${Math.round(appState.wind * 100)}%`;
    } else if (key === 'houseLights') {
      lightsToggle.checked = appState.houseLights;
    }
  });

  state.reset(); // Initial sync
}
