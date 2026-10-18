import { type Store, type Weather, describeHour, formatHour } from '../state';
import type { Insets } from '../interaction/cameraRig';

const ICON_SUN = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/></g></svg>`;
const ICON_RAIN = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7 15.5a4.2 4.2 0 0 1-.4-8.4 5.4 5.4 0 0 1 10.3 1.3A3.6 3.6 0 0 1 17 15.5Z" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8.5 18.4 7.6 21M12.5 18.4l-.9 2.6M16.5 18.4l-.9 2.6"/></g></svg>`;
const ICON_CHEVRON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_RESET = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_ISLAND = `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false"><path d="M4 14.5c3-2.6 7-3.4 12-3.4s9 .8 12 3.4c-.6 1.6-2.4 2.6-4.6 2.9l-2.4 5.6c-.6 1.4-1.4 2.6-2.2 3.6-.4.5-1.2.5-1.6 0l-1.2-1.7-1.4 2.6c-.3.5-1 .5-1.3 0l-1.6-3.2-1.7-2.7c-1.7-.4-3-1.3-3.4-2.8-.2-.6-.2-1.2-.6-2.3Z" fill="#8a6a52"/><path d="M3.5 14.2c3.2-3.2 7.5-4.2 12.5-4.2s9.3 1 12.5 4.2c-3 1.7-7.5 2.3-12.5 2.3s-9.5-.6-12.5-2.3Z" fill="#7db663"/><path d="M12.200 7.700 16 3.800l3.800 3.900V10h-7.600Z" fill="#f1e6cf"/><path d="m11.200 8 4.800-4.600L20.800 8Z" fill="#c26a4a"/></svg>`;

const HINT = 'Drag to orbit, scroll or pinch to zoom, and tap the house to switch its lights.';

export class Panel {
  readonly element: HTMLElement;
  private readonly time: HTMLInputElement;
  private readonly timeMain: HTMLElement;
  private readonly timeSub: HTMLElement;
  private readonly wind: HTMLInputElement;
  private readonly windOut: HTMLElement;
  private readonly radios: HTMLInputElement[];
  private readonly lights: HTMLButtonElement;
  private readonly lightsText: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly live: HTMLElement;
  /** Must match the bottom-sheet media query in style.css. */
  private readonly narrow = window.matchMedia('(max-width: 640px), (orientation: portrait) and (max-width: 1000px)');
  private lastLights: boolean | null = null;

  constructor(
    host: HTMLElement,
    private readonly store: Store,
    private readonly actions: { onReset: () => void; onLayout: () => void },
  ) {
    const el = document.createElement('aside');
    el.className = 'panel';
    el.setAttribute('aria-label', 'Pocket World controls');
    el.innerHTML = `
      <header class="panel__head">
        <span class="panel__logo">${ICON_ISLAND}</span>
        <h1 class="panel__title">Pocket World</h1>
        <button class="panel__toggle" type="button" aria-expanded="true" aria-controls="panel-body" aria-label="Hide controls">${ICON_CHEVRON}</button>
      </header>
      <div class="panel__body" id="panel-body">
        <div class="control control--time">
          <div class="control__row">
            <label for="time">Time of day</label>
            <output id="time-out" for="time" class="control__value"><span class="control__main" id="time-main"></span><span class="control__sub" id="time-sub"></span></output>
          </div>
          <input class="slider slider--time" id="time" type="range" min="0" max="24" step="0.25" aria-describedby="time-out" />
          <div class="ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        </div>

        <fieldset class="control control--weather">
          <legend>Weather</legend>
          <div class="segmented">
            <label class="segmented__option"><input type="radio" name="weather" value="clear" /><span>${ICON_SUN}Clear</span></label>
            <label class="segmented__option"><input type="radio" name="weather" value="rain" /><span>${ICON_RAIN}Rain</span></label>
          </div>
        </fieldset>

        <div class="control">
          <div class="control__row">
            <label for="wind">Wind</label>
            <output id="wind-out" for="wind" class="control__value"></output>
          </div>
          <input class="slider slider--wind" id="wind" type="range" min="0" max="100" step="1" aria-describedby="wind-out" />
        </div>

        <div class="control control--inline">
          <span class="control__label" id="lights-label">House lights</span>
          <button class="switch" id="lights" type="button" role="switch" aria-checked="false" aria-labelledby="lights-label">
            <span class="switch__text"></span><span class="switch__thumb" aria-hidden="true"></span>
          </button>
        </div>

        <div class="panel__foot">
          <button class="reset" type="button">${ICON_RESET}<span>Reset</span></button>
          <p class="panel__hint">${HINT}</p>
        </div>
      </div>
      <div class="sr-only" role="status" aria-live="polite" id="panel-live"></div>
    `;
    // First in the document, so the controls come before the scene in the tab order.
    host.prepend(el);
    this.element = el;

    const q = <T extends HTMLElement>(sel: string): T => el.querySelector(sel) as T;
    this.time = q('#time');
    this.timeMain = q('#time-main');
    this.timeSub = q('#time-sub');
    this.wind = q('#wind');
    this.windOut = q('#wind-out');
    this.lights = q('#lights');
    this.lightsText = q('.switch__text');
    this.toggle = q('.panel__toggle');
    this.live = q('#panel-live');
    this.radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[name="weather"]'));

    this.time.addEventListener('input', () => this.store.set({ hour: parseFloat(this.time.value) }));
    this.wind.addEventListener('input', () => this.store.set({ wind: parseFloat(this.wind.value) / 100 }));
    for (const r of this.radios) {
      r.addEventListener('change', () => {
        if (r.checked) this.store.set({ weather: r.value as Weather });
      });
    }
    this.lights.addEventListener('click', () => this.store.toggleLights());
    q<HTMLButtonElement>('.reset').addEventListener('click', () => this.actions.onReset());
    this.toggle.addEventListener('click', () => this.setCollapsed(!this.collapsed));

    this.store.subscribe(() => this.render());
    this.render();

    // On phones the panel is a bottom sheet; start it closed only if the screen is very short.
    // (The app has not finished building yet, so it is not told about the layout; it measures afterwards.)
    if (this.narrow.matches && window.innerHeight < 520) this.setCollapsed(true, false);

    new ResizeObserver(() => this.actions.onLayout()).observe(el);
    this.narrow.addEventListener('change', () => this.actions.onLayout());
  }

