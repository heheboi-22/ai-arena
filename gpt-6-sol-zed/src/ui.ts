import type { AppState } from './state';

function clockTime(hour: number): string {
  const minutes = Math.round(hour * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function getControl<T extends Element>(host: HTMLElement, selector: string): T {
  const control = host.querySelector<T>(selector);
  if (!control) throw new Error(`Pocket World control not found: ${selector}`);
  return control;
}

export function createUI(
  host: HTMLElement,
  initial: AppState,
  onChange: (patch: Partial<AppState>) => void,
  onReset: () => void,
): { sync(state: AppState): void } {
  host.innerHTML = `
    <div class="field-guide">
      <header class="field-guide__header">
        <span class="field-guide__edition">A little weather study</span>
        <h1 class="field-guide__title">Pocket World<span aria-hidden="true">.</span></h1>
        <p class="field-guide__intro">An island for changing the hour, and watching what follows.</p>
      </header>

      <details class="instrument" open>
        <summary class="instrument__summary">
          <span>World controls</span>
          <span class="instrument__summary-mark" aria-hidden="true">+</span>
        </summary>
        <div class="instrument__body">
          <h2 class="instrument__heading">Set the scene</h2>

          <div class="control-group">
            <div class="control-group__heading">
              <label for="pocket-time">Time of day</label>
              <output id="pocket-time-value" for="pocket-time">16:00</output>
            </div>
            <input id="pocket-time" class="control-range" type="range" min="0" max="24" step="0.25" value="16" aria-valuetext="16:00" />
            <div class="range-ends" aria-hidden="true"><span>00:00</span><span>24:00</span></div>
          </div>

          <div class="control-group">
            <div class="control-group__heading">
              <span id="pocket-weather-label">Weather</span>
            </div>
            <div class="weather-options" role="group" aria-labelledby="pocket-weather-label">
              <button class="weather-options__clear" type="button" aria-pressed="true">Clear</button>
              <button class="weather-options__rain" type="button" aria-pressed="false">Rain</button>
            </div>
          </div>

          <div class="control-group">
            <div class="control-group__heading">
              <label for="pocket-wind">Wind</label>
              <output id="pocket-wind-value" for="pocket-wind">30%</output>
            </div>
            <input id="pocket-wind" class="control-range" type="range" min="0" max="100" step="1" value="30" aria-valuetext="30 percent" />
            <div class="range-ends" aria-hidden="true"><span>Still</span><span>Breezy</span></div>
          </div>

          <div class="control-group control-group--lights">
            <button class="light-switch" type="button" aria-pressed="false">
              <span class="light-switch__copy">House lights <span class="light-switch__status" aria-hidden="true">Off</span></span>
              <span class="light-switch__track" aria-hidden="true"><span class="light-switch__knob"></span></span>
            </button>
          </div>

          <div class="instrument__footer">
            <button class="reset-scene" type="button">Reset scene</button>
            <p class="instrument__mobile-help">Drag to orbit. Pinch to zoom. Tap the house for lights.</p>
          </div>
        </div>
      </details>
    </div>

    <aside class="scene-hint" aria-label="How to explore the island">
      <span class="scene-hint__title">Take a closer look</span>
      <p>Drag to orbit. Scroll or pinch to zoom.<br />Tap the house for lights.</p>
    </aside>
  `;

  const details = getControl<HTMLDetailsElement>(host, '.instrument');
  const timeInput = getControl<HTMLInputElement>(host, '#pocket-time');
  const timeOutput = getControl<HTMLOutputElement>(host, '#pocket-time-value');
  const windInput = getControl<HTMLInputElement>(host, '#pocket-wind');
  const windOutput = getControl<HTMLOutputElement>(host, '#pocket-wind-value');
  const clearButton = getControl<HTMLButtonElement>(host, '.weather-options__clear');
  const rainButton = getControl<HTMLButtonElement>(host, '.weather-options__rain');
  const lightsButton = getControl<HTMLButtonElement>(host, '.light-switch');
  const lightsStatus = getControl<HTMLElement>(host, '.light-switch__status');
  const resetButton = getControl<HTMLButtonElement>(host, '.reset-scene');
  let current = initial;

  function sync(state: AppState): void {
    current = state;
    const time = clockTime(state.time);
    timeInput.value = String(state.time);
    timeInput.setAttribute('aria-valuetext', time);
    timeInput.style.setProperty('--fill', `${(state.time / 24) * 100}%`);
    timeOutput.value = time;

    windInput.value = String(state.wind);
    windInput.setAttribute('aria-valuetext', `${Math.round(state.wind)} percent`);
    windInput.style.setProperty('--fill', `${state.wind}%`);
    windOutput.value = `${Math.round(state.wind)}%`;

    clearButton.setAttribute('aria-pressed', String(state.weather === 'clear'));
    rainButton.setAttribute('aria-pressed', String(state.weather === 'rain'));
    lightsButton.setAttribute('aria-pressed', String(state.lights));
    lightsStatus.textContent = state.lights ? 'On' : 'Off';
  }

  function change(patch: Partial<AppState>): void {
    sync({ ...current, ...patch });
    onChange(patch);
  }

  timeInput.addEventListener('input', () => change({ time: Number(timeInput.value) }));
  windInput.addEventListener('input', () => change({ wind: Number(windInput.value) }));
  clearButton.addEventListener('click', () => change({ weather: 'clear' }));
  rainButton.addEventListener('click', () => change({ weather: 'rain' }));
  lightsButton.addEventListener('click', () => change({ lights: !current.lights }));
  resetButton.addEventListener('click', onReset);

  const mobileLayout = window.matchMedia('(max-width: 700px)');
  const setLayout = () => {
    details.open = !mobileLayout.matches;
    host.classList.toggle('is-drawer-open', details.open);
  };
  setLayout();
  mobileLayout.addEventListener('change', setLayout);
  details.addEventListener('toggle', () => host.classList.toggle('is-drawer-open', details.open));

  sync(initial);
  return { sync };
}
