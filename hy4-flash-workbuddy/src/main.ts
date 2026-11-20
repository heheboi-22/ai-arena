import {
  ACESFilmicToneMapping,
  Clock,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createRain } from './environment/weather'
import { createLighting } from './environment/lighting'
import { createSky } from './environment/sky'
import { createPicker } from './interaction/picker'
import { createUI } from './ui/panel'
import { createClouds } from './world/clouds'
import { createHouse } from './world/house'
import { createIsland } from './world/island'
import { createMaterials } from './world/materials'
import { createPond } from './world/pond'
import { createProps } from './world/props'
import { createVegetation } from './world/vegetation'
import { createWindmill } from './world/windmill'
import { sampleEnvironment } from './world/palette'
import { createSmoothed, DEFAULTS, Store, stepSmoothed, type Weather } from './state'
import { clamp } from './util/math'
import { mergeStatic } from './util/merge'
import './style.css'

interface DebugHandle {
  store: Store
  setTime: (value: number) => void
  setWeather: (value: Weather) => void
  setWind: (value: number) => void
  setLights: (value: boolean) => void
  reset: () => void
  diagnostics: () => Record<string, unknown>
}

declare global {
  interface Window {
    __pocketWorld?: DebugHandle
  }
}

const loading = document.getElementById('loading')
const fallback = document.getElementById('fallback')
const container = document.getElementById('scene')

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function showFallback(): void {
  loading?.classList.add('hidden')
  if (fallback) fallback.hidden = false
}

