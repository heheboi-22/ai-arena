import { describe, expect, it } from 'vitest';
import { PointerTapTracker } from '../src/scene/gesture';
import { RainSystem } from '../src/scene/effects/rain';
import { RippleSystem } from '../src/scene/effects/ripples';
import { POND_CENTER, getIslandSurfaceHeight, isInsideIsland, isInsidePond } from '../src/scene/terrain';

describe('PointerTapTracker (click vs orbit drag)', () => {
  it('accepts a clean primary click or tap with minimal drift', () => {
    const tracker = new PointerTapTracker();
    tracker.onDown(1, 200, 300, 1000, true, 0);
    tracker.onMove(1, 202, 303);
    expect(tracker.onUp(1, 203, 302, 1120)).toBe(true);
  });

  it('rejects an orbit drag even if the pointer returns near the starting point', () => {
    const tracker = new PointerTapTracker();
    tracker.onDown(1, 200, 300, 1000, true, 0);
    tracker.onMove(1, 240, 315);
    tracker.onMove(1, 201, 301);
    expect(tracker.onUp(1, 201, 301, 1200)).toBe(false);
  });

  it('rejects secondary clicks, non-primary touches, long holds, and canceled pointers', () => {
    const tracker = new PointerTapTracker();

    tracker.onDown(2, 100, 100, 1000, true, 2);
    expect(tracker.onUp(2, 100, 100, 1050)).toBe(false);

    tracker.onDown(3, 100, 100, 1000, false, 0);
    expect(tracker.onUp(3, 100, 100, 1050)).toBe(false);

    tracker.onDown(4, 100, 100, 1000, true, 0);
    expect(tracker.onUp(4, 100, 100, 1600)).toBe(false);

    tracker.onDown(5, 100, 100, 1000, true, 0);
    tracker.onCancel(5);
    expect(tracker.onUp(5, 100, 100, 1050)).toBe(false);
  });
});

describe('RainSystem and RippleSystem pooling', () => {
  it('keeps rain pooled, blocks drops from piercing the island, and clears cleanly', () => {
    const rain = new RainSystem(180);
    const poolCapacity = rain.getPoolSize();
    expect(poolCapacity).toBe(180);

    for (let i = 0; i < 60; i++) {
      rain.update(0.05, 1, 0, { x: 1, z: 0 }, false);
    }

    expect(rain.getActiveCount()).toBeGreaterThan(0);
    expect(rain.getPoolSize()).toBe(poolCapacity);

    // Every active drop inside the island footprint stays above the island/pond surface
    for (const drop of rain.getDropsSnapshot()) {
      if (!drop.active) continue;
      if (isInsideIsland(drop.x, drop.z, 0)) {
        const floorY = Math.max(
          getIslandSurfaceHeight(drop.x, drop.z),
          isInsidePond(drop.x, drop.z) ? POND_CENTER.waterY : -99
        );
        expect(drop.y).toBeGreaterThanOrEqual(floorY - 0.35);
      }
    }

    // Zero wind produces vertical rain (zero horizontal velocity)
    rain.update(0.05, 1, 0, { x: 0.88, z: 0.47 }, false);
    for (const drop of rain.getDropsSnapshot()) {
      if (drop.active) {
        expect(drop.vx).toBe(0);
        expect(drop.vz).toBe(0);
      }
    }

    // Stronger wind shifts horizontal velocity along wind vector
    rain.update(0.05, 1, 0.9, { x: 0.88, z: 0.47 }, false);
    const windyActive = rain.getDropsSnapshot().filter((d) => d.active);
    expect(windyActive.some((d) => d.vx > 0 && d.vz > 0)).toBe(true);

    // Turning rain off drains active drops cleanly without resizing pool
    for (let i = 0; i < 120; i++) {
      rain.update(0.05, 0, 0.3, { x: 0.88, z: 0.47 }, false);
    }
    expect(rain.getActiveCount()).toBe(0);
    expect(rain.getPoolSize()).toBe(poolCapacity);

    rain.dispose();
  });

  it('keeps pond ripples pooled inside the pond and clears them when dry', () => {
    const ripples = new RippleSystem(14);
    expect(ripples.getPoolSize()).toBe(14);

    for (let i = 0; i < 40; i++) {
      ripples.update(0.05, 1, false);
    }

    expect(ripples.getVisibleCount()).toBeGreaterThan(0);
    for (const r of ripples.getRipplesSnapshot()) {
      if (r.active) {
        expect(isInsidePond(r.x, r.z)).toBe(true);
      }
    }

    for (let i = 0; i < 80; i++) {
      ripples.update(0.05, 0, false);
    }
    expect(ripples.getVisibleCount()).toBe(0);
    expect(ripples.getPoolSize()).toBe(14);

    ripples.dispose();
  });
});
