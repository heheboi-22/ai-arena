import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_STATE,
  MAX_FRAME_DELTA,
  POND_CENTER,
  clampFrameDelta,
  computeEnvironmentLighting,
  createInitialSmoothedState,
  formatTimeOfDay,
  getIslandSurfaceStopY,
  isClickGesture,
  stepSmoothedState,
} from '../worldState';

describe('worldState', () => {
  it('defines expected spec defaults', () => {
    expect(DEFAULT_WORLD_STATE.timeOfDay).toBe(16);
    expect(DEFAULT_WORLD_STATE.weather).toBe('clear');
    expect(DEFAULT_WORLD_STATE.windStrength).toBe(30);
    expect(DEFAULT_WORLD_STATE.houseLightsOn).toBe(false);
    expect(DEFAULT_WORLD_STATE.reducedMotion).toBe(false);
  });

  it('clamps invalid and oversized frame deltas', () => {
    expect(clampFrameDelta(-1)).toBe(0);
    expect(clampFrameDelta(Number.NaN)).toBe(0);
    expect(clampFrameDelta(0.016)).toBeCloseTo(0.016);
    expect(clampFrameDelta(5.0)).toBe(MAX_FRAME_DELTA);
    expect(MAX_FRAME_DELTA).toBe(0.1);
  });

  it('formats 24-hour time into HH:MM and readable period labels', () => {
    expect(formatTimeOfDay(0).timeText).toBe('00:00');
    expect(formatTimeOfDay(6.5).timeText).toBe('06:30');
    expect(formatTimeOfDay(12).timeText).toBe('12:00');
    expect(formatTimeOfDay(16).timeText).toBe('16:00');
    expect(formatTimeOfDay(18.5).timeText).toBe('18:30');
    expect(formatTimeOfDay(23.75).timeText).toBe('23:45');
    expect(formatTimeOfDay(24).timeText).toBe('24:00');

    expect(formatTimeOfDay(12).periodText).toBe('Midday');
    expect(formatTimeOfDay(18.5).periodText).toBe('Sunset');
    expect(formatTimeOfDay(23).periodText).toBe('Night');
  });

  it('smoothly converges state over clamped steps and respects reducedMotion', () => {
    let smoothed = createInitialSmoothedState(DEFAULT_WORLD_STATE);
    const target = {
      ...DEFAULT_WORLD_STATE,
      weather: 'rain' as const,
      windStrength: 100,
      houseLightsOn: true,
    };

    for (let i = 0; i < 40; i++) {
      smoothed = stepSmoothedState(smoothed, target, 0.05);
    }

    expect(smoothed.rainFactor).toBeGreaterThan(0.95);
    expect(smoothed.windFactor).toBeGreaterThan(0.95);
    expect(smoothed.houseLightFactor).toBeGreaterThan(0.95);
    expect(smoothed.windmillAngle).toBeGreaterThan(1);

    const prevBob = smoothed.islandBobTime;
    const zeroWindReduced = stepSmoothedState(
      smoothed,
      { ...target, windStrength: 0, reducedMotion: true },
      0.05,
    );
    expect(zeroWindReduced.islandBobTime).toBe(prevBob);
  });

  it('produces distinct daylight, sunset, and readable nighttime lighting', () => {
    const base = createInitialSmoothedState(DEFAULT_WORLD_STATE);
    const day = computeEnvironmentLighting({ ...base, timeOfDay: 12, rainFactor: 0, houseLightFactor: 0 });
    const sunset = computeEnvironmentLighting({ ...base, timeOfDay: 18.3, rainFactor: 0, houseLightFactor: 0 });
    const night = computeEnvironmentLighting({ ...base, timeOfDay: 0, rainFactor: 0, houseLightFactor: 0 });
    const rainyDay = computeEnvironmentLighting({ ...base, timeOfDay: 12, rainFactor: 1, houseLightFactor: 0 });
    const litNight = computeEnvironmentLighting({ ...base, timeOfDay: 23, rainFactor: 0, houseLightFactor: 1 });

    // Distinct sky colors
    expect(day.skyTopHex).not.toBe(sunset.skyTopHex);
    expect(sunset.skyTopHex).not.toBe(night.skyTopHex);
    expect(day.skyTopHex).not.toBe(night.skyTopHex);

    // Nighttime must remain atmospheric and readable
    expect(night.nightFactor).toBeGreaterThan(0.8);
    expect(night.ambientIntensity).toBeGreaterThanOrEqual(0.35);
    expect(night.hemiIntensity).toBeGreaterThanOrEqual(0.45);
    expect(night.sunIntensity).toBeGreaterThan(0.2);

    // Rain softens sunlight and darkens clouds
    expect(rainyDay.sunIntensity).toBeLessThan(day.sunIntensity * 0.7);
    expect(rainyDay.cloudColorHex).not.toBe(day.cloudColorHex);

    // House lights significantly boost window emissive and point light
    expect(litNight.windowEmissiveIntensity).toBeGreaterThan(night.windowEmissiveIntensity + 0.8);
    expect(litNight.houseLightIntensity).toBeGreaterThan(1.0);
  });

  it('stops rain at island surface and pond without falling through underside', () => {
    const centerStop = getIslandSurfaceStopY(0, 0);
    expect(centerStop.hitsIsland).toBe(true);
    expect(centerStop.stopY).toBeGreaterThanOrEqual(-0.05);

    const pondStop = getIslandSurfaceStopY(POND_CENTER.x, POND_CENTER.z);
    expect(pondStop.hitsIsland).toBe(true);
    expect(pondStop.hitsPond).toBe(true);
    expect(pondStop.stopY).toBeGreaterThanOrEqual(-0.15);

    const offIsland = getIslandSurfaceStopY(8.5, 8.5);
    expect(offIsland.hitsIsland).toBe(false);
    expect(offIsland.hitsPond).toBe(false);
  });

  it('distinguishes click gestures from orbit drags', () => {
    expect(isClickGesture(100, 100, 102, 103, 120)).toBe(true);
    expect(isClickGesture(100, 100, 108, 100, 120)).toBe(false);
    expect(isClickGesture(100, 100, 101, 101, 650)).toBe(false);
  });
});
