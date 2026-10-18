import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('.shots', { recursive: true });
const state = (page: Page) => page.evaluate(() => (window as any).__pocketWorld.store.get());
const snapshot = (page: Page) => page.evaluate(() => {
  const w = (window as any).__pocketWorld.world;
  return {
    angle: w.rotor.rotation.z,
    tree: w.trees[0].pivot.rotation.z,
    cloud: w.environment.clouds[0].position.x,
    drops: Array.from(w.environment.rain.geometry.attributes.position.array as Float32Array),
    camera: w.camera.position.toArray(),
    target: w.controls.target.toArray(),
    sun: w.environment.sun.intensity,
    direction: w.environment.sun.position.toArray(),
    sky: getComputedStyle(document.documentElement).getPropertyValue('--sky'),
    rainVisible: w.environment.rain.visible,
    rainOpacity: w.environment.rain.material.opacity,
    rippleCount: w.environment.ripples.length,
    geometries: w.renderer.info.memory.geometries,
    drawCalls: w.renderer.info.render.calls,
    glass: w.house.glass.emissiveIntensity,
  };
});
async function slider(page: Page, id: string, value: number) {
  await page.locator(`#${id}`).evaluate((element, value) => {
    (element as HTMLInputElement).value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function housePoint(page: Page) {
  return page.evaluate(() => {
    const w = (window as any).__pocketWorld.world;
    const vector = w.camera.position.clone().set(0.55, 1.03, 0.96);
    w.house.house.localToWorld(vector); vector.project(w.camera);
    const rect = w.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (vector.x + 1) * rect.width / 2, y: rect.top + (1 - vector.y) * rect.height / 2 };
  });
}

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__pocketWorld));
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test('default composition, local assets, keyboard controls and camera bounds', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  expect(await state(page)).toEqual({ time: 16, weather: 'clear', wind: 0.3, lights: false });
  await expect(page.locator('#time-output')).toHaveText('16:00');
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  const external = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(url => !url.startsWith(location.origin) && !url.startsWith('data:')));
  expect(external).toEqual([]);
  await page.screenshot({ path: '.shots/default.png' });
  const before = await snapshot(page);
  await page.locator('canvas').focus();
  await page.keyboard.press('ArrowRight');
  const distanceBeforeZoom = await page.evaluate(() => (window as any).__pocketWorld.world.controls.getDistance());
  await page.keyboard.press('+');
  await expect.poll(() => page.evaluate(() => (window as any).__pocketWorld.world.controls.getDistance())).toBeLessThan(distanceBeforeZoom);
  await expect.poll(async () => (await snapshot(page)).camera).not.toEqual(before.camera);
  const distanceBeforeButton = await page.evaluate(() => (window as any).__pocketWorld.world.controls.getDistance());
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__pocketWorld.world.controls.getDistance())).toBeGreaterThan(distanceBeforeButton);
  const bounds = await page.evaluate(() => {
    const w = (window as any).__pocketWorld.world;
    for (let i = 0; i < 30; i++) w.controls.dollyIn(1 / 1.5);
    w.controls.update();
    const min = w.controls.getDistance();
    for (let i = 0; i < 30; i++) w.controls.dollyOut(1 / 1.5);
    w.controls.update();
    return { min, max: w.controls.getDistance(), lower: w.controls.minDistance, upper: w.controls.maxDistance, pan: w.controls.enablePan };
  });
  expect(bounds.min).toBeCloseTo(bounds.lower); expect(bounds.max).toBeCloseTo(bounds.upper); expect(bounds.pan).toBe(false);
  await page.locator('#time').focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('#time-output')).toHaveText('16:15');
  expect(errors).toEqual([]);
});

