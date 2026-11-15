import {
  describeTimePhase,
  formatTimeMinutes,
  type WeatherMode,
  type WorldState,
} from "../state";

export interface ControlPanelCallbacks {
  onTimeChange: (minutes: number) => void;
  onWeatherChange: (weather: WeatherMode) => void;
  onWindChange: (strength: number) => void;
  onLightsToggle: () => void;
  onReset: () => void;
}

export interface ControlPanelController {
  sync: (state: WorldState) => void;
  dispose: () => void;
}

export function createControlPanel(
  mount: HTMLElement,
  initialState: WorldState,
  callbacks: ControlPanelCallbacks
): ControlPanelController {
  const isCompactStart =
    window.innerWidth < 640 || window.innerHeight < 520;
  let collapsed = isCompactStart;

  mount.innerHTML = `
    <header class="title-block">
      <h1 class="world-title">Pocket World</h1>
      <p class="world-hint">Drag to orbit · Scroll to zoom · Click cottage for lights</p>
    </header>

    <section class="dock-wrapper ${collapsed ? "is-collapsed" : ""}" aria-label="Environment controls">
      <button
        type="button"
        class="dock-toggle"
        aria-expanded="${!collapsed}"
        aria-controls="pocket-controls-panel"
      >
        <span class="dock-toggle-label">${collapsed ? "Show Controls" : "Hide Controls"}</span>
      </button>

      <div id="pocket-controls-panel" class="dock-panel">
        <div class="control-group control-time">
          <div class="control-header">
            <label for="time-slider" class="control-label">Time of Day</label>
            <span class="control-readout" id="time-readout"></span>
          </div>
          <input
            id="time-slider"
            class="range-input"
            type="range"
            min="0"
            max="1440"
            step="5"
            aria-label="Time of day"
          />
        </div>

        <div class="control-group control-wind">
          <div class="control-header">
            <label for="wind-slider" class="control-label">Wind</label>
            <span class="control-readout" id="wind-readout"></span>
          </div>
          <input
            id="wind-slider"
            class="range-input"
            type="range"
            min="0"
            max="100"
            step="1"
            aria-label="Wind strength"
          />
        </div>

        <div class="control-group control-weather">
          <span class="control-label" id="weather-group-label">Weather</span>
          <div class="segmented" role="group" aria-labelledby="weather-group-label">
            <button type="button" class="seg-btn" data-weather="clear" aria-pressed="true">Clear</button>
            <button type="button" class="seg-btn" data-weather="rain" aria-pressed="false">Rain</button>
          </div>
        </div>

        <div class="control-actions">
          <button type="button" class="action-btn lights-btn" id="lights-toggle" aria-pressed="false">
            Lights Off
          </button>
          <button type="button" class="action-btn reset-btn" id="reset-btn">
            Reset
          </button>
        </div>
      </div>
    </section>
  `;

  const wrapper = mount.querySelector(".dock-wrapper") as HTMLElement;
  const toggleBtn = mount.querySelector(".dock-toggle") as HTMLButtonElement;
  const toggleLabel = mount.querySelector(".dock-toggle-label") as HTMLSpanElement;
  const timeSlider = mount.querySelector("#time-slider") as HTMLInputElement;
  const timeReadout = mount.querySelector("#time-readout") as HTMLSpanElement;
  const windSlider = mount.querySelector("#wind-slider") as HTMLInputElement;
  const windReadout = mount.querySelector("#wind-readout") as HTMLSpanElement;
  const clearBtn = mount.querySelector(`[data-weather="clear"]`) as HTMLButtonElement;
  const rainBtn = mount.querySelector(`[data-weather="rain"]`) as HTMLButtonElement;
  const lightsBtn = mount.querySelector("#lights-toggle") as HTMLButtonElement;
  const resetBtn = mount.querySelector("#reset-btn") as HTMLButtonElement;

  const setCollapsed = (next: boolean) => {
    collapsed = next;
    wrapper.classList.toggle("is-collapsed", collapsed);
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleLabel.textContent = collapsed ? "Show Controls" : "Hide Controls";
  };

  const onToggleClick = () => setCollapsed(!collapsed);
  const onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT") return;
    if (e.key === "h" || e.key === "H") {
      setCollapsed(!collapsed);
    }
  };
  const onTimeInput = () => {
    callbacks.onTimeChange(Number(timeSlider.value));
  };
  const onWindInput = () => {
    callbacks.onWindChange(Number(windSlider.value) / 100);
  };
  const onClearClick = () => callbacks.onWeatherChange("clear");
  const onRainClick = () => callbacks.onWeatherChange("rain");
  const onLightsClick = () => callbacks.onLightsToggle();
  const onResetClick = () => callbacks.onReset();

  toggleBtn.addEventListener("click", onToggleClick);
  window.addEventListener("keydown", onKeyDown);
  timeSlider.addEventListener("input", onTimeInput);
  windSlider.addEventListener("input", onWindInput);
  clearBtn.addEventListener("click", onClearClick);
  rainBtn.addEventListener("click", onRainClick);
  lightsBtn.addEventListener("click", onLightsClick);
  resetBtn.addEventListener("click", onResetClick);

  const sync = (state: WorldState) => {
    timeSlider.value = String(Math.round(state.timeMinutes));
    timeReadout.textContent = `${formatTimeMinutes(state.timeMinutes)} · ${describeTimePhase(state.timeMinutes)}`;

    const windPct = Math.round(state.windStrength * 100);
    windSlider.value = String(windPct);
    windReadout.textContent = `${windPct}%`;

    const isRain = state.weather === "rain";
    clearBtn.classList.toggle("is-active", !isRain);
    clearBtn.setAttribute("aria-pressed", String(!isRain));
    rainBtn.classList.toggle("is-active", isRain);
    rainBtn.setAttribute("aria-pressed", String(isRain));

    lightsBtn.classList.toggle("is-on", state.houseLights);
    lightsBtn.setAttribute("aria-pressed", String(state.houseLights));
    lightsBtn.textContent = state.houseLights ? "Lights On" : "Lights Off";
  };

  sync(initialState);

  const dispose = () => {
    toggleBtn.removeEventListener("click", onToggleClick);
    window.removeEventListener("keydown", onKeyDown);
    timeSlider.removeEventListener("input", onTimeInput);
    windSlider.removeEventListener("input", onWindInput);
    clearBtn.removeEventListener("click", onClearClick);
    rainBtn.removeEventListener("click", onRainClick);
    lightsBtn.removeEventListener("click", onLightsClick);
    resetBtn.removeEventListener("click", onResetClick);
  };

  return {
    sync,
    dispose,
  };
}
