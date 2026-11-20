import { PerspectiveCamera, Raycaster, Vector2 } from 'three'
import type { Object3D } from 'three'
import type { Store } from '../state'

interface Gesture {
  id: number
  x: number
  y: number
  time: number
  dragged: boolean
}

export function createPicker(canvas: HTMLCanvasElement, camera: PerspectiveCamera, house: Object3D, store: Store): void {
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let gesture: Gesture | null = null
  let lastHover = 0

  const hitsHouse = (clientX: number, clientY: number): boolean => {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObject(house, true).length > 0
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), dragged: false }
    canvas.style.cursor = 'grabbing'
  })

  canvas.addEventListener('pointermove', (event) => {
    if (gesture && gesture.id === event.pointerId) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.dragged = true
      return
    }
    if (event.pointerType !== 'mouse') return
    const now = performance.now()
    if (now - lastHover < 90) return
    lastHover = now
    canvas.style.cursor = hitsHouse(event.clientX, event.clientY) ? 'pointer' : 'grab'
  })

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!gesture || gesture.id !== event.pointerId) return
    const click = !cancelled && !gesture.dragged && performance.now() - gesture.time < 650
    gesture = null
    canvas.style.cursor = 'grab'
    if (click && hitsHouse(event.clientX, event.clientY)) store.toggleLights()
  }

  canvas.addEventListener('pointerup', (event) => finish(event, false))
  canvas.addEventListener('pointercancel', (event) => finish(event, true))
  canvas.style.cursor = 'grab'
}
