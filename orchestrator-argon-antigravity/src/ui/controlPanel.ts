import { WorldState, formatTimeOfDay } from '../state/worldState';

export interface ControlPanelCallbacks {
  onTimeChange: (timeOfDay: number) => void;
  onWeatherChange: (weather: 'clear' | 'rain') => void;
  onWindChange: (windStrength: number) => void;
  onToggleLights: () => void;
  onReset: () => void;
}

export class ControlPanel {
  private readonly root: HTMLElement;
  private readonly panelEl: HTMLElement;
  private readonly collapseBtn: HTMLButtonElement;
  private readonly headerSummary: HTMLSpanElement;
  private readonly timeSlider: HTMLInputElement;
  private readonly timeValue: HTMLSpanElement;
  private readonly clearBtn: HTMLButtonElement;
  private readonly rainBtn: HTMLButtonElement;
  private readonly windSlider: HTMLInputElement;
  private readonly windValue: HTMLSpanElement;
  private readonly lightsBtn: HTMLButtonElement;
  private readonly lightsBadge: HTMLSpanElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly callbacks: ControlPanelCallbacks;

  private isCollapsed = false;

  constructor(container: HTMLElement, initialState: WorldState, callbacks: ControlPanelCallbacks) {
    this.root = container;
    this.callbacks = callbacks;
    this.isCollapsed = typeof window !== 'undefined' && window.innerWidth <= 640;

    this.panelEl = document.createElement('aside');
    this.panelEl.className = 'pw-panel';
    this.panelEl.setAttribute('aria-label', 'Pocket World Controls');

    this.panelEl.innerHTML = `
      <div class="pw-header">
        <div class="pw-title-group">
          <h1 class="pw-title">Pocket World</h1>
          <span class="pw-summary" data-role="summary"></span>
        </div>
        <button
          type="button"
          class="pw-collapse-btn"
          data-role="collapse"
          aria-expanded="true"
          aria-controls="pw-controls-body"
          title="Toggle controls"
        >
          <span class="pw-chevron" aria-hidden="true"></span>
          <span class="sr-only">Toggle controls panel</span>
        </button>
      </div>

      <div id="pw-controls-body" class="pw-body">
        <div class="pw-control">
          <div class="pw-label-row">
            <label for="pw-time-slider" class="pw-label">Time of Day</label>
            <span class="pw-readout" data-role="time-value"></span>
          </div>
          <input
            id="pw-time-slider"
            class="pw-slider pw-slider-time"
            type="range"
            min="0"
            max="24"
            step="0.25"
            value="${initialState.timeOfDay}"
          />
        </div>

        <div class="pw-control">
          <span class="pw-label" id="pw-weather-label">Weather</span>
          <div class="pw-segmented" role="group" aria-labelledby="pw-weather-label">
            <button type="button" class="pw-seg-btn" data-weather="clear" aria-pressed="true">
              Clear
            </button>
            <button type="button" class="pw-seg-btn" data-weather="rain" aria-pressed="false">
              Rain
            </button>
          </div>
        </div>

        <div class="pw-control">
          <div class="pw-label-row">
            <label for="pw-wind-slider" class="pw-label">Wind</label>
            <span class="pw-readout" data-role="wind-value"></span>
          </div>
          <input
            id="pw-wind-slider"
            class="pw-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value="${initialState.windStrength}"
          />
        </div>

        <div class="pw-actions-row">
          <button
            type="button"
            class="pw-toggle-btn"
            data-role="lights"
            role="switch"
            aria-checked="false"
          >
            <span class="pw-toggle-label">House Lights</span>
            <span class="pw-toggle-pill" data-role="lights-badge">Off</span>
          </button>

          <button type="button" class="pw-reset-btn" data-role="reset">
            Reset
          </button>
        </div>

        <p class="pw-hint">
          Drag to orbit · Scroll or pinch to zoom · Click the house for lights
        </p>
      </div>
    `;

    this.root.appendChild(this.panelEl);

    this.collapseBtn = this.panelEl.querySelector('[data-role="collapse"]')!;
    this.headerSummary = this.panelEl.querySelector('[data-role="summary"]')!;
    this.timeSlider = this.panelEl.querySelector('#pw-time-slider')!;
    this.timeValue = this.panelEl.querySelector('[data-role="time-value"]')!;
    this.clearBtn = this.panelEl.querySelector('[data-weather="clear"]')!;
    this.rainBtn = this.panelEl.querySelector('[data-weather="rain"]')!;
    this.windSlider = this.panelEl.querySelector('#pw-wind-slider')!;
    this.windValue = this.panelEl.querySelector('[data-role="wind-value"]')!;
    this.lightsBtn = this.panelEl.querySelector('[data-role="lights"]')!;
    this.lightsBadge = this.panelEl.querySelector('[data-role="lights-badge"]')!;
    this.resetBtn = this.panelEl.querySelector('[data-role="reset"]')!;

    this.collapseBtn.addEventListener('click', this.handleCollapseToggle);
    this.timeSlider.addEventListener('input', this.handleTimeInput);
    this.clearBtn.addEventListener('click', this.handleClearClick);
    this.rainBtn.addEventListener('click', this.handleRainClick);
    this.windSlider.addEventListener('input', this.handleWindInput);
    this.lightsBtn.addEventListener('click', this.handleLightsClick);
    this.resetBtn.addEventListener('click', this.handleResetClick);

    this.applyCollapseState();
    this.sync(initialState);
  }

