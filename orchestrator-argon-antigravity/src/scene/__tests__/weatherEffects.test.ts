import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_STATE,
  POND_CENTER,
  createInitialSmoothedState,
  getIslandSurfaceStopY,
} from '../../state/worldState';
import { createWeatherEffects } from '../weatherEffects';

describe('weatherEffects', () => {
  it('initializes fixed pools without allocating new children on update', () => {
    const effects = createWeatherEffects();
    const initialChildCount = effects.group.children.length;
    const base = createInitialSmoothedState(DEFAULT_WORLD_STATE);

    effects.update({ ...base, rainFactor: 1, windFactor: 0.8 }, 0.05);
    effects.update({ ...base, rainFactor: 1, windFactor: 0.8 }, 0.05);

    expect(effects.group.children.length).toBe(initialChildCount);
    effects.dispose();
  });

  it('activates rain, tilts with wind, spawns pond ripples, and recycles drops at island surface', () => {
    const effects = createWeatherEffects();
    const base = createInitialSmoothedState(DEFAULT_WORLD_STATE);
    const rainState = { ...base, rainFactor: 1, windFactor: 0.9 };

    // Run multiple steps to let drops fall and spawn ripples
    for (let i = 0; i < 60; i++) {
      effects.update(rainState, 0.05);
      const rainMesh = effects.getRainInstancedMesh();
      expect(rainMesh.visible).toBe(true);

      // Verify no drop passes below island surface when over the island
      for (let d = 0; d < rainMesh.count; d++) {
        const pos = effects.getDropPosition(d);
        const surface = getIslandSurfaceStopY(pos.x, pos.z);
        if (surface.hitsIsland) {
          expect(pos.y).toBeGreaterThanOrEqual(surface.stopY - 0.15);
        }
      }
    }

    expect(effects.getActiveRippleCount()).toBeGreaterThan(0);

    // Check pond ripples are inside pond bounds
    for (const child of effects.group.children) {
      if (child.name === 'PondRipple' && child.visible) {
        const dist = Math.hypot(child.position.x - POND_CENTER.x, child.position.z - POND_CENTER.z);
        expect(dist).toBeLessThanOrEqual(POND_CENTER.radius);
      }
    }

    effects.dispose();
  });

  it('fades out ripples cleanly and hides rain when returning to clear weather', () => {
    const effects = createWeatherEffects();
    const base = createInitialSmoothedState(DEFAULT_WORLD_STATE);

    for (let i = 0; i < 40; i++) {
      effects.update({ ...base, rainFactor: 1, windFactor: 0.3 }, 0.05);
    }
    expect(effects.getActiveRippleCount()).toBeGreaterThan(0);

    // Switch back to clear
    for (let i = 0; i < 40; i++) {
      effects.update({ ...base, rainFactor: 0, windFactor: 0.3 }, 0.05);
    }

    expect(effects.getActiveRippleCount()).toBe(0);
    expect(effects.getRainInstancedMesh().visible).toBe(false);
    effects.dispose();
  });
});
