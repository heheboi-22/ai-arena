import { describe, expect, it } from "vitest";
import {
  computeSkyFactors,
  createInitialState,
  DEFAULT_WORLD_STATE,
  describeTimePhase,
  formatTimeMinutes,
} from "../src/state";
import {
  groundHeightAt,
  HOUSE_CENTER,
  islandRadiusAt,
  pondNormalizedRadius,
  WATER_LEVEL,
  WINDMILL_CENTER,
} from "../src/util/math";

describe("Pocket World state & formatting", () => {
  it("provides exact defaults required for Reset", () => {
    const state = createInitialState();
    expect(state).toEqual(DEFAULT_WORLD_STATE);
    expect(state.timeMinutes).toBe(960);
    expect(state.weather).toBe("clear");
    expect(state.windStrength).toBeCloseTo(0.3, 5);
    expect(state.houseLights).toBe(false);
  });

  it("formats time labels across 24-hour range", () => {
    expect(formatTimeMinutes(0)).toBe("00:00");
    expect(formatTimeMinutes(375)).toBe("06:15");
    expect(formatTimeMinutes(960)).toBe("16:00");
    expect(formatTimeMinutes(1435)).toBe("23:55");
    expect(formatTimeMinutes(1440)).toBe("00:00");
  });

  it("transitions daylight, sunset twilight, and nightness plausibly", () => {
    const noon = computeSkyFactors(12 * 60);
    const sunset = computeSkyFactors(18 * 60 + 45);
    const midnight = computeSkyFactors(0);

    expect(noon.daylight).toBeGreaterThan(0.85);
    expect(noon.nightness).toBeLessThan(0.1);

    expect(sunset.twilight).toBeGreaterThan(0.4);

    expect(midnight.nightness).toBeGreaterThan(0.85);
    expect(midnight.daylight).toBeLessThan(0.1);
  });

  it("describes time phases accurately", () => {
    expect(describeTimePhase(6 * 60)).toBe("Dawn");
    expect(describeTimePhase(10 * 60)).toBe("Morning");
    expect(describeTimePhase(16 * 60)).toBe("Afternoon");
    expect(describeTimePhase(18 * 60)).toBe("Sunset");
    expect(describeTimePhase(23 * 60)).toBe("Night");
  });
});

describe("Pocket World terrain & placement math", () => {
  it("produces an organic irregular island radius", () => {
    const radii = [0, 1, 2, 3, 4, 5].map((a) => islandRadiusAt(a));
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    expect(max - min).toBeGreaterThan(0.6);
    expect(min).toBeGreaterThan(5.5);
  });

  it("carves a pond basin below water level and elevates the windmill knoll", () => {
    const pondCenterY = groundHeightAt(-0.68, 2.08);
    const housePadY = groundHeightAt(HOUSE_CENTER.x, HOUSE_CENTER.z);
    const windmillKnollY = groundHeightAt(WINDMILL_CENTER.x, WINDMILL_CENTER.z);

    expect(pondCenterY).toBeLessThan(WATER_LEVEL - 0.25);
    expect(windmillKnollY).toBeGreaterThan(housePadY);
    expect(pondNormalizedRadius(-0.68, 2.08)).toBeLessThan(0.1);
    expect(pondNormalizedRadius(HOUSE_CENTER.x, HOUSE_CENTER.z)).toBeGreaterThan(1.3);
  });
});
