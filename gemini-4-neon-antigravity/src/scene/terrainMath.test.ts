import { describe, expect, it } from 'vitest';
import {
  HOUSE_ANCHOR,
  POND_ANCHOR,
  WATER_LEVEL,
  WINDMILL_ANCHOR,
  getIslandRadius,
  getRainCollision,
  getTerrainHeight,
  getUndersideDepth,
  isInsideIsland,
  isInsidePond,
} from './terrainMath';

describe('terrainMath', () => {
  it('places landmarks well inside the island without overlapping the pond', () => {
    expect(isInsideIsland(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z, 0.75)).toBe(true);
    expect(isInsideIsland(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z, 0.78)).toBe(true);
    expect(isInsidePond(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z)).toBe(false);
    expect(isInsidePond(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z)).toBe(false);
    expect(isInsidePond(POND_ANCHOR.x, POND_ANCHOR.z)).toBe(true);
  });

  it('carves pond below WATER_LEVEL and keeps cottage/windmill elevated above water', () => {
    expect(getTerrainHeight(POND_ANCHOR.x, POND_ANCHOR.z)).toBeLessThan(WATER_LEVEL - 0.25);
    expect(getTerrainHeight(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z)).toBeGreaterThan(0.3);
    expect(getTerrainHeight(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z)).toBeGreaterThan(0.75);
  });

  it('produces an organic non-constant island silhouette and deep underside spire', () => {
    const radii = [0, 1, 2, 3, 4, 5].map((a) => getIslandRadius(a));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.5);
    expect(getUndersideDepth(0, 0)).toBeLessThan(-3.5);
    expect(getUndersideDepth(0, 1)).toBeGreaterThan(-0.6);
  });

  it('returns accurate rain collisions for house, pond, grass, and off-island air', () => {
    const pondHit = getRainCollision(POND_ANCHOR.x, POND_ANCHOR.z);
    expect(pondHit.hitPond).toBe(true);
    expect(pondHit.floorY).toBe(WATER_LEVEL);

    const houseHit = getRainCollision(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z);
    expect(houseHit.hitIsland).toBe(true);
    expect(houseHit.floorY).toBeGreaterThan(2);

    const offIsland = getRainCollision(10, 10);
    expect(offIsland.hitIsland).toBe(false);
    expect(offIsland.floorY).toBeLessThan(-1.5);
  });
});
