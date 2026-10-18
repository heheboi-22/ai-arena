import type { Store, Weather } from '../state';

export interface PanelOptions {
  store: Store;
  onReset: () => void;
  /** Called after the panel opens or closes, so the scene can re-centre above a bottom sheet. */
  onLayout: () => void;
}

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `minutes` in [0, 1440) as HH:MM. */
export function formatTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const PHASES: [number, string][] = [
  [5, 'Night'],
  [6.5, 'Dawn'],
  [9, 'Morning'],
  [15, 'Daytime'],
  [17.5, 'Afternoon'],
  [18.9, 'Sunset'],
  [20.2, 'Dusk'],
  [24, 'Night'],
];

export function phaseName(hour: number): string {
  for (const [end, name] of PHASES) {
    if (hour < end) return name;
  }
  return 'Night';
}

/** Wires the control panel to the store, in both directions: inputs write state, state writes the DOM. */
export function bindPanel(opts: PanelOptions): void {
  const { store, onReset, onLayout } = opts;

  const panel = element<HTMLElement>('panel');
  const toggle = element<HTMLButtonElement>('panel-toggle');
  const toggleLabel = toggle.querySelector<HTMLElement>('.panel-toggle-text');
  const timeSlider = element<HTMLInputElement>('time-slider');
  const timeOutput = element<HTMLOutputElement>('time-output');
  const phaseOutput = element<HTMLElement>('phase-label');
  const windSlider = element<HTMLInputElement>('wind-slider');
  const windOutput = element<HTMLOutputElement>('wind-output');
  const lightsSwitch = element<HTMLButtonElement>('lights-switch');
  const resetButton = element<HTMLButtonElement>('reset-button');
  const weatherInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="weather"]'));

  // On a phone the panel starts folded so the island is fully visible.
  const compact = window.matchMedia('(max-width: 640px)');
  const setOpen = (open: boolean): void => {
    panel.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    if (toggleLabel) toggleLabel.textContent = open ? 'Hide' : 'Controls';
    onLayout();
  };
  setOpen(!compact.matches);
  compact.addEventListener('change', () => setOpen(!compact.matches));
  toggle.addEventListener('click', () => setOpen(panel.dataset.open !== 'true'));

  timeSlider.addEventListener('input', () => {
    store.set({ hour: Number(timeSlider.value) / 60 });
  });
  windSlider.addEventListener('input', () => {
    store.set({ wind: Number(windSlider.value) / 100 });
  });
  for (const input of weatherInputs) {
    input.addEventListener('change', () => {
      if (input.checked) store.set({ weather: input.value as Weather });
    });
  }
  lightsSwitch.addEventListener('click', () => {
    store.set({ houseLights: !store.get().houseLights });
  });
  resetButton.addEventListener('click', onReset);

  store.subscribe((s) => {
    const minutes = Math.round(s.hour * 60) % 1440;
    timeSlider.value = String(minutes);
    timeSlider.style.setProperty('--p', `${(minutes / 1439) * 100}%`);
    timeOutput.textContent = formatTime(minutes);
    phaseOutput.textContent = phaseName(s.hour);

    const wind = Math.round(s.wind * 100);
    windSlider.value = String(wind);
    windSlider.style.setProperty('--p', `${wind}%`);
    windOutput.textContent = `${wind}%`;

    for (const input of weatherInputs) input.checked = input.value === s.weather;
    lightsSwitch.setAttribute('aria-checked', String(s.houseLights));
  });
}
