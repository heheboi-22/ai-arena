import type { StateStore } from './state';
import { formatHour } from './utils';

export interface UIHooks {
  onResetCamera: () => void;
}

const SUN_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
  <circle cx="8" cy="8" r="3" fill="currentColor"/>
  <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
    <path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1"/>
  </g>
</svg>`;

const CLOUD_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
  <path d="M4.4 12.2h7a2.3 2.3 0 0 0 .5-4.55A3.5 3.5 0 0 0 5.2 6.5a2.8 2.8 0 0 0-.8 5.7z" fill="currentColor"/>
</svg>`;

const CHEVRON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
  <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * The compact control panel. All controls are native elements (sliders,
 * buttons) so they are keyboard-focusable and announce state; the panel
 * subscribes to the store, so house clicks, resets and UI actions all
 * stay in sync automatically.
 */
export function createUI(store: StateStore, hooks: UIHooks): void {
  const root = document.getElementById('ui');
  if (!root) return;

  root.innerHTML = `
    <section class="panel" aria-label="Pocket World controls">
      <div class="panel-head">
        <h1 class="panel-title"><span class="dot" aria-hidden="true"></span>Pocket World</h1>
        <button class="collapse-btn" id="pw-collapse" aria-expanded="true" aria-label="Collapse panel">${CHEVRON}</button>
      </div>
      <div class="panel-body">
        <div class="row">
          <label class="row-label" for="pw-time">Time of day <output id="pw-time-out" for="pw-time">16:00</output></label>
          <input type="range" id="pw-time" min="0" max="24" step="0.05" value="16" aria-label="Time of day" />
        </div>
        <div class="row seg">
          <span class="row-label" id="pw-weather-label">Weather</span>
          <div class="seg-buttons" role="group" aria-labelledby="pw-weather-label">
            <button type="button" id="pw-weather-clear" aria-pressed="true">${SUN_ICON} Clear</button>
            <button type="button" id="pw-weather-rain" aria-pressed="false">${CLOUD_ICON} Rain</button>
          </div>
        </div>
        <div class="row">
          <label class="row-label" for="pw-wind">Wind strength <output id="pw-wind-out" for="pw-wind">30%</output></label>
          <input type="range" id="pw-wind" min="0" max="100" step="1" value="30" aria-label="Wind strength" />
        </div>
        <div class="row actions-row">
          <button type="button" class="switch" id="pw-lights" role="switch" aria-checked="false">
            <span class="track" aria-hidden="true"></span> House lights
          </button>
          <button type="button" class="reset-btn" id="pw-reset">Reset</button>
        </div>
        <p class="hint"><strong>Drag</strong> to orbit · <strong>scroll / pinch</strong> to zoom · <strong>click the house</strong> to flip its lights.</p>
      </div>
    </section>
  `;

  const panel = root.querySelector<HTMLElement>('.panel')!;
  const collapseBtn = root.querySelector<HTMLButtonElement>('#pw-collapse')!;
  const timeInput = root.querySelector<HTMLInputElement>('#pw-time')!;
  const timeOut = root.querySelector<HTMLOutputElement>('#pw-time-out')!;
  const windInput = root.querySelector<HTMLInputElement>('#pw-wind')!;
  const windOut = root.querySelector<HTMLOutputElement>('#pw-wind-out')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('#pw-weather-clear')!;
  const rainBtn = root.querySelector<HTMLButtonElement>('#pw-weather-rain')!;
  const lightsBtn = root.querySelector<HTMLButtonElement>('#pw-lights')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('#pw-reset')!;

  const sync = (): void => {
    const s = store.state;
    timeInput.value = String(s.hour);
    timeOut.value = formatHour(s.hour);
    windInput.value = String(Math.round(s.wind * 100));
    windOut.value = `${Math.round(s.wind * 100)}%`;
    clearBtn.setAttribute('aria-pressed', String(s.weather === 'clear'));
    rainBtn.setAttribute('aria-pressed', String(s.weather === 'rain'));
    lightsBtn.setAttribute('aria-checked', String(s.lightsOn));
  };

  timeInput.addEventListener('input', () => store.setHour(Number(timeInput.value)));
  windInput.addEventListener('input', () => store.setWind(Number(windInput.value) / 100));
  clearBtn.addEventListener('click', () => store.setWeather('clear'));
  rainBtn.addEventListener('click', () => store.setWeather('rain'));
  lightsBtn.addEventListener('click', () => store.toggleLights());
  resetBtn.addEventListener('click', () => {
    store.reset();
    hooks.onResetCamera();
  });

  collapseBtn.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  });

  // start collapsed on small screens so the island stays unobstructed
  if (window.matchMedia('(max-width: 640px)').matches) {
    panel.classList.add('collapsed');
    collapseBtn.setAttribute('aria-expanded', 'false');
  }

  store.subscribe(sync);
  sync();
}
