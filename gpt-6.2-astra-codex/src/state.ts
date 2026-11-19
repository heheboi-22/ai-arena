export interface WorldState {
  time: number
  wind: number
  weather: 'clear' | 'rain'
  lights: boolean
}

export const defaults: Readonly<WorldState> = Object.freeze({
  time: 16,
  wind: 0.3,
  weather: 'clear',
  lights: false,
})

export function formatTime(hour: number) {
  const minutes = Math.round(hour * 60)
  return [Math.floor(minutes / 60), minutes % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

export function period(hour: number) {
  if (hour < 5.5 || hour >= 20.5) return 'Night'
  if (hour < 7.5) return 'Dawn'
  if (hour < 12) return 'Morning'
  if (hour < 17.5) return 'Afternoon'
  if (hour < 19.5) return 'Sunset'
  return 'Dusk'
}
