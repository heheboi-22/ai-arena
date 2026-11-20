import { periodForTime, Store, timeLabel, windLabel, type WorldState } from '../state'
import { clamp } from '../util/math'

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing UI element: ${id}`)
  return found as T
}

export interface UIHandle {
  collapsed: boolean
  setCollapsed(value: boolean): void
}

export function createUI(store: Store, onReset: () => void): UIHandle {
  const panel = element<HTMLElement>('panel')
  const toggle = element<HTMLButtonElement>('panel-toggle')
  const timeSlider = element<HTMLInputElement>('time-slider')
  const timeValue = element<HTMLOutputElement>('time-value')
  const phaseLabel = element<HTMLElement>('phase-label')
  const phaseDot = element<HTMLElement>('phase-dot')
  const windSlider = element<HTMLInputElement>('wind-slider')
  const windValue = element<HTMLOutputElement>('wind-value')
  const windNote = element<HTMLElement>('wind-note')
  const clearButton = element<HTMLButtonElement>('weather-clear')
  const rainButton = element<HTMLButtonElement>('weather-rain')
  const weatherNote = element<HTMLElement>('weather-note')
  const lightsButton = element<HTMLButtonElement>('lights-toggle')
  const lightsText = element<HTMLElement>('lights-text')
  const resetButton = element<HTMLButtonElement>('reset-button')

  const handle: UIHandle = {
    collapsed: false,
    setCollapsed(value: boolean) {
      handle.collapsed = value
      panel.classList.toggle('collapsed', value)
      toggle.setAttribute('aria-expanded', String(!value))
    },
  }

  const render = (state: Readonly<WorldState>) => {
    timeSlider.value = String(state.time)
    timeSlider.style.setProperty('--fill', `${(state.time / 24) * 100}%`)
    timeValue.value = timeLabel(state.time)
    timeValue.textContent = timeLabel(state.time)
    const period = periodForTime(state.time)
    phaseLabel.textContent = period.label
    phaseDot.className = `phase-dot ${period.period === 'day' ? '' : period.period}`.trim()

    const windPercent = Math.round(clamp(state.wind, 0, 1) * 100)
    windSlider.value = String(windPercent)
    windSlider.style.setProperty('--fill', `${windPercent}%`)
    windValue.value = `${windPercent}%`
    windValue.textContent = `${windPercent}%`
    windNote.textContent = windLabel(state.wind)

    const raining = state.weather === 'rain'
    clearButton.classList.toggle('active', !raining)
    rainButton.classList.toggle('active', raining)
    clearButton.setAttribute('aria-pressed', String(!raining))
    rainButton.setAttribute('aria-pressed', String(raining))
    weatherNote.textContent = raining ? 'Soft rainfall' : 'Clear skies'

    lightsButton.setAttribute('aria-checked', String(state.lights))
    lightsText.textContent = state.lights ? 'On' : 'Off'
  }

  store.subscribe(render)

  timeSlider.addEventListener('input', () => store.set('time', Number(timeSlider.value)))
  windSlider.addEventListener('input', () => store.set('wind', Number(windSlider.value) / 100))
  clearButton.addEventListener('click', () => store.set('weather', 'clear'))
  rainButton.addEventListener('click', () => store.set('weather', 'rain'))
  lightsButton.addEventListener('click', () => store.toggleLights())
  resetButton.addEventListener('click', () => {
    store.reset()
    onReset()
  })
  toggle.addEventListener('click', () => handle.setCollapsed(!handle.collapsed))

  const compactQuery = window.matchMedia('(max-width: 720px)')
  compactQuery.addEventListener('change', (event) => handle.setCollapsed(event.matches))
  if (compactQuery.matches) handle.setCollapsed(true)
  return handle
}
