import {
  WorldStore,
  describeTimeOfDay,
  formatClock,
  type Weather,
  type WorldState,
} from '../state';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element: ${id}`);
  return element as T;
}

export interface PanelOptions {
  store: WorldStore;
  onResetView: () => void;
}

export class ControlPanel {
  private readonly store: WorldStore;
  private readonly onResetView: () => void;
  private readonly panel = byId<HTMLElement>('panel');
  private readonly toggle = byId<HTMLButtonElement>('panel-toggle');
  private readonly toggleLabel = this.toggle.querySelector<HTMLElement>('.sheet-toggle__label');
  private readonly timeInput = byId<HTMLInputElement>('time');
  private readonly timeClock = byId<HTMLElement>('time-clock');
  private readonly timePeriod = byId<HTMLElement>('time-period');
  private readonly windInput = byId<HTMLInputElement>('wind');
  private readonly windOutput = byId<HTMLElement>('wind-output');
  private readonly lightsButton = byId<HTMLButtonElement>('lights');
  private readonly lightsState = byId<HTMLElement>('lights-state');
  private readonly resetButton = byId<HTMLButtonElement>('reset');
  private readonly liveTime = byId<HTMLElement>('live-time');
  private readonly liveWeather = byId<HTMLElement>('live-weather');
  private readonly liveLights = byId<HTMLElement>('live-lights');
  private readonly weatherButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-weather]'),
  );
  private readonly mobileQuery = window.matchMedia('(max-width: 820px), (max-height: 560px)');

  constructor(options: PanelOptions) {
    this.store = options.store;
    this.onResetView = options.onResetView;

    this.bindEvents();
    this.store.subscribe((state) => this.render(state));
    this.applyResponsiveState();
  }

  private bindEvents(): void {
    this.timeInput.addEventListener('input', () => {
      this.store.set({ time: Number(this.timeInput.value) });
    });

    this.windInput.addEventListener('input', () => {
      this.store.set({ wind: Number(this.windInput.value) / 100 });
    });

    for (const button of this.weatherButtons) {
      button.addEventListener('click', () => {
        const weather = button.dataset.weather as Weather;
        this.store.setWeather(weather);
      });
    }

    this.lightsButton.addEventListener('click', () => {
      this.store.toggleHouseLights();
    });

    this.resetButton.addEventListener('click', () => {
      this.store.reset();
      this.onResetView();
    });

    this.toggle.addEventListener('click', () => {
      const open = !this.panel.classList.contains('is-open');
      this.setOpen(open);
    });

    this.mobileQuery.addEventListener('change', () => this.applyResponsiveState());
  }

  private applyResponsiveState(): void {
    if (this.mobileQuery.matches) {
      this.setOpen(false);
    } else {
      this.setOpen(true);
    }
  }

  private setOpen(open: boolean): void {
    this.panel.classList.toggle('is-open', open);
    this.panel.classList.toggle('is-collapsed', !open);
    this.toggle.setAttribute('aria-expanded', String(open));
    if (this.toggleLabel) this.toggleLabel.textContent = open ? 'Hide' : 'Controls';
  }

  private render(state: Readonly<WorldState>): void {
    const clock = formatClock(state.time);
    const period = describeTimeOfDay(state.time);
    this.timeInput.value = String(state.time);
    this.timeClock.textContent = clock;
    this.timePeriod.textContent = period;
    this.timeInput.setAttribute('aria-valuetext', `${clock}, ${period.toLowerCase()}`);
    this.setFill(this.timeInput, (state.time / 24) * 100);

    const windPercent = Math.round(state.wind * 100);
    this.windInput.value = String(windPercent);
    this.windOutput.textContent = `${windPercent}%`;
    this.windInput.setAttribute('aria-valuetext', `${windPercent} percent`);
    this.setFill(this.windInput, state.wind * 100);

    for (const button of this.weatherButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.weather === state.weather));
    }

    this.lightsButton.setAttribute('aria-checked', String(state.houseLights));
    this.lightsState.textContent = state.houseLights ? 'On' : 'Off';

    const weatherLabel = state.weather === 'rain' ? 'Rain' : 'Clear';
    this.liveTime.textContent = clock;
    this.liveWeather.textContent = weatherLabel;
    this.liveLights.textContent = state.houseLights ? 'Lights on' : 'Lights off';
  }

  private setFill(input: HTMLInputElement, percent: number): void {
    input.style.setProperty('--fill', `${Math.max(0, Math.min(100, percent))}%`);
  }
}
