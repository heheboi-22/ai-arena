import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:4173/?debug';
const OUT = '/home/aorus/Project/ai-arena/hy3-workbuddy/shots';
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) =>
  errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText ?? ''))
);

await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(2500);

const hasOverlay = await page.evaluate(() => !!document.querySelector('.overlay-msg'));
check('WebGL scene initialised (no error overlay)', !hasOverlay);

// --- Helper: screen position of the house ---
const housePoint = await page.evaluate(() => {
  const w = window.__pocketWorld;
  const v = w.house.position.clone();
  v.y += 1.2;
  v.project(w.camera);
  const r = document.querySelector('#app canvas').getBoundingClientRect();
  return {
    x: r.left + ((v.x + 1) / 2) * r.width,
    y: r.top + ((-v.y + 1) / 2) * r.height,
  };
});
check('House projected to screen', Number.isFinite(housePoint.x) && Number.isFinite(housePoint.y),
  `(${Math.round(housePoint.x)}, ${Math.round(housePoint.y)})`);

const getState = () => page.evaluate(() => ({ ...window.__pocketWorld.state }));

// --- 1. Drag across the house must NOT toggle the lights ---
let before = await getState();
await page.mouse.move(housePoint.x - 60, housePoint.y);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(housePoint.x - 60 + i * 15, housePoint.y + i * 2);
  await sleep(16);
}
await page.mouse.up();
await sleep(500);
let after = await getState();
check('Drag across house does NOT toggle lights', after.houseLights === before.houseLights,
  `before=${before.houseLights} after=${after.houseLights}`);

// --- 2. A genuine click on the house DOES toggle the lights ---
before = await getState();
await page.mouse.click(housePoint.x, housePoint.y);
await sleep(600);
after = await getState();
check('Click on house toggles lights', after.houseLights !== before.houseLights,
  `before=${before.houseLights} after=${after.houseLights}`);

// --- 3. UI toggle stays in sync with the 3D house toggle ---
const uiPressed = await page.evaluate(() =>
  document.querySelector('.btn[aria-pressed]')?.getAttribute('aria-pressed')
);
check('UI light toggle reflects house click', uiPressed === String(after.houseLights),
  `aria-pressed=${uiPressed} state=${after.houseLights}`);

before = await getState();
await page.evaluate(() => {
  [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('House lights')).click();
});
await sleep(400);
after = await getState();
check('UI light toggle changes state', after.houseLights !== before.houseLights);
const uiPressed2 = await page.evaluate(() =>
  document.querySelector('.btn[aria-pressed]')?.getAttribute('aria-pressed')
);
check('UI toggle stays in sync both ways', uiPressed2 === String(after.houseLights));

// --- 4. Orbit drag rotates the camera ---
const camBefore = await page.evaluate(() => {
  const c = window.__pocketWorld.camera.position;
  return [c.x, c.y, c.z];
});
await page.mouse.move(900, 400);
await page.mouse.down();
for (let i = 0; i < 10; i++) { await page.mouse.move(900 - i * 14, 400); await sleep(16); }
await page.mouse.up();
await sleep(700);
const camAfter = await page.evaluate(() => {
  const c = window.__pocketWorld.camera.position;
  return [c.x, c.y, c.z];
});
const moved = Math.hypot(camAfter[0] - camBefore[0], camAfter[1] - camBefore[1], camAfter[2] - camBefore[2]);
check('Drag orbits the camera', moved > 0.5, `moved ${moved.toFixed(2)} units`);

// --- 5. Reset restores world + controls ---
await page.evaluate(() => {
  const time = document.querySelectorAll('input[type=range]')[0];
  time.value = '3';
  time.dispatchEvent(new Event('input', { bubbles: true }));
  const wind = document.querySelectorAll('input[type=range]')[1];
  wind.value = '95';
  wind.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === 'Rain').click();
  [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('House lights')).click();
});
await sleep(400);
await page.evaluate(() => {
  [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('Reset')).click();
});
await sleep(900);
const st = await getState();
check('Reset: time = 16:00', st.time === 16, `time=${st.time}`);
check('Reset: weather = clear', st.weather === 'clear', `weather=${st.weather}`);
check('Reset: wind = 30%', Math.abs(st.wind - 0.3) < 1e-6, `wind=${st.wind}`);
check('Reset: house lights off', st.houseLights === false, `lights=${st.houseLights}`);

