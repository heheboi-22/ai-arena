import {
  formatTimeLabel,
  getTimePeriodLabel,
  type WeatherMode,
  type WorldState,
  type WorldStateStore,
} from '../state/worldState';

export interface ControlPanelController {
  setThemeMode: (isNight: boolean) => void;
  dispose: () => void;
}

const MOBILE_BREAKPOINT = 680;

const ICON_SUN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"/></svg>`;

const ICON_RAIN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 15.5A4.5 4.5 0 0 1 7.2 6.6a5.5 5.5 0 0 1 10.6 1.6A3.8 3.8 0 0 1 18 15.5"/><path d="M8.5 18.5 7.5 21M12.5 18.5 11.5 21M16.5 18.5 15.5 21"/></svg>`;

const ICON_LAMP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.1 1.4 1.2 2.4h5.2c.1-1 .5-1.8 1.2-2.4A6 6 0 0 0 12 3Z"/></svg>`;

const ICON_RESET = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;

const ICON_CHEVRON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

export function createControlPanel(
  container: HTMLElement,
  store: WorldStateStore,
): ControlPanelController {
  let isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  let isExpanded = !isMobile;

  const panel = document.createElement('aside');
  panel.className = 'pw-panel';
  panel.setAttribute('aria-label', 'Pocket World Controls');
  panel.dataset.theme = 'day';
  panel.dataset.expanded = String(isExpanded);

  panel.innerHTML = `
    <div class="pw-header">
      <div class="pw-brand">
        <h1 class="pw-title">Pocket World</h1>
        <span class="pw-time-pill" data-role="summary-pill">16:00 · Afternoon</span>
      </div>
      <button
        type="button"
        class="pw-collapse-btn"
        data-role="collapse-btn"
        aria-expanded="${isExpanded}"
        aria-controls="pw-panel-body"
      >
        <span class="pw-collapse-label" data-role="collapse-label">${isExpanded ? 'Hide' : 'Controls'}</span>
        <span class="pw-chevron">${ICON_CHEVRON}</span>
      </button>
    </div>

    <div class="pw-body" id="pw-panel-body">
      <p class="pw-hint">Drag to orbit · Scroll or pinch to zoom · Click house for lights</p>

      <div class="pw-control">
        <div class="pw-control-head">
          <label class="pw-label" for="pw-time-slider">Time of Day</label>
          <output class="pw-value" for="pw-time-slider" data-role="time-output">16:00 · Afternoon</output>
        </div>
        <input
          id="pw-time-slider"
          class="pw-slider pw-slider--time"
          type="range"
          min="0"
          max="1440"
          step="1"
          value="960"
          aria-label="Time of Day"
        />
        <div class="pw-ticks" aria-hidden="true">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>

      <div class="pw-control">
        <span class="pw-label" id="pw-weather-label">Weather</span>
        <div class="pw-segmented" role="group" aria-labelledby="pw-weather-label">
          <button
            type="button"
            class="pw-seg-btn"
            data-weather="clear"
            aria-pressed="true"
          >
            ${ICON_SUN}
            <span>Clear</span>
          </button>
          <button
            type="button"
            class="pw-seg-btn"
            data-weather="rain"
            aria-pressed="false"
          >
            ${ICON_RAIN}
            <span>Rain</span>
          </button>
        </div>
      </div>

      <div class="pw-control">
        <div class="pw-control-head">
          <label class="pw-label" for="pw-wind-slider">Wind</label>
          <output class="pw-value" for="pw-wind-slider" data-role="wind-output">30%</output>
        </div>
        <input
          id="pw-wind-slider"
          class="pw-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value="30"
          aria-label="Wind strength"
        />
      </div>

      <div class="pw-actions-row">
        <button
          type="button"
          class="pw-light-btn"
          data-role="lights-btn"
          aria-pressed="false"
        >
          <span class="pw-light-left">
            <span class="pw-light-icon">${ICON_LAMP}</span>
            <span>House Lights</span>
          </span>
          <span class="pw-light-badge" data-role="lights-status">Off</span>
        </button>

        <button type="button" class="pw-reset-btn" data-role="reset-btn">
          ${ICON_RESET}
          <span>Reset</span>
        </button>
      </div>
    </div>
  `;

  container.appendChild(panel);

  const summaryPill = panel.querySelector<HTMLElement>('[data-role="summary-pill"]')!;
  const collapseBtn = panel.querySelector<HTMLButtonElement>('[data-role="collapse-btn"]')!;
  const collapseLabel = panel.querySelector<HTMLElement>('[data-role="collapse-label"]')!;
  const timeSlider = panel.querySelector<HTMLInputElement>('#pw-time-slider')!;
  const timeOutput = panel.querySelector<HTMLOutputElement>('[data-role="time-output"]')!;
  const clearBtn = panel.querySelector<HTMLButtonElement>('[data-weather="clear"]')!;
  const rainBtn = panel.querySelector<HTMLButtonElement>('[data-weather="rain"]')!;
  const windSlider = panel.querySelector<HTMLInputElement>('#pw-wind-slider')!;
  const windOutput = panel.querySelector<HTMLOutputElement>('[data-role="wind-output"]')!;
  const lightsBtn = panel.querySelector<HTMLButtonElement>('[data-role="lights-btn"]')!;
  const lightsStatus = panel.querySelector<HTMLElement>('[data-role="lights-status"]')!;
  const resetBtn = panel.querySelector<HTMLButtonElement>('[data-role="reset-btn"]')!;

  const updateExpandedUi = () => {
    panel.dataset.expanded = String(isExpanded);
    collapseBtn.setAttribute('aria-expanded', String(isExpanded));
    collapseLabel.textContent = isExpanded ? 'Hide' : 'Controls';
  };

  const renderState = (state: Readonly<WorldState>) => {
    const timeText = formatTimeLabel(state.timeMinutes);
    const periodText = getTimePeriodLabel(state.timeMinutes);
    const combinedTime = `${timeText} · ${periodText}`;

    timeSlider.value = String(Math.round(state.timeMinutes));
    timeSlider.setAttribute('aria-valuetext', combinedTime);
    timeOutput.textContent = combinedTime;
    summaryPill.textContent = combinedTime;

    const isRain = state.weather === 'rain';
    clearBtn.setAttribute('aria-pressed', String(!isRain));
    rainBtn.setAttribute('aria-pressed', String(isRain));
    clearBtn.classList.toggle('is-active', !isRain);
    rainBtn.classList.toggle('is-active', isRain);

    const windPct = Math.round(state.windStrength * 100);
    windSlider.value = String(windPct);
    windSlider.setAttribute('aria-valuetext', `${windPct} percent`);
    windSlider.style.setProperty('--slider-fill', `${windPct}%`);
    windOutput.textContent = `${windPct}%`;

    lightsBtn.setAttribute('aria-pressed', String(state.houseLights));
    lightsBtn.classList.toggle('is-on', state.houseLights);
    lightsStatus.textContent = state.houseLights ? 'On' : 'Off';
  };

  const handleTimeInput = () => {
    store.setTimeMinutes(Number(timeSlider.value));
  };

  const handleWindInput = () => {
    store.setWindStrength(Number(windSlider.value) / 100);
  };

  const handleWeatherClick = (mode: WeatherMode) => () => {
    store.setWeather(mode);
  };

  const handleLightsClick = () => {
    store.toggleHouseLights();
  };

  const handleResetClick = () => {
    store.reset();
  };

  const handleCollapseClick = () => {
    isExpanded = !isExpanded;
    updateExpandedUi();
  };

  const handleResize = () => {
    const nowMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    if (nowMobile !== isMobile) {
      isMobile = nowMobile;
      isExpanded = !nowMobile;
      updateExpandedUi();
    }
  };

  const onClearClick = handleWeatherClick('clear');
  const onRainClick = handleWeatherClick('rain');

  timeSlider.addEventListener('input', handleTimeInput);
  windSlider.addEventListener('input', handleWindInput);
  clearBtn.addEventListener('click', onClearClick);
  rainBtn.addEventListener('click', onRainClick);
  lightsBtn.addEventListener('click', handleLightsClick);
  resetBtn.addEventListener('click', handleResetClick);
  collapseBtn.addEventListener('click', handleCollapseClick);
  window.addEventListener('resize', handleResize);

  const unsubscribe = store.subscribe(renderState);
  renderState(store.getState());

  return {
    setThemeMode: (isNight: boolean) => {
      const next = isNight ? 'night' : 'day';
      if (panel.dataset.theme !== next) {
        panel.dataset.theme = next;
      }
    },
    dispose: () => {
      unsubscribe();
      timeSlider.removeEventListener('input', handleTimeInput);
      windSlider.removeEventListener('input', handleWindInput);
      clearBtn.removeEventListener('click', onClearClick);
      rainBtn.removeEventListener('click', onRainClick);
      lightsBtn.removeEventListener('click', handleLightsClick);
      resetBtn.removeEventListener('click', handleResetClick);
      collapseBtn.removeEventListener('click', handleCollapseClick);
      window.removeEventListener('resize', handleResize);
      panel.remove();
    },
  };
}
