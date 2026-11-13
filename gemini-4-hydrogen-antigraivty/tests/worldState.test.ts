import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORLD_STATE,
  WorldStateStore,
  clampDeltaTime,
  createAnimatedWorldState,
  dampValue,
  formatTimeOfDay,
  stepAnimatedState,
} from '../src/state/worldState';

describe('worldState', () => {
  it('defines required default state', () => {
    expect(DEFAULT_WORLD_STATE).toEqual({
      timeOfDay: 16,
      weather: 'clear',
      windStrength: 30,
      houseLights: false,
    });
  });

  it('formats 24-hour times cleanly', () => {
    expect(formatTimeOfDay(0)).toBe('00:00');
    expect(formatTimeOfDay(6.5)).toBe('06:30');
    expect(formatTimeOfDay(16)).toBe('16:00');
    expect(formatTimeOfDay(23.75)).toBe('23:45');
    expect(formatTimeOfDay(24)).toBe('24:00');
  });

  it('clamps delta time to prevent tab-switch spikes and invalid values', () => {
    expect(clampDeltaTime(0.016)).toBeCloseTo(0.016);
    expect(clampDeltaTime(4.2)).toBe(0.1);
    expect(clampDeltaTime(-0.25)).toBe(0);
    expect(clampDeltaTime(Number.NaN)).toBe(0);
    expect(clampDeltaTime(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('damps values smoothly toward target without overshoot', () => {
    const next = dampValue(0, 1, 8, 0.016);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
    expect(dampValue(0.5, 0.5, 8, 0.016)).toBe(0.5);
  });

  it('manages state mutations, clamping, subscriptions, and reset', () => {
    const store = new WorldStateStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setTimeOfDay(30);
    expect(store.getState().timeOfDay).toBe(24);

    store.setTimeOfDay(-3);
    expect(store.getState().timeOfDay).toBe(0);

    store.setWindStrength(140);
    expect(store.getState().windStrength).toBe(100);

    store.setWindStrength(-10);
    expect(store.getState().windStrength).toBe(0);

    store.setWeather('rain');
    expect(store.getState().weather).toBe('rain');

    store.toggleHouseLights();
    expect(store.getState().houseLights).toBe(true);

    store.reset();
    expect(store.getState()).toEqual(DEFAULT_WORLD_STATE);
    expect(listener).toHaveBeenCalled();

    const callCountBeforeUnsub = listener.mock.calls.length;
    unsubscribe();
    store.toggleHouseLights();
    expect(listener.mock.calls.length).toBe(callCountBeforeUnsub);
  });

  it('steps animated simulation state smoothly across rapid changes', () => {
    const store = new WorldStateStore();
    const anim = createAnimatedWorldState(store.getState());

    expect(anim.timeOfDay).toBe(16);
    expect(anim.rainFactor).toBe(0);
    expect(anim.windFactor).toBeCloseTo(0.3);
    expect(anim.houseLightFactor).toBe(0);

    store.setWeather('rain');
    store.setWindStrength(90);
    store.setHouseLights(true);
    store.setTimeOfDay(22);

    for (let i = 0; i < 12; i++) {
      stepAnimatedState(anim, store.getState(), 0.05);
    }

    expect(anim.rainFactor).toBeGreaterThan(0.5);
    expect(anim.rainFactor).toBeLessThanOrEqual(1);
    expect(anim.windFactor).toBeGreaterThan(0.5);
    expect(anim.houseLightFactor).toBeGreaterThan(0.5);
    expect(anim.timeOfDay).toBeGreaterThan(18);

    // Interrupt mid-transition back to defaults
    store.reset();
    for (let i = 0; i < 80; i++) {
      stepAnimatedState(anim, store.getState(), 0.05);
    }

    expect(anim.rainFactor).toBeLessThan(0.01);
    expect(anim.windFactor).toBeCloseTo(0.3, 2);
    expect(anim.houseLightFactor).toBeLessThan(0.01);
    expect(anim.timeOfDay).toBeCloseTo(16, 2);
  });
});
