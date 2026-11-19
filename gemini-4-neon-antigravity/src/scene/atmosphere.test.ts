import { describe, expect, it } from 'vitest';
import { computeAtmosphereSample } from './atmosphere';

describe('computeAtmosphereSample', () => {
  it('creates clearly distinct lighting and sky palettes for midday, sunset, and night', () => {
    const midday = computeAtmosphereSample(12 * 60 + 30, 0);
    const sunset = computeAtmosphereSample(18 * 60 + 25, 0);
    const night = computeAtmosphereSample(23 * 60 + 30, 0);

    // Midday should be bright and blue-sky
    expect(midday.keyLightIntensity).toBeGreaterThan(2.0);
    expect(midday.zenith.b).toBeGreaterThan(midday.zenith.r);
    expect(midday.nightFactor).toBeLessThan(0.1);

    // Sunset should have warm amber-coral horizon (R clearly higher than B)
    expect(sunset.horizon.r).toBeGreaterThan(sunset.horizon.b + 0.25);
    expect(sunset.sunsetFactor).toBeGreaterThan(0.35);

    // Night should show stars and high nightFactor while staying readable (non-black lighting)
    expect(night.nightFactor).toBeGreaterThan(0.85);
    expect(night.starVisibility).toBeGreaterThan(0.6);
    expect(night.keyLightIntensity).toBeGreaterThanOrEqual(0.5);
    expect(night.hemiIntensity).toBeGreaterThanOrEqual(0.6);
  });

  it('softens direct sunlight and dims sun glow when rain is active', () => {
    const clearDay = computeAtmosphereSample(16 * 60, 0);
    const rainyDay = computeAtmosphereSample(16 * 60, 1);

    expect(rainyDay.keyLightIntensity).toBeLessThan(clearDay.keyLightIntensity * 0.6);
    expect(rainyDay.sunGlowStrength).toBeLessThan(clearDay.sunGlowStrength * 0.25);
  });
});