  get collapsed(): boolean {
    return this.element.classList.contains('is-collapsed');
  }

  private setCollapsed(value: boolean, notify = true): void {
    this.element.classList.toggle('is-collapsed', value);
    this.toggle.setAttribute('aria-expanded', String(!value));
    this.toggle.setAttribute('aria-label', value ? 'Show controls' : 'Hide controls');
    if (notify) this.actions.onLayout();
  }

  /** Pushes the store into every control. Both the panel and the 3D house write to the store. */
  private render(): void {
    const s = this.store.state;
    this.time.value = String(s.hour);
    this.timeMain.textContent = formatHour(s.hour);
    this.timeSub.textContent = describeHour(s.hour);
    this.time.setAttribute('aria-valuetext', `${formatHour(s.hour)}, ${describeHour(s.hour)}`);

    this.wind.value = String(Math.round(s.wind * 100));
    this.windOut.textContent = `${Math.round(s.wind * 100)}%`;
    this.wind.setAttribute('aria-valuetext', `${Math.round(s.wind * 100)} percent`);

    for (const r of this.radios) r.checked = r.value === s.weather;

    this.lights.setAttribute('aria-checked', String(s.lights));
    this.lights.classList.toggle('is-on', s.lights);
    this.lightsText.textContent = s.lights ? 'On' : 'Off';
    if (this.lastLights !== null && this.lastLights !== s.lights) {
      this.live.textContent = s.lights ? 'House lights on' : 'House lights off';
    }
    this.lastLights = s.lights;

    this.paintSliders();
  }

  private paintSliders(): void {
    const fill = (input: HTMLInputElement): void => {
      const min = parseFloat(input.min);
      const max = parseFloat(input.max);
      input.style.setProperty('--fill', `${((parseFloat(input.value) - min) / (max - min)) * 100}%`);
    };
    fill(this.time);
    fill(this.wind);
  }

  /** Marks the panel as night-themed once it is dark outside. */
  setTone(night: boolean): void {
    if (this.element.dataset.tone === (night ? 'night' : 'day')) return;
    this.element.dataset.tone = night ? 'night' : 'day';
    document.documentElement.dataset.tone = night ? 'night' : 'day';
  }

  /** Space the panel covers, so the camera can frame the island in what is left. */
  get insets(): Insets {
    const rect = this.element.getBoundingClientRect();
    if (this.narrow.matches) {
      return { left: 0, right: 0, top: 0, bottom: Math.max(0, window.innerHeight - rect.top) };
    }
    return { left: rect.right + 14, right: 0, top: 0, bottom: 0 };
  }

  dispose(): void {
    this.element.remove();
  }
}
