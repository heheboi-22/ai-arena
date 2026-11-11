/**
 * Browser verification for Pocket World (glm-5.3-zcode).
 *
 * Run:  node scripts/verify.mjs
 * Needs: the production build served at http://127.0.0.1:5132/
 *        (`npm run build && npm run serve`), and playwright-core resolvable.
 *
 * playwright-core is imported from the sibling kimi-k3-workbuddy project's
 * node_modules on purpose: this repo verifies worlds with local software GL
 * (SwiftShader), and keeping the browser package out of our dependencies
 * keeps the arena Docker build small.
 */
import { chromium } from '/home/aorus/Project/ai-arena/kimi-k3-workbuddy/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5132/';
const OUT = new URL('../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const W = 1280, H = 800;
const errors = [];

const browser = await chromium.launch({
  executablePath: '/home/aorus/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(3200);

// 1. default view
await page.screenshot({ path: `${OUT}1-default.png` });

// webgl sanity
const webgl = await page.evaluate(() => {
  const c = document.querySelector('#scene canvas');
  if (!c) return 'no-canvas';
  return !!(c.getContext('webgl2') || c.getContext('webgl')) ? 'webgl-ok' : 'no-ctx';
});
console.log('webgl:', webgl);

// 2. clean tap on the house toggles the lights (camera still at its home
//    position, so the projection below is valid)
const house = houseScreenPos();
await page.mouse.move(house.x, house.y - 10);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(500);
const afterTap = await page.getAttribute('#lights-toggle', 'aria-checked');
console.log('lights after house tap (want true):', afterTap);

// 2b. the UI switch flips the same state back off
await page.locator('#lights-toggle').click();
await page.waitForTimeout(300);
const afterUi = await page.getAttribute('#lights-toggle', 'aria-checked');
console.log('lights after UI switch (want false):', afterUi);

// 3. orbit + zoom, then a drag that starts on the house must NOT toggle lights
await page.mouse.move(house.x, house.y);
await page.mouse.down();
await page.mouse.move(house.x + 260, house.y - 140, { steps: 14 }); // drag across the house
await page.mouse.up();
await page.mouse.wheel(0, -300);
await page.waitForTimeout(900);
const afterDrag = await page.getAttribute('#lights-toggle', 'aria-checked');
console.log('lights after drag over house (want false):', afterDrag);
await page.screenshot({ path: `${OUT}2-orbit.png` });

// 4. sunset
await page.locator('#time-slider').fill('18.5');
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}3-sunset.png` });

// 5. rainy night with house lights on
await page.locator('#time-slider').fill('22');
await page.locator('#weather-rain').click();
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}4-night-rain.png` });

// 6. strong wind while raining, then back to clear to check cleanup
await page.locator('#wind-slider').fill('85');
await page.waitForTimeout(1200);
await page.locator('#weather-clear').click();
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}5-wind-clear.png` });

// 7. reset restores world and controls
await page.locator('#reset-btn').click();
await page.waitForTimeout(1600);
const resetState = await page.evaluate(() => ({
  time: document.getElementById('time-slider').value,
  wind: document.getElementById('wind-slider').value,
  lights: document.getElementById('lights-toggle').getAttribute('aria-checked'),
  rainActive: document.getElementById('weather-rain').getAttribute('aria-pressed'),
  clearActive: document.getElementById('weather-clear').getAttribute('aria-pressed'),
}));
console.log('after reset (want time 16, wind 30, lights false, clear pressed):', resetState);
await page.screenshot({ path: `${OUT}6-reset.png` });

// 8. rapid control changes must not break the scene
await page.locator('#time-slider').fill('6');
await page.locator('#weather-rain').click();
await page.locator('#time-slider').fill('23.75');
await page.locator('#wind-slider').fill('0');
await page.locator('#weather-clear').click();
await page.locator('#wind-slider').fill('100');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}7-rapid.png` });

// 9. mobile layout
const mobile = await browser.newPage({ viewport: { width: 390, height: 780 } });
mobile.on('console', (m) => { if (m.type() === 'error') errors.push(`[mobile console] ${m.text()}`); });
mobile.on('pageerror', (e) => errors.push(`[mobile pageerror] ${e.message}`));
await mobile.goto(BASE, { waitUntil: 'load' });
await mobile.waitForTimeout(2600);
await mobile.screenshot({ path: `${OUT}8-mobile.png` });
const panelCollapsed = await mobile.evaluate(() =>
  document.getElementById('panel').classList.contains('collapsed'));
console.log('mobile panel collapsed (want true):', panelCollapsed);
// expand the panel and check it stays usable
await mobile.locator('#panel-head').click();
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: `${OUT}9-mobile-panel.png` });
await mobile.close();

await browser.close();

console.log('errors:', errors.length ? errors : 'none');
if (errors.length) process.exitCode = 1;

/** Project the house's mid-wall point to canvas pixels using the fixed initial camera. */
function houseScreenPos() {
  // camera defaults, mirrored from src/world/layout.ts
  const P = [11.4, 3.9, 13.5];
  const T = [0, -0.95, 0];
  const fovY = (42 * Math.PI) / 180;
  const aspect = W / H;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const f = norm(sub(T, P));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const w = [1.55, 1.3, -0.35]; // roughly the middle of the house walls
  const d = sub(w, P);
  const xv = dot(r, d), yv = dot(u, d), zv = -dot(f, d);
  const th = Math.tan(fovY / 2);
  // zv is negative in front of the camera (view space looks down -Z)
  const nx = xv / (-zv * aspect * th);
  const ny = yv / (-zv * th);
  return { x: (nx * 0.5 + 0.5) * W, y: (1 - (ny * 0.5 + 0.5)) * H };
}
