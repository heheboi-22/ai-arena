import { phaseName } from '../env/daycycle';
import type { AppState, Store, Weather } from '../state';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

export const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const windName = (pct: number): string =>
  pct === 0 ? 'Still' : pct < 20 ? 'Light air' : pct < 50 ? 'Breeze' : pct < 80 ? 'Windy' : 'Gale';

/**
 * Binds the control panel to the store, both ways. The DOM is always rendered
 * from state, so the 3D click, the switch and Reset can never disagree.
 */
export function createPanel(store: Store, onLayout: () => void): { element: HTMLElement } {
  const panel = $<HTMLElement>('panel');
  const time = $<HTMLInputElement>('time');
  const timeOut = $<HTMLOutputElement>('time-out');
  const wind = $<HTMLInputElement>('wind');
  const windOut = $<HTMLOutputElement>('wind-out');
  const lights = $<HTMLButtonElement>('lights');
  const lightsState = $<HTMLElement>('lights-state');
  const reset = $<HTMLButtonElement>('reset');
  const collapse = $<HTMLButtonElement>('collapse');
  const summary = $<HTMLElement>('summary');
  const live = $<HTMLElement>('live');
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="weather"]'));

  time.addEventListener('input', () => store.set({ minutes: Number(time.value) }));
  wind.addEventListener('input', () => store.set({ wind: Number(wind.value) / 100 }));
  for (const r of radios) {
    r.addEventListener('change', () => {
      if (r.checked) store.set({ weather: r.value as Weather });
    });
  }
  lights.addEventListener('click', () => store.toggleLights());
  reset.addEventListener('click', () => store.reset());

  collapse.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.querySelector('.sr-only')!.textContent = collapsed ? 'Show controls' : 'Hide controls';
    onLayout();
  });

  let prev: AppState | null = null;
  store.subscribe((s) => {
    const clock = formatTime(s.minutes);
    const phase = phaseName(s.minutes / 60);
    if (Number(time.value) !== s.minutes) time.value = String(s.minutes);
    time.setAttribute('aria-valuetext', `${clock}, ${phase}`);
    timeOut.innerHTML = `<b>${clock}</b> ${phase}`;

    const pct = Math.round(s.wind * 100);
    if (Number(wind.value) !== pct) wind.value = String(pct);
    wind.style.setProperty('--fill', `${pct}%`);
    wind.setAttribute('aria-valuetext', `${pct} percent, ${windName(pct)}`);
    windOut.innerHTML = `<b>${pct}%</b> ${windName(pct)}`;

    for (const r of radios) r.checked = r.value === s.weather;

    lights.setAttribute('aria-checked', String(s.lights));
    lightsState.textContent = s.lights ? 'On' : 'Off';

    summary.textContent = `${clock} · ${s.weather === 'rain' ? 'Rain' : 'Clear'}${s.lights ? ' · Lights on' : ''}`;

    // Tell assistive tech about changes that happened in the 3D view.
    if (prev && prev.lights !== s.lights) live.textContent = `House lights ${s.lights ? 'on' : 'off'}`;
    prev = { ...s };
  });

  return { element: panel };
}
