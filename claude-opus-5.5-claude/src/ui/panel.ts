import { formatHour, phaseName } from '../env/timeOfDay';
import type { Store, Weather, WorldState } from '../state';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

export function windWord(w: number): string {
  if (w <= 0.001) return 'Still';
  if (w < 0.25) return 'Light breeze';
  if (w < 0.5) return 'Breezy';
  if (w < 0.78) return 'Windy';
  return 'Gale';
}

/**
 * The control panel. Inputs write to the store; a store subscription writes back to the
 * inputs, so the 3D click, keyboard, reset and the panel all show the same state.
 */
export class Panel {
  readonly root = $<HTMLElement>('panel');
  private readonly time = $<HTMLInputElement>('time');
  private readonly timeValue = $<HTMLOutputElement>('time-value');
  private readonly wind = $<HTMLInputElement>('wind');
  private readonly windValue = $<HTMLOutputElement>('wind-value');
  private readonly lights = $<HTMLButtonElement>('lights');
  private readonly lightsState = $<HTMLElement>('lights-state');
  private readonly summary = $<HTMLElement>('summary');
  private readonly toggle = $<HTMLButtonElement>('panel-toggle');
  private readonly announce = $<HTMLElement>('announce');
  private readonly mobileQuery = window.matchMedia('(max-width: 720px)');
  private readonly shortQuery = window.matchMedia('(max-height: 560px)');
  private night = false;

  constructor(
    store: Store,
    handlers: { onReset: () => void; onLayout: () => void },
  ) {
    this.time.addEventListener('input', () => store.set({ time: Number(this.time.value) }));
    this.wind.addEventListener('input', () => store.set({ wind: Number(this.wind.value) / 100 }));
    for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="weather"]')) {
      radio.addEventListener('change', () => {
        if (radio.checked) store.set({ weather: radio.value as Weather });
      });
    }
    this.lights.addEventListener('click', () => store.set({ lights: !store.get().lights }));
    $<HTMLButtonElement>('reset').addEventListener('click', handlers.onReset);

    this.toggle.addEventListener('click', () => {
      this.setOpen(this.root.dataset.open !== 'true');
      handlers.onLayout();
    });
    // Phones (and short landscape windows) start folded so the island gets the screen.
    this.setOpen(!this.mobileQuery.matches && !this.shortQuery.matches);
    this.mobileQuery.addEventListener('change', (e) => {
      this.setOpen(!e.matches);
      handlers.onLayout();
    });

    if (window.matchMedia('(pointer: coarse)').matches) {
      $('hint').textContent = 'Drag to orbit · Pinch to zoom · Tap the house to switch its lights';
    }

    store.subscribe((s, prev) => {
      this.sync(s);
      if (s.lights !== prev.lights) this.say(`House lights ${s.lights ? 'on' : 'off'}`);
      if (s.weather !== prev.weather) this.say(s.weather === 'rain' ? 'Rain starting' : 'Skies clearing');
    });
    this.sync(store.get());
  }

  get isMobile(): boolean {
    return this.mobileQuery.matches;
  }

  /** Screen space the panel takes from the scene: `left` on desktop, `bottom` on phones. */
  insets(resting = false): { left: number; bottom: number } {
    const rect = this.root.getBoundingClientRect();
    if (this.isMobile) {
      if (resting) return { left: 0, bottom: this.collapsedHeight() };
      return { left: 0, bottom: Math.max(0, window.innerHeight - rect.top) };
    }
    if (!resting && this.root.dataset.open !== 'true') return { left: 0, bottom: 0 };
    return { left: Math.max(0, rect.right), bottom: 0 };
  }

  private collapsedHeight(): number {
    const head = this.root.querySelector<HTMLElement>('.panel__head');
    return (head?.getBoundingClientRect().height ?? 64) + 16;
  }

  setNight(night: number): void {
    const isNight = this.night ? night > 0.4 : night > 0.55;
    if (isNight === this.night) return;
    this.night = isNight;
    document.documentElement.dataset.theme = isNight ? 'night' : 'day';
  }

  private setOpen(open: boolean): void {
    this.root.dataset.open = String(open);
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.setAttribute('aria-label', open ? 'Hide controls' : 'Show controls');
  }

  private sync(s: Readonly<WorldState>): void {
    if (Number(this.time.value) !== s.time) this.time.value = String(s.time);
    const clock = formatHour(s.time);
    const phase = phaseName(s.time);
    this.timeValue.innerHTML = `<b>${clock}</b> ${phase}`;
    this.time.setAttribute('aria-valuetext', `${clock}, ${phase}`);
    this.time.style.setProperty('--fill', `${(s.time / 24) * 100}%`);

    const pct = Math.round(s.wind * 100);
    if (Number(this.wind.value) !== pct) this.wind.value = String(pct);
    const word = windWord(s.wind);
    this.windValue.innerHTML = `<b>${pct}%</b> ${word}`;
    this.wind.setAttribute('aria-valuetext', `${pct} percent, ${word}`);
    this.wind.style.setProperty('--fill', `${pct}%`);

    for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="weather"]')) {
      radio.checked = radio.value === s.weather;
    }

    this.lights.setAttribute('aria-checked', String(s.lights));
    this.lightsState.textContent = s.lights ? 'On' : 'Off';

    this.summary.textContent = `${clock} · ${s.weather === 'rain' ? 'Rain' : 'Clear'} · ${word}`;
  }

  private say(text: string): void {
    this.announce.textContent = text;
  }
}
