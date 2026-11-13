import { WorldState, WorldStateStore, formatTimeOfDay } from '../state/worldState';

export interface ControlPanelHandle {
  destroy(): void;
}

export function createControlPanel(
  container: HTMLElement,
  store: WorldStateStore,
  onResetCamera: () => void
): ControlPanelHandle {
  container.innerHTML = '';

  const panel = document.createElement('section');
  panel.className = 'control-panel is-collapsed';
  panel.setAttribute('aria-label', 'Pocket World environment controls');

  panel.innerHTML = `
    <header class="panel-header">
      <div class="panel-title-wrap">
        <h1 class="panel-title">Pocket World</h1>
        <p class="panel-summary" data-label="summary">16:00 · Clear</p>
      </div>
      <button
        type="button"
        class="panel-toggle-btn"
        data-control="toggle-panel"
        aria-expanded="false"
        aria-controls="pw-controls-body"
      >
        <span class="toggle-text">Controls</span>
        <svg class="toggle-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </header>

    <div id="pw-controls-body" class="panel-body">
      <p class="panel-hint">Drag to orbit · Scroll to zoom · Click house for lights</p>

      <div class="control-group">
        <div class="control-label-row">
          <label class="control-label" for="pw-time">Time of Day</label>
          <output class="control-value" for="pw-time" data-label="time">16:00</output>
        </div>
        <input
          id="pw-time"
          class="control-slider"
          data-control="time"
          type="range"
          min="0"
          max="24"
          step="0.25"
          value="16"
        />
      </div>

      <div class="control-group">
        <span class="control-label" id="pw-weather-label">Weather</span>
        <div class="segmented-control" role="group" aria-labelledby="pw-weather-label">
          <button type="button" class="seg-btn is-active" data-weather="clear" aria-pressed="true">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="8" cy="8" r="3.2" fill="currentColor" />
              <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
            <span>Clear</span>
          </button>
          <button type="button" class="seg-btn" data-weather="rain" aria-pressed="false">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4.5 9.5h7.2a2.3 2.3 0 0 0 .3-4.6A3.4 3.4 0 0 0 5.4 4a2.6 2.6 0 0 0-.9 5.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
              <path d="M5.5 12l-.8 2M8.2 12l-.8 2M10.9 12l-.8 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
            <span>Rain</span>
          </button>
        </div>
      </div>

      <div class="control-group">
        <div class="control-label-row">
          <label class="control-label" for="pw-wind">Wind</label>
          <output class="control-value" for="pw-wind" data-label="wind">30%</output>
        </div>
        <input
          id="pw-wind"
          class="control-slider"
          data-control="wind"
          type="range"
          min="0"
          max="100"
          step="1"
          value="30"
        />
      </div>

      <div class="control-actions-row">
        <button
          type="button"
          class="action-btn lights-btn"
          data-control="lights"
          aria-pressed="false"
        >
          <span class="light-dot" aria-hidden="true"></span>
          <span class="lights-text">Lights: Off</span>
        </button>

        <button
          type="button"
          class="action-btn reset-btn"
          data-control="reset"
          aria-label="Reset world and camera"
        >
          Reset
        </button>
      </div>
    </div>
  `;

  container.appendChild(panel);

  const togglePanelBtn = panel.querySelector<HTMLButtonElement>('[data-control="toggle-panel"]')!;
  const summaryLabel = panel.querySelector<HTMLElement>('[data-label="summary"]')!;
  const timeSlider = panel.querySelector<HTMLInputElement>('[data-control="time"]')!;
  const timeLabel = panel.querySelector<HTMLElement>('[data-label="time"]')!;
  const clearBtn = panel.querySelector<HTMLButtonElement>('[data-weather="clear"]')!;
  const rainBtn = panel.querySelector<HTMLButtonElement>('[data-weather="rain"]')!;
  const windSlider = panel.querySelector<HTMLInputElement>('[data-control="wind"]')!;
  const windLabel = panel.querySelector<HTMLElement>('[data-label="wind"]')!;
  const lightsBtn = panel.querySelector<HTMLButtonElement>('[data-control="lights"]')!;
  const lightsText = panel.querySelector<HTMLElement>('.lights-text')!;
  const resetBtn = panel.querySelector<HTMLButtonElement>('[data-control="reset"]')!;

  const syncFromState = (state: Readonly<WorldState>) => {
    const formattedTime = formatTimeOfDay(state.timeOfDay);
    timeSlider.value = String(state.timeOfDay);
    timeSlider.setAttribute('aria-valuetext', formattedTime);
    timeLabel.textContent = formattedTime;

    const isRain = state.weather === 'rain';
    clearBtn.classList.toggle('is-active', !isRain);
    clearBtn.setAttribute('aria-pressed', String(!isRain));
    rainBtn.classList.toggle('is-active', isRain);
    rainBtn.setAttribute('aria-pressed', String(isRain));

    const windRounded = Math.round(state.windStrength);
    windSlider.value = String(windRounded);
    windSlider.setAttribute('aria-valuetext', `${windRounded}%`);
    windLabel.textContent = `${windRounded}%`;

    lightsBtn.classList.toggle('is-active', state.houseLights);
    lightsBtn.setAttribute('aria-pressed', String(state.houseLights));
    lightsText.textContent = state.houseLights ? 'Lights: On' : 'Lights: Off';

    summaryLabel.textContent = `${formattedTime} · ${isRain ? 'Rain' : 'Clear'}`;
  };

  syncFromState(store.getState());
  const unsubscribe = store.subscribe(syncFromState);

  const onTimeInput = () => {
    store.setTimeOfDay(Number.parseFloat(timeSlider.value));
  };
  const onWindInput = () => {
    store.setWindStrength(Number.parseFloat(windSlider.value));
  };
  const onClearClick = () => store.setWeather('clear');
  const onRainClick = () => store.setWeather('rain');
  const onLightsClick = () => store.toggleHouseLights();
  const onResetClick = () => {
    store.reset();
    onResetCamera();
  };
  const onTogglePanelClick = () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    togglePanelBtn.setAttribute('aria-expanded', String(!collapsed));
  };

  timeSlider.addEventListener('input', onTimeInput);
  windSlider.addEventListener('input', onWindInput);
  clearBtn.addEventListener('click', onClearClick);
  rainBtn.addEventListener('click', onRainClick);
  lightsBtn.addEventListener('click', onLightsClick);
  resetBtn.addEventListener('click', onResetClick);
  togglePanelBtn.addEventListener('click', onTogglePanelClick);

  return {
    destroy() {
      unsubscribe();
      timeSlider.removeEventListener('input', onTimeInput);
      windSlider.removeEventListener('input', onWindInput);
      clearBtn.removeEventListener('click', onClearClick);
      rainBtn.removeEventListener('click', onRainClick);
      lightsBtn.removeEventListener('click', onLightsClick);
      resetBtn.removeEventListener('click', onResetClick);
      togglePanelBtn.removeEventListener('click', onTogglePanelClick);
      container.innerHTML = '';
    },
  };
}