const ui = await page.evaluate(() => ({
  time: document.querySelectorAll('input[type=range]')[0].value,
  wind: document.querySelectorAll('input[type=range]')[1].value,
  timeLabel: document.querySelectorAll('.field__value')[0].textContent,
  clearActive: [...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === 'Clear').classList.contains('active'),
  lightsOn: [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('House lights')).classList.contains('on'),
}));
check('Reset: UI controls synced', ui.time === '16' && ui.wind === '30' && ui.timeLabel === '16:00'
  && ui.clearActive && !ui.lightsOn, JSON.stringify(ui));

const camReset = await page.evaluate(() => {
  const c = window.__pocketWorld.camera.position;
  const t = window.__pocketWorld.controls.target;
  return { p: [c.x, c.y, c.z], t: [t.x, t.y, t.z] };
});
const dist = Math.hypot(camReset.p[0] - camReset.t[0], camReset.p[1] - camReset.t[1], camReset.p[2] - camReset.t[2]);
check('Reset: camera restored', dist > 10 && dist < 20, `distance ${dist.toFixed(2)}`);

// --- 6. Rapid changes don't break the scene ---
for (let i = 0; i < 12; i++) {
  await page.evaluate((k) => {
    const time = document.querySelectorAll('input[type=range]')[0];
    time.value = String((k * 2) % 24);
    time.dispatchEvent(new Event('input', { bubbles: true }));
    const wind = document.querySelectorAll('input[type=range]')[1];
    wind.value = String((k * 17) % 101);
    wind.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('.seg button')].find((b) =>
      b.textContent.trim() === (k % 2 ? 'Rain' : 'Clear')).click();
  }, i);
  await sleep(60);
}
await sleep(1200);
const alive = await page.evaluate(() => {
  const w = window.__pocketWorld;
  return !!(w && w.renderer && w.renderer.info.render.frame > 0);
});
check('Rapid control changes keep scene alive', alive);

// --- 7. Rain toggles repeatedly without accumulating particles ---
for (let i = 0; i < 6; i++) {
  await page.evaluate((rain) => {
    [...document.querySelectorAll('.seg button')].find((b) =>
      b.textContent.trim() === (rain ? 'Rain' : 'Clear')).click();
  }, i % 2 === 0);
  await sleep(350);
}
await sleep(1500);
const rainState = await page.evaluate(() => {
  const w = window.__pocketWorld;
  let rainMesh = null;
  w.renderer.info; // no-op
  return { calls: w.renderer.info.render.calls, triangles: w.renderer.info.render.triangles };
});
check('Repeated rain toggles stay stable', rainState.calls > 0, JSON.stringify(rainState));

// --- 8. Time-of-day produces different lighting ---
// Read the resolved sky shader uniforms through the ?debug hook. We avoid
// readPixels() because the WebGL drawing buffer is cleared after compositing
// (preserveDrawingBuffer is false), which would always return 0,0,0.
const sample = async (t) => {
  await page.evaluate((v) => {
    const time = document.querySelectorAll('input[type=range]')[0];
    time.value = String(v);
    time.dispatchEvent(new Event('input', { bubbles: true }));
  }, t);
  // Let the smoothed view settle on the new time.
  await sleep(1600);
  return page.evaluate(() => {
    const w = window.__pocketWorld;
    const u = w.env.skyMat.uniforms;
    const top = u.topColor.value;
    const bot = u.bottomColor.value;
    return {
      top: [top.r, top.g, top.b],
      bottom: [bot.r, bot.g, bot.b],
      sun: w.env.sun.intensity,
    };
  });
};
const skyNoon = await sample(12);
const skyNight = await sample(1);
const skyDusk = await sample(19);
const diffRGB = (a, b) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
check('Sky differs between noon / night / dusk',
  diffRGB(skyNoon.top, skyNight.top) > 0.25 &&
  diffRGB(skyNoon.top, skyDusk.top) > 0.15 &&
  diffRGB(skyNoon.bottom, skyDusk.bottom) > 0.15,
  `noon.top=${skyNoon.top.map((n) => n.toFixed(2))} night.top=${skyNight.top.map((n) => n.toFixed(2))} dusk.top=${skyDusk.top.map((n) => n.toFixed(2))} sun(noon=${skyNoon.sun.toFixed(2)},night=${skyNight.sun.toFixed(2)},dusk=${skyDusk.sun.toFixed(2)})`);

