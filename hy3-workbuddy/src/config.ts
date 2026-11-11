// Shared constants and global environment flags for Pocket World.

export const GROUND_Y = 0.3; // world-y of the grass top surface
export const ISLAND_TOP_RADIUS = 5.0;

/** Respect reduced-motion: scale decorative animation, keep controls functional. */
export const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Crude capability / device-class detection for tuning render cost. */
export const isSmallDevice =
  typeof window !== 'undefined' &&
  (window.innerWidth < 760 || ('ontouchstart' in window && window.innerWidth < 1024));

/** Default configuration applied on load and on Reset. */
export const DEFAULTS = {
  time: 16, // 16:00
  weather: 'clear' as Weather,
  wind: 0.3, // 30%
  houseLights: false,
};

export type Weather = 'clear' | 'rain';