test('day, sunset and night affect actual lighting and sky', async ({ page }) => {
  await slider(page, 'time', 12);
  await expect.poll(async () => (await snapshot(page)).sun).toBeGreaterThan(2.8);
  const day = await snapshot(page);
  await slider(page, 'time', 18);
  await expect.poll(async () => (await snapshot(page)).sun).toBeLessThan(2.3);
  const sunset = await snapshot(page);
  expect(sunset.sky).not.toEqual(day.sky); expect(sunset.direction).not.toEqual(day.direction);
  await page.screenshot({ path: '.shots/sunset.png' });
  await slider(page, 'time', 22);
  await page.getByRole('button', { name: 'Rain', exact: true }).click();
  await page.getByRole('switch').click();
  await expect.poll(async () => (await snapshot(page)).glass).toBeGreaterThan(2.4);
  await expect.poll(async () => (await snapshot(page)).sun).toBeLessThan(0.3);
  expect((await snapshot(page)).sky).not.toEqual(sunset.sky);
  await page.screenshot({ path: '.shots/rainy-night.png' });
});

test('weather transitions recycle fixed rain and ripple pools without stale effects', async ({ page }) => {
  await page.getByRole('button', { name: 'Rain', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).rainOpacity).toBeGreaterThan(0.5);
  const first = await snapshot(page);
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.getByRole('button', { name: 'Rain', exact: true }).click();
  }
  const repeated = await snapshot(page);
  expect(repeated.drops.length).toEqual(first.drops.length);
  expect(repeated.rippleCount).toEqual(first.rippleCount);
  expect(repeated.geometries).toEqual(first.geometries);
  const underneath = await page.evaluate(() => {
    const positions = (window as any).__pocketWorld.world.environment.rain.geometry.attributes.position.array;
    let count = 0;
    for (let i = 0; i < positions.length; i += 6) {
      if (Math.abs(positions[i]) < 1 && Math.abs(positions[i + 2]) < 1 && positions[i + 1] < 0.2) count++;
    }
    return count;
  });
  expect(underneath).toEqual(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).rainVisible).toBe(false);
  expect((await snapshot(page)).rainOpacity).toBeLessThan(0.01);
});

test('shared wind drives mill, tree, cloud and rain; still air keeps rain falling', async ({ page }) => {
  await page.getByRole('button', { name: 'Rain', exact: true }).click();
  await slider(page, 'wind', 0);
  await expect.poll(async () => Math.abs((await snapshot(page)).tree)).toBeLessThan(0.0001);
  await page.waitForTimeout(1600);
  const stillA = await snapshot(page); await page.waitForTimeout(450); const stillB = await snapshot(page);
  expect(Math.abs(stillB.angle - stillA.angle)).toBeLessThan(0.001);
  expect(Math.abs(stillB.cloud - stillA.cloud)).toBeLessThan(0.001);
  expect(stillB.drops).not.toEqual(stillA.drops);
  expect(Math.abs(stillB.drops[0] - stillB.drops[3])).toBeLessThan(0.001);
  await slider(page, 'wind', 100); await page.waitForTimeout(1400);
  const windA = await snapshot(page); await page.waitForTimeout(500); const windB = await snapshot(page);
  expect(Math.abs(windB.angle - windA.angle)).toBeGreaterThan(0.4);
  expect(Math.abs(windB.tree - windA.tree)).toBeGreaterThan(0.0005);
  expect(Math.abs(windB.cloud - windA.cloud)).toBeGreaterThan(0.01);
  expect(Math.abs(windB.drops[0] - windB.drops[3])).toBeGreaterThan(0.1);
});

test('house click and UI stay synchronized, orbit and returning drag do not toggle lights', async ({ page }) => {
  const point = await housePoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('switch').click();
  expect((await state(page)).lights).toBe(false);
  const before = await snapshot(page);
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y + 20, { steps: 10 });
  await page.mouse.move(point.x, point.y, { steps: 10 }); await page.mouse.up();
  expect((await state(page)).lights).toBe(false);
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 100, point.y + 30, { steps: 10 }); await page.mouse.up();
  expect((await snapshot(page)).camera).not.toEqual(before.camera);
  expect((await state(page)).lights).toBe(false);
});

