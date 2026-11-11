import { AppState } from '../state';
import { Weather } from '../config';

export interface PanelOptions {
  root: HTMLElement;
  state: AppState;
  onReset: () => void;
  /** Fired whenever the panel expands or collapses (mobile bottom sheet). */
  onExpandChange?: (expanded: boolean) => void;
}

export interface Panel {
  /** Reflect the current state into the controls (used after reset / house tap). */
  sync: () => void;
}

function formatTime(t: number): string {
  const h = Math.floor(t) % 24;
  const m = Math.floor((t - Math.floor(t)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createPanel(opts: PanelOptions): Panel {
  const { root, state } = opts;

  const panel = el('div', 'panel');
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Pocket World controls');

  // Header
  const header = el('div', 'panel__header');
  const title = el('div', 'panel__title');
  const dot = el('span', 'dot');
  title.appendChild(dot);
  title.appendChild(el('span', undefined, 'Pocket World'));
  const collapse = el('button', 'panel__collapse', '–');
  collapse.setAttribute('aria-label', 'Collapse panel');
  collapse.setAttribute('aria-expanded', 'true');
  header.appendChild(title);
  header.appendChild(collapse);
  panel.appendChild(header);

  collapse.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.textContent = collapsed ? '+' : '–';
    opts.onExpandChange?.(!collapsed);
  });

  // On small screens start collapsed so the island stays in view.
  if (window.matchMedia('(max-width: 640px)').matches) {
    panel.classList.add('collapsed');
    collapse.setAttribute('aria-expanded', 'false');
    collapse.textContent = '+';
  }
  opts.onExpandChange?.(!panel.classList.contains('collapsed'));

  const body = el('div', 'panel__body');

  // --- Time ---
  const timeField = el('div', 'field');
  const timeRow = el('div', 'field__row');
  const timeLabel = el('span', 'field__label', 'Time of day');
  const timeValue = el('span', 'field__value', '16:00');
  timeRow.appendChild(timeLabel);
  timeRow.appendChild(timeValue);
  const timeInput = el('input');
  timeInput.type = 'range';
  timeInput.min = '0';
  timeInput.max = '24';
  timeInput.step = '0.25';
  timeInput.value = '16';
  timeInput.setAttribute('aria-label', 'Time of day in hours');
  timeField.appendChild(timeRow);
  timeField.appendChild(timeInput);
  body.appendChild(timeField);

  // --- Weather ---
  const weatherField = el('div', 'field');
  const weatherRow = el('div', 'field__row');
  weatherRow.appendChild(el('span', 'field__label', 'Weather'));
  weatherRow.appendChild(el('span', 'field__value', 'Clear'));
  const weatherVal = weatherRow.querySelector('.field__value') as HTMLElement;
  weatherField.appendChild(weatherRow);
  const seg = el('div', 'seg');
  const clearBtn = el('button', 'active', 'Clear');
  const rainBtn = el('button', undefined, 'Rain');
  clearBtn.setAttribute('aria-pressed', 'true');
  rainBtn.setAttribute('aria-pressed', 'false');
  seg.appendChild(clearBtn);
  seg.appendChild(rainBtn);
  weatherField.appendChild(seg);
  body.appendChild(weatherField);

  // --- Wind ---
  const windField = el('div', 'field');
  const windRow = el('div', 'field__row');
  const windLabel = el('span', 'field__label', 'Wind');
  const windValue = el('span', 'field__value', '30%');
  windRow.appendChild(windLabel);
  windRow.appendChild(windValue);
  const windInput = el('input');
  windInput.type = 'range';
  windInput.min = '0';
  windInput.max = '100';
  windInput.step = '1';
  windInput.value = '30';
  windInput.setAttribute('aria-label', 'Wind strength percent');
  windField.appendChild(windRow);
  windField.appendChild(windInput);
  body.appendChild(windField);

  // --- House lights ---
  const lightsBtn = el('button', 'btn', 'House lights');
  const led = el('span', 'led');
  lightsBtn.prepend(led);
  lightsBtn.setAttribute('aria-pressed', 'false');
  body.appendChild(lightsBtn);

  // --- Reset ---
  const resetBtn = el('button', 'btn btn--reset', 'Reset scene');
  resetBtn.setAttribute('aria-label', 'Reset scene to defaults');
  body.appendChild(resetBtn);

  // --- Hint ---
  const hint = el('div', 'hint');
  hint.innerHTML =
    '<b>Drag</b> to orbit · <b>Scroll / pinch</b> to zoom · <b>Tap the house</b> to toggle its lights.';
  body.appendChild(hint);

  panel.appendChild(body);
  root.appendChild(panel);

  // --- Wiring ---
  timeInput.addEventListener('input', () => {
    state.time = parseFloat(timeInput.value);
    timeValue.textContent = formatTime(state.time);
  });

  clearBtn.addEventListener('click', () => setWeather('clear'));
  rainBtn.addEventListener('click', () => setWeather('rain'));

  windInput.addEventListener('input', () => {
    state.wind = parseInt(windInput.value, 10) / 100;
    windValue.textContent = `${windInput.value}%`;
  });

  lightsBtn.addEventListener('click', () => {
    state.houseLights = !state.houseLights;
    sync();
  });

  resetBtn.addEventListener('click', () => opts.onReset());

  function setWeather(w: Weather): void {
    state.weather = w;
    const isRain = w === 'rain';
    clearBtn.classList.toggle('active', !isRain);
    rainBtn.classList.toggle('active', isRain);
    clearBtn.setAttribute('aria-pressed', String(!isRain));
    rainBtn.setAttribute('aria-pressed', String(isRain));
    weatherVal.textContent = isRain ? 'Rain' : 'Clear';
  }

  function sync(): void {
    timeInput.value = String(state.time);
    timeValue.textContent = formatTime(state.time);
    setWeather(state.weather);
    windInput.value = String(Math.round(state.wind * 100));
    windValue.textContent = `${Math.round(state.wind * 100)}%`;
    lightsBtn.classList.toggle('on', state.houseLights);
    lightsBtn.setAttribute('aria-pressed', String(state.houseLights));
  }

  sync();
  return { sync };
}
