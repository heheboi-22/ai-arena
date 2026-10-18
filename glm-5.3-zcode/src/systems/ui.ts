import type { AppState } from '../app-state';
import { formatClock } from '../lib/math';

/**
 * DOM wiring. Every control writes to the shared state and every state change
 * re-syncs the whole panel, so the 3D house click and the UI switch can never
 * drift apart.
 */
export function makeUI(state: AppState, onResetView: () => void): void {
  const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

  const panel = $('<HTMLElement>panel');
  const panelToggle = $<HTMLButtonElement>('panel-toggle');
  const timeSlider = $<HTMLInputElement>('time-slider');
  const timeValue = $<HTMLOutputElement>('time-value');
  const weatherClear = $<HTMLButtonElement>('weather-clear');
  const weatherRain = $<HTMLButtonElement>('weather-rain');
  const weatherValue = $<HTMLOutputElement>('weather-value');
  const windSlider = $<HTMLInputElement>('wind-slider');
  const windValue = $<HTMLOutputElement>('wind-value');
  const lightsToggle = $<HTMLButtonElement>('lights-toggle');
  const lightsState = $('<HTMLElement>lights-state');
  const resetBtn = $<HTMLButtonElement>('reset-btn');

  const setFill = (el: HTMLInputElement): void => {
    const min = Number(el.min);
    const max = Number(el.max);
    el.style.setProperty('--fill', `${((Number(el.value) - min) / (max - min)) * 100}%`);
  };

  const sync = (): void => {
    timeSlider.value = String(state.hourTarget);
    timeValue.textContent = formatClock(state.hourTarget);
    setFill(timeSlider);

    const raining = state.rainTarget > 0.5;
    weatherClear.classList.toggle('is-active', !raining);
    weatherRain.classList.toggle('is-active', raining);
    weatherClear.setAttribute('aria-pressed', String(!raining));
    weatherRain.setAttribute('aria-pressed', String(raining));
    weatherValue.textContent = raining ? 'Rain' : 'Clear';

    const windPct = Math.round(state.windTarget * 100);
    windSlider.value = String(windPct);
    windValue.textContent = `${windPct}%`;
    setFill(windSlider);

    lightsToggle.setAttribute('aria-checked', String(state.lightsOn));
    lightsState.textContent = state.lightsOn ? 'On' : 'Off';
  };

  state.onChange(sync);
  sync();

  timeSlider.addEventListener('input', () => state.setHour(Number(timeSlider.value)));
  weatherClear.addEventListener('click', () => state.setRain(false));
  weatherRain.addEventListener('click', () => state.setRain(true));
  windSlider.addEventListener('input', () => state.setWind(Number(windSlider.value) / 100));
  lightsToggle.addEventListener('click', () => state.toggleLights());
  resetBtn.addEventListener('click', () => {
    state.reset();
    onResetView();
  });

  const setCollapsed = (collapsed: boolean): void => {
    panel.dataset.collapsed = String(collapsed);
    panelToggle.setAttribute('aria-expanded', String(!collapsed));
  };
  panelToggle.addEventListener('click', () => setCollapsed(panel.dataset.collapsed !== 'true'));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const applyReduced = (): void => {
    state.reducedMotion = reduced.matches;
  };
  applyReduced();
  reduced.addEventListener('change', applyReduced);

  // Keyboard shortcut for the house lights (the switch itself is focusable).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'l' || e.key === 'L') state.toggleLights();
  });
}
