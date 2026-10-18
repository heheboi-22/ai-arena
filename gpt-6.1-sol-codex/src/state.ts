export interface WorldState {
  time: number;
  weather: 'clear' | 'rain';
  wind: number;
  lights: boolean;
}

export const defaults: Readonly<WorldState> = {
  time: 16, weather: 'clear', wind: 0.3, lights: false,
};

export class WorldStore {
  state: WorldState = { ...defaults };
  private listeners = new Set<(state: WorldState) => void>();

  set(change: Partial<WorldState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: WorldState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  reset() { this.set(defaults); }
  toggleLights() { this.set({ lights: !this.state.lights }); }
}

export function formatTime(time: number) {
  const minutes = Math.round(time * 60) % 1440;
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
