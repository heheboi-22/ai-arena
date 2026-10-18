/** Everything a world module needs to animate one frame, built once per tick in main. */
export interface Frame {
  /** Delta seconds, already clamped (<= 0.1) by the render loop. */
  dt: number;
  /** Total elapsed seconds since startup. */
  time: number;
  /** Smoothed time of day in decimal hours. */
  hour: number;
  /** Smoothed wind strength 0..1. */
  wind: number;
  /** Shared horizontal wind direction (normalized-ish). */
  windDir: { x: number; z: number };
  /** Smoothed rain amount 0..1. */
  rain: number;
  /** House light glow 0..1. */
  glow: number;
  /** 0 at night, 1 in full daylight. */
  dayFactor: number;
  reducedMotion: boolean;
}
