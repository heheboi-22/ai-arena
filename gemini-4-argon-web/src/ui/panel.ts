import {
  WorldStateStore,
  describeTimePhase,
  formatTimeHours,
} from '../state';

export interface UIPanelHandle {
  destroy: () => void;
}

export function createControlPanel(
  mount: HTMLElement,
  store: WorldStateStore,
  onResetCamera: () => void,
): UIPanelHandle {
  const container = document.createElement('aside');
  container.className = 'pw-panel';
  container.setAttribute('aria-label', 'Pocket World environment controls');

  container.innerHTML = `
    <div class="pw-header">
      <div class="pw-brand">
        <h1 class="pw-title">Pocket World</h1>
        <p class="pw-subtitle" id="pw-status-readout">16:00 · Late Afternoon</p>
      </div>
      <button
        type="button"
        id="pw-collapse-btn"
        class="pw-collapse-btn"
        aria-expanded="true"
        aria-controls="pw-controls-body"
      >
        Hide Controls
      </button>
    </div>

    <div class="pw-body" id="pw-controls-body">
      <div class="pw-control-group">
        <div class="pw-label-row">
          <label for="pw-time-slider" class="pw-label">Time of Day</label>
          <output id="pw-time-value" for="pw-time-slider" class="pw-value">16:00 · Late Afternoon</output>
        </div>
        <input
          id="pw-time-slider"
          type="range"
          min="0"
          max="24"
          step="0.05"
          value="16"
          class="pw-slider"
          aria-label="Time of Day (24-hour clock)"
        />
        <div class="pw-presets" role="group" aria-label="Time of day presets">
          <button type="button" class="pw-preset-btn" data-time="6.25">Dawn</button>
          <button type="button" class="pw-preset-btn" data-time="12.25">Midday</button>
          <button type="button" class="pw-preset-btn is-active" data-time="16">16:00</button>
          <button type="button" class="pw-preset-btn" data-time="18.4">Sunset</button>
          <button type="button" class="pw-preset-btn" data-time="22.5">Night</button>
        </div>
      </div>

      <div class="pw-row-split">
        <div class="pw-control-group">
          <span class="pw-label" id="pw-weather-label">Weather</span>
          <div class="pw-segmented" role="group" aria-labelledby="pw-weather-label">
            <button
              type="button"
              id="pw-weather-clear"
              class="pw-seg-btn is-active"
              aria-pressed="true"
            >
              Clear
            </button>
            <button
              type="button"
              id="pw-weather-rain"
              class="pw-seg-btn"
              aria-pressed="false"
            >
              Rain
            </button>
          </div>
        </div>

        <div class="pw-control-group">
          <span class="pw-label" id="pw-lights-label">House Lights</span>
          <button
            type="button"
            id="pw-lights-toggle"
            class="pw-toggle-btn"
            aria-pressed="false"
            aria-labelledby="pw-lights-label"
          >
            <span class="pw-lamp-indicator" aria-hidden="true"></span>
            <span id="pw-lights-text">Off</span>
          </button>
        </div>
      </div>

      <div class="pw-control-group">
        <div class="pw-label-row">
          <label for="pw-wind-slider" class="pw-label">Wind Strength</label>
          <output id="pw-wind-value" for="pw-wind-slider" class="pw-value">30%</output>
        </div>
        <input
          id="pw-wind-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value="30"
          class="pw-slider"
          aria-label="Wind Strength percentage"
        />
      </div>

      <div class="pw-footer">
        <p class="pw-hint">Drag to orbit · Scroll to zoom · Click house for lights</p>
        <button type="button" id="pw-reset-btn" class="pw-reset-btn">
          Reset
        </button>
      </div>
    </div>
  `;

  mount.appendChild(container);

  const collapseBtn = container.querySelector<HTMLButtonElement>('#pw-collapse-btn')!;
  const statusReadout = container.querySelector<HTMLElement>('#pw-status-readout')!;
  const timeSlider = container.querySelector<HTMLInputElement>('#pw-time-slider')!;
  const timeValue = container.querySelector<HTMLOutputElement>('#pw-time-value')!;
  const presetBtns = Array.from(container.querySelectorAll<HTMLButtonElement>('.pw-preset-btn'));
  const weatherClearBtn = container.querySelector<HTMLButtonElement>('#pw-weather-clear')!;
  const weatherRainBtn = container.querySelector<HTMLButtonElement>('#pw-weather-rain')!;
  const windSlider = container.querySelector<HTMLInputElement>('#pw-wind-slider')!;
  const windValue = container.querySelector<HTMLOutputElement>('#pw-wind-value')!;
  const lightsToggleBtn = container.querySelector<HTMLButtonElement>('#pw-lights-toggle')!;
  const lightsText = container.querySelector<HTMLElement>('#pw-lights-text')!;
  const resetBtn = container.querySelector<HTMLButtonElement>('#pw-reset-btn')!;

  let isCollapsed = false;
  const setCollapsed = (collapsed: boolean) => {
    isCollapsed = collapsed;
    container.classList.toggle('is-collapsed', isCollapsed);
    collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
    collapseBtn.textContent = isCollapsed ? 'Show Controls' : 'Hide Controls';
  };

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!isCollapsed);
  });

  // Wire Time of Day slider & presets
  timeSlider.addEventListener('input', () => {
    store.setTimeHours(parseFloat(timeSlider.value));
  });

  for (const btn of presetBtns) {
    btn.addEventListener('click', () => {
      const targetHours = parseFloat(btn.dataset.time || '16');
      store.setTimeHours(targetHours);
    });
  }

  // Wire Weather buttons
  weatherClearBtn.addEventListener('click', () => {
    store.setWeather('clear');
  });
  weatherRainBtn.addEventListener('click', () => {
    store.setWeather('rain');
  });

  // Wire Wind slider
  windSlider.addEventListener('input', () => {
    store.setWindStrength(parseInt(windSlider.value, 10));
  });

  // Wire House Lights toggle
  lightsToggleBtn.addEventListener('click', () => {
    store.toggleHouseLights();
  });

  // Wire Reset button
  resetBtn.addEventListener('click', () => {
    store.reset();
    onResetCamera();
  });

  // Synchronize UI controls whenever state updates (from UI or 3D scene click)
  const unsubscribe = store.subscribe((state) => {
    const formattedTime = formatTimeHours(state.timeHours);
    const phase = describeTimePhase(state.timeHours);
    const fullTimeLabel = `${formattedTime} · ${phase}`;

    if (document.activeElement !== timeSlider) {
      timeSlider.value = String(state.timeHours);
    }
    timeValue.textContent = fullTimeLabel;
    statusReadout.textContent = `${formattedTime} · ${state.weather === 'rain' ? 'Rain' : phase}`;

    for (const btn of presetBtns) {
      const presetTime = parseFloat(btn.dataset.time || '0');
      const active = Math.abs(state.timeHours - presetTime) < 0.35;
      btn.classList.toggle('is-active', active);
    }

    const isRain = state.weather === 'rain';
    weatherClearBtn.classList.toggle('is-active', !isRain);
    weatherClearBtn.setAttribute('aria-pressed', String(!isRain));
    weatherRainBtn.classList.toggle('is-active', isRain);
    weatherRainBtn.setAttribute('aria-pressed', String(isRain));

    if (document.activeElement !== windSlider) {
      windSlider.value = String(state.windStrength);
    }
    windValue.textContent = `${state.windStrength}%`;

    lightsToggleBtn.classList.toggle('is-active', state.houseLightsOn);
    lightsToggleBtn.setAttribute('aria-pressed', String(state.houseLightsOn));
    lightsText.textContent = state.houseLightsOn ? 'On' : 'Off';

    // Expose state on document.body for deterministic inspection
    document.body.dataset.time = formattedTime;
    document.body.dataset.phase = phase;
    document.body.dataset.weather = state.weather;
    document.body.dataset.wind = String(state.windStrength);
    document.body.dataset.houseLights = state.houseLightsOn ? 'on' : 'off';
  });

  return {
    destroy: () => {
      unsubscribe();
      container.remove();
    },
  };
}
