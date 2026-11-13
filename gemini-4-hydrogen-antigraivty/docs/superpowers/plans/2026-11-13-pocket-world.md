# Pocket World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Pocket World", a complete, polished, interactive 3D miniature floating island diorama in Three.js, Vite, and TypeScript with dynamic 24-hour time-of-day lighting, 3D weather/rain/pond ripples, shared wind physics, clickable house lights, responsive UI, and full browser verification.

**Architecture:** Modular TypeScript architecture separating pure deterministic state/math (`worldState.ts`, `palette.ts`, `terrain.ts`, `gesture.ts`), procedural 3D asset builders (`island`, `house`, `pond`, `windmill`, `trees`, `details`, `clouds`), pooled environmental effects (`sky`, `rain`, `ripples`), scene orchestration (`PocketWorldScene.ts`), and accessible responsive UI (`ControlPanel.ts`). All geometry, shaders, and micro-textures are generated procedurally in-browser with zero external runtime assets.

**Tech Stack:** Vite, TypeScript, Three.js (`three`, `@types/three`, `OrbitControls`), Vitest + jsdom (dev/test only).

**Spec:** Inline user specification in current session (`Pocket World` prompt).

## Global Constraints

- Render with Three.js using Vite and TypeScript with minimal dependencies (`three` only at runtime).
- Entirely client-side in-browser; zero backend, external APIs, external fonts, downloaded 3D models, external textures, HDRs, or remote runtime assets.
- Procedural textures via Canvas 2D and custom shaders are allowed.
- Required defaults and Reset state: Camera initial 3/4 view, Time `16:00`, Weather `Clear`, Wind strength `30%`, House lights `off`.
- OrbitControls with damping, sensible distance/polar limits, and no unrestricted panning (`enablePan = false`).
- Time-based animation with clamped frame deltas (`<= 0.1s`), interruptible transitions, pooled rain and ripple objects, `prefers-reduced-motion` support, and graceful WebGL failure fallback.
- Desktop and mobile responsive layout with accessible labels, keyboard support, and visible focus states.

## Review Focus

- **Orbit drag over house toggles lights**: Pointer gesture detector must reject any gesture exceeding `6px` max travel from `pointerdown` or multi-touch/canceled pointers so orbiting across the house never triggers lights.
- **Rain falling visibly through bottom of floating island**: Rain drop update checks whether `(x, z)` is inside the island silhouette and recycles drops on impact with `getIslandSurfaceHeight(x, z)` (or pond water level) instead of letting drops pierce out the rocky underside.
- **Tab-switch delta spikes or rapid control toggling**: Frame delta `dt` is clamped to `<= 0.1s`; weather, lighting, and camera transitions use interruptible exponential damping toward target state, and pooled rain/ripple arrays cleanly deactivate when clear.
- **Mobile viewport clipping or UI occlusion**: Camera framing scales distance smoothly when viewport aspect `< 1`, and mobile layout collapses controls into a compact expandable bottom bar.
- **Missing WebGL or extreme window resize**: Renderer creation fails safely to an accessible fallback card; resize updates renderer dimensions, pixel ratio, camera aspect, and framing without stretching.

---

