// CDP verification for Pocket World (runs on the arena host).
//
//   node verify.mjs [baseUrl] [houseX houseY]
//
// Uses puppeteer-core from the sibling hy3-workbuddy install (this repo keeps
// one Puppeteer download, in ~/.cache/puppeteer) and drives the real page:
// default view, rainy night with lights, sunset, reset, house click, mobile.
// Writes screenshots/*.png and prints a JSON report. Exits 1 on any failure.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require2 = createRequire(new URL('../hy3-workbuddy/verify.mjs', import.meta.url));
let puppeteer;
try {
  puppeteer = require2('puppeteer-core');
} catch {
  puppeteer = (await import('puppeteer-core')).default;
}

function chromePath() {
  const base = join(homedir(), '.cache', 'puppeteer', 'chrome');
  const versions = readdirSync(base).sort().reverse();
  for (const v of versions) {
    const p = join(base, v, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('no puppeteer chrome found in ' + base);
}

const baseUrl = process.argv[2] || 'http://127.0.0.1:5137/';
const houseX = Number(process.argv[3] || 0);
const houseY = Number(process.argv[4] || 0);

mkdirSync(new URL('./screenshots', import.meta.url), { recursive: true });
const shot = (name) => new URL(`./screenshots/${name}`, import.meta.url).pathname;

const report = { url: baseUrl, errors: [], checks: {} };
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--window-size=1440,900',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  page.on('pageerror', (e) => report.errors.push(String(e)));

  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: shot('desktop-default.png') });
  report.checks.defaultRendered = await page.evaluate(() => {
    const c = document.getElementById('scene');
    return !!c && getComputedStyle(c).display !== 'none';
  });

  // Rainy night, lights on, strong wind.
  await page.evaluate(() => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('time', 23);
    set('wind', 90);
  });
  await page.click('#w-rain');
  await page.click('#lights');
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: shot('rain-night-lights.png') });
  report.checks.lightsStateOn = await page.evaluate(
    () => document.getElementById('lights-state')?.textContent === 'On',
  );
  report.checks.timeLabelNight = await page.evaluate(() =>
    (document.getElementById('time-label')?.textContent || '').includes('23:00'),
  );

  // Sunset, clear again.
  await page.click('#w-clear');
  await page.evaluate(() => {
    const el = document.getElementById('time');
    el.value = '18.6';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: shot('sunset.png') });

  // Reset restores defaults.
  await page.click('#reset');
  await new Promise((r) => setTimeout(r, 1500));
  report.checks.resetOk = await page.evaluate(() => {
    const t = document.getElementById('time-label')?.textContent || '';
    const w = document.getElementById('wind-label')?.textContent || '';
    const l = document.getElementById('lights-state')?.textContent || '';
    return t.includes('16:00') && w.includes('30%') && l === 'Off';
  });

  // House click toggles lights (coordinates from the default screenshot).
  if (houseX > 0 && houseY > 0) {
    await page.mouse.click(houseX, houseY);
    await new Promise((r) => setTimeout(r, 600));
    report.checks.houseClickToggles = await page.evaluate(
      () => document.getElementById('lights-state')?.textContent === 'On',
    );
    // A drag across the house must NOT toggle.
    await page.mouse.move(houseX, houseY);
    await page.mouse.down();
    await page.mouse.move(houseX + 260, houseY + 40, { steps: 12 });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 600));
    report.checks.dragDoesNotToggle = await page.evaluate(
      () => document.getElementById('lights-state')?.textContent === 'On',
    );
  }

  // Mobile layout.
  const mob = await browser.newPage();
  mob.on('pageerror', (e) => report.errors.push('mobile: ' + String(e)));
  await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mob.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  await mob.screenshot({ path: shot('mobile-default.png') });
  report.checks.mobileRendered = await mob.evaluate(() => {
    const c = document.getElementById('scene');
    return !!c && getComputedStyle(c).display !== 'none';
  });
} finally {
  await browser.close();
}

report.checks.noConsoleErrors = report.errors.length === 0;
console.log(JSON.stringify(report, null, 2));
const failed = Object.entries(report.checks).filter(([, v]) => v !== true);
process.exit(failed.length ? 1 : 0);
