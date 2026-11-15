export type WeatherMode = 'clear' | 'rain';

export interface WorldState {
  /** Time of day in hours [0, 24]. Default: 16.0 (16:00). */
  timeHours: number;
  /** Weather mode: 'clear' or 'rain'. Default: 'clear'. */
  weather: WeatherMode;
  /** Wind strength percentage [0, 100]. Default: 30. */
  windStrength: number;
  /** Whether the cottage lights are turned on. Default: false. */
  houseLightsOn: boolean;
}

export interface SmoothedWorldValues {
  timeHours: number;
  rainFactor: number;
  windFactor: number;
  houseLightsFactor: number;
  reducedMotion: boolean;
}

export const DEFAULT_WORLD_STATE: Readonly<WorldState> = Object.freeze({
  timeHours: 16.0,
  weather: 'clear',
  windStrength: 30,
  houseLightsOn: false,
});

export type StateListener = (state: Readonly<WorldState>) => void;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  if (Math.abs(target - current) < 0.0004) {
    return target;
  }
  return current + (target - current) * (1 - Math.exp(-lambda * Math.max(0, dt)));
}

export function formatTimeHours(hours: number): string {
  const clamped = clamp(hours, 0, 24);
  let totalMinutes = Math.round(clamped * 60);
  if (totalMinutes >= 1440) {
    totalMinutes = 0;
  }
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function describeTimePhase(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 5.0 && h < 7.25) return 'Dawn';
  if (h >= 7.25 && h < 11.5) return 'Morning';
  if (h >= 11.5 && h < 15.0) return 'Midday';
  if (h >= 15.0 && h < 17.5) return 'Late Afternoon';
  if (h >= 17.5 && h < 19.75) return 'Sunset';
  if (h >= 19.75 && h < 21.25) return 'Dusk';
  return 'Night';
}

export interface CelestialFactors {
  /** Sun elevation in radians (-PI/2 to PI/2) */
  sunElevation: number;
  /** Sun azimuth in radians */
  sunAzimuth: number;
  /** Normalized sun direction vector [x, y, z] */
  sunDir: [number, number, number];
  /** Normalized moon direction vector [x, y, z] */
  moonDir: [number, number, number];
  /** [0, 1] daylight factor */
  daylight: number;
  /** [0, 1] golden hour / sunset / sunrise factor */
  twilight: number;
  /** [0, 1] night factor */
  nightness: number;
}

export function computeCelestialState(timeHours: number): CelestialFactors {
  const h = ((timeHours % 24) + 24) % 24;
  // Sunrise around 06:00, solar noon around 12:15, sunset around 18:30
  const solarAngle = ((h - 6.25) / 24) * Math.PI * 2;
  const sunElevation = Math.sin(solarAngle) * 1.12;
  const sunAzimuth = 0.55 + (h / 24) * Math.PI * 1.9;

  const cosEl = Math.cos(sunElevation);
  const sx = Math.cos(sunAzimuth) * cosEl;
  const sy = Math.sin(sunElevation);
  const sz = Math.sin(sunAzimuth) * cosEl;
  const sLen = Math.hypot(sx, sy, sz) || 1;
  const sunDir: [number, number, number] = [sx / sLen, sy / sLen, sz / sLen];

  // Moon sits roughly opposite the sun with a flattering elevated nighttime arc
  const moonElevation = Math.max(0.28, -sy * 0.85 + 0.25);
  const moonAzimuth = sunAzimuth + Math.PI * 0.88;
  const mCos = Math.cos(moonElevation);
  const mx = Math.cos(moonAzimuth) * mCos;
  const my = Math.sin(moonElevation);
  const mz = Math.sin(moonAzimuth) * mCos;
  const mLen = Math.hypot(mx, my, mz) || 1;
  const moonDir: [number, number, number] = [mx / mLen, my / mLen, mz / mLen];

  const daylight = smoothstep(-0.12, 0.52, sunElevation);
  const twilight = Math.exp(-Math.pow((sunElevation - 0.04) / 0.24, 2));
  const nightness = smoothstep(0.12, -0.28, sunElevation);

  return {
    sunElevation,
    sunAzimuth,
    sunDir,
    moonDir,
    daylight,
    twilight: clamp(twilight, 0, 1),
    nightness,
  };
}

/**
 * Computes the irregular organic radius of the floating island at a given polar angle.
 */
export function computeIslandOutlineRadius(angle: number): number {
  const base = 7.4;
  const lobe1 = Math.cos(angle * 2 - 0.4) * 0.55;
  const lobe2 = Math.sin(angle * 3 + 0.8) * 0.42;
  const lobe3 = Math.cos(angle * 5 - 1.2) * 0.22;
  const bluffBoost = Math.exp(-Math.pow( Math.atan2(Math.sin(angle - 0.65), Math.cos(angle - 0.65)) / 0.8, 2 )) * 0.65;
  return base + lobe1 + lobe2 + lobe3 + bluffBoost;
}

/**
 * Pond center and radii in world X/Z coordinates.
 */
export const POND_CENTER = { x: -1.85, z: 1.95, rx: 2.35, rz: 1.85 };

