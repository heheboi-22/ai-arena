// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_WORLD_STATE, WorldStateStore } from '../src/state/worldState';
import { createControlPanel } from '../src/ui/ControlPanel';
import { computeResponsiveCameraDistance } from '../src/scene/framing';

describe('ControlPanel and responsive framing', () => {
  it('renders Pocket World controls with default state and syncs interactions', () => {
    const root = document.createElement('div');
    const store = new WorldStateStore();
    const onResetCamera = vi.fn();

    const panel = createControlPanel(root, store, onResetCamera);

    expect(root.textContent).toContain('Pocket World');

    const timeSlider = root.querySelector<HTMLInputElement>('[data-control="time"]');
    const timeLabel = root.querySelector<HTMLElement>('[data-label="time"]');
    const windSlider = root.querySelector<HTMLInputElement>('[data-control="wind"]');
    const windLabel = root.querySelector<HTMLElement>('[data-label="wind"]');
    const clearBtn = root.querySelector<HTMLButtonElement>('[data-weather="clear"]');
    const rainBtn = root.querySelector<HTMLButtonElement>('[data-weather="rain"]');
    const lightsBtn = root.querySelector<HTMLButtonElement>('[data-control="lights"]');
    const resetBtn = root.querySelector<HTMLButtonElement>('[data-control="reset"]');

    expect(timeSlider?.value).toBe('16');
    expect(timeLabel?.textContent).toBe('16:00');
    expect(windSlider?.value).toBe('30');
    expect(windLabel?.textContent).toBe('30%');
    expect(clearBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(rainBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(lightsBtn?.getAttribute('aria-pressed')).toBe('false');

    // UI -> Store updates
    if (timeSlider) {
      timeSlider.value = '21.5';
      timeSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(store.getState().timeOfDay).toBe(21.5);
    expect(timeLabel?.textContent).toBe('21:30');

    rainBtn?.click();
    expect(store.getState().weather).toBe('rain');
    expect(rainBtn?.getAttribute('aria-pressed')).toBe('true');

    if (windSlider) {
      windSlider.value = '75';
      windSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(store.getState().windStrength).toBe(75);
    expect(windLabel?.textContent).toBe('75%');

    // External 3D click -> UI sync
    store.toggleHouseLights();
    expect(lightsBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(lightsBtn?.textContent).toContain('On');

    // Reset restores both state and controls and invokes camera reset
    resetBtn?.click();
    expect(store.getState()).toEqual(DEFAULT_WORLD_STATE);
    expect(timeSlider?.value).toBe('16');
    expect(timeLabel?.textContent).toBe('16:00');
    expect(windSlider?.value).toBe('30');
    expect(windLabel?.textContent).toBe('30%');
    expect(clearBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(lightsBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(onResetCamera).toHaveBeenCalledTimes(1);

    panel.destroy();
  });

  it('supports mobile panel collapse toggle with aria-expanded', () => {
    const root = document.createElement('div');
    const store = new WorldStateStore();
    const panel = createControlPanel(root, store, () => {});

    const collapseBtn = root.querySelector<HTMLButtonElement>('[data-control="toggle-panel"]');
    const panelEl = root.querySelector<HTMLElement>('.control-panel');

    expect(collapseBtn).not.toBeNull();
    expect(collapseBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(panelEl?.classList.contains('is-collapsed')).toBe(true);

    collapseBtn?.click();
    expect(collapseBtn?.getAttribute('aria-expanded')).toBe('true');
    expect(panelEl?.classList.contains('is-collapsed')).toBe(false);

    panel.destroy();
  });

  it('scales camera framing distance outward on narrow portrait viewports', () => {
    const desktopDist = computeResponsiveCameraDistance(16 / 9, 16.5);
    const mobilePortraitDist = computeResponsiveCameraDistance(390 / 844, 16.5);

    expect(desktopDist).toBeCloseTo(16.5, 2);
    expect(mobilePortraitDist).toBeGreaterThan(desktopDist * 1.25);
  });
});
