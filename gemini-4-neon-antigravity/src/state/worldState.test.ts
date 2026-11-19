import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_HOUSE_LIGHTS,
  DEFAULT_TIME_MINUTES,
  DEFAULT_WEATHER,
  DEFAULT_WIND_STRENGTH,
  WorldStateStore,
  formatTimeLabel,
  getTimePeriodLabel,
} from './worldState';

describe('WorldStateStore', () => {
  it('initializes with the required defaults (16:00, clear, 30% wind, lights off)', () => {
    const store = new WorldStateStore();
    expect(store.getState()).toEqual({
      timeMinutes: DEFAULT_TIME_MINUTES,
      weather: DEFAULT_WEATHER,
      windStrength: DEFAULT_WIND_STRENGTH,
      houseLights: DEFAULT_HOUSE_LIGHTS,
      reducedMotion: false,
    });
    expect(formatTimeLabel(store.getState().timeMinutes)).toBe('16:00');
    expect(getTimePeriodLabel(store.getState().timeMinutes)).toBe('Afternoon');
  });

  it('clamps time and wind values and notifies subscribers', () => {
    const store = new WorldStateStore();
    const spy = vi.fn();
    store.subscribe(spy);

    store.setTimeMinutes(1600);
    expect(store.getState().timeMinutes).toBe(1440);
    store.setTimeMinutes(-15);
    expect(store.getState().timeMinutes).toBe(0);

    store.setWindStrength(2.5);
    expect(store.getState().windStrength).toBe(1);
    store.setWindStrength(-0.2);
    expect(store.getState().windStrength).toBe(0);

    store.toggleHouseLights();
    expect(store.getState().houseLights).toBe(true);
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('restores exact defaults on reset while preserving reducedMotion preference', () => {
    const store = new WorldStateStore({ reducedMotion: true });
    const resetSpy = vi.fn();
    store.onReset(resetSpy);

    store.setTimeMinutes(1320);
    store.setWeather('rain');
    store.setWindStrength(0.85);
    store.setHouseLights(true);

    store.reset();

    expect(store.getState()).toEqual({
      timeMinutes: 960,
      weather: 'clear',
      windStrength: 0.3,
      houseLights: false,
      reducedMotion: true,
    });
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('formats 24-hour times and periods cleanly across the full day', () => {
    expect(formatTimeLabel(0)).toBe('00:00');
    expect(formatTimeLabel(75)).toBe('01:15');
    expect(formatTimeLabel(960)).toBe('16:00');
    expect(formatTimeLabel(1440)).toBe('24:00');
    expect(getTimePeriodLabel(120)).toBe('Night');
    expect(getTimePeriodLabel(360)).toBe('Dawn');
    expect(getTimePeriodLabel(750)).toBe('Midday');
    expect(getTimePeriodLabel(1110)).toBe('Sunset');
  });
});
