import { WorldStore, formatTime } from './state';

const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
const rainIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 14a4 4 0 0 1-1-7.9 6 6 0 0 1 11.5-1A4.5 4.5 0 1 1 18 14H6Z"/><path d="m8 17-1 3m6-3-1 3m6-3-1 3"/></svg>';
const resetIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6"/></svg>';

export function mountUI(app: HTMLElement, store: WorldStore, resetCamera: () => void) {
  app.innerHTML = `
    <main class="experience">
      <header class="masthead">
        <div class="wordmark">Pocket World<span class="wordmark-period">.</span></div>
        <p>A small place to slow down.</p>
      </header>
      <section class="world-stage" aria-label="Interactive floating island">
        <div id="viewport"></div>
        <div class="loading" role="status">Planting your little world…</div>
        <div class="scene-caption"><span id="day-description">A mellow afternoon</span><span class="caption-rule"></span><span id="scene-weather">Clear skies</span></div>
        <p class="interaction-hint">Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Click the cottage for lights</p>
      </section>
      <aside class="controls" aria-label="World controls">
        <div class="panel-heading">
          <div><h1>Pocket World</h1><p>A day, any way you like.</p></div>
          <button id="panel-toggle" class="panel-toggle" type="button" aria-expanded="true" aria-controls="control-body">Hide controls</button>
        </div>
        <div id="control-body" class="control-body">
          <div class="time-control">
            <div class="label-row"><label for="time">Time of day</label><span id="time-phase">Afternoon</span></div>
            <output id="time-value" for="time" class="time-value">16:00</output>
            <input id="time" type="range" min="0" max="24" step="0.25" value="16" aria-valuetext="16:00" />
            <div class="range-ends"><span>Midnight</span><span>Noon</span><span>Midnight</span></div>
          </div>
          <fieldset class="weather-control">
            <legend>Weather</legend>
            <div class="weather-options">
              <button type="button" id="clear" aria-pressed="true">${sunIcon} Clear</button>
              <button type="button" id="rain" aria-pressed="false">${rainIcon} Rain</button>
            </div>
          </fieldset>
          <div class="wind-control">
            <div class="label-row"><label for="wind">Wind</label><output id="wind-value" for="wind">30%</output></div>
            <input id="wind" type="range" min="0" max="100" value="30" aria-valuetext="30 percent" />
            <div class="range-ends"><span>Still</span><span>Breezy</span></div>
          </div>
          <div class="lights-control">
            <label id="lights-label" for="lights">Cottage lights<span id="lights-description">Nobody home, just yet</span></label>
            <button id="lights" type="button" role="switch" aria-checked="false" aria-labelledby="lights-label"><span></span></button>
          </div>
          <button id="reset" class="reset-button" type="button">${resetIcon} Reset the world</button>
          <p class="panel-note">Make it rain. Catch the sunset.<br />Leave the lights on for a while.</p>
        </div>
      </aside>
      <p class="bottom-note">A little world. A moment to yourself.</p>
      <span class="announcement" role="status" aria-live="polite"></span>
    </main>`;

  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const time = element<HTMLInputElement>('time'), wind = element<HTMLInputElement>('wind');
  time.addEventListener('input', () => store.set({ time: Number(time.value) }));
  wind.addEventListener('input', () => store.set({ wind: Number(wind.value) / 100 }));
  element('clear').addEventListener('click', () => store.set({ weather: 'clear' }));
  element('rain').addEventListener('click', () => store.set({ weather: 'rain' }));
  element('lights').addEventListener('click', () => store.toggleLights());
  element('reset').addEventListener('click', () => {
    store.reset();
    resetCamera();
    app.querySelector('.announcement')!.textContent = 'World reset to 16:00, clear skies, 30 percent wind, cottage lights off.';
  });
  const toggle = element<HTMLButtonElement>('panel-toggle');
  const body = element('control-body');
  const panel = app.querySelector<HTMLElement>('.controls')!;
  const measurePanel = () => {
    const height = `${panel.getBoundingClientRect().height}px`;
    if (app.style.getPropertyValue('--controls-height') !== height) app.style.setProperty('--controls-height', height);
  };
  let panelFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(panelFrame);
    panelFrame = requestAnimationFrame(measurePanel);
  }).observe(panel);
  measurePanel();
  function setExpanded(expanded: boolean) {
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? 'Hide controls' : 'Show controls';
    body.hidden = !expanded;
    app.classList.toggle('controls-collapsed', !expanded);
  }
  toggle.addEventListener('click', () => setExpanded(toggle.getAttribute('aria-expanded') !== 'true'));
  const narrow = matchMedia('(max-width: 700px)');
  narrow.addEventListener('change', () => setExpanded(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && narrow.matches) setExpanded(false);
  });

  store.subscribe(state => {
    const formatted = formatTime(state.time);
    time.value = String(state.time);
    time.setAttribute('aria-valuetext', formatted);
    time.style.setProperty('--fill', `${state.time / 24 * 100}%`);
    wind.value = String(Math.round(state.wind * 100));
    wind.setAttribute('aria-valuetext', `${Math.round(state.wind * 100)} percent`);
    wind.style.setProperty('--fill', `${state.wind * 100}%`);
    element('time-value').textContent = formatted;
    element('wind-value').textContent = `${Math.round(state.wind * 100)}%`;
    element('clear').setAttribute('aria-pressed', String(state.weather === 'clear'));
    element('rain').setAttribute('aria-pressed', String(state.weather === 'rain'));
    element('lights').setAttribute('aria-checked', String(state.lights));
    element('lights-description').textContent = state.lights ? 'A warm welcome' : 'Nobody home, just yet';
    element('scene-weather').textContent = state.weather === 'rain' ? 'A passing rain' : 'Clear skies';
    const t = state.time % 24;
    const phase = t < 5 || t >= 21 ? 'Night' : t < 8 ? 'Dawn' : t < 12 ? 'Morning' : t < 17 ? 'Afternoon' : t < 20 ? 'Sunset' : 'Dusk';
    element('time-phase').textContent = phase;
    const descriptions: Record<string, string> = { Night: 'Under a quiet sky', Dawn: 'The first light', Morning: 'A fresh morning', Afternoon: 'A mellow afternoon', Sunset: 'The golden hour', Dusk: 'The day drifts away' };
    element('day-description').textContent = descriptions[phase];
  });

  return element('viewport');
}

export function showError(message: string) {
  const loading = document.querySelector<HTMLElement>('.loading');
  if (loading) {
    loading.classList.add('error');
    loading.setAttribute('role', 'alert');
    loading.innerHTML = `<h2>This world needs WebGL</h2><p>${message}</p><button type="button" id="retry">Reload the world</button>`;
    document.getElementById('retry')?.addEventListener('click', () => location.reload());
  }
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.controls input, .controls button').forEach(control => control.disabled = true);
}
