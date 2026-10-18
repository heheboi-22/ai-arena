import type { Store } from './state';
import { timeLabel, timeMood } from './state';

const paths: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="3.7"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>',
  rain: '<path d="M6 15a4 4 0 0 1-.3-8A6 6 0 0 1 17 6a4.5 4.5 0 0 1 1 9M8 17l-1 3m6-3-1 3m6-3-1 3"/>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a2 2 0 1 1-2 2"/>',
  moon: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>',
  lamp: '<path d="M9 18h6m-5 3h4m-5-6c0-2-3-2.6-3-6a6 6 0 1 1 12 0c0 3.4-3 4-3 6v1H9z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1.8 8M3 4v6h6"/>',
  arrow: '<path d="m8 10 4 4 4-4"/>',
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="4.8" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
};
export const icon = (name: string, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;

export function createUI(app: HTMLElement, store: Store, onReset: () => void) {
  app.innerHTML = `
    <header class="brand">
      <a class="brand-mark" href="./" aria-label="Pocket World home">
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="m4 20 14-7 14 7-14 8L4 20Z" fill="#acba82"/><path d="m4 20 14 8 14-8-7 12-7 3-7-3-7-12Z" fill="#9b8972"/><path d="M14 12h9v10h-9z" fill="#f5ead1"/><path d="m11 13 7-8 8 8H11Z" fill="#b96c4b"/><path d="M17 18h3v5h-3z" fill="#6b785c"/></svg>
        <span>A LITTLE PLACE TO PAUSE</span>
      </a>
      <h1>Pocket World<span class="title-dot">.</span></h1>
      <p>A little world.<br>A moment to yourself.</p>
    </header>
    <div class="edition"><span class="edition-line"></span><span>NO. 001 &nbsp; / &nbsp; THE QUIET MEADOW</span></div>
    <main id="world" class="world" aria-label="Your pocket world">
      <div id="loading" class="loading"><span></span>Growing your little world…</div>
      <div id="world-error" class="world-error" role="alert" hidden></div>
    </main>
    <aside class="controls" aria-label="Environment controls">
      <button class="mobile-handle" id="panel-toggle" aria-expanded="true" aria-controls="panel-content"><span>Make it your moment</span>${icon('arrow')}</button>
      <div id="panel-content" class="panel-content">
        <div class="panel-heading"><span class="small-dot"></span> MAKE IT YOUR MOMENT</div>
        <div class="control-section time-section">
          <div class="control-label"><label for="time">${icon('sun')}Time of day</label><output for="time" id="time-output">16:00</output></div>
          <input id="time" type="range" min="0" max="24" step="0.25" value="16" aria-valuetext="16:00" />
          <div class="range-caption"><span>Midnight</span><span>Noon</span><span>Midnight</span></div>
        </div>
        <div class="control-section weather-section">
          <span class="field-label" id="weather-label">A change in the weather</span>
          <div class="weather-picker" role="group" aria-labelledby="weather-label">
            <button id="clear" aria-pressed="true">${icon('sun')}Clear</button>
            <button id="rain" aria-pressed="false">${icon('rain')}Rain</button>
          </div>
        </div>
        <div class="control-section wind-section">
          <div class="control-label"><label for="wind">${icon('wind')}A little breeze</label><output for="wind" id="wind-output">30<span>%</span></output></div>
          <input id="wind" type="range" min="0" max="100" step="1" value="30" aria-valuetext="30 percent wind strength" />
          <div class="range-caption"><span>Still</span><span>Windy</span></div>
        </div>
        <div class="lights-section">
          <div><label id="lights-label">${icon('lamp')}Cottage lights</label><p>Or tap the little house.</p></div>
          <button id="lights" class="switch" role="switch" aria-checked="false" aria-labelledby="lights-label"><span></span></button>
        </div>
        <button id="reset" class="reset">${icon('reset')}Reset world</button>
      </div>
    </aside>
    <div class="world-caption"><span class="status-dot"></span><span id="mood">The golden hours</span><span class="caption-divider">/</span><span id="weather-caption">a gentle breeze</span></div>
    <div class="scene-tools" role="group" aria-label="Camera zoom"><button id="zoom-in" aria-label="Zoom in">${icon('plus')}</button><span></span><button id="zoom-out" aria-label="Zoom out">${icon('minus')}</button></div>
    <footer><span class="footer-note">Small world. No hurry.</span><div class="gesture-guide">${icon('orbit')}<span class="desktop-guide">Drag to explore <b>·</b> Scroll to get closer</span><span class="touch-guide">Drag to explore <b>·</b> Pinch to get closer</span></div><span class="footer-right">MADE FOR A MOMENT OF CALM</span></footer>
    <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>
  `;
  const el = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
  const time = el<HTMLInputElement>('time'), wind = el<HTMLInputElement>('wind');
  time.addEventListener('input', () => store.set({ time: Number(time.value) }));
  wind.addEventListener('input', () => store.set({ wind: Number(wind.value) / 100 }));
  el('clear').addEventListener('click', () => store.set({ weather: 'clear' }));
  el('rain').addEventListener('click', () => store.set({ weather: 'rain' }));
  el('lights').addEventListener('click', () => store.set({ lights: !store.get().lights }));
  el('reset').addEventListener('click', () => {
    store.reset(); onReset();
    el('announcement').textContent = 'World reset. 16:00, clear skies, 30 percent wind, cottage lights off.';
  });
  el('panel-toggle').addEventListener('click', () => {
    const collapsed = el('panel-toggle').getAttribute('aria-expanded') === 'true';
    el('panel-toggle').setAttribute('aria-expanded', String(!collapsed));
    app.querySelector('.controls')?.classList.toggle('collapsed', collapsed);
  });
  const panelObserver = new ResizeObserver(entries => {
    app.style.setProperty('--panel-height', `${entries[0].target.getBoundingClientRect().height}px`);
  });
  panelObserver.observe(app.querySelector('.controls')!);
  const unsubscribe = store.subscribe(state => {
    time.value = String(state.time); wind.value = String(Math.round(state.wind * 100));
    el('time-output').textContent = timeLabel(state.time);
    el('wind-output').innerHTML = `${Math.round(state.wind * 100)}<span>%</span>`;
    time.setAttribute('aria-valuetext', timeLabel(state.time));
    wind.setAttribute('aria-valuetext', `${Math.round(state.wind * 100)} percent wind strength`);
    time.style.setProperty('--progress', `${state.time / 24 * 100}%`); wind.style.setProperty('--progress', `${state.wind * 100}%`);
    el('clear').setAttribute('aria-pressed', String(state.weather === 'clear'));
    el('rain').setAttribute('aria-pressed', String(state.weather === 'rain'));
    el('lights').setAttribute('aria-checked', String(state.lights));
    el('mood').textContent = timeMood(state.time);
    el('weather-caption').textContent = state.weather === 'rain' ? 'a passing shower' : state.wind < 0.05 ? 'perfectly still' : state.wind > 0.7 ? 'a playful wind' : 'a gentle breeze';
    document.documentElement.dataset.night = String(state.time < 6 || state.time >= 20);
  });
  return { host: el('world'), zoomIn: el('zoom-in'), zoomOut: el('zoom-out'), unsubscribe: () => { unsubscribe(); panelObserver.disconnect(); } };
}
