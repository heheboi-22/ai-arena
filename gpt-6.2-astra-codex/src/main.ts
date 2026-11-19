import './style.css'
import { defaults, type WorldState } from './state'
import { buildUI } from './ui'
import { startWorld } from './world/scene'

const state: WorldState = { ...defaults }
let world: ReturnType<typeof startWorld> | undefined
function change(patch: Partial<WorldState>) {
  Object.assign(state, patch)
  ui.sync()
}
const ui = buildUI(state, change, () => {
  change(defaults)
  world?.reset()
})
function unavailable() {
  ui.viewport.innerHTML =
    '<div class="fallback"><strong>The island needs WebGL 2.</strong><br>Enable hardware acceleration or open Pocket World in a WebGL-enabled browser.</div>'
  document.querySelector('.live')!.textContent = 'Scene unavailable'
}
try {
  world = startWorld(ui.viewport, ui.needle, state, () => change({ lights: !state.lights }))
  ui.viewport.querySelector('canvas')!.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    unavailable()
  })
} catch (error) {
  console.error('Pocket World could not initialize.', error)
  unavailable()
}