export function isPointInPond(x: number, z: number): boolean {
  const dx = (x - POND_CENTER.x) / POND_CENTER.rx;
  const dz = (z - POND_CENTER.z) / POND_CENTER.rz;
  // Slightly organic pond shape
  const angle = Math.atan2(dz, dx);
  const warp = 1 + 0.08 * Math.sin(angle * 3 + 0.5);
  return dx * dx + dz * dz <= warp * warp;
}

/**
 * Returns the approximate top surface Y coordinate of the island at (x, z),
 * or null if (x, z) is outside the island's horizontal silhouette.
 */
export function getIslandSurfaceHeight(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const maxR = computeIslandOutlineRadius(angle);
  if (r > maxR) {
    return null;
  }

  const edgeFactor = clamp(1 - Math.pow(r / maxR, 4.5), 0, 1);

  // Windmill bluff in northeast quadrant (+x, -z)
  const bluffDist = Math.hypot(x - 2.9, z + 2.3);
  const bluffHeight = 1.05 * Math.exp(-Math.pow(bluffDist / 2.45, 2));

  // Gentle cottage terrace rise in northwest quadrant (-x, -z)
  const cottageDist = Math.hypot(x + 1.5, z + 1.35);
  const cottageHeight = 0.28 * Math.exp(-Math.pow(cottageDist / 2.6, 2));

  // Pond basin depression in southwest quadrant (-x, +z)
  const dxPond = (x - POND_CENTER.x) / (POND_CENTER.rx * 1.15);
  const dzPond = (z - POND_CENTER.z) / (POND_CENTER.rz * 1.15);
  const pondDistSq = dxPond * dxPond + dzPond * dzPond;
  const pondDepression = pondDistSq < 1.3 ? 0.62 * Math.exp(-pondDistSq * 2.1) : 0;

  // Gentle organic meadow undulation
  const meadowWave =
    0.07 * Math.sin(x * 0.55 + 0.3) * Math.cos(z * 0.55 - 0.2) +
    0.04 * Math.cos((x + z) * 0.8);

  const rawHeight = (0.18 + bluffHeight + cottageHeight - pondDepression + meadowWave) * edgeFactor;
  return rawHeight;
}

export class WorldStateStore {
  private state: WorldState = { ...DEFAULT_WORLD_STATE };
  private listeners: Set<StateListener> = new Set();
  private resetListeners: Set<() => void> = new Set();

  public smoothed: SmoothedWorldValues = {
    timeHours: DEFAULT_WORLD_STATE.timeHours,
    rainFactor: 0,
    windFactor: DEFAULT_WORLD_STATE.windStrength / 100,
    houseLightsFactor: 0,
    reducedMotion: false,
  };

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.smoothed.reducedMotion = mq.matches;
      const onChange = (e: MediaQueryListEvent) => {
        this.smoothed.reducedMotion = e.matches;
      };
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
      }
    }
  }

  public getState(): Readonly<WorldState> {
    return this.state;
  }

  public setTimeHours(hours: number): void {
    const next = clamp(Number.isFinite(hours) ? hours : DEFAULT_WORLD_STATE.timeHours, 0, 24);
    if (Math.abs(this.state.timeHours - next) > 0.0001) {
      this.state = { ...this.state, timeHours: next };
      this.emit();
    }
  }

  public setWeather(weather: WeatherMode): void {
    if (weather !== 'clear' && weather !== 'rain') return;
    if (this.state.weather !== weather) {
      this.state = { ...this.state, weather };
      this.emit();
    }
  }

  public setWindStrength(windStrength: number): void {
    const next = Math.round(clamp(Number.isFinite(windStrength) ? windStrength : 30, 0, 100));
    if (this.state.windStrength !== next) {
      this.state = { ...this.state, windStrength: next };
      this.emit();
    }
  }

  public setHouseLights(on: boolean): void {
    const next = Boolean(on);
    if (this.state.houseLightsOn !== next) {
      this.state = { ...this.state, houseLightsOn: next };
      this.emit();
    }
  }

  public toggleHouseLights(): boolean {
    const next = !this.state.houseLightsOn;
    this.setHouseLights(next);
    return next;
  }

  public reset(): void {
    this.state = { ...DEFAULT_WORLD_STATE };
    this.emit();
    for (const cb of this.resetListeners) {
      cb();
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onReset(listener: () => void): () => void {
    this.resetListeners.add(listener);
    return () => {
      this.resetListeners.delete(listener);
    };
  }

  public updateSmoothed(rawDt: number): void {
    const dt = clamp(rawDt, 0, 0.1);
    const targetRain = this.state.weather === 'rain' ? 1 : 0;
    const targetWind = this.state.windStrength / 100;
    const targetLights = this.state.houseLightsOn ? 1 : 0;
    const targetTime = this.state.timeHours;

    const fast = this.smoothed.reducedMotion;
    this.smoothed.rainFactor = damp(this.smoothed.rainFactor, targetRain, fast ? 9.0 : 2.8, dt);
    this.smoothed.windFactor = damp(this.smoothed.windFactor, targetWind, fast ? 12.0 : 5.5, dt);
    this.smoothed.houseLightsFactor = damp(this.smoothed.houseLightsFactor, targetLights, fast ? 14.0 : 7.5, dt);
    this.smoothed.timeHours = damp(this.smoothed.timeHours, targetTime, fast ? 16.0 : 9.0, dt);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
