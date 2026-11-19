import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function setupInteraction(
  camera: T.OrthographicCamera,
  viewport: HTMLElement,
  canvas: HTMLCanvasElement,
  house: T.Group,
  scene: T.Scene,
  needle: HTMLElement,
  onHouse: () => void,
) {
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.085
  controls.enablePan = false
  controls.minPolarAngle = Math.PI * 0.18
  controls.maxPolarAngle = Math.PI * 0.46
  controls.minZoom = 0.8
  controls.maxZoom = 1.85
  controls.rotateSpeed = 0.64
  controls.zoomSpeed = 0.78
  controls.touches.TWO = T.TOUCH.DOLLY_ROTATE
  controls.target.set(0, 0.47, 0)
  camera.position.set(7.0, 9.25, 16.0)
  controls.update()
  controls.saveState()
  const pickRay = new T.Raycaster(),
    ndc = new T.Vector2()
  const pointers = new Set<number>()
  let startX = 0,
    startY = 0,
    dragged = false,
    primary = -1
  const islandSolids = scene.children.filter((o) => o.userData.pickSurface)
  function hitHouse(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1)
    pickRay.setFromCamera(ndc, camera)
    const hit = pickRay.intersectObjects(islandSolids, true)[0]
    return hit?.object.parent === house
  }
  canvas.addEventListener('pointerdown', (e) => {
    pointers.add(e.pointerId)
    if (pointers.size > 1) {
      dragged = true
      return
    }
    startX = e.clientX
    startY = e.clientY
    dragged = e.button !== 0
    primary = e.pointerId
  })
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.size && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) dragged = true
    if (!pointers.size && e.pointerType === 'mouse')
      canvas.style.cursor = hitHouse(e) ? 'pointer' : 'grab'
    if (pointers.size) canvas.style.cursor = 'grabbing'
  })
  canvas.addEventListener('pointerup', (e) => {
    const click =
      pointers.has(e.pointerId) &&
      !dragged &&
      primary === e.pointerId &&
      Math.hypot(e.clientX - startX, e.clientY - startY) <= 5
    pointers.delete(e.pointerId)
    if (click && hitHouse(e)) onHouse()
    canvas.style.cursor = 'grab'
  })
  canvas.addEventListener('pointercancel', (e) => {
    dragged = true
    pointers.delete(e.pointerId)
  })
  viewport.addEventListener('keydown', (e) => {
    const angle = 0.11
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      controls.rotateLeft(e.key === 'ArrowLeft' ? angle : -angle)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
      controls.rotateUp(e.key === 'ArrowUp' ? angle : -angle)
    else if (e.key === '+' || e.key === '=' || e.key === '-') {
      camera.zoom = T.MathUtils.clamp(
        camera.zoom * (e.key === '-' ? 0.92 : 1.09),
        controls.minZoom,
        controls.maxZoom,
      )
      camera.updateProjectionMatrix()
    } else return
    e.preventDefault()
    controls.update()
  })
  function update() {
    controls.update()
    needle.style.transform = 'rotate(' + (controls.getAzimuthalAngle() * 180) / Math.PI + 'deg)'
  }
  return {
    update,
    reset() {
      controls.enableDamping = false
      controls.update()
      controls.reset()
      controls.enableDamping = true
      update()
    },
  }
}
