import { describe, expect, it } from 'vitest';
import {
  HOUSE_ANCHOR,
  POND_CENTER,
  WINDMILL_ANCHOR,
  getIslandRadiusAtAngle,
  getIslandSurfaceHeight,
  isInsideIsland,
  isInsidePond,
  validateLandmarkClearance,
} from '../src/scene/terrain';

describe('terrain & layout geometry', () => {
  it('defines an organic irregular island silhouette rather than a uniform circle', () => {
    const radii: number[] = [];
    for (let i = 0; i < 16; i++) {
      radii.push(getIslandRadiusAtAngle((i / 16) * Math.PI * 2));
    }
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    expect(min).toBeGreaterThan(4.2);
    expect(max).toBeLessThan(6.8);
    expect(max - min).toBeGreaterThan(0.8);
  });

  it('carves a submerged basin at the pond center and keeps anchors on solid ground', () => {
    expect(isInsideIsland(POND_CENTER.x, POND_CENTER.z, 0.5)).toBe(true);
    expect(isInsidePond(POND_CENTER.x, POND_CENTER.z)).toBe(true);
    expect(getIslandSurfaceHeight(POND_CENTER.x, POND_CENTER.z)).toBeLessThan(POND_CENTER.waterY - 0.15);

    expect(isInsideIsland(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z, HOUSE_ANCHOR.radius)).toBe(true);
    expect(isInsidePond(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z, 0.4)).toBe(false);
    expect(getIslandSurfaceHeight(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z)).toBeGreaterThan(POND_CENTER.waterY + 0.1);

    expect(isInsideIsland(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z, WINDMILL_ANCHOR.radius)).toBe(true);
    expect(isInsidePond(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z, 0.4)).toBe(false);
    expect(getIslandSurfaceHeight(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z)).toBeGreaterThan(POND_CENTER.waterY + 0.15);
  });

  it('validates landmark clearance to prevent overlapping placements', () => {
    expect(
      validateLandmarkClearance([
        { id: 'house', x: HOUSE_ANCHOR.x, z: HOUSE_ANCHOR.z, radius: HOUSE_ANCHOR.radius },
        { id: 'windmill', x: WINDMILL_ANCHOR.x, z: WINDMILL_ANCHOR.z, radius: WINDMILL_ANCHOR.radius },
        { id: 'pond', x: POND_CENTER.x, z: POND_CENTER.z, radius: Math.max(POND_CENTER.rx, POND_CENTER.rz) },
      ])
    ).toBe(true);

    expect(
      validateLandmarkClearance([
        { id: 'a', x: 0, z: 0, radius: 1.5 },
        { id: 'b', x: 2.0, z: 0, radius: 1.0 },
      ])
    ).toBe(false);
  });
});
