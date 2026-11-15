import { describe, it, expect } from "vitest";
import {
  DEFAULT_WORLD_STATE,
  WorldStateStore,
  computeCelestialState,
  computeIslandOutlineRadius,
  describeTimePhase,
  formatTimeHours,
  getIslandSurfaceHeight,
  isPointInPond,
  POND_CENTER,
} from "../src/state";

describe("Pocket World State & Environment Math", () => {
  it("matches exact default specification", () => {
    expect(DEFAULT_WORLD_STATE.timeHours).toBe(16.0);
    expect(DEFAULT_WORLD_STATE.weather).toBe("clear");
    expect(DEFAULT_WORLD_STATE.windStrength).toBe(30);
    expect(DEFAULT_WORLD_STATE.houseLightsOn).toBe(false);
  });

  it("formats 24-hour clock labels and phases accurately", () => {
    expect(formatTimeHours(0)).toBe("00:00");
    expect(formatTimeHours(6.5)).toBe("06:30");
    expect(formatTimeHours(16.0)).toBe("16:00");
    expect(formatTimeHours(24.0)).toBe("00:00");
    expect(describeTimePhase(6.0)).toBe("Dawn");
    expect(describeTimePhase(12.5)).toBe("Midday");
    expect(describeTimePhase(16.0)).toBe("Late Afternoon");
    expect(describeTimePhase(18.5)).toBe("Sunset");
    expect(describeTimePhase(23.0)).toBe("Night");
  });

  it("computes distinct celestial factors for noon, sunset, and midnight", () => {
    const noon = computeCelestialState(12.25);
    const sunset = computeCelestialState(18.35);
    const midnight = computeCelestialState(0.5);
    expect(noon.daylight).toBeGreaterThan(0.9);
    expect(sunset.twilight).toBeGreaterThan(0.55);
    expect(midnight.nightness).toBeGreaterThan(0.9);
  });

  it("updates, smooths, and resets WorldStateStore cleanly", () => {
    const store = new WorldStateStore();
    store.setTimeHours(22.5);
    store.setWeather("rain");
    store.setWindStrength(85);
    store.toggleHouseLights();

    for (let i = 0; i < 30; i++) {
      store.updateSmoothed(0.05);
    }
    expect(store.smoothed.rainFactor).toBeGreaterThan(0.95);
    expect(store.smoothed.windFactor).toBeCloseTo(0.85, 1);
    expect(store.smoothed.houseLightsFactor).toBeGreaterThan(0.98);

    store.reset();
    expect(store.getState()).toEqual(DEFAULT_WORLD_STATE);
  });

  it("evaluates island heightfield and pond containment", () => {
    expect(computeIslandOutlineRadius(0)).toBeGreaterThan(6.0);
    const bluffY = getIslandSurfaceHeight(2.9, -2.3);
    const pondY = getIslandSurfaceHeight(POND_CENTER.x, POND_CENTER.z);
    expect(bluffY).not.toBeNull();
    expect(pondY).not.toBeNull();
    expect(bluffY!).toBeGreaterThan(pondY! + 0.8);
    expect(isPointInPond(POND_CENTER.x, POND_CENTER.z)).toBe(true);
  });
});
