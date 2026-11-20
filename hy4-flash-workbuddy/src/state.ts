import { clamp, damp, formatTime } from './util/math'

export type Weather = 'clear' | 'rain'
export type Period = 'night' | 'dawn' | 'day' | 'dusk'

export interface WorldState {
  time: number
  weather: Weather
  wind: number
  lights: boolean
}

export const DEFAULTS: Readonly<WorldState> = Object.freeze({
  time: 16,
  weather: 'clear',
  wind: 0.3,
  lights: false,
})

type Listener = (state: Readonly<WorldState>) => void

/** One authoritative, observable state object shared by UI, 3D picking and the renderer. */
export class Store {
  readonly state: WorldState = { ...DEFAULTS }
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  set<K extends keyof WorldState>(key: K, value: WorldState[K]): void {
    if (this.state[key] === value) return
    this.state[key] = value
    this.emit()
  }

  toggleLights(): void {
    this.set('lights', !this.state.lights)
  }

  reset(): void {
    Object.assign(this.state, DEFAULTS)
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state)
  }
}

/** Eased mirror of the target state. Every scene system reads from this, so rapid
 *  control changes simply retarget one value instead of stacking animations. */
export interface SmoothedState {
  time: number
  rain: number
  wind: number
  lights: number
}

export function createSmoothed(state: Readonly<WorldState>): SmoothedState {
  return {
    time: state.time,
    rain: state.weather === 'rain' ? 1 : 0,
    wind: state.wind,
    lights: state.lights ? 1 : 0,
  }
}

export function stepSmoothed(current: SmoothedState, target: Readonly<WorldState>, dt: number): void {
  current.time = damp(current.time, target.time, 6.5, dt)
  current.rain = damp(current.rain, target.weather === 'rain' ? 1 : 0, 3.6, dt)
  current.wind = damp(current.wind, target.wind, 4.5, dt)
  current.lights = damp(current.lights, target.lights ? 1 : 0, 6, dt)
}

export function timeLabel(time: number): string {
  return formatTime(time)
}

export function periodForTime(time: number): { label: string; period: Period } {
  if (time < 5) return { label: 'Deep night', period: 'night' }
  if (time < 7) return { label: 'First light', period: 'dawn' }
  if (time < 11) return { label: 'Morning light', period: 'day' }
  if (time < 16.8) return { label: 'Afternoon light', period: 'day' }
  if (time < 18.5) return { label: 'Golden hour', period: 'dusk' }
  if (time < 20.5) return { label: 'Blue hour', period: 'dusk' }
  return { label: 'Quiet night', period: 'night' }
}

export function windLabel(wind: number): string {
  if (wind < 0.02) return 'Dead calm'
  if (wind < 0.25) return 'A gentle breeze'
  if (wind < 0.55) return 'A steady breeze'
  if (wind < 0.8) return 'A fresh breeze'
  return 'A strong breeze'
}

export function normalizedTime(time: number): number {
  return clamp(time / 24, 0, 1)
}
