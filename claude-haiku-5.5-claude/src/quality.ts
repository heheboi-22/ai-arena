export interface Quality {
  pixelRatio: number;
  shadowSize: number;
  rainDrops: number;
  ripples: number;
}

/**
 * Picks a rendering budget once at startup. Touch-first or low-core devices get
 * a smaller pixel ratio, a smaller shadow map and fewer particles.
 */
export function detectQuality(): Quality {
  const cores = navigator.hardwareConcurrency ?? 8;
  const touchFirst = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 720;
  const constrained = cores <= 4 || (touchFirst && small);

  if (constrained) {
    return {
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
      shadowSize: 1024,
      rainDrops: 520,
      ripples: 20,
    };
  }
  return {
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    shadowSize: 2048,
    rainDrops: 900,
    ripples: 36,
  };
}
