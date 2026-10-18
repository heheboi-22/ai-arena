export type WeatherType = 'clear' | 'rain';

export interface AppState {
  time: number; // 0 to 24
  weather: WeatherType;
  wind: number; // 0 to 1
  houseLights: boolean;
}

export const defaultState: AppState = {
  time: 16,
  weather: 'clear',
  wind: 0.3,
  houseLights: false,
};

type StateListener = (state: AppState, key: keyof AppState) => void;

class StateManager {
  private state: AppState;
  private listeners: StateListener[] = [];

  constructor(initial: AppState) {
    this.state = { ...initial };
  }

  get<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  getAll(): AppState {
    return { ...this.state };
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.notify(key);
    }
  }

  reset(): void {
    for (const key in defaultState) {
      const k = key as keyof AppState;
      if (this.state[k] !== defaultState[k]) {
        // use proper type assertions
        if (k === 'time') this.state[k] = defaultState[k];
        else if (k === 'weather') this.state[k] = defaultState[k];
        else if (k === 'wind') this.state[k] = defaultState[k];
        else if (k === 'houseLights') this.state[k] = defaultState[k];

        this.notify(k);
      }
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(key: keyof AppState): void {
    for (const listener of this.listeners) {
      listener(this.state, key);
    }
  }
}

export const state = new StateManager(defaultState);