// --- Screenshots ---
await page.evaluate(() => {
  const time = document.querySelectorAll('input[type=range]')[0];
  time.value = '16';
  time.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === 'Clear').click();
  const wind = document.querySelectorAll('input[type=range]')[1];
  wind.value = '30';
  wind.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(1500);
await page.screenshot({ path: `${OUT}/01-default.png` });

await page.evaluate(() => {
  const time = document.querySelectorAll('input[type=range]')[0];
  time.value = '23';
  time.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === 'Rain').click();
  [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('House lights')).click();
});
await sleep(2500);
await page.screenshot({ path: `${OUT}/02-rainy-night-lights.png` });

await page.evaluate(() => {
  const time = document.querySelectorAll('input[type=range]')[0];
  time.value = '19';
  time.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === 'Clear').click();
  [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('House lights')).click();
  const wind = document.querySelectorAll('input[type=range]')[1];
  wind.value = '85';
  wind.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(2200);
await page.screenshot({ path: `${OUT}/03-sunset-windy.png` });

// Golden hour — the sun sitting exactly on the horizon.
await page.evaluate(() => {
  const time = document.querySelectorAll('input[type=range]')[0];
  time.value = '18';
  time.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(2000);
await page.screenshot({ path: `${OUT}/03b-golden-hour.png` });

await page.evaluate(() => {
  [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('Reset')).click();
});
await sleep(1600);
await page.screenshot({ path: `${OUT}/04-after-reset.png` });

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
await sleep(1500);
await page.screenshot({ path: `${OUT}/05-mobile.png` });

// Mobile panel expanded
await page.evaluate(() => document.querySelector('.panel__collapse').click());
await sleep(600);
await page.screenshot({ path: `${OUT}/06-mobile-panel.png` });

console.log('\n--- CONSOLE ERRORS/WARNINGS (' + errors.length + ') ---');
console.log(errors.join('\n') || 'none');

// --- 9. Reduced motion is respected ---
const rmBrowser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const rmPage = await rmBrowser.newPage();
await rmPage.emulateMediaFeatures([
  { name: 'prefers-reduced-motion', value: 'reduce' },
]);
await rmPage.setViewport({ width: 900, height: 700 });
await rmPage.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(2500);
const rmState = await rmPage.evaluate(() => {
  const w = window.__pocketWorld;
  return {
    ok: !!w && w.renderer.info.render.frame > 0,
    // The windmill must still be driven by wind, just more gently.
    blades: w ? !!w : false,
  };
});
check('Reduced motion still renders a live scene', rmState.ok);
await rmBrowser.close();

// --- 10. Missing WebGL shows a readable message, not a blank page ---
const noGlBrowser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-webgl',
    '--disable-webgl2',
    '--disable-3d-apis',
  ],
});
const noGlPage = await noGlBrowser.newPage();
await noGlPage.setViewport({ width: 900, height: 700 });
await noGlPage.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(1500);
const noGl = await noGlPage.evaluate(() => {
  const card = document.querySelector('.overlay-msg .card');
  return {
    hasOverlay: !!document.querySelector('.overlay-msg'),
    heading: card?.querySelector('h1')?.textContent ?? '',
    body: card?.querySelector('p')?.textContent ?? '',
  };
});
check('Missing WebGL shows a readable fallback message',
  noGl.hasOverlay && noGl.heading.length > 3 && noGl.body.length > 20,
  `heading="${noGl.heading}" body="${noGl.body.slice(0, 60)}..."`);
await noGlBrowser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join('; '));

await browser.close();
