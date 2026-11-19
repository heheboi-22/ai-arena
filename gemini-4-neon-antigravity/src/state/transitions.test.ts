import { describe, expect, it } from 'vitest';
import {
  EnvironmentTransitionController,
  MAX_FRAME_DELTA,
  clampDelta,
} from './transitions';
import { WorldStateStore } from './worldState';

describe('EnvironmentTransitionController', () => {
  it('clamps large or invalid frame deltas to prevent tab-return jumps', () => {
    expect(clampDelta(-0.5)).toBe(0);
    expect(clampDelta(Number.NaN)).toBe(0);
    expect(clampDelta(0.016)).toBeCloseTo(0.016);
    expect(clampDelta(4.5)).toBe(MAX_FRAME_DELTA);
  });

  it('smoothly transitions and cleanly handles rapid interrupted changes', () => {
    const store = new WorldStateStore();
    const controller = new EnvironmentTransitionController(store.getState());

    // Toggle to rain and step briefly
    store.setWeather('rain');
    controller.update(store.getState(), 0.05);
    const midRain = controller.values.rainAmount;
    expect(midRain).toBeGreaterThan(0);
    expect(midRain).toBeLessThan(1);

    // Immediately interrupt back to clear
    store.setWeather('clear');
    for (let i = 0; i < 120; i++) {
      controller.update(store.getState(), 0.04);
    }
    expect(controller.values.rainAmount).toBe(0);
  });

  it('converges wind, time, and house lights cleanly to target values', () => {
    const store = new WorldStateStore();
    const controller = new EnvironmentTransitionController(store.getState());

    store.setTimeMinutes(1350);
    store.setWindStrength(0.95);
    store.setHouseLights(true);

    for (let i = 0; i < 120; i++) {
      controller.update(store.getState(), 0.04);
    }

    expect(controller.values.timeMinutes).toBeCloseTo(1350, 1);
    expect(controller.values.windStrength).toBeCloseTo(0.95, 2);
    expect(controller.values.houseLightsAmount).toBe(1);
  });
});
