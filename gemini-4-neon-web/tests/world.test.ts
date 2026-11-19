import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_STATE,
  WorldStateStore,
  computeAtmosphere,
  deriveWindEffects,
  formatTimeMinutes,
  getTimePhaseLabel,
} from "../src/state/worldState";
import {
  LANDMARKS,
  WATER_LEVEL,
  getIslandRadiusAtAngle,
  getIslandTopHeight,
  getIslandUndersideHeight,
  getRainStopHeightAt,
  isInsideIsland,
  isInsidePond,
} from "../src/scene/terrainMath";
import { isClickGesture } from "../src/interaction/cameraAndPicking";

describe("WorldStateStore & Defaults", () => {
  it("starts with exact required defaults (16:00, clear, 30% wind, lights off)", () => {
    const store = new WorldStateStore();
    const s = store.getState();
    expect(s.timeMinutes).toBe(960);
    expect(formatTimeMinutes(s.timeMinutes)).toBe("16:00");
    expect(s.weather).toBe("clear");
    expect(s.windStrength).toBeCloseTo(0.3, 5);
    expect(s.houseLightsOn).toBe(false);
  });

  it("restores all fields cleanly on reset", () => {
    const store = new WorldStateStore();
    let resetFired = false;
    store.subscribe((_s, key) => {
      if (key === "reset") resetFired = true;
    });

    store.setTimeMinutes(1350);
    store.setWeather("rain");
    store.setWindStrength(0.92);
    store.toggleHouseLights();

    expect(store.getState().houseLightsOn).toBe(true);
    expect(store.getState().weather).toBe("rain");

    store.reset();
    expect(resetFired).toBe(true);
    expect(store.getState()).toEqual(DEFAULT_WORLD_STATE);
  });
});

describe("Atmosphere & 24-hour Transitions", () => {
  it("produces visibly distinct day, sunset, and night lighting while keeping night readable", () => {
    const midday = computeAtmosphere(13 * 60, 0);
    const sunset = computeAtmosphere(18.5 * 60, 0);
    const night = computeAtmosphere(23 * 60, 0);

    // Midday brighter than night
    expect(midday.sunLightIntensity).toBeGreaterThan(night.sunLightIntensity);
    // Sunset horizon warmer (higher red/blue ratio) than midday horizon
    const sunsetWarmth = sunset.skyHorizon.r / Math.max(0.01, sunset.skyHorizon.b);
    const middayWarmth = midday.skyHorizon.r / Math.max(0.01, midday.skyHorizon.b);
    expect(sunsetWarmth).toBeGreaterThan(middayWarmth);

    // Night stays atmospheric and readable (non-zero moon/hemi fill + stars visible)
    expect(night.hemiIntensity).toBeGreaterThanOrEqual(0.65);
    expect(night.sunLightIntensity).toBeGreaterThanOrEqual(0.7);
    expect(night.starVisibility).toBeGreaterThan(0.5);
    expect(night.windowProminence).toBeGreaterThan(midday.windowProminence);
  });

  it("darkens clouds and softens sunlight when rain is active", () => {
    const clear = computeAtmosphere(16 * 60, 0);
    const rainy = computeAtmosphere(16 * 60, 1);

    expect(rainy.sunLightIntensity).toBeLessThan(clear.sunLightIntensity * 0.6);
    const clearCloudLuma = clear.cloudColor.r + clear.cloudColor.g + clear.cloudColor.b;
    const rainyCloudLuma = rainy.cloudColor.r + rainy.cloudColor.g + rainy.cloudColor.b;
    expect(rainyCloudLuma).toBeLessThan(clearCloudLuma * 0.8);
  });

  it("formats boundary times and phases cleanly", () => {
    expect(formatTimeMinutes(0)).toBe("00:00");
    expect(formatTimeMinutes(960)).toBe("16:00");
    expect(formatTimeMinutes(1440)).toBe("24:00");
    expect(getTimePhaseLabel(13 * 60)).toBe("Midday");
    expect(getTimePhaseLabel(18.5 * 60)).toBe("Sunset");
    expect(getTimePhaseLabel(23 * 60)).toBe("Night");
  });
});

describe("Shared Wind Coupling", () => {
  it("halts wind-driven motion at zero wind while rain still falls straight down", () => {
    const calm = deriveWindEffects(0);
    expect(calm.windmillRadPerSec).toBe(0);
    expect(calm.treeSwayRadians).toBe(0);
    expect(calm.cloudSpeed).toBe(0);
    expect(calm.rainVelocityX).toBe(0);
    expect(calm.rainVelocityZ).toBe(0);
    expect(calm.rainVelocityY).toBeLessThan(-10);
  });

  it("scales windmill, tree sway, cloud drift, and rain slant monotonically with wind", () => {
    const light = deriveWindEffects(0.25);
    const strong = deriveWindEffects(0.9);
    expect(strong.windmillRadPerSec).toBeGreaterThan(light.windmillRadPerSec * 2);
    expect(strong.treeSwayRadians).toBeGreaterThan(light.treeSwayRadians * 2);
    expect(strong.treeSwayRadians).toBeLessThan(0.2); // stays plausible
    expect(strong.cloudSpeed).toBeGreaterThan(light.cloudSpeed * 2);
    expect(Math.hypot(strong.rainVelocityX, strong.rainVelocityZ)).toBeGreaterThan(
      Math.hypot(light.rainVelocityX, light.rainVelocityZ) * 2
    );
  });
});

describe("Terrain, Pond & Rain Containment", () => {
  it("shapes an irregular island silhouette with a recessed pond below water level", () => {
    const r0 = getIslandRadiusAtAngle(0);
    const r1 = getIslandRadiusAtAngle(1.2);
    const r2 = getIslandRadiusAtAngle(2.5);
    expect(Math.max(r0, r1, r2) - Math.min(r0, r1, r2)).toBeGreaterThan(0.5);

    // Pond center sits below WATER_LEVEL while cottage & windmill sit above
    const pondCenterY = getIslandTopHeight(LANDMARKS.pond.x, LANDMARKS.pond.z);
    const houseY = getIslandTopHeight(LANDMARKS.house.x, LANDMARKS.house.z);
    const millY = getIslandTopHeight(LANDMARKS.windmill.x, LANDMARKS.windmill.z);
    expect(pondCenterY).toBeLessThan(WATER_LEVEL - 0.15);
    expect(isInsidePond(LANDMARKS.pond.x, LANDMARKS.pond.z)).toBe(true);
    expect(isInsidePond(LANDMARKS.house.x, LANDMARKS.house.z)).toBe(false);
    expect(houseY).toBeGreaterThan(0.4);
    expect(millY).toBeGreaterThan(houseY);
  });

  it("stops rain above the island surface/pond and returns null outside the rim", () => {
    expect(isInsideIsland(0, 0)).toBe(true);
    expect(getRainStopHeightAt(LANDMARKS.pond.x, LANDMARKS.pond.z)).toBe(WATER_LEVEL);
    expect(getRainStopHeightAt(LANDMARKS.house.x, LANDMARKS.house.z)).toBeGreaterThan(0.4);
    expect(getRainStopHeightAt(15, 15)).toBeNull();
    expect(getIslandUndersideHeight(0, 0)).toBeLessThan(-4.5);
  });
});

describe("Click vs Orbit Drag Discrimination", () => {
  it("recognizes short taps as clicks and rejects orbit drags", () => {
    expect(isClickGesture(200, 200, 203, 202, 120)).toBe(true);
    expect(isClickGesture(200, 200, 224, 205, 180)).toBe(false);
    expect(isClickGesture(200, 200, 201, 201, 900)).toBe(false);
  });
});
