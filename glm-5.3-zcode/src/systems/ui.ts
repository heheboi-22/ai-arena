import type { Weather } from '../app-state';

export interface UIHandlers {
  onTime: (hour: number) => void;
  onWeather: (w: Weather) => void;
  onWind: (v01: number) => void;
  onLights: (on: boolean) => void;
  onReset: () => void;
}

export interface UI {
  syncTime: (hour: number) => void;
  syncWeather: (w: Weather) => void;
  syncWind: (v01: number) => void;
  syncLights: (on: boolean) => void;
  collapsed: () => boolean;
}

const fmtHour = (h: number): string => {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const H = mm === 60 ? (hh + 1) % 24 : hh;
  const M = mm === 60 ? 0 : mm;
  return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
};

export function createUI(handlers: UIHandlers): UI {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const panel = $('panel') as HTMLElement;
  const head = $('panel-head');
  const toggle = $<HTMLButtonElement>('panel-toggle');
  const body = $('panel-body');
  const timeSlider = $<HTMLInputElement>('time-slider');
  const timeLabel = $('time-label');
  const clearBtn = $<HTMLButtonElement>('weather-clear');
  const rainBtn = $<HTMLButtonElement>('weather-rain');
  const windSlider = $<HTMLInputElement>('wind-slider');
  const windLabel = $('wind-label');
  const lightsToggle = $<HTMLButtonElement>('lights-toggle');
  const resetBtn = $<HTMLButtonElement>('reset-btn');

  const setCollapsed = (c: boolean) => {
    panel.classList.toggle('collapsed', c);
    toggle.setAttribute('aria-expanded', String(!c));
    toggle.setAttribute('aria-label', c ? 'Expand control panel' : 'Collapse control panel');
  };

  // small screens start collapsed so the world is never covered
  const small = matchMedia('(max-width: 640px), (max-height: 560px)');
  setCollapsed(small.matches);
  const onSmallChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
  small.addEventListener('change', onSmallChange);

  const onHeadClick = () => setCollapsed(!panel.classList.contains('collapsed'));
  head.addEventListener('click', onHeadClick);
  // the chevron button lives inside the head; stop the double-toggle
  toggle.addEventListener('click', (e) => e.stopPropagation());
  toggle.addEventListener('click', onHeadClick);

  const paintRange = (el: HTMLInputElement) => {
    const min = Number(el.min), max = Number(el.max);
    const pct = ((Number(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--fill', `${pct}%`);
  };

  timeSlider.addEventListener('input', () => {
    paintRange(timeSlider);
    timeLabel.textContent = fmtHour(Number(timeSlider.value));
    handlers.onTime(Number(timeSlider.value));
  });
  windSlider.addEventListener('input', () => {
    paintRange(windSlider);
    windLabel.textContent = `${windSlider.value}%`;
    handlers.onWind(Number(windSlider.value) / 100);
  });

  const setWeatherButtons = (w: Weather) => {
    clearBtn.classList.toggle('is-active', w === 'clear');
    rainBtn.classList.toggle('is-active', w === 'rain');
    clearBtn.setAttribute('aria-pressed', String(w === 'clear'));
    rainBtn.setAttribute('aria-pressed', String(w === 'rain'));
  };
  clearBtn.addEventListener('click', () => {
    setWeatherButtons('clear');
    handlers.onWeather('clear');
  });
  rainBtn.addEventListener('click', () => {
    setWeatherButtons('rain');
    handlers.onWeather('rain');
  });

  const setLightsButton = (on: boolean) => {
    lightsToggle.setAttribute('aria-checked', String(on));
  };
  lightsToggle.addEventListener('click', () => {
    const next = lightsToggle.getAttribute('aria-checked') !== 'true';
    setLightsButton(next);
    handlers.onLights(next);
  });

  resetBtn.addEventListener('click', () => handlers.onReset());

  paintRange(timeSlider);
  paintRange(windSlider);

  return {
    syncTime(hour) {
      timeSlider.value = String(hour);
      paintRange(timeSlider);
      timeLabel.textContent = fmtHour(hour);
    },
    syncWeather: setWeatherButtons,
    syncWind(v01) {
      windSlider.value = String(Math.round(v01 * 100));
      paintRange(windSlider);
      windLabel.textContent = `${Math.round(v01 * 100)}%`;
    },
    syncLights: setLightsButton,
    collapsed: () => panel.classList.contains('collapsed'),
  };
}
