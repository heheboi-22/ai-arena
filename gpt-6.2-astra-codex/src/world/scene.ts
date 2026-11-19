import * as T from 'three'
import type { WorldState } from '../state'
import { buildTerrain } from './terrain'
import { buildHouse, buildMill } from './buildings'
import { buildGarden } from './garden'
import { makeAtmosphere } from './atmosphere'
import { setupInteraction } from './interaction'

export function startWorld(
  viewport: HTMLElement,
  needle: HTMLElement,
  state: WorldState,
  onHouse: () => void,
) {
  const compact = window.matchMedia('(max-width:760px)').matches
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.5 : 1.75))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  viewport.appendChild(renderer.domElement)
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-8, 8, 5, -5, 0.1, 85)
  const { land, water, route } = buildTerrain()
  const { house, glass, glow } = buildHouse(),
    { mill, rotor } = buildMill()
  const { trees, garden } = buildGarden(route)
  land.name = 'Island'
  house.name = 'Cottage'
  mill.name = 'Windmill'
  rotor.name = 'Sails'
  garden.name = 'Meadow'
  trees.forEach((tree, i) => {
    tree.name = 'Tree ' + (i + 1)
  })
  for (const obj of [land, house, mill, garden, ...trees]) {
    obj.userData.pickSurface = true
    scene.add(obj)
  }
  const atmosphere = makeAtmosphere(scene, compact)
  const interaction = setupInteraction(
    camera,
    viewport,
    renderer.domElement,
    house,
    scene,
    needle,
    onHouse,
  )
  const origins = trees.map((t) => t.rotation.y)
  let hour = state.time,
    wet = 0,
    wind = state.wind,
    light = 0,
    phase = 0
  function resize() {
    const w = viewport.clientWidth,
      h = viewport.clientHeight
    if (!w || !h) return
    const aspect = w / h,
      isSmall = window.innerWidth <= 760
    const viewHeight = Math.max(8.7, (isSmall ? 13.35 : 14.0) / aspect)
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.left = (-viewHeight * aspect) / 2
    camera.right = (viewHeight * aspect) / 2
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall ? 1.5 : 1.75))
    renderer.setSize(w, h, false)
  }
  new ResizeObserver(resize).observe(viewport)
  resize()
  const onColor = new T.Color('#ffe4a4'),
    offColor = new T.Color('#81998b'),
    tint = new T.Color(),
    pondNight = new T.Color('#4f7c88')
  let last = performance.now()
  renderer.setAnimationLoop((now: number) => {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.055))
    last = now
    const ease = 1 - Math.exp(-dt * 5.4)
    const distance = T.MathUtils.euclideanModulo(state.time - hour + 12, 24) - 12
    hour = T.MathUtils.euclideanModulo(hour + distance * ease, 24)
    wet += ((state.weather === 'rain' ? 1 : 0) - wet) * ease
    wind += (state.wind - wind) * ease
    if (Math.abs(state.wind - wind) < 0.0002) wind = state.wind
    const { day, lightTarget } = atmosphere.update(dt, hour, wet, wind, motion.matches, state)
    light += (lightTarget - light) * ease
    glass.color.copy(offColor).lerp(onColor, light)
    glass.emissiveIntensity = light * (0.95 + (1 - day) * 1.68)
    glow.intensity = light * (0.24 + (1 - day) * 2.85)
    water.color
      .set('#70b4b0')
      .lerp(pondNight, 1 - day)
      .lerp(tint.set('#749b9c'), wet * 0.28)
    const movement = motion.matches ? 0.23 : 1
    rotor.rotation.z -= dt * wind * 2.2 * movement
    phase += dt * wind * 2.3 * movement
    trees.forEach((tree, i) => {
      tree.rotation.z =
        wind *
        (0.018 * Math.sin(phase * 1.7 + i * 1.82) + 0.014 * Math.sin(phase * 0.81 + i * 0.41)) *
        movement
      tree.rotation.x = wind * 0.011 * Math.sin(phase * 1.2 + origins[i]) * movement
    })
    interaction.update()
    renderer.render(scene, camera)
  })
  return { reset: interaction.reset }
}
