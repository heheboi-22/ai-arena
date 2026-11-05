import { formatClock, phaseForHour, windLabel } from '../environment/palette';
import type { PocketStore, WorldState } from '../state';

interface PanelOptions {
  onReset: () => void;
  onLayoutChange: () => void;
}

const compactQuery = '(max-width: 1099px)';

export class Panel {
  private readonly store: PocketStore;
  private readonly options: PanelOptions;
  private readonly panel: HTMLElement;
  private readonly panelBody: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly toggleLabel: HTMLElement;
  private readonly timeRange: HTMLInputElement;
  private readonly timeClock: HTMLElement;
  private readonly timePhase: HTMLElement;
  private readonly windRange: HTMLInputElement;
  private readonly windPercent: HTMLElement;
  private readonly windNote: HTMLElement;
  private readonly weatherButtons: HTMLButtonElement[];
  private readonly lightsToggle: HTMLButtonElement;
  private readonly lightsState: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly unsubscribe: () => void;
  private readonly compactMedia = window.matchMedia(compactQuery);
  private compact = this.compactMedia.matches;
  private open = !this.compact;

  constructor(store: PocketStore, options: PanelOptions) {
    this.store = store;
    this.options = options;
    this.panel = this.requireElement<HTMLElement>('#panel');
    this.panelBody = this.requireElement<HTMLElement>('#panel-body');
    this.toggle = this.requireElement<HTMLButtonElement>('#panel-toggle');
    this.toggleLabel = this.requireElement<HTMLElement>('#panel-toggle-label');
    this.timeRange = this.requireElement<HTMLInputElement>('#time-range');
    this.timeClock = this.requireElement<HTMLElement>('#time-clock');
    this.timePhase = this.requireElement<HTMLElement>('#time-phase');
    this.windRange = this.requireElement<HTMLInputElement>('#wind-range');
    this.windPercent = this.requireElement<HTMLElement>('#wind-percent');
    this.windNote = this.requireElement<HTMLElement>('#wind-label');
    this.lightsToggle = this.requireElement<HTMLButtonElement>('#lights-toggle');
    this.lightsState = this.requireElement<HTMLElement>('#lights-state');
    this.summary = this.requireElement<HTMLElement>('#panel-summary');
    this.resetButton = this.requireElement<HTMLButtonElement>('#reset-button');
    this.weatherButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-weather]')
    );

    this.bindEvents();
    this.applyOpenState(this.open, false);
    this.unsubscribe = store.subscribe((state) => this.render(state));
    this.compactMedia.addEventListener('change', this.handleCompactChange);
  }

  private requireElement<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }

  private bindEvents(): void {
    this.timeRange.addEventListener('input', () => {
      const minutes = Number(this.timeRange.value);
      this.store.set({ hour: minutes / 60 });
    });

    this.windRange.addEventListener('input', () => {
      this.store.set({ wind: Number(this.windRange.value) / 100 });
    });

    for (const button of this.weatherButtons) {
      button.addEventListener('click', () => {
        const weather = button.dataset.weather;
        if (weather === 'clear' || weather === 'rain') {
          this.store.set({ weather });
        }
      });
    }

    this.lightsToggle.addEventListener('click', () => {
      this.store.set({ houseLights: !this.store.snapshot.houseLights });
    });

    this.resetButton.addEventListener('click', () => this.options.onReset());
    this.toggle.addEventListener('click', () => {
      this.applyOpenState(!this.open, true);
    });

    this.panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.compact && this.open) {
        this.applyOpenState(false, true);
        this.toggle.focus();
      }
    });
  }

  private handleCompactChange = (event: MediaQueryListEvent): void => {
    this.compact = event.matches;
    if (this.compact) {
      this.applyOpenState(false, true);
    } else {
      this.open = true;
      this.panelBody.hidden = false;
      this.panel.classList.remove('is-open');
      this.toggle.setAttribute('aria-expanded', 'true');
      this.toggleLabel.textContent = 'Hide';
      this.options.onLayoutChange();
    }
  };

  private applyOpenState(open: boolean, notify: boolean): void {
    this.open = open;
    this.panel.classList.toggle('is-open', open);
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggleLabel.textContent = open ? 'Hide' : 'Controls';
    if (this.compact) {
      this.panelBody.hidden = !open;
    } else {
      this.panelBody.hidden = false;
    }
    if (notify) {
      window.requestAnimationFrame(() => this.options.onLayoutChange());
    }
  }

  private render(state: Readonly<WorldState>): void {
    const totalMinutes = Math.round(state.hour * 60);
    const clock = totalMinutes >= 24 * 60 ? '24:00' : formatClock(state.hour);
    const phase = phaseForHour(state.hour);
    const percent = Math.round(state.wind * 100);
    const breeze = windLabel(state.wind);
    const weatherLabel = state.weather === 'rain' ? 'Rain' : 'Clear';

    this.timeClock.textContent = clock;
    this.timePhase.textContent = phase;
    this.timeRange.value = String(Math.round(state.hour * 60));
    this.timeRange.setAttribute('aria-valuetext', `${clock}, ${phase}`);
    this.timeRange.style.setProperty('--fill', `${(state.hour / 24) * 100}%`);

    this.windPercent.textContent = `${percent}%`;
    this.windNote.textContent = breeze;
    this.windRange.value = String(percent);
    this.windRange.style.setProperty('--fill', `${percent}%`);
    this.windRange.setAttribute('aria-valuetext', `${percent} percent, ${breeze}`);

    for (const button of this.weatherButtons) {
      const active = button.dataset.weather === state.weather;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    this.lightsToggle.setAttribute('aria-checked', String(state.houseLights));
    this.lightsState.textContent = state.houseLights ? 'On' : 'Off';
    this.summary.textContent = `${clock} · ${weatherLabel} · ${breeze}`;
  }

  get element(): HTMLElement {
    return this.panel;
  }

  destroy(): void {
    this.unsubscribe();
    this.compactMedia.removeEventListener('change', this.handleCompactChange);
  }
}