## File Structure

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `README.md` — Project scaffold & scripts
- `src/state/worldState.ts` — Pure state store, defaults (`16:00`, `clear`, `30%`, `lights: false`), damped simulation state, `formatTimeOfDay`, `clampDeltaTime`
- `src/scene/palette.ts` — Continuous 24h sky/sun/moon/fog/exposure/window-glow interpolation modulated by weather
- `src/scene/terrain.ts` — Deterministic island boundary (`getIslandRadiusAtAngle`), heightfield (`getIslandSurfaceHeight`), pond depth/bounds (`isInsidePond`), layout collision check (`validatePlacements`), and island mesh builder
- `src/scene/textures.ts` — Procedural Canvas2D textures (plaster, wood, shingles, grass grain, stone)
- `src/scene/gesture.ts` — Pure click-vs-drag gesture classifier (`PointerTapTracker`) & raycast helper
- `src/scene/effects/sky.ts` — Procedural gradient sky dome shader, sun/moon glow, stars
- `src/scene/effects/rain.ts` — Pooled `InstancedMesh` 3D rain system with wind slant and island surface recycling
- `src/scene/effects/ripples.ts` — Pooled pond surface expanding ripple rings during rain
- `src/scene/assets/house.ts` — Handmade cottage (plinth, walls, timber trim, roof, chimney + smoke puffs, door, flower box, multi-pane emissive windows, warm `PointLight`)
- `src/scene/assets/pond.ts` — Pond basin water mesh, shoreline sand/pebbles, reeds, small dock
- `src/scene/assets/windmill.ts` — Tapered tower, cap, and wind-driven 4-blade rotor
- `src/scene/assets/trees.ts` — Layered pine & broadleaf trees with deterministic non-overlapping placements and wind-sway rigs
- `src/scene/assets/details.ts` — Stepping-stone path, wooden fence, boulders, flowers, grass tufts, lantern post
- `src/scene/assets/clouds.ts` — Multi-puff clouds drifting on shared wind vector and darkening in rain
- `src/scene/PocketWorldScene.ts` — Three.js renderer/camera/controls/loop/raycasting/responsive framing/disposal
- `src/ui/ControlPanel.ts` — Accessible desktop/mobile control UI synced bidirectionally with `WorldStateStore`
- `src/styles/main.css` — Full-viewport canvas + crafted translucent UI + focus/reduced-motion/mobile styles
- `src/main.ts` — App entry point with WebGL check and fallback handling
- `tests/*.test.ts` — Vitest unit & integration tests covering state, atmosphere, terrain/layout, rain pooling/collision, gesture discrimination, and UI binding

---

### Task 1: Project Scaffold, Tooling, and Verification Pipeline

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Test: `tests/setup.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm run typecheck`, `npm test`

- [ ] **Step 1: Initialize git repository and `.gitignore`**
  Run `git init` and write `.gitignore` ignoring `node_modules`, `dist`, `.superpowers`, `.vite`.
