export interface WorldState {
  time: number;
  weather: 'clear' | 'rain';
  wind: number;
  lights: boolean;
}

export const DEFAULTS: Readonly<WorldState> = Object.freeze({
  time: 16, weather: 'clear', wind: 0.3, lights: false,
});

export function createStore() {
  let state: WorldState = { ...DEFAULTS };
  const subscribers = new Set<(value: Readonly<WorldState>) => void>();
  return {
    get: () => state as Readonly<WorldState>,
    set(patch: Partial<WorldState>) {
      state = {
        ...state, ...patch,
        time: Math.max(0, Math.min(24, patch.time ?? state.time)),
        wind: Math.max(0, Math.min(1, patch.wind ?? state.wind)),
      };
      subscribers.forEach((listener) => listener(state));
    },
    reset() { this.set({ ...DEFAULTS }); },
    subscribe(listener: (value: Readonly<WorldState>) => void) {
      subscribers.add(listener);
      listener(state);
      return () => subscribers.delete(listener);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
export function timeLabel(time: number) {
  const minutes = Math.round(time * 60) % 1440;
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
export function timeMood(time: number) {
  if (time < 5 || time >= 20) return 'A quiet night';
  if (time < 8) return 'First light';
  if (time < 15) return 'A bright little day';
  if (time < 17.5) return 'The golden hours';
  return 'Chasing the sunset';
}