test('rapid input is interruptible; reset restores the camera, world and controls', async ({ page }) => {
  const initial = await snapshot(page);
  for (let i = 0; i < 8; i++) {
    await slider(page, 'time', i % 2 ? 23 : 6);
    await slider(page, 'wind', i % 2 ? 100 : 0);
    await page.getByRole('button', { name: i % 2 ? 'Rain' : 'Clear', exact: true }).click();
  }
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Reset world', exact: true }).click();
  expect(await state(page)).toEqual({ time: 16, weather: 'clear', wind: 0.3, lights: false });
  await expect(page.locator('#time')).toHaveValue('16'); await expect(page.locator('#wind')).toHaveValue('30');
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await snapshot(page)).rainVisible).toBe(false);
  const reset = await snapshot(page);
  reset.camera.forEach((value: number, i: number) => expect(value).toBeCloseTo(initial.camera[i], 5));
  expect(reset.glass).toBeLessThan(0.01);
});

test('mobile framing, panel collapse and real touch orbit, pinch and house tap', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__pocketWorld));
  const layout = await page.evaluate(() => {
    const world = document.querySelector('#world')!.getBoundingClientRect();
    const panel = document.querySelector('.controls')!.getBoundingClientRect();
    const caption = document.querySelector('.world-caption')!.getBoundingClientRect();
    return { worldBottom: world.bottom, panelTop: panel.top, captionBottom: caption.bottom, width: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  expect(layout.worldBottom).toBeLessThan(layout.panelTop);
  expect(layout.captionBottom).toBeLessThan(layout.panelTop);
  expect(layout.width).toEqual(layout.viewport);
  await page.screenshot({ path: '.shots/mobile.png' });
  const house = await housePoint(page); await page.touchscreen.tap(house.x, house.y);
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  const cdp = await context.newCDPSession(page);
  const before = await snapshot(page);
  const touch = (x: number, y: number, id: number) => ({ x, y, id, radiusX: 3, radiusY: 3 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(180, 290, 0)] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(180 + i * 9, 290, 0)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await snapshot(page)).camera).not.toEqual(before.camera);
  expect((await state(page)).lights).toBe(true);
  const distance = () => page.evaluate(() => (window as any).__pocketWorld.world.controls.getDistance());
  const startDistance = await distance();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(145, 300, 0), touch(245, 300, 1)] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(145 - i * 5, 300, 0), touch(245 + i * 5, 300, 1)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(distance).toBeLessThan(startDistance - 1);
  expect((await state(page)).lights).toBe(true);
  await page.getByRole('button', { name: 'Make it your moment' }).click();
  await expect(page.locator('#panel-content')).toBeHidden();
  await page.getByRole('button', { name: 'Make it your moment' }).click();
  await expect(page.locator('#panel-content')).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('#time')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.locator('#reset')).toBeInViewport();
  await context.close();
});

test('reduced motion retains usable controls and lowers decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await slider(page, 'wind', 100); await page.waitForTimeout(1200);
  const a = await snapshot(page); await page.waitForTimeout(500); const b = await snapshot(page);
  expect(Math.abs(b.tree)).toBeLessThanOrEqual(0.009);
  expect(Math.abs(b.angle - a.angle)).toBeLessThan(0.65);
  await page.getByRole('button', { name: 'Rain', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).rainVisible).toBe(true);
  await page.getByRole('switch').click();
  await expect.poll(async () => (await snapshot(page)).glass).toBeGreaterThan(0.4);
});

test('missing WebGL shows a readable fallback and disabled scene controls', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: any[]) {
      if (String(args[0]).startsWith('webgl')) return null;
      return (original as any).apply(this, args);
    } as any;
  });
  const page = await context.newPage(); await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('WebGL 2');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('#time')).toBeDisabled();
  await context.close();
});