  public sync(state: WorldState): void {
    const { timeText, periodText } = formatTimeOfDay(state.timeOfDay);
    this.timeSlider.value = String(state.timeOfDay);
    this.timeValue.textContent = `${timeText} · ${periodText}`;
    this.headerSummary.textContent = `${timeText} · ${state.weather === 'rain' ? 'Rain' : periodText}`;

    const isRain = state.weather === 'rain';
    this.clearBtn.classList.toggle('is-active', !isRain);
    this.clearBtn.setAttribute('aria-pressed', String(!isRain));
    this.rainBtn.classList.toggle('is-active', isRain);
    this.rainBtn.setAttribute('aria-pressed', String(isRain));

    this.windSlider.value = String(state.windStrength);
    this.windValue.textContent = `${Math.round(state.windStrength)}%`;

    this.lightsBtn.classList.toggle('is-on', state.houseLightsOn);
    this.lightsBtn.setAttribute('aria-checked', String(state.houseLightsOn));
    this.lightsBadge.textContent = state.houseLightsOn ? 'On' : 'Off';
  }

  private applyCollapseState(): void {
    this.panelEl.classList.toggle('is-collapsed', this.isCollapsed);
    this.collapseBtn.setAttribute('aria-expanded', String(!this.isCollapsed));
  }

  private handleCollapseToggle = (): void => {
    this.isCollapsed = !this.isCollapsed;
    this.applyCollapseState();
  };

  private handleTimeInput = (): void => {
    this.callbacks.onTimeChange(Number(this.timeSlider.value));
  };

  private handleClearClick = (): void => {
    this.callbacks.onWeatherChange('clear');
  };

  private handleRainClick = (): void => {
    this.callbacks.onWeatherChange('rain');
  };

  private handleWindInput = (): void => {
    this.callbacks.onWindChange(Number(this.windSlider.value));
  };

  private handleLightsClick = (): void => {
    this.callbacks.onToggleLights();
  };

  private handleResetClick = (): void => {
    this.callbacks.onReset();
  };

  public dispose(): void {
    this.collapseBtn.removeEventListener('click', this.handleCollapseToggle);
    this.timeSlider.removeEventListener('input', this.handleTimeInput);
    this.clearBtn.removeEventListener('click', this.handleClearClick);
    this.rainBtn.removeEventListener('click', this.handleRainClick);
    this.windSlider.removeEventListener('input', this.handleWindInput);
    this.lightsBtn.removeEventListener('click', this.handleLightsClick);
    this.resetBtn.removeEventListener('click', this.handleResetClick);
    this.panelEl.remove();
  }
}