- [ ] **Step 2: Create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`**
  Dependencies: `"three": "^0.174.0"`. DevDependencies: `"@types/three"`, `"typescript"`, `"vite"`, `"vitest"`, `"jsdom"`.
  Scripts: `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"preview": "vite preview"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`.
  Ensure `index.html` uses zero external font/asset links.
- [ ] **Step 3: Install npm dependencies**
  Run `npm install` (outside sandbox only if network required).
- [ ] **Step 4: Write smoke test `tests/setup.test.ts` and run `npm test` + `npm run typecheck`**
  Expected: Vitest discovers and passes `tests/setup.test.ts`, `tsc --noEmit` exits 0.
- [ ] **Step 5: Commit scaffold**

---

### Task 2: Pure World State, Time-of-Day Store, and Damping Simulation

**Files:**
- Create: `src/state/worldState.ts`
- Test: `tests/worldState.test.ts`

**Interfaces:**
- Produces:
  - `export type WeatherMode = 'clear' | 'rain';`
  - `export interface WorldState { timeOfDay: number; weather: WeatherMode; windStrength: number; houseLights: boolean; }`
  - `export interface AnimatedWorldState { timeOfDay: number; rainFactor: number; windFactor: number; houseLightFactor: number; windDirection: { x: number; z: number }; }`
  - `export const DEFAULT_WORLD_STATE: WorldState` (`timeOfDay: 16`, `weather: 'clear'`, `windStrength: 30`, `houseLights: false`)
  - `export function formatTimeOfDay(hours: number): string`
  - `export function clampDeltaTime(rawSeconds: number): number`
  - `export function dampValue(current: number, target: number, lambda: number, dt: number): number`
  - `export class WorldStateStore` (`getState()`, `subscribe()`, `setTimeOfDay()`, `setWeather()`, `setWindStrength()`, `setHouseLights()`, `toggleHouseLights()`, `reset()`)
  - `export function stepAnimatedState(anim: AnimatedWorldState, target: WorldState, dt: number): void`

- [ ] **Step 1: Write failing tests in `tests/worldState.test.ts`**
  Assert `DEFAULT_WORLD_STATE` equals `{ timeOfDay: 16, weather: 'clear', windStrength: 30, houseLights: false }`, clamping out-of-range inputs, `formatTimeOfDay(16) === '16:00'` and `formatTimeOfDay(6.5) === '06:30'`, `clampDeltaTime(3.5) === 0.1` and `clampDeltaTime(-1) === 0`, `toggleHouseLights()`, `reset()`, and `stepAnimatedState` converges cleanly without overshoot even under rapid flips.
- [ ] **Step 2: Run `npx vitest run tests/worldState.test.ts`**
  Expected: FAIL (`Cannot find module '../src/state/worldState'`).
- [ ] **Step 3: Implement `src/state/worldState.ts`**
- [ ] **Step 4: Run `npx vitest run tests/worldState.test.ts`**
  Expected: PASS.
- [ ] **Step 5: Commit**

---

### Task 3: 24-Hour Atmosphere & Lighting Palette Interpolation

**Files:**
- Create: `src/scene/palette.ts`
- Test: `tests/palette.test.ts`

**Interfaces:**
- Consumes: `src/state/worldState.ts`
- Produces:
  - `export interface AtmosphereSample { skyTop: string; skyHorizon: string; skyBottom: string; fogColor: string; sunColor: string; sunIntensity: number; sunDirection: [number, number, number]; ambientSkyColor: string; ambientGroundColor: string; ambientIntensity: number; exposure: number; starOpacity: number; cloudColor: string; windowGlowStrength: number; houseLightMultiplier: number; }`
  - `export function evaluateAtmosphere(timeOfDay: number, rainFactor: number): AtmosphereSample`

- [ ] **Step 1: Write failing tests in `tests/palette.test.ts`**
  Assert:
  - Continuity across midnight wrap (`evaluateAtmosphere(0, 0)` matches `evaluateAtmosphere(24, 0)`).
  - Distinct luminance and sun elevation between noon (`12`), golden hour (`16`), sunset (`18.5`), and night (`0`).
  - Nighttime preserves non-zero readable ambient/exposure (`ambientIntensity >= 0.45`, `sunIntensity >= 0.35` moonlight).
  - Rain (`rainFactor = 1`) softens sunlight intensity and darkens clouds compared to clear (`rainFactor = 0`).
- [ ] **Step 2: Run `npx vitest run tests/palette.test.ts`**
  Expected: FAIL.
- [ ] **Step 3: Implement `src/scene/palette.ts`**
- [ ] **Step 4: Run `npx vitest run tests/palette.test.ts`**
  Expected: PASS.
- [ ] **Step 5: Commit**

---

### Task 4: Terrain Math, Pond Bounds, Layout Validation, and Procedural Island Mesh

**Files:**
- Create: `src/scene/terrain.ts`, `src/scene/textures.ts`
- Test: `tests/terrain.test.ts`

**Interfaces:**
- Produces:
  - `export const POND_CENTER: { x: number; z: number; rx: number; rz: number; waterY: number }`
  - `export const HOUSE_ANCHOR: { x: number; z: number; rotationY: number; radius: number }`
  - `export const WINDMILL_ANCHOR: { x: number; z: number; rotationY: number; radius: number }`
  - `export function getIslandRadiusAtAngle(theta: number): number`
  - `export function isInsideIsland(x: number, z: number, margin?: number): boolean`
  - `export function isInsidePond(x: number, z: number, margin?: number): boolean`
  - `export function getIslandSurfaceHeight(x: number, z: number): number`
  - `export function validateLandmarkClearance(items: Array<{ id: string; x: number; z: number; radius: number }>): boolean`
  - `export function createIslandMesh(textures: ProceduralTextures): THREE.Group`
  - `export function createProceduralTextures(): ProceduralTextures`

- [ ] **Step 1: Write failing tests in `tests/terrain.test.ts`**
  Assert irregular silhouette (radius varies meaningfully across angles), pond center height dips below `POND_CENTER.waterY`, house & windmill anchors sit comfortably inside island with positive elevation above water, and `validateLandmarkClearance` catches overlapping footprints and passes non-overlapping ones.
- [ ] **Step 2: Run `npx vitest run tests/terrain.test.ts`**
  Expected: FAIL.
- [ ] **Step 3: Implement `src/scene/textures.ts` and `src/scene/terrain.ts`**
  Build multi-layered floating island mesh: grassy rolling top cap with vertex color modulation + canvas micro-texture, overhanging turf rim, soil strata band, sculpted faceted rocky underside tapering to craggy spire, and 4 small floating underside rock fragments.
- [ ] **Step 4: Run `npx vitest run tests/terrain.test.ts`**
  Expected: PASS.
- [ ] **Step 5: Commit**

---

### Task 5: Gesture Discrimination, Pooled 3D Rain & Pond Ripples

**Files:**
- Create: `src/scene/gesture.ts`, `src/scene/effects/rain.ts`, `src/scene/effects/ripples.ts`, `src/scene/effects/sky.ts`
- Test: `tests/effects.test.ts`

**Interfaces:**
- Consumes: `src/scene/terrain.ts`, `src/scene/palette.ts`
- Produces:
  - `export class PointerTapTracker` (`onDown(id, x, y, timeMs, isPrimary, button)`, `onMove(id, x, y)`, `onUp(id, x, y, timeMs): boolean`, `onCancel(id)`)
  - `export class RainSystem` (`group`, `update(dt, rainFactor, windFactor, windDir, reducedMotion)`, `getActiveCount()`, `dispose()`)
  - `export class RippleSystem` (`group`, `update(dt, rainFactor, reducedMotion)`, `getVisibleCount()`, `dispose()`)
  - `export class SkySystem` (`group`, `update(atmosphere, timeSec, reducedMotion)`, `dispose()`)

- [ ] **Step 1: Write failing tests in `tests/effects.test.ts`**
  Assert:
  - `PointerTapTracker` returns `true` for clean click/tap (`<= 6px` move, `< 450ms`), and `false` if pointer drifted `> 6px` even if returning to start position, or if canceled/secondary button.
  - `RainSystem` creates a fixed preallocated pool (`InstancedMesh` count fixed, never grows), drops inside island footprint never fall below `getIslandSurfaceHeight(x, z) - 0.15` (so rain does not pass through the floating island), wind=0 yields zero horizontal drift while rain still falls, and `rainFactor=0` settles active count to 0.
  - `RippleSystem` preallocates fixed ring pool inside `isInsidePond` bounds and hides all rings when `rainFactor` reaches 0.
- [ ] **Step 2: Run `npx vitest run tests/effects.test.ts`**
  Expected: FAIL.
- [ ] **Step 3: Implement `gesture.ts`, `rain.ts`, `ripples.ts`, `sky.ts`**
- [ ] **Step 4: Run `npx vitest run tests/effects.test.ts`**
  Expected: PASS.
- [ ] **Step 5: Commit**

---

### Task 6: Handmade Diorama Assets (House, Pond, Windmill, Trees, Clouds, Details)

**Files:**
- Create: `src/scene/assets/house.ts`, `src/scene/assets/pond.ts`, `src/scene/assets/windmill.ts`, `src/scene/assets/trees.ts`, `src/scene/assets/details.ts`, `src/scene/assets/clouds.ts`
- Test: `tests/assets.test.ts`

**Interfaces:**
- Consumes: `src/scene/terrain.ts`, `src/scene/textures.ts`
- Produces:
  - `createHouse(textures): { group: THREE.Group; hitTargets: THREE.Object3D[]; update(dt: number, lightFactor: number, atmosphere: AtmosphereSample, reducedMotion: boolean): void; dispose(): void }`
  - `createPond(): { group: THREE.Group; update(timeSec: number, rainFactor: number, atmosphere: AtmosphereSample, reducedMotion: boolean): void; dispose(): void }`
  - `createWindmill(textures): { group: THREE.Group; update(dt: number, windFactor: number): void; dispose(): void }`
  - `TREE_PLACEMENTS` + `createTrees(textures): { group: THREE.Group; update(timeSec: number, windFactor: number, windDir: { x: number; z: number }, reducedMotion: boolean): void; dispose(): void }`
  - `createDetails(textures): { group: THREE.Group; update(timeSec: number, windFactor: number, reducedMotion: boolean): void; dispose(): void }`
  - `createClouds(): { group: THREE.Group; update(dt: number, windFactor: number, windDir: { x: number; z: number }, rainFactor: number, atmosphere: AtmosphereSample, reducedMotion: boolean): void; dispose(): void }`

- [ ] **Step 1: Write failing tests in `tests/assets.test.ts`**
  Assert:
  - `TREE_PLACEMENTS` + `HOUSE_ANCHOR` + `WINDMILL_ANCHOR` + `POND` pass `validateLandmarkClearance`, and every tree sits inside the island and outside the pond.
  - `createHouse` returns non-empty `hitTargets`, and `update(..., lightFactor = 1, ...)` increases window emissive intensity and house `PointLight` intensity compared to `lightFactor = 0`.
  - `createWindmill` rotor rotation angle advances when `windFactor > 0` and remains stationary when `windFactor === 0`.
  - `createClouds` positions wrap smoothly within arena bounds and stay stationary when `windFactor === 0`.
- [ ] **Step 2: Run `npx vitest run tests/assets.test.ts`**
  Expected: FAIL.
- [ ] **Step 3: Implement `house.ts`, `pond.ts`, `windmill.ts`, `trees.ts`, `details.ts`, `clouds.ts`**
  Craft rich, tactile handmade miniature meshes (stone plinth, timber frame, pitched gable & overhang, flower box, chimney with soft subtle smoke puffs, recessed glowing windows, pond pebble edge + cattails + mini dock, tapered windmill with wooden sail lattice, varied pine & broadleaf trees, stepping-stone path, wooden fence, rocks, wildflowers, puffy clouds).
- [ ] **Step 4: Run `npx vitest run tests/assets.test.ts`**
  Expected: PASS.
- [ ] **Step 5: Commit**

---

### Task 7: Scene Orchestrator, Responsive Control Panel UI, Styles, and WebGL Fallback

**Files:**
- Create: `src/scene/PocketWorldScene.ts`, `src/ui/ControlPanel.ts`, `src/styles/main.css`, `src/main.ts`
- Modify: `index.html`
- Test: `tests/ui.test.ts`

**Interfaces:**
- Consumes: `src/state/worldState.ts`, `src/scene/*`, `src/ui/ControlPanel.ts`
- Produces:
  - `computeResponsiveCameraDistance(aspect: number, baseDistance: number): number`
  - `createControlPanel(container: HTMLElement, store: WorldStateStore, onResetCamera: () => void): { destroy(): void }`
  - `PocketWorldScene` class (`constructor(container, store)`, `resetCamera()`, `dispose()`)

- [ ] **Step 1: Write failing tests in `tests/ui.test.ts` (using `@vitest-environment jsdom`)**
  Assert:
  - Control panel renders title `"Pocket World"`, time slider (`0..24`, default `16`, label `16:00`), weather buttons (`Clear`, `Rain`), wind slider (`0..100`, default `30`, label `30%`), house lights toggle (`Off`/`On`), and `Reset` button.
  - Changing UI controls updates `WorldStateStore`; external `store.toggleHouseLights()` (simulating clicking the 3D house!) updates UI toggle `aria-pressed` state synchronously.
  - Clicking `Reset` restores store to defaults (`16:00`, `clear`, `30%`, `lights: false`), resets all UI input values, and invokes `onResetCamera`.
  - Mobile collapse toggle updates `aria-expanded` cleanly.
  - `computeResponsiveCameraDistance` pulls camera back smoothly when `aspect < 1` so portrait viewports keep the island framed.
- [ ] **Step 2: Run `npx vitest run tests/ui.test.ts`**
  Expected: FAIL.
- [ ] **Step 3: Implement `PocketWorldScene.ts`, `ControlPanel.ts`, `main.css`, `main.ts`, `index.html`**
  Include graceful WebGL initialization guard showing a styled readable message if WebGL context creation fails.
- [ ] **Step 4: Run `npx vitest run` (full test suite)**
  Expected: All unit & UI tests PASS.
- [ ] **Step 5: Commit**

---

### Task 8: README, Full Build Check, Live Browser & Visual Verification

**Files:**
- Create: `README.md`
- Verify & refine visually if needed.

- [ ] **Step 1: Write concise `README.md`**
  Include exact `npm install`, `npm run dev`, `npm run build`, `npm test`, and controls overview.
- [ ] **Step 2: Run `npm run typecheck && npm test && npm run build`**
  Expected: 0 TypeScript errors, all tests pass, production bundle builds cleanly.
- [ ] **Step 3: Live browser verification & visual inspection**
  Start app server and inspect rendered views in a real headless/live browser:
  1. Default initial 3/4 view (`16:00`, Clear, Wind `30%`, Lights Off)
  2. Rainy nighttime view (`23:30` or `00:00`, Rain, Wind `80%`, Lights On)
  3. Sunset view (`18:30`, Clear)
  4. Mobile layout (`390x844` viewport)
  5. Interactive checks: drag-orbiting across the house does NOT toggle lights; direct click on the house DOES toggle lights and syncs the UI button; rapid changes to time/weather/wind leave no stuck particles or console errors; Reset restores camera + controls.
  Inspect screenshots carefully and fix any visual/layout issues discovered!
- [ ] **Step 4: Re-run `npm run typecheck && npm test && npm run build` after any final edits**
- [ ] **Step 5: Final clean commit & verify clean `git status`**
