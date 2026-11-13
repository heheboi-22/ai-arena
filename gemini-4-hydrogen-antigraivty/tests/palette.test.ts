import { describe, expect, it } from 'vitest';
import { evaluateAtmosphere } from '../src/scene/palette';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = Number.parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

describe('palette / atmosphere evaluation', () => {
  it('wraps cleanly between 0:00 and 24:00', () => {
    const start = evaluateAtmosphere(0, 0);
    const end = evaluateAtmosphere(24, 0);
    expect(start.skyTop).toBe(end.skyTop);
    expect(start.skyHorizon).toBe(end.skyHorizon);
    expect(start.sunIntensity).toBeCloseTo(end.sunIntensity, 4);
    expect(start.sunDirection[0]).toBeCloseTo(end.sunDirection[0], 4);
    expect(start.sunDirection[1]).toBeCloseTo(end.sunDirection[1], 4);
    expect(start.sunDirection[2]).toBeCloseTo(end.sunDirection[2], 4);
  });

  it('produces distinct daytime, sunset, and readable nighttime states', () => {
    const noon = evaluateAtmosphere(12.5, 0);
    const afternoon = evaluateAtmosphere(16, 0);
    const sunset = evaluateAtmosphere(18.5, 0);
    const night = evaluateAtmosphere(0.5, 0);

    expect(noon.sunDirection[1]).toBeGreaterThan(sunset.sunDirection[1]);
    expect(noon.sunIntensity).toBeGreaterThan(sunset.sunIntensity);
    expect(afternoon.sunIntensity).toBeGreaterThan(night.sunIntensity);

    const [sr, , sb] = hexToRgb(sunset.sunColor);
    expect(sr).toBeGreaterThan(sb + 40);

    expect(night.starOpacity).toBeGreaterThan(0.6);
    expect(noon.starOpacity).toBe(0);
    expect(night.windowGlowStrength).toBeGreaterThan(0.8);

    // Nighttime must remain atmospheric and readable
    expect(night.ambientIntensity).toBeGreaterThanOrEqual(0.45);
    expect(night.sunIntensity).toBeGreaterThanOrEqual(0.35);
    expect(night.exposure).toBeGreaterThanOrEqual(0.9);
    expect(luminance(night.skyHorizon)).toBeGreaterThan(0.05);
  });

  it('softens sunlight and darkens clouds in rain', () => {
    const clear = evaluateAtmosphere(12.5, 0);
    const rain = evaluateAtmosphere(12.5, 1);

    expect(rain.sunIntensity).toBeLessThan(clear.sunIntensity * 0.65);
    expect(luminance(rain.cloudColor)).toBeLessThan(luminance(clear.cloudColor) - 0.15);
    expect(luminance(rain.skyTop)).toBeLessThan(luminance(clear.skyTop));
  });
});
