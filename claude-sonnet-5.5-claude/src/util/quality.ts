/**
 * Picks rendering budgets once at start-up. Phones, small windows and
 * low-core machines get a cheaper preset; everything else gets the full one.
 * `?quality=low` or `?quality=high` in the URL forces a preset.
 */
export interface Quality {
  tier: 'low' | 'high';
  maxPixelRatio: number;
  shadowMapSize: number;
  rainDrops: number;
  grassTufts: number;
  groundTexture: number;
  antialias: boolean;
}

const PRESETS: Record<Quality['tier'], Quality> = {
  high: {
    tier: 'high',
    maxPixelRatio: 2,
    shadowMapSize: 2048,
    rainDrops: 1700,
    grassTufts: 650,
    groundTexture: 2048,
    antialias: true,
  },
  low: {
    tier: 'low',
    maxPixelRatio: 1.5,
    shadowMapSize: 1024,
    rainDrops: 800,
    grassTufts: 320,
    groundTexture: 1024,
    antialias: true,
  },
};

export function detectQuality(): Quality {
  const forced = new URLSearchParams(window.location.search).get('quality');
  if (forced === 'low' || forced === 'high') return PRESETS[forced];

  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return coarse || small || weak ? PRESETS.low : PRESETS.high;
}
