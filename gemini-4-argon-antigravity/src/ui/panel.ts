import {
  StateStore,
  formatTimeLabel,
  getTimePhaseLabel,
} from '../state';

export function createUIPanel(
  container: HTMLElement,
  store: StateStore
): () => void {
  const panel = document.createElement('aside');
  panel.className = 'pw-panel';
  panel.setAttribute('aria-label', 'Pocket World Environment Controls');

  panel.innerHTML = `
    <header class="pw-header">
      <div class="pw-brand">
        <div class="pw-logo-badge" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3L4 9v11h16V9l-8-6z"/>
            <path d="M9 20v-6h6v6"/>
          </svg>
        </div>
        <div class="pw-title-group">
          <h1 class="pw-title">Pocket World</h1>
          <span class="pw-subtitle">Miniature Island Diorama</span>
        </div>
      </div>
      <button type="button" class="pw-collapse-btn" id="pw-collapse-toggle" aria-expanded="true" aria-controls="pw-panel-body">
        <span id="pw-collapse-label">Hide</span>
      </button>
    </header>

    <div class="pw-body" id="pw-panel-body">
      <!-- Time of Day -->
      <div class="pw-control-group">
        <div class="pw-label-row">
          <label class="pw-label" for="pw-time-slider">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
            Time of Day
          </label>
          <span class="pw-value-badge" id="pw-time-badge">
            <span id="pw-time-value">16:00</span>
            <span class="pw-phase-tag" id="pw-time-phase">Afternoon</span>
          </span>
        </div>
        <input
          id="pw-time-slider"
          class="pw-slider pw-slider--time"
          type="range"
          min="0"
          max="24"
          step="0.05"
          value="16"
          aria-label="Time of Day"
        />
      </div>

      <!-- Weather -->
      <div class="pw-control-group">
        <div class="pw-label-row">
          <span class="pw-label" id="pw-weather-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
            </svg>
            Weather
          </span>
        </div>
        <div class="pw-segmented" role="group" aria-labelledby="pw-weather-label">
          <button type="button" class="pw-seg-btn" id="pw-weather-clear" aria-pressed="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            Clear
          </button>
          <button type="button" class="pw-seg-btn" id="pw-weather-rain" aria-pressed="false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
              <path d="M16 14v6M8 14v6M12 16v6"/>
            </svg>
            Rain
          </button>
        </div>
      </div>

      <!-- Wind Strength -->
      <div class="pw-control-group">
        <div class="pw-label-row">
          <label class="pw-label" for="pw-wind-slider">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
              <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
              <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
            </svg>
            Wind Strength
          </label>
          <span class="pw-value-badge" id="pw-wind-value">30%</span>
        </div>
        <input
          id="pw-wind-slider"
          class="pw-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value="30"
          aria-label="Wind Strength"
        />
      </div>

      <!-- House Lights & Reset Row -->
      <div class="pw-actions-row">
        <button type="button" class="pw-toggle-btn" id="pw-lights-btn" aria-pressed="false">
          <span class="pw-light-dot" aria-hidden="true"></span>
          <span id="pw-lights-label">House Lights: Off</span>
        </button>
        <button type="button" class="pw-reset-btn" id="pw-reset-btn" title="Restore default view and environment">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Reset
        </button>
      </div>

      <!-- Interaction Guidance -->
      <div class="pw-guidance">
        <span><strong>Explore:</strong> Drag to orbit · Scroll or pinch to zoom</span>
        <span><strong>Interact:</strong> Click or tap the cottage to toggle its lights</span>
      </div>
    </div>
  `;

  container.appendChild(panel);

  // Query elements
  const collapseBtn = panel.querySelector<HTMLButtonElement>('#pw-collapse-toggle')!;
  const collapseLabel = panel.querySelector<HTMLSpanElement>('#pw-collapse-label')!;
  const timeSlider = panel.querySelector<HTMLInputElement>('#pw-time-slider')!;
  const timeValue = panel.querySelector<HTMLSpanElement>('#pw-time-value')!;
  const timePhase = panel.querySelector<HTMLSpanElement>('#pw-time-phase')!;
  const weatherClearBtn = panel.querySelector<HTMLButtonElement>('#pw-weather-clear')!;
  const weatherRainBtn = panel.querySelector<HTMLButtonElement>('#pw-weather-rain')!;
  const windSlider = panel.querySelector<HTMLInputElement>('#pw-wind-slider')!;
  const windValue = panel.querySelector<HTMLSpanElement>('#pw-wind-value')!;
  const lightsBtn = panel.querySelector<HTMLButtonElement>('#pw-lights-btn')!;
  const lightsLabel = panel.querySelector<HTMLSpanElement>('#pw-lights-label')!;
  const resetBtn = panel.querySelector<HTMLButtonElement>('#pw-reset-btn')!;

  // Mobile collapse toggle
  let isCollapsed = false;
  collapseBtn.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    panel.classList.toggle('is-collapsed', isCollapsed);
    collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
    collapseLabel.textContent = isCollapsed ? 'Controls' : 'Hide';
  });

  // Event listeners for controls -> state store
  timeSlider.addEventListener('input', () => {
    store.setTimeOfDay(parseFloat(timeSlider.value));
  });

  weatherClearBtn.addEventListener('click', () => {
    store.setWeather('clear');
  });

  weatherRainBtn.addEventListener('click', () => {
    store.setWeather('rain');
  });

  windSlider.addEventListener('input', () => {
    store.setWindStrength(parseInt(windSlider.value, 10));
  });

  lightsBtn.addEventListener('click', () => {
    store.toggleHouseLights();
  });

  resetBtn.addEventListener('click', () => {
    store.reset();
  });

  // Subscribe UI to state store so external changes (e.g. clicking 3D house or Reset) stay in sync
  const unsubscribe = store.subscribe((state) => {
    // Time
    if (Math.abs(parseFloat(timeSlider.value) - state.timeOfDay) > 0.01) {
      timeSlider.value = String(state.timeOfDay);
    }
    const formattedTime = formatTimeLabel(state.timeOfDay);
    const phaseText = getTimePhaseLabel(state.timeOfDay);
    timeValue.textContent = formattedTime;
    timePhase.textContent = phaseText;
    timeSlider.setAttribute('aria-valuetext', `${formattedTime} (${phaseText})`);

    // Weather
    const isRain = state.weather === 'rain';
    weatherClearBtn.setAttribute('aria-pressed', String(!isRain));
    weatherRainBtn.setAttribute('aria-pressed', String(isRain));

    // Wind
    if (parseInt(windSlider.value, 10) !== state.windStrength) {
      windSlider.value = String(state.windStrength);
    }
    windValue.textContent = `${state.windStrength}%`;
    windSlider.setAttribute('aria-valuetext', `${state.windStrength}%`);

    // House Lights
    lightsBtn.setAttribute('aria-pressed', String(state.houseLightsOn));
    lightsLabel.textContent = state.houseLightsOn
      ? 'House Lights: On'
      : 'House Lights: Off';
  });

  return () => {
    unsubscribe();
    panel.remove();
  };
}

