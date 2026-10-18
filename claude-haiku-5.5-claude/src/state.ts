export type Weather = 'clear' | 'rain';

// The one source of truth for everything the user can change. The 3D scene,
// the panel and the house click all write here; the scene reads it each frame
// and eases its visuals toward it, so no control ever starts its own animation.
export interface WorldState {
  /** Hour of day in [0, 24). */
  hour: number;
  weather: Weather;
  /** Wind strength in [0, 1]. */
  wind: number;
  houseLights: boolean;
}

export const DEFAULT_STATE: Readonly<WorldState> = {
  hour: 16,
  weather: 'clear',
  wind: 0.3,
  houseLights: false,
};

type Listener = (state: Readonly<WorldState>) => void;

export interface Store {
  get(): Readonly<WorldState>;
  set(patch: Partial<WorldState>): void;
  reset(): void;
  subscribe(listener: Listener): () => void;
}

export function createStore(initial: WorldState): Store {
  let state: WorldState = { ...initial };
  const listeners = new Set<Listener>();

  const emit = (): void => {
    for (const listener of listeners) listener(state);
  };

  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      // Skip no-op writes so slider drags and repeated clicks don't re-render the panel.
      const changed = (Object.keys(next) as (keyof WorldState)[]).some((k) => next[k] !== state[k]);
      if (!changed) return;
      state = next;
      emit();
    },
    reset() {
      state = { ...DEFAULT_STATE };
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}