function boot(): void {
  if (!container || !hasWebGL()) {
    showFallback()
    return
  }

  const lowPower = window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = reducedMotionQuery.matches
  reducedMotionQuery.addEventListener('change', (event) => { reducedMotion = event.matches })

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.98
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  const camera = new PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400)
  const target = new Vector3(-1.55, -0.5, 0)
  const initialDirection = new Vector3(13.5, 7.35, 16.5).normalize()
  let baseDistance = 22.8
  const applyFraming = () => {
    const aspect = window.innerWidth / window.innerHeight
    camera.aspect = aspect
    camera.fov = aspect < 0.8 ? 68 : aspect < 1.1 ? 56 : 38
    baseDistance = aspect < 0.8 ? 34 : aspect < 1 ? 28 : 22.8
    camera.updateProjectionMatrix()
    if (!userMovedCamera) {
      camera.position.copy(target).addScaledVector(initialDirection, baseDistance)
      controls.target.copy(target)
    }
  }

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.065
  controls.enablePan = false
  controls.minDistance = 12
  controls.maxDistance = 48
  controls.minPolarAngle = 0.45
  controls.maxPolarAngle = 1.62
  controls.rotateSpeed = 0.72
  controls.zoomSpeed = 0.85
  controls.target.copy(target)
  camera.position.copy(target).addScaledVector(initialDirection, baseDistance)
  controls.update()

  let userMovedCamera = false
  controls.addEventListener('start', () => { userMovedCamera = true; cancelCameraTween() })

  // Reset camera is tweened; user interaction interrupts it immediately.
  let cameraTween: { startPosition: Vector3; startTarget: Vector3; elapsed: number } | null = null
  function cancelCameraTween(): void {
    if (!cameraTween) return
    cameraTween = null
    controls.enabled = true
  }
  function resetCamera(): void {
    cancelCameraTween()
    // Flush any leftover damping from an earlier drag before capturing the start.
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = true
    cameraTween = {
      startPosition: camera.position.clone(),
      startTarget: controls.target.clone(),
      elapsed: 0,
    }
    controls.enabled = false
  }

  const store = new Store()
  const smoothed = createSmoothed(store.state)

  const materials = createMaterials()
  const island = createIsland(materials, lowPower)
  const house = createHouse(materials)
  const windmill = createWindmill(materials)
  const pond = createPond(materials, lowPower)
  const vegetation = createVegetation(materials, lowPower)
  const props = createProps(materials)
  const clouds = createClouds(lowPower)

  // Collapse static details by material; animated subtrees opt out.
  for (const part of [island.group, house.group, windmill.group, pond.group, vegetation.group, props.group]) {
    mergeStatic(part)
  }

  scene.add(island.group, house.group, windmill.group, pond.group, vegetation.group, props.group, clouds.group)

  const sky = createSky(scene, lowPower)
  const lighting = createLighting(scene, lowPower)
  const rainSystem = createRain(scene, lowPower)

  createPicker(renderer.domElement, camera, house.group, store)
  createUI(store, resetCamera)

  window.addEventListener('resize', () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75))
    renderer.setSize(window.innerWidth, window.innerHeight)
    applyFraming()
  })

  window.__pocketWorld = {
    store,
    setTime: (value) => store.set('time', clamp(value, 0, 24)),
    setWeather: (value) => store.set('weather', value),
    setWind: (value) => store.set('wind', clamp(value, 0, 1)),
    setLights: (value) => store.set('lights', value),
    reset: () => { store.reset(); resetCamera() },
    diagnostics: () => ({
      state: { ...store.state },
      smoothed: { ...smoothed },
      camera: camera.position.toArray().map((n) => Number(n.toFixed(2))),
      target: controls.target.toArray().map((n) => Number(n.toFixed(2))),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      rainDrops: rainSystem.count,
      vegetation: vegetation.stats,
      houseScreen: (() => {
        const projected = house.group.position.clone()
        projected.y += 1.4
        projected.project(camera)
        return {
          x: Math.round((projected.x * 0.5 + 0.5) * window.innerWidth),
          y: Math.round((-projected.y * 0.5 + 0.5) * window.innerHeight),
        }
      })(),
      reducedMotion,
      pixelRatio: renderer.getPixelRatio(),
    }),
  }

  const clock = new Clock()
  let elapsed = 0
  let firstFrame = true

  const animate = () => {
    requestAnimationFrame(animate)
    // Background tabs can produce huge deltas; clamp so nothing jumps. State
    // transitions use a slightly wider clamp than the physical animation so a
    // slow device still reaches the requested value promptly.
    const rawDt = clock.getDelta()
    const dt = Math.min(rawDt, 0.08)
    const stateDt = Math.min(rawDt, 0.25)
    elapsed += dt

    stepSmoothed(smoothed, store.state, stateDt)
    const env = sampleEnvironment(smoothed.time, smoothed.rain)

    sky.update(env, smoothed.rain, elapsed)
    lighting.update(env, smoothed.rain)
    renderer.toneMappingExposure = env.exposure
    materials.applyWetness(smoothed.rain)

    house.update(smoothed.lights, env.night, elapsed, smoothed.wind, reducedMotion)
    windmill.update(dt, smoothed.wind, reducedMotion)
    vegetation.update(elapsed, smoothed.wind, reducedMotion)
    clouds.update(dt, elapsed, smoothed.wind, smoothed.rain, reducedMotion, camera.position)
    pond.update(dt, elapsed, smoothed.rain, smoothed.wind, env.sunDirection, env.night, reducedMotion)
    props.update(env.night, smoothed.lights, smoothed.rain)
    rainSystem.update(dt, smoothed.rain, smoothed.wind)

    if (cameraTween) {
      cameraTween.elapsed += stateDt
      const t = clamp(cameraTween.elapsed / 0.8, 0, 1)
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      camera.position.lerpVectors(cameraTween.startPosition, target.clone().addScaledVector(initialDirection, baseDistance), eased)
      controls.target.lerpVectors(cameraTween.startTarget, target, eased)
      if (t >= 1) {
        cameraTween = null
        controls.enabled = true
        userMovedCamera = false
      }
    }

    if (!cameraTween) controls.update()
    renderer.render(scene, camera)

    if (firstFrame) {
      firstFrame = false
      loading?.classList.add('hidden')
      window.setTimeout(() => loading?.remove(), 600)
    }
  }

  applyFraming()
  animate()
}

try {
  boot()
} catch (error) {
  console.error('Pocket World failed to start', error)
  showFallback()
}
