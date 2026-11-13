import { describe, expect, it } from 'vitest';
import { createHouse } from '../src/scene/assets/house';
import { createWindmill } from '../src/scene/assets/windmill';
import { TREE_PLACEMENTS, createTrees } from '../src/scene/assets/trees';
import { createClouds } from '../src/scene/assets/clouds';
import { createProceduralTextures } from '../src/scene/textures';
import { evaluateAtmosphere } from '../src/scene/palette';
import {
  HOUSE_ANCHOR,
  POND_CENTER,
  WINDMILL_ANCHOR,
  isInsideIsland,
  isInsidePond,
  validateLandmarkClearance,
} from '../src/scene/terrain';

describe('diorama assets and layout', () => {
  it('places all trees inside the island without colliding with house, pond, windmill, or each other', () => {
    const landmarks = [
      { id: 'house', x: HOUSE_ANCHOR.x, z: HOUSE_ANCHOR.z, radius: HOUSE_ANCHOR.radius },
      { id: 'windmill', x: WINDMILL_ANCHOR.x, z: WINDMILL_ANCHOR.z, radius: WINDMILL_ANCHOR.radius },
      { id: 'pond', x: POND_CENTER.x, z: POND_CENTER.z, radius: Math.max(POND_CENTER.rx, POND_CENTER.rz) },
      ...TREE_PLACEMENTS.map((t, i) => ({ id: `tree-${i}`, x: t.x, z: t.z, radius: t.clearanceRadius })),
    ];

    expect(TREE_PLACEMENTS.length).toBeGreaterThanOrEqual(5);
    expect(validateLandmarkClearance(landmarks)).toBe(true);

    for (const tree of TREE_PLACEMENTS) {
      expect(isInsideIsland(tree.x, tree.z, tree.clearanceRadius)).toBe(true);
      expect(isInsidePond(tree.x, tree.z, tree.clearanceRadius)).toBe(false);
    }
  });

  it('toggles house emissive windows and spill light smoothly with lightFactor', () => {
    const textures = createProceduralTextures(false);
    const house = createHouse(textures);
    const night = evaluateAtmosphere(0, 0);

    expect(house.hitTargets.length).toBeGreaterThan(0);

    house.update(0.016, 0, night, false);
    const offWindowEmissive = house.getWindowEmissiveIntensity();
    const offPointLight = house.getLightIntensity();

    house.update(0.016, 1, night, false);
    const onWindowEmissive = house.getWindowEmissiveIntensity();
    const onPointLight = house.getLightIntensity();

    expect(onWindowEmissive).toBeGreaterThan(offWindowEmissive + 0.5);
    expect(onPointLight).toBeGreaterThan(offPointLight + 0.5);

    house.dispose();
  });

  it('rotates windmill blades strictly proportionally to windFactor and stops at zero wind', () => {
    const textures = createProceduralTextures(false);
    const windmill = createWindmill(textures);

    const startAngle = windmill.getRotorAngle();
    windmill.update(0.1, 0);
    expect(windmill.getRotorAngle()).toBe(startAngle);

    windmill.update(0.1, 0.3);
    const slowDelta = Math.abs(windmill.getRotorAngle() - startAngle);
    expect(slowDelta).toBeGreaterThan(0);

    const midAngle = windmill.getRotorAngle();
    windmill.update(0.1, 1.0);
    const fastDelta = Math.abs(windmill.getRotorAngle() - midAngle);
    expect(fastDelta).toBeGreaterThan(slowDelta * 2);

    windmill.dispose();
  });

  it('moves clouds along shared wind vector and stops at zero wind', () => {
    const clouds = createClouds();
    const day = evaluateAtmosphere(16, 0);
    const initialPositions = clouds.getCloudPositions();

    clouds.update(0.2, 0, { x: 1, z: 0 }, 0, day, false);
    expect(clouds.getCloudPositions()).toEqual(initialPositions);

    clouds.update(0.5, 0.8, { x: 0.88, z: 0.47 }, 0, day, false);
    const movedPositions = clouds.getCloudPositions();
    expect(movedPositions[0].x).not.toBeCloseTo(initialPositions[0].x, 4);

    clouds.dispose();
  });

  it('creates varied trees that stay within plausible sway limits', () => {
    const textures = createProceduralTextures(false);
    const trees = createTrees(textures);

    trees.update(1.5, 1.0, { x: 0.88, z: 0.47 }, false);
    for (const tilt of trees.getCurrentTilts()) {
      expect(Math.abs(tilt.x)).toBeLessThan(0.18);
      expect(Math.abs(tilt.z)).toBeLessThan(0.18);
    }

    trees.update(1.5, 0, { x: 0.88, z: 0.47 }, false);
    for (const tilt of trees.getCurrentTilts()) {
      expect(Math.abs(tilt.x)).toBeLessThan(0.001);
      expect(Math.abs(tilt.z)).toBeLessThan(0.001);
    }

    trees.dispose();
  });
});
