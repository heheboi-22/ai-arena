export interface Quality {
  tier: 'high' | 'low';
  maxPixelRatio: number;
  shadowMapSize: number;
  rainDrops: number;
  grassTufts: number;
}

/** Picks a rendering budget up front; the renderer can still lower the pixel ratio later. */
export function detectQuality(): Quality {
  const smallScreen = Math.min(window.screen.width, window.screen.height) < 600;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;

  if (smallScreen || (coarse && fewCores)) {
    return { tier: 'low', maxPixelRatio: 1.5, shadowMapSize: 1024, rainDrops: 650, grassTufts: 160 };
  }
  return { tier: 'high', maxPixelRatio: 2, shadowMapSize: 2048, rainDrops: 1300, grassTufts: 320 };
}
