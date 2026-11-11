import type { PocketWorldStore, WorldTargetState } from '../state';
import { formatTimeLabel, getDayPhaseLabel } from '../utils/math';

export interface PanelHandle {
  dispose: () => void;
}

export function mountControlPanel(
  container: HTMLElement,
  store: PocketWorldStore
): PanelHandle {
  const panel = document.createElement('aside');
  panel.className = 'pw-panel';
  panel.setAttribute('aria-label', 'Pocket World environment controls');

  panel.innerHTML = `
    <div class="pw-panel__header">
      <div class="pw-panel__brand">
        <h1 class="pw-panel__title">Pocket World</h1>
        <span class="pw-panel__phase" id="pw-phase-badge">Afternoon</span>
      </div>
      <button
        type="button"
        class="pw-collapse-btn"
        id="pw-collapse-btn"
        aria-expanded="true"
        aria-controls="pw-panel-body"
        title="Collapse or expand controls"
      >
        <span class="pw-collapse-btn__label" id="pw-collapse-label">Minimize</span>
        <svg class="pw-collapse-btn__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <div class="pw-panel__body" id="pw-panel-body">
      <!-- Time of Day -->
      <div class="pw-control-group">
        <div class="pw-label-row">
          <label class="pw-label" for="pw-time-slider">Time of Day</label>
          <output class="pw-readout" id="pw-time-value" for="pw-time-slider">16:00</output>
        </div>
        <input
          type="range"
          id="pw-time-slider"
          class="pw-slider pw-slider--time"
          min="0"
          max="24"
          step="0.05"
          value="16"
        />
      </div>

      <!-- Weather -->
      <div class="pw-control-group">
        <span class="pw-label" id="pw-weather-label">Weather</span>
        <div class="pw-segmented" role="group" aria-labelledby="pw-weather-label">
          <button
            type="button"
            class="pw-seg-btn is-active"
            id="pw-weather-clear"
            aria-pressed="true"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="3.2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 1.6v1.6M8 12.8v1.6M1.6 8h1.6M12.8 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            Clear
          </button>
          <button
            type="button"
            class="pw-seg-btn"
            id="pw-weather-rain"
            aria-pressed="false"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 9.5a2.8 2.8 0 0 1-.3-5.58A3.6 3.6 0 0 1 11.2 5a2.3 2.3 0 0 1 .5 4.5H4.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              <path d="M5.6 11.5l-.8 2M8.4 11.5l-.8 2M11.2 11.5l-.8 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            Rain
          </button>
        </div>
      </div>

      <!-- Wind Strength -->
      <div class="pw-control-group">
        <div class="pw-label-row">
          <label class="pw-label" for="pw-wind-slider">Wind Strength</label>
          <output class="pw-readout" id="pw-wind-value" for="pw-wind-slider">30%</output>
        </div>
        <input
          type="range"
          id="pw-wind-slider"
          class="pw-slider"
          min="0"
          max="100"
          step="1"
          value="30"
        />
      </div>

      <!-- House Lights & Reset Row -->
      <div class="pw-actions-row">
        <button
          type="button"
          class="pw-light-toggle"
          id="pw-house-lights-btn"
          aria-pressed="false"
        >
          <span class="pw-light-toggle__dot" aria-hidden="true"></span>
          <span class="pw-light-toggle__text">House Lights</span>
          <span class="pw-light-toggle__state" id="pw-lights-state">Off</span>
        </button>

        <button
          type="button"
          class="pw-reset-btn"
          id="pw-reset-btn"
          title="Restore default view and environment"
        >
          Reset
        </button>
      </div>

      <p class="pw-guidance">
        Drag to orbit &middot; Scroll or pinch to zoom &middot; Click the cottage for lights
      </p>
    </div>
  `;

  container.appendChild(panel);

  const collapseBtn = panel.querySelector<HTMLButtonElement>('#pw-collapse-btn')!;
  const collapseLabel = panel.querySelector<HTMLSpanElement>('#pw-collapse-label')!;
  const phaseBadge = panel.querySelector<HTMLSpanElement>('#pw-phase-badge')!;
  const timeSlider = panel.querySelector<HTMLInputElement>('#pw-time-slider')!;
  const timeValue = panel.querySelector<HTMLOutputElement>('#pw-time-value')!;
  const clearBtn = panel.querySelector<HTMLButtonElement>('#pw-weather-clear')!;
  const rainBtn = panel.querySelector<HTMLButtonElement>('#pw-weather-rain')!;
  const windSlider = panel.querySelector<HTMLInputElement>('#pw-wind-slider')!;
  const windValue = panel.querySelector<HTMLOutputElement>('#pw-wind-value')!;
  const houseLightsBtn = panel.querySelector<HTMLButtonElement>('#pw-house-lights-btn')!;
  const lightsStateText = panel.querySelector<HTMLSpanElement>('#pw-lights-state')!;
  const resetBtn = panel.querySelector<HTMLButtonElement>('#pw-reset-btn')!;

  let isCollapsed = false;

  function setCollapsed(next: boolean): void {
    isCollapsed = next;
    panel.classList.toggle('is-collapsed', isCollapsed);
    collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
    collapseLabel.textContent = isCollapsed ? 'Controls' : 'Minimize';
  }

  const onCollapseClick = (): void => {
    setCollapsed(!isCollapsed);
  };

  const onTimeInput = (): void => {
    store.setTime(parseFloat(timeSlider.value));
  };

  const onClearClick = (): void => {
    store.setWeather('clear');
  };

  const onRainClick = (): void => {
    store.setWeather('rain');
  };

  const onWindInput = (): void => {
    store.setWind(parseFloat(windSlider.value) / 100);
  };

  const onLightsClick = (): void => {
    store.toggleHouseLights();
  };

  const onResetClick = (): void => {
    store.reset();
  };

  collapseBtn.addEventListener('click', onCollapseClick);
  timeSlider.addEventListener('input', onTimeInput);
  clearBtn.addEventListener('click', onClearClick);
  rainBtn.addEventListener('click', onRainClick);
  windSlider.addEventListener('input', onWindInput);
  houseLightsBtn.addEventListener('click', onLightsClick);
  resetBtn.addEventListener('click', onResetClick);

  function syncUI(state: Readonly<WorldTargetState>): void {
    // Sync Time
    if (document.activeElement !== timeSlider) {
      timeSlider.value = state.time.toFixed(2);
    } else if (Math.abs(parseFloat(timeSlider.value) - state.time) > 0.06) {
      timeSlider.value = state.time.toFixed(2);
    }
    timeValue.textContent = formatTimeLabel(state.time);
    phaseBadge.textContent = getDayPhaseLabel(state.time);

    // Sync Weather
    const isRain = state.weather === 'rain';
    clearBtn.classList.toggle('is-active', !isRain);
    clearBtn.setAttribute('aria-pressed', String(!isRain));
    rainBtn.classList.toggle('is-active', isRain);
    rainBtn.setAttribute('aria-pressed', String(isRain));

    // Sync Wind
    const windPct = Math.round(state.wind * 100);
    if (document.activeElement !== windSlider) {
      windSlider.value = String(windPct);
    } else if (Math.abs(parseInt(windSlider.value, 10) - windPct) > 1) {
      windSlider.value = String(windPct);
    }
    windValue.textContent = `${windPct}%`;
    windSlider.style.setProperty('--fill-pct', `${windPct}%`);
    timeSlider.style.setProperty('--fill-pct', `${((state.time / 24) * 100).toFixed(1)}%`);

    // Sync House Lights
    houseLightsBtn.classList.toggle('is-on', state.houseLights);
    houseLightsBtn.setAttribute('aria-pressed', String(state.houseLights));
    lightsStateText.textContent = state.houseLights ? 'On' : 'Off';
  }

  const unsubscribe = store.subscribe(syncUI);

  return {
    dispose() {
      unsubscribe();
      collapseBtn.removeEventListener('click', onCollapseClick);
      timeSlider.removeEventListener('input', onTimeInput);
      clearBtn.removeEventListener('click', onClearClick);
      rainBtn.removeEventListener('click', onRainClick);
      windSlider.removeEventListener('input', onWindInput);
      houseLightsBtn.removeEventListener('click', onLightsClick);
      resetBtn.removeEventListener('click', onResetClick);
      panel.remove();
    },
  };
}
