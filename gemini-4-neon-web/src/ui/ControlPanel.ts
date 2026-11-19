import {
  WorldState,
  WorldStateStore,
  formatTimeMinutes,
  getTimePhaseLabel,
} from "../state/worldState";

export interface ControlPanelHandle {
  dispose: () => void;
}

export function createControlPanel(
  root: HTMLElement,
  store: WorldStateStore
): ControlPanelHandle {
  const isInitiallyMobile = window.innerWidth < 768;
  let collapsed = isInitiallyMobile;

  root.innerHTML = "";

  // 1. Top-left editorial title + brief interaction guidance (unboxed, clean typography)
  const header = document.createElement("header");
  header.className = "pw-brand";
  header.innerHTML = `
    <h1 class="pw-title">Pocket World</h1>
    <p class="pw-hint">Drag to orbit · Scroll to zoom · Click house for lights</p>
  `;
  root.appendChild(header);

  // 2. Bottom collapsible control dock (zero center viewport occlusion)
  const dockWrapper = document.createElement("aside");
  dockWrapper.className = "pw-dock-wrap";
  dockWrapper.setAttribute("aria-label", "Environment controls");

  const toggleBar = document.createElement("div");
  toggleBar.className = "pw-dock-handle-row";

  const collapseBtn = document.createElement("button");
  collapseBtn.type = "button";
  collapseBtn.className = "pw-collapse-btn";
  collapseBtn.setAttribute("aria-expanded", String(!collapsed));
  collapseBtn.setAttribute("aria-controls", "pw-controls-panel");
  toggleBar.appendChild(collapseBtn);
  dockWrapper.appendChild(toggleBar);

  const panel = document.createElement("div");
  panel.id = "pw-controls-panel";
  panel.className = "pw-panel";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Pocket World settings");

  // Control 1: Time of Day
  const timeGroup = document.createElement("div");
  timeGroup.className = "pw-control pw-control-slider";
  timeGroup.innerHTML = `
    <div class="pw-label-row">
      <label class="pw-label" for="pw-time-slider">Time of day</label>
      <span class="pw-value" id="pw-time-readout" aria-live="off">16:00 · Afternoon</span>
    </div>
    <input
      id="pw-time-slider"
      class="pw-range"
      type="range"
      min="0"
      max="1440"
      step="5"
      value="960"
      aria-label="Time of day"
    />
  `;

  // Control 2: Weather (Clear / Rain)
  const weatherGroup = document.createElement("div");
  weatherGroup.className = "pw-control pw-control-compact";
  weatherGroup.innerHTML = `
    <span class="pw-label" id="pw-weather-label">Weather</span>
    <div class="pw-segmented" role="group" aria-labelledby="pw-weather-label">
      <button type="button" class="pw-seg-btn" data-weather="clear" aria-pressed="true">Clear</button>
      <button type="button" class="pw-seg-btn" data-weather="rain" aria-pressed="false">Rain</button>
    </div>
  `;

  // Control 3: Wind Strength
  const windGroup = document.createElement("div");
  windGroup.className = "pw-control pw-control-slider";
  windGroup.innerHTML = `
    <div class="pw-label-row">
      <label class="pw-label" for="pw-wind-slider">Wind</label>
      <span class="pw-value" id="pw-wind-readout">30%</span>
    </div>
    <input
      id="pw-wind-slider"
      class="pw-range"
      type="range"
      min="0"
      max="100"
      step="1"
      value="30"
      aria-label="Wind strength"
    />
  `;

  // Control 4: House Lights + Reset
  const actionsGroup = document.createElement("div");
  actionsGroup.className = "pw-control pw-control-actions";
  actionsGroup.innerHTML = `
    <span class="pw-label" id="pw-house-label">Cottage</span>
    <div class="pw-action-row">
      <button type="button" id="pw-lights-btn" class="pw-toggle-btn" aria-pressed="false">
        Lights: Off
      </button>
      <button type="button" id="pw-reset-btn" class="pw-reset-btn">
        Reset
      </button>
    </div>
  `;

  panel.append(timeGroup, weatherGroup, windGroup, actionsGroup);
  dockWrapper.appendChild(panel);
  root.appendChild(dockWrapper);

  // Element refs
  const timeSlider = panel.querySelector("#pw-time-slider") as HTMLInputElement;
  const timeReadout = panel.querySelector("#pw-time-readout") as HTMLSpanElement;
  const clearBtn = panel.querySelector('[data-weather="clear"]') as HTMLButtonElement;
  const rainBtn = panel.querySelector('[data-weather="rain"]') as HTMLButtonElement;
  const windSlider = panel.querySelector("#pw-wind-slider") as HTMLInputElement;
  const windReadout = panel.querySelector("#pw-wind-readout") as HTMLSpanElement;
  const lightsBtn = panel.querySelector("#pw-lights-btn") as HTMLButtonElement;
  const resetBtn = panel.querySelector("#pw-reset-btn") as HTMLButtonElement;

  const updateCollapsedVisual = (state: WorldState) => {
    dockWrapper.classList.toggle("is-collapsed", collapsed);
    panel.hidden = collapsed;
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    const timeText = formatTimeMinutes(state.timeMinutes);
    collapseBtn.textContent = collapsed
      ? `Controls · ${timeText}`
      : "Hide controls";
  };

  const syncUi = (state: WorldState) => {
    const roundedMin = Math.round(state.timeMinutes);
    timeSlider.value = String(roundedMin);
    const formatted = formatTimeMinutes(roundedMin);
    const phase = getTimePhaseLabel(roundedMin);
    timeReadout.textContent = `${formatted} · ${phase}`;
    timeSlider.setAttribute("aria-valuetext", `${formatted}, ${phase}`);

    const isRain = state.weather === "rain";
    clearBtn.setAttribute("aria-pressed", String(!isRain));
    rainBtn.setAttribute("aria-pressed", String(isRain));
    clearBtn.classList.toggle("is-active", !isRain);
    rainBtn.classList.toggle("is-active", isRain);

    const windPct = Math.round(state.windStrength * 100);
    windSlider.value = String(windPct);
    windReadout.textContent = `${windPct}%`;
    windSlider.setAttribute("aria-valuetext", `${windPct} percent`);

    lightsBtn.setAttribute("aria-pressed", String(state.houseLightsOn));
    lightsBtn.classList.toggle("is-active", state.houseLightsOn);
    lightsBtn.textContent = state.houseLightsOn ? "Lights: On" : "Lights: Off";

    updateCollapsedVisual(state);
  };

  // Event listeners
  const onTimeInput = () => {
    store.setTimeMinutes(Number(timeSlider.value));
  };
  const onClearClick = () => {
    store.setWeather("clear");
  };
  const onRainClick = () => {
    store.setWeather("rain");
  };
  const onWindInput = () => {
    store.setWindStrength(Number(windSlider.value) / 100);
  };
  const onLightsClick = () => {
    store.toggleHouseLights();
  };
  const onResetClick = () => {
    store.reset();
  };
  const onCollapseClick = () => {
    collapsed = !collapsed;
    updateCollapsedVisual(store.getState());
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
      return;
    }
    if (e.key === "h" || e.key === "H") {
      collapsed = !collapsed;
      updateCollapsedVisual(store.getState());
    } else if (e.key === "l" || e.key === "L") {
      store.toggleHouseLights();
    } else if (e.key === "r" || e.key === "R") {
      store.reset();
    }
  };

  timeSlider.addEventListener("input", onTimeInput);
  clearBtn.addEventListener("click", onClearClick);
  rainBtn.addEventListener("click", onRainClick);
  windSlider.addEventListener("input", onWindInput);
  lightsBtn.addEventListener("click", onLightsClick);
  resetBtn.addEventListener("click", onResetClick);
  collapseBtn.addEventListener("click", onCollapseClick);
  window.addEventListener("keydown", onKeyDown);

  const unsubscribe = store.subscribe((nextState) => {
    syncUi(nextState);
  });

  // Initial sync
  syncUi(store.getState());

  return {
    dispose: () => {
      unsubscribe();
      timeSlider.removeEventListener("input", onTimeInput);
      clearBtn.removeEventListener("click", onClearClick);
      rainBtn.removeEventListener("click", onRainClick);
      windSlider.removeEventListener("input", onWindInput);
      lightsBtn.removeEventListener("click", onLightsClick);
      resetBtn.removeEventListener("click", onResetClick);
      collapseBtn.removeEventListener("click", onCollapseClick);
      window.removeEventListener("keydown", onKeyDown);
      root.innerHTML = "";
    },
  };
}
