import { icon, mark } from './icons'
import { formatTime, period, type WorldState } from './state'

export function buildUI(
  state: WorldState,
  change: (patch: Partial<WorldState>) => void,
  reset: () => void,
) {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <header class="masthead">
      <div class="brand">${mark}<h1>Pocket World</h1><span class="studio">Diorama studio</span></div>
      <div class="header-actions"><span class="live"><i></i> Live scene</span><button id="fullscreen" class="screen-btn" aria-label="Enter fullscreen" title="Enter fullscreen">${icon('expand')}</button></div>
    </header>
    <main>
      <section class="stage" aria-label="Willowmere interactive diorama">
        <div id="viewport" tabindex="0" role="group" aria-label="Floating island. Drag to orbit, scroll or pinch to zoom. Use arrow keys to orbit and plus or minus to zoom."></div>
        <div class="scene-caption"><span class="caption-type"><span class="gold-line"></span>Floating island</span><h2>Willowmere</h2>
          <span id="condition" class="condition"></span></div>
        <div class="compass" aria-hidden="true"><span>N</span><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-dasharray="1 3.6"/><g id="needle"><path d="m22 6 4.2 16-4.2-2-4.2 2z" fill="#d3b47d"/><path d="m22 38 4.2-16-4.2 2-4.2-2z" fill="#708982"/></g><circle cx="22" cy="22" r="1.6" fill="#d3b47d"/></svg></div>
      </section>
      <aside class="panel" aria-labelledby="panel-title">
        <div class="panel-heading"><div class="panel-title">${icon('sliders')}<h2 id="panel-title">Environment</h2></div><button id="panel-disclosure" aria-expanded="false" aria-controls="panel-controls" aria-label="Expand environment controls">${icon('chevron')}</button></div>
        <div id="panel-controls">
          <div class="control-block time-block"><div class="row"><label for="time">${icon('clock')}Time of day</label><output for="time" id="time-value"></output></div>
            <input type="range" id="time" min="0" max="24" step="0.25" /><div class="scale"><span>00:00</span><span>12:00</span><span>24:00</span></div></div>
          <div class="control-block"><div id="weather-label" class="label">${icon('weather')}Weather</div>
            <div class="weather-options" role="group" aria-labelledby="weather-label"><button id="clear" aria-pressed="true">${icon('sun')}Clear</button><button id="rain" aria-pressed="false">${icon('rain')}Rain</button></div></div>
          <div class="control-block wind-block"><div class="row"><label for="wind">${icon('wind')}Wind strength</label><output for="wind" id="wind-value"></output></div>
            <input type="range" id="wind" min="0" max="100" step="1" /><div class="scale"><span>Calm</span><span>Strong</span></div></div>
          <div class="control-block lights"><div class="row"><label id="lights-label" for="lights">${icon('bulb')}House lights</label><div class="light-control"><span id="light-value"></span><button id="lights" role="switch" aria-checked="false" aria-labelledby="lights-label"><span></span></button></div></div></div>
          <div class="panel-foot"><button id="reset">${icon('reset')}Reset world</button></div>
        </div>
      </aside>
    </main>
    <footer><div class="hints"><span>${icon('orbit')}Drag to orbit</span><b></b><span>${icon('zoom')}<span class="mouse">Scroll</span><span class="touch">Pinch</span> to zoom</span><b></b><span class="house-hint">${icon('pointer')}Select house to toggle lights</span></div>
    <button class="guide-link" id="open-guide"><span aria-hidden="true">?</span>Interaction guide</button></footer>
    <dialog id="guide"><div class="guide-heading"><h2>Exploring Willowmere</h2><button id="close-guide" aria-label="Close interaction guide">×</button></div>
    <dl><dt>Orbit the island</dt><dd>Drag with a mouse or one finger. With the island focused, use the arrow keys.</dd>
    <dt>Look closer</dt><dd>Scroll or pinch with two fingers. Use the + and − keys with the island focused.</dd>
    <dt>Light the cottage</dt><dd>Click or tap the house, or use the House lights switch.</dd></dl></dialog>
  `
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
  const time = el<HTMLInputElement>('time'),
    wind = el<HTMLInputElement>('wind')
  time.oninput = () => change({ time: +time.value })
  wind.oninput = () => change({ wind: +wind.value / 100 })
  el('clear').onclick = () => change({ weather: 'clear' })
  el('rain').onclick = () => change({ weather: 'rain' })
  el('lights').onclick = () => change({ lights: !state.lights })
  el('reset').onclick = reset
  const guide = el<HTMLDialogElement>('guide')
  el('open-guide').onclick = () => guide.showModal()
  el('close-guide').onclick = () => guide.close()
  const panel = app.querySelector('aside')!
  const disclosure = el('panel-disclosure')
  function showPanel(open: boolean) {
    panel.classList.toggle('open', open)
    disclosure.setAttribute('aria-expanded', String(open))
    disclosure.setAttribute('aria-label', (open ? 'Collapse' : 'Expand') + ' environment controls')
  }
  showPanel(matchMedia('(max-width: 760px) and (min-height: 720px)').matches)
  disclosure.onclick = () => showPanel(!panel.classList.contains('open'))
  const full = el<HTMLButtonElement>('fullscreen')
  if (!document.fullscreenEnabled) full.hidden = true
  full.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      full.hidden = true
    }
  }
  document.addEventListener('fullscreenchange', () => {
    const active = !!document.fullscreenElement
    full.innerHTML = icon(active ? 'shrink' : 'expand')
    full.title = active ? 'Exit fullscreen' : 'Enter fullscreen'
    full.setAttribute('aria-label', full.title)
  })
  function sync() {
    time.value = String(state.time)
    wind.value = String(Math.round(state.wind * 100))
    el('time-value').textContent = formatTime(state.time)
    time.setAttribute('aria-valuetext', formatTime(state.time))
    el('wind-value').textContent = wind.value + '%'
    wind.setAttribute('aria-valuetext', wind.value + ' percent')
    time.style.setProperty('--fill', (state.time / 24) * 100 + '%')
    wind.style.setProperty('--fill', wind.value + '%')
    el('clear').setAttribute('aria-pressed', String(state.weather === 'clear'))
    el('rain').setAttribute('aria-pressed', String(state.weather === 'rain'))
    el('lights').setAttribute('aria-checked', String(state.lights))
    el('light-value').textContent = state.lights ? 'On' : 'Off'
    const phase = period(state.time)
    el('condition').innerHTML =
      icon(state.weather === 'rain' ? 'rain' : phase === 'Night' ? 'moon' : 'sun') +
      (state.weather === 'clear' ? 'Clear' : 'Rainy') +
      ' ' +
      phase.toLowerCase()
  }
  sync()
  return { sync, viewport: el('viewport'), needle: el('needle') }
}
