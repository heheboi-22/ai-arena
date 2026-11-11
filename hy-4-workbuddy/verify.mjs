/**
 * Headless behavioural verification for Pocket World.
 *
 *   npm run build
 *   npm run verify
 *
 * Serves dist/ on 127.0.0.1:4199, opens the production bundle in headless
 * Chromium (SwiftShader WebGL), exercises every control through real clicks,
 * drags and key presses, writes screenshots to shots/, and prints a PASS/FAIL
 * report. Nothing here is a static code inspection: every assertion reads the
 * live scene state or the live DOM.
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots');
const PORT = 4199;
const URL = `http://127.0.0.1:${PORT}/?debug`;
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(body);
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--enable-webgl',
  ],
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText ?? '')));

const visual = () => page.evaluate(() => window.__pocketWorld.visual());
const set = (patch) => page.evaluate((p) => { window.__pocketWorld.set(p); window.__pocketWorld.settle(); }, patch);
const settle = () => page.evaluate(() => window.__pocketWorld.settle());
const shot = (name) => page.screenshot({ path: path.join(OUT, name) });

await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(1800);

// ---------------------------------------------------------------- init ------
const init = await page.evaluate(() => ({
  debug: !!window.__pocketWorld,
  fallbackHidden: document.getElementById('fallback').hidden,
  loadingGone: !document.getElementById('loading') || document.getElementById('loading').classList.contains('is-gone'),
  canvas: (() => { const c = document.querySelector('#app canvas'); return c ? [c.width, c.height] : null; })(),
  overflow: document.documentElement.scrollWidth - window.innerWidth,
}));
check('WebGL scene initialised, no fallback overlay', init.debug && init.fallbackHidden, JSON.stringify(init.fallbackHidden));
check('Loading state resolves', init.loadingGone);
check('Canvas sized and no horizontal overflow', !!init.canvas && init.canvas[0] > 0 && init.overflow === 0, `${init.canvas} overflow=${init.overflow}`);

const v0 = await visual();
check('Render loop is drawing the world', v0.drawCalls > 50 && v0.triangles > 10000, `${v0.drawCalls} calls / ${v0.triangles} tris`);
await shot('01-default.png');

// Island bounding box projected onto the viewport, including the rocky underside.
// Project real vertices, not AABB corners (which include empty space where the
// tapered cliff is not) so the framing assertion reflects what is drawn.
const islandBounds = () => page.evaluate(() => {
  const w = window.__pocketWorld;
  const island = w.scene.getObjectByName('island');
  let minX = 9, maxX = -9, minY = 9, maxY = -9;
  island.traverse((o) => {
    if (!o.isMesh) return;
    const attr = o.geometry.getAttribute('position');
    const step = Math.max(1, Math.floor(attr.count / 600));
    for (let i = 0; i < attr.count; i += step) {
      const p = w.camera.position.clone()
        .set(attr.getX(i), attr.getY(i), attr.getZ(i))
        .applyMatrix4(o.matrixWorld)
        .project(w.camera);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  });
  return { minX, maxX, minY, maxY };
});
const b0 = await islandBounds();
check('Whole island framed, underside included',
  b0.minX > -1 && b0.maxX < 1 && b0.minY > -1 && b0.maxY < 1,
  `NDC x[${b0.minX.toFixed(2)},${b0.maxX.toFixed(2)}] y[${b0.minY.toFixed(2)},${b0.maxY.toFixed(2)}]`);
check('Island fills the composition', (b0.maxX - b0.minX) > 0.7 && (b0.maxY - b0.minY) > 0.8,
  `width=${(b0.maxX - b0.minX).toFixed(2)} height=${(b0.maxY - b0.minY).toFixed(2)} NDC`);

// ------------------------------------------------------------ time of day ----
const noon = await (async () => { await set({ time: 12, weather: 'clear', wind: 30, houseLights: false }); await sleep(250); return visual(); })();
await set({ time: 18 }); await sleep(250);
const dusk = await visual();
await shot('02-golden-hour.png');
await set({ time: 22 }); await sleep(250);
const night = await visual();
await set({ time: 6 }); await sleep(250);
const dawn = await visual();
check('Time slider drives sky, sun and ambient', noon.skyTop !== night.skyTop && noon.sunPower > night.sunPower * 3,
  `noon ${noon.skyTop}/${noon.sunPower.toFixed(2)} vs night ${night.skyTop}/${night.sunPower.toFixed(2)}`);
check('Sunset and sunrise give warm low sun', dusk.golden > 0.4 && dawn.golden > 0.4 && dusk.sunUp < 0.35,
  `dusk golden=${dusk.golden.toFixed(2)} dawn=${dawn.golden.toFixed(2)}`);
check('Night is atmospheric but readable', night.night > 0.9 && night.skyTop !== noon.skyTop,
  `night=${night.night.toFixed(2)}`);
const domTime = await page.evaluate(() => ({ value: document.getElementById('time-value').value, note: document.getElementById('time-note').textContent }));
check('Time label and period stay in sync', domTime.value === '06:00' && domTime.note.length > 3, JSON.stringify(domTime));

// A real UI change must ease, not jump. Compare target against the smoothed
// value directly: the render loop in software WebGL is slow, so wall-clock
// sampling of an eased value would measure frame rate instead of behaviour.
await page.evaluate(() => {
  const t = document.getElementById('time');
  t.value = '22';
  t.dispatchEvent(new Event('input', { bubbles: true }));
});
const easing = await page.evaluate(() => ({
  target: window.__pocketWorld.state.time,
  smooth: window.__pocketWorld.smooth.time,
}));
await sleep(1600);
const progressing = await visual();
await settle();
const done = await visual();
check('Time change is eased, not a step',
  easing.target === 22 && Math.abs(easing.smooth - 22) > 0.01 && progressing.time !== easing.smooth && Math.abs(done.time - 22) < 0.01,
  `target=${easing.target}, immediately=${easing.smooth.toFixed(2)}h, mid=${progressing.time.toFixed(2)}h, settled=${done.time.toFixed(2)}h`);

// ---------------------------------------------------------------- weather ----
await set({ time: 16, weather: 'clear', wind: 30, houseLights: false });
await sleep(700);
const dry = await visual();
await set({ weather: 'rain' });
await sleep(900);
const wet = await visual();
check('Rain appears in the 3D scene', wet.rainVisible && wet.rainStreaks > 200 && dry.rainStreaks === 0,
  `${wet.rainStreaks}/${wet.rainCount} streaks`);
check('Rain darkens clouds and sky', wet.cloudColor !== dry.cloudColor && wet.skyTop !== dry.skyTop,
  `${dry.cloudColor} -> ${wet.cloudColor}`);
check('Rain makes pond ripples', wet.ripples > 0, `${wet.ripples} active rings`);
for (let i = 0; i < 3; i++) {
  await set({ weather: i % 2 === 0 ? 'clear' : 'rain' });
  await sleep(220);
}
await set({ weather: 'clear' });
await sleep(700);
const dryAgain = await visual();
check('Repeated weather toggles leave no stale particles',
  dryAgain.rainCount === v0.rainCount && dryAgain.rainStreaks === 0 && dryAgain.rainVisible === false,
  `count=${dryAgain.rainCount} streaks=${dryAgain.rainStreaks}`);

// ------------------------------------------------------------------- wind ----
await set({ weather: 'clear', wind: 0, time: 16 });
await sleep(650);
const stillA = await visual();
const cloudA = await page.evaluate(() => window.__pocketWorld.scene.getObjectByName('clouds').children[0].position.x);
await sleep(650);
const stillB = await visual();
const cloudB = await page.evaluate(() => window.__pocketWorld.scene.getObjectByName('clouds').children[0].position.x);
check('Zero wind stops windmill and clouds',
  Math.abs(stillB.windmillAngle - stillA.windmillAngle) < 0.02 && Math.abs(cloudB - cloudA) < 0.02,
  `sail delta=${(stillB.windmillAngle - stillA.windmillAngle).toFixed(4)}, cloud delta=${(cloudB - cloudA).toFixed(4)}`);
await set({ wind: 100 });
await sleep(1700);
const gust = await visual();
const cloudC = await page.evaluate(() => window.__pocketWorld.scene.getObjectByName('clouds').children[0].position.x);
check('Strong wind spins sails and moves clouds',
  gust.windmillAngle - stillB.windmillAngle > 0.45 && cloudC - cloudB > 0.35,
  `sail delta=${(gust.windmillAngle - stillB.windmillAngle).toFixed(2)}, cloud delta=${(cloudC - cloudB).toFixed(2)}`);
await set({ weather: 'rain', wind: 100 });
await sleep(400);
const slant = await page.evaluate(() => {
  const g = window.__pocketWorld.rain.points.geometry.getAttribute('position');
  return Math.abs(g.getX(0) - g.getX(1));
});
check('Wind slants the rain', slant > 0.15, `streak x-offset=${slant.toFixed(3)}`);

// ------------------------------------------------------------ house lights ----
await set({ weather: 'clear', wind: 30, time: 16, houseLights: false });
await sleep(400);
const houseScreenPoint = () => page.evaluate(() => {
  const w = window.__pocketWorld;
  const p = w.house.group.position.clone();
  p.y += 1.45;
  p.project(w.camera);
  const r = document.querySelector('#app canvas').getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((-p.y + 1) / 2) * r.height };
});
let housePoint = await houseScreenPoint();
check('Cottage projects inside the canvas', housePoint.x > 0 && housePoint.x < 1280 && housePoint.y > 0 && housePoint.y < 800,
  `(${Math.round(housePoint.x)}, ${Math.round(housePoint.y)})`);

// A drag that starts on the cottage must orbit, not toggle.
let before = await page.evaluate(() => window.__pocketWorld.state.houseLights);
await page.mouse.move(housePoint.x - 55, housePoint.y);
await page.mouse.down();
for (let i = 1; i <= 9; i++) { await page.mouse.move(housePoint.x - 55 + i * 13, housePoint.y + i * 2); await sleep(14); }
await page.mouse.up();
await sleep(200);
const afterDrag = await page.evaluate(() => window.__pocketWorld.state.houseLights);
check('Orbit drag across the cottage does not toggle lights', before === afterDrag, `${before} -> ${afterDrag}`);

// The drag orbited the camera, so re-project the cottage before tapping it.
housePoint = await houseScreenPoint();
await page.mouse.click(housePoint.x, housePoint.y);
await sleep(450);
const afterTap = await page.evaluate(() => window.__pocketWorld.state.houseLights);
const uiAfterTap = await page.evaluate(() => document.getElementById('lights').getAttribute('aria-checked'));
check('Tapping the cottage toggles lights and syncs the switch', afterTap === true && uiAfterTap === 'true',
  `lights=${afterTap}, switch=${uiAfterTap}`);

await page.click('#lights');
await settle();
await sleep(150);
const afterSwitch = await page.evaluate(() => window.__pocketWorld.state.houseLights);
const glow = (await visual()).lights;
check('UI switch toggles the same state', afterSwitch === false && glow < 0.01, `lights=${afterSwitch}, glow=${glow.toFixed(2)}`);

// -------------------------------------------------------------- keyboard -----
await page.focus('#time');
const tBefore = await page.evaluate(() => Number(document.getElementById('time').value));
await page.keyboard.press('ArrowRight');
await sleep(120);
const tAfter = await page.evaluate(() => Number(document.getElementById('time').value));
check('Time slider is keyboard operable', tAfter > tBefore, `${tBefore} -> ${tAfter}`);
await page.focus('#lights');
await page.keyboard.press('Space');
await sleep(350);
const kLights = await page.evaluate(() => document.getElementById('lights').getAttribute('aria-checked'));
check('House-light switch is keyboard operable', kLights === 'true', `aria-checked=${kLights}`);
await page.focus('#wind');
await page.keyboard.press('Tab');
await sleep(100);
const focusRing = await page.evaluate(() => {
  const el = document.activeElement;
  const s = getComputedStyle(el);
  return { id: el.id, outline: s.outlineStyle, width: s.outlineWidth };
});
check('Keyboard focus keeps a visible focus ring', focusRing.outline !== 'none' && focusRing.width !== '0px', JSON.stringify(focusRing));

// --------------------------------------------------------- rapid changes ----
for (let i = 0; i < 20; i++) {
  await page.evaluate((k) => {
    const w = window.__pocketWorld;
    w.set({ time: (k * 3.7) % 24, weather: k % 2 ? 'rain' : 'clear', wind: (k * 17) % 101, houseLights: !!(k % 3) });
  }, i);
  await sleep(35);
}
await sleep(400);
const rapid = await visual();
check('Rapid changes keep the scene alive and consistent',
  Number.isFinite(rapid.time) && Number.isFinite(rapid.sunPower) && rapid.drawCalls > 50 && rapid.rainCount === v0.rainCount,
  `time=${rapid.time.toFixed(2)} calls=${rapid.drawCalls}`);

// ------------------------------------------------------------------ reset ----
const home = v0.cameraPosition;
await set({ time: 22, weather: 'rain', wind: 80, houseLights: true });
await page.mouse.move(900, 400);
await page.mouse.down();
await page.mouse.move(980, 430, { steps: 6 });
await page.mouse.up();
await sleep(300);
const moved = await visual();
await page.click('#reset');
await sleep(2600);
await settle();
const reset = await visual();
const domReset = await page.evaluate(() => ({
  time: document.getElementById('time').value,
  wind: document.getElementById('wind').value,
  lights: document.getElementById('lights').getAttribute('aria-checked'),
  clear: document.getElementById('weather-clear').getAttribute('aria-pressed'),
}));
const camError = Math.hypot(...reset.cameraPosition.map((v, i) => v - home[i]));
check('Reset restores the world state',
  Math.abs(reset.time - 16) < 0.05 && reset.weather === 'clear' && Math.abs(reset.wind - 0.3) < 0.02 && reset.lights < 0.02,
  JSON.stringify({ time: reset.time.toFixed(2), weather: reset.weather, wind: reset.wind.toFixed(2), lights: reset.lights.toFixed(2) }));
check('Reset restores every control', domReset.time === '16' && domReset.wind === '30' && domReset.lights === 'false' && domReset.clear === 'true', JSON.stringify(domReset));
check('Reset returns the camera home', camError < 0.25 && Math.abs(reset.cameraDistance - v0.cameraDistance) < 0.25,
  `moved=${moved.cameraDistance.toFixed(2)} -> home error=${camError.toFixed(3)}`);
await shot('06-after-reset.png');

// Final showcase frame: rainy night, lights on.
await set({ time: 22, weather: 'rain', wind: 65, houseLights: true });
await sleep(1200);
await shot('03-rainy-night-lights.png');

// ----------------------------------------------------------------- mobile ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await sleep(1500);
const mob = await page.evaluate(() => ({
  collapsed: window.__pocketWorld.visual().panelCollapsed,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  rainCount: window.__pocketWorld.visual().rainCount,
}));
const bm = await islandBounds();
check('Mobile: no horizontal overflow, panel collapsed', mob.overflow === 0 && mob.collapsed, JSON.stringify(mob));
check('Mobile: island still fully framed', bm.minX > -1 && bm.maxX < 1 && bm.minY > -1 && bm.maxY < 1,
  `NDC x[${bm.minX.toFixed(2)},${bm.maxX.toFixed(2)}] y[${bm.minY.toFixed(2)},${bm.maxY.toFixed(2)}]`);
await shot('04-mobile.png');
await page.click('#collapse');
await sleep(300);
const expanded = await page.evaluate(() => ({
  collapsed: window.__pocketWorld.visual().panelCollapsed,
  bodyVisible: getComputedStyle(document.getElementById('panel-body')).display !== 'none',
}));
check('Mobile panel opens and closes', expanded.collapsed === false && expanded.bodyVisible, JSON.stringify(expanded));
await shot('05-mobile-panel.png');
await page.click('#collapse');

await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await sleep(1400);
const bl = await islandBounds();
const landOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('Short landscape keeps island framed and card clear', bl.minY > -1 && bl.maxY < 1 && landOverflow === 0,
  `NDC y[${bl.minY.toFixed(2)},${bl.maxY.toFixed(2)}]`);
await shot('07-short-landscape.png');

// --------------------------------------------------------- reduced motion ----
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto(URL, { waitUntil: 'networkidle0' });
await sleep(1200);
const rm = await visual();
check('Reduced motion still renders a live scene', rm.reducedMotion === true && rm.drawCalls > 50,
  `reducedMotion=${rm.reducedMotion}, calls=${rm.drawCalls}`);
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

// ----------------------------------------------------------- WebGL off ------
const noGl = await browser.newPage();
await noGl.evaluateOnNewDocument(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (String(type).includes('webgl')) return null;
    return original.call(this, type, ...rest);
  };
});
await noGl.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
await noGl.goto(URL, { waitUntil: 'networkidle0' });
await sleep(400);
const fb = await noGl.evaluate(() => ({
  visible: !document.getElementById('fallback').hidden,
  text: document.getElementById('fallback-reason').textContent.trim(),
}));
check('Missing WebGL shows a readable message, not a blank page', fb.visible && fb.text.length > 30, fb.text.slice(0, 60));
await noGl.close();

check('No console errors, warnings or failed requests during the run', errors.length === 0, errors.slice(0, 4).join(' | '));

await browser.close();
server.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log('FAILURES:\n' + results.filter((r) => !r.pass).map((r) => ` - ${r.name}: ${r.detail}`).join('\n'));
  process.exitCode = 1;
}
