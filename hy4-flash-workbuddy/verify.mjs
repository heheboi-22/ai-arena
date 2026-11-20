import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = new URL('./dist/', import.meta.url).pathname
const SHOTS = new URL('./shots/', import.meta.url).pathname
const PORT = 4179
const CHROME = process.env.CHROME_PATH || '/home/programmer/.agent-browser/browsers/chrome-157.0.8103.38/chrome'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

await mkdir(SHOTS, { recursive: true })
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent((req.url || '/').split('?')[0])
    const file = join(ROOT, normalize(path === '/' ? 'index.html' : path).replace(/^(\.\.[/\\])+/, ''))
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve))

let browser
try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
    ],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  const consoleErrors = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => !!window.__pocketWorld, { timeout: 20000 })
  await wait(1800)

  const diagnostics = () => page.evaluate(() => window.__pocketWorld.diagnostics())
  const set = (fn, value) => page.evaluate((f, v) => window.__pocketWorld[f](v), fn, value)

  const initial = await diagnostics()
  check('WebGL app initialized', Array.isArray(initial.camera) && initial.drawCalls > 0, `${initial.drawCalls} draw calls, ${initial.triangles} triangles`)
  check('Default state is 16:00 / clear / 30% / lights off',
    initial.state.time === 16 && initial.state.weather === 'clear' && initial.state.wind === 0.3 && initial.state.lights === false)
  check('Panel visible on desktop', await page.evaluate(() => !document.getElementById('panel').classList.contains('collapsed')))
  await page.screenshot({ path: join(SHOTS, '01-default.png') })

  await set('setTime', 7)
  await wait(2200)
  const morning = await diagnostics()
  check('Morning eases to target time', Math.abs(morning.smoothed.time - 7) < 0.4, `smoothed ${morning.smoothed.time.toFixed(2)}`)
  await page.screenshot({ path: join(SHOTS, '02-morning.png') })

  await set('setTime', 18.5)
  await wait(1800)
  await page.screenshot({ path: join(SHOTS, '03-golden-hour.png') })
  await set('setTime', 22)
  await set('setWeather', 'rain')
  await set('setWind', 0.85)
  await set('setLights', true)
  await wait(3200)
  const storm = await diagnostics()
  check('Rain eases in and wind follows state', storm.smoothed.rain > 0.9 && Math.abs(storm.smoothed.wind - 0.85) < 0.06,
    `rain ${storm.smoothed.rain.toFixed(2)}, wind ${storm.smoothed.wind.toFixed(2)}`)
  check('House lights eased on', storm.smoothed.lights > 0.9)
  await page.screenshot({ path: join(SHOTS, '04-rainy-night-lights.png') })

  // Toggle rain off/on repeatedly: no stale objects or state.
  for (let i = 0; i < 4; i++) {
    await set('setWeather', i % 2 === 0 ? 'clear' : 'rain')
    await wait(220)
  }
  await set('setWeather', 'clear')
  await set('setTime', 14)
  await set('setWind', 0.3)
  await set('setLights', false)
  await wait(2500)
  const cleared = await diagnostics()
  check('Rain clears fully without stale effects', cleared.smoothed.rain < 0.02 && cleared.state.weather === 'clear', `rain ${cleared.smoothed.rain.toFixed(3)}`)

  // House picking: direct click toggles; dragging across the house must not.
  const house = cleared.houseScreen
  await page.mouse.click(house.x, house.y)
  await wait(300)
  const afterClick = await diagnostics()
  check('Clicking the cottage toggles lights', afterClick.state.lights === true, `house at ${house.x},${house.y}`)
  await page.mouse.move(house.x, house.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(house.x + i * 9, house.y + i * 2)
  await page.mouse.up()
  await wait(300)
  const afterDrag = await diagnostics()
  check('Dragging across the cottage does not toggle lights', afterDrag.state.lights === true)

  await page.click('#lights-toggle')
  await wait(150)
  const afterUiToggle = await diagnostics()
  check('UI switch stays synchronized with 3D click', afterUiToggle.state.lights === false)

  // Reset restores world and interface.
  await set('setTime', 3)
  await set('setWeather', 'rain')
  await set('setWind', 0.95)
  await set('setLights', true)
  await wait(400)
  await page.click('#reset-button')
  await wait(1800)
  const afterReset = await diagnostics()
  check('Reset restores all four controls',
    afterReset.state.time === 16 && afterReset.state.weather === 'clear' && afterReset.state.wind === 0.3 && afterReset.state.lights === false)
  check('Reset restores camera framing', Math.abs(afterReset.camera[0] - initial.camera[0]) < 0.4 && Math.abs(afterReset.camera[1] - initial.camera[1]) < 0.4,
    `${afterReset.camera.join(',')}`)
  const uiValues = await page.evaluate(() => ({
    time: document.getElementById('time-slider').value,
    wind: document.getElementById('wind-slider').value,
    clear: document.getElementById('weather-clear').getAttribute('aria-pressed'),
    lights: document.getElementById('lights-toggle').getAttribute('aria-checked'),
  }))
  check('Reset updates interface controls', uiValues.time === '16' && uiValues.wind === '30' && uiValues.clear === 'true' && uiValues.lights === 'false')
  await page.screenshot({ path: join(SHOTS, '05-after-reset.png') })

  // Rapid input stress.
  for (let i = 0; i < 20; i++) {
    await page.evaluate((t) => {
      window.__pocketWorld.setTime((t * 1.3) % 24)
      window.__pocketWorld.setWind((t % 7) / 6)
      window.__pocketWorld.setWeather(t % 2 ? 'rain' : 'clear')
      window.__pocketWorld.setLights(t % 3 === 0)
    }, i)
  }
  await wait(600)
  check('Rapid changes leave a valid state', await page.evaluate(() => {
    const s = window.__pocketWorld.store.state
    return s.time >= 0 && s.time <= 24 && s.wind >= 0 && s.wind <= 1
  }))

  // Mobile layout.
  await page.evaluate(() => window.__pocketWorld.reset())
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await wait(900)
  const mobileCollapsed = await page.evaluate(() => document.getElementById('panel').classList.contains('collapsed'))
  check('Mobile panel starts collapsed', mobileCollapsed)
  await page.screenshot({ path: join(SHOTS, '06-mobile.png') })
  await page.click('#panel-toggle')
  await wait(350)
  await page.screenshot({ path: join(SHOTS, '07-mobile-panel.png') })
  check('Mobile panel expands on tap', await page.evaluate(() => !document.getElementById('panel').classList.contains('collapsed')))

  await page.setViewport({ width: 900, height: 480, deviceScaleFactor: 1 })
  await wait(600)
  await page.screenshot({ path: join(SHOTS, '08-short-landscape.png') })
  const resized = await diagnostics()
  check('Resize keeps the island in frame', resized.drawCalls > 0 && resized.camera.every(Number.isFinite))

  check('No browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`)
  if (results.some((r) => !r.pass)) process.exitCode = 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.close()
}
