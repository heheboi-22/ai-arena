import { AppState } from '../state/AppState';

export interface UIRefs {
  root: HTMLElement;
  time: HTMLInputElement;
  timeLabel: HTMLElement;
  wind: HTMLInputElement;
  windLabel: HTMLElement;
  lights: HTMLInputElement;
  clearBtn: HTMLButtonElement;
  rainBtn: HTMLButtonElement;
  collapseBtn: HTMLButtonElement;
}

function fmtTime(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

export function buildUI(
  state: AppState,
  onLights: (v: boolean) => void,
  onWeather: (w: AppState['weather']) => void,
  onReset: () => void
): UIRefs {
  const host = document.getElementById('ui-container')!;
  host.innerHTML = `
    <aside class="panel" id="panel">
      <header class="panel-head">
        <div>
          <h1>Pocket World</h1>
          <p class="tagline">A tiny floating island</p>
        </div>
        <button id="collapse" class="icon-btn" aria-label="Collapse panel" aria-expanded="true">–</button>
      </header>
      <div class="panel-body" id="panel-body">
        <div class="row">
          <label for="time">Time <span id="time-label" class="value"></span></label>
          <input type="range" id="time" min="0" max="24" step="0.25" value="${state.time}" aria-label="Time of day" />
        </div>
        <div class="row">
          <span class="row-label">Weather</span>
          <div class="segmented" role="group" aria-label="Weather">
            <button id="weather-clear" type="button">Clear</button>
            <button id="weather-rain" type="button">Rain</button>
          </div>
        </div>
        <div class="row">
          <label for="wind">Wind <span id="wind-label" class="value"></span></label>
          <input type="range" id="wind" min="0" max="100" step="1" value="${Math.round(state.wind * 100)}" aria-label="Wind strength" />
        </div>
        <div class="row switch-row">
          <label for="lights">House lights</label>
          <input type="checkbox" id="lights" class="switch" role="switch" />
        </div>
        <button id="reset" class="reset" type="button">Reset world</button>
        <p class="hint">Drag to orbit · scroll or pinch to zoom · tap the house to toggle its lights</p>
      </div>
    </aside>
  `;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const refs: UIRefs = {
    root: $('panel'),
    time: $('time') as HTMLInputElement,
    timeLabel: $('time-label'),
    wind: $('wind') as HTMLInputElement,
    windLabel: $('wind-label'),
    lights: $('lights') as HTMLInputElement,
    clearBtn: $('weather-clear') as HTMLButtonElement,
    rainBtn: $('weather-rain') as HTMLButtonElement,
    collapseBtn: $('collapse') as HTMLButtonElement,
  };

  refs.time.addEventListener('input', () => {
    state.time = parseFloat(refs.time.value);
    refs.timeLabel.textContent = fmtTime(state.time);
  });
  refs.wind.addEventListener('input', () => {
    state.wind = parseInt(refs.wind.value, 10) / 100;
    refs.windLabel.textContent = `${refs.wind.value}%`;
  });
  refs.lights.addEventListener('change', () => onLights(refs.lights.checked));
  refs.clearBtn.addEventListener('click', () => onWeather('clear'));
  refs.rainBtn.addEventListener('click', () => onWeather('rain'));
  document.getElementById('reset')!.addEventListener('click', onReset);
  refs.collapseBtn.addEventListener('click', () => {
    const collapsed = refs.root.classList.toggle('collapsed');
    refs.collapseBtn.textContent = collapsed ? '+' : '–';
    refs.collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  });

  return refs;
}

export function syncUI(ui: UIRefs, state: AppState) {
  ui.time.value = String(state.time);
  ui.timeLabel.textContent = fmtTime(state.time);
  ui.wind.value = String(Math.round(state.wind * 100));
  ui.windLabel.textContent = `${Math.round(state.wind * 100)}%`;
  ui.lights.checked = state.lights;
  ui.clearBtn.classList.toggle('active', state.weather === 'clear');
  ui.rainBtn.classList.toggle('active', state.weather === 'rain');
  ui.clearBtn.setAttribute('aria-pressed', String(state.weather === 'clear'));
  ui.rainBtn.setAttribute('aria-pressed', String(state.weather === 'rain'));
}
