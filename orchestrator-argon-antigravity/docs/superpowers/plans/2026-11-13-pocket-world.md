# Pocket World Implementation Plan

> **For agentic workers:** Execute this plan task-by-task to build, test, and visually verify the complete working "Pocket World" 3D application. Do not stop at a proposal or scaffold—complete all implementation, build checks, unit tests, and live browser verifications.

**Goal:** Build "Pocket World," a polished, interactive 3D floating-island diorama in Three.js, Vite, and TypeScript with cohesive procedural miniature art direction and interconnected time, weather, wind, camera, and house-lighting controls.

**Architecture:** The application separates pure reactive state and environmental math (`src/state/worldState.ts`) from procedural 3D geometry construction (`src/scene/*`), pooled particle/ripple effects (`src/scene/weatherEffects.ts`), pointer/camera interaction (`src/interaction/inputController.ts`), and an accessible, responsive HTML/CSS control panel (`src/ui/controlPanel.ts`). A single `requestAnimationFrame` loop with clamped frame deltas (`<= 0.1s`) drives exponentially damped transitions so rapid control adjustments remain smooth and interruptible.

**Tech Stack:** Three.js (`three`, `@types/three`), Vite, TypeScript, Vitest (for unit testing state, lighting math, delta clamping, and rain collision bounds).

**Spec:** User prompt specification (Sections 1–8).

## Global Constraints

- Use Three.js for rendering with Vite and TypeScript and minimal dependencies.
- Run entirely in the browser without a backend, external services, API keys, or remotely hosted runtime assets.
- Create all scene objects through code; do not use downloaded 3D models, external image textures, HDR environments, or asset packs (procedural Canvas textures and shaders are allowed).
- Include required scene elements: floating island with grassy top, irregular silhouette, and sculpted rocky underside; small recognizable house with roof, door, windows, chimney, and architectural details; pond with visible shoreline; several trees with varied sizes and silhouettes; windmill with clearly visible rotating blades; clouds, rocks, path, fence, and flowers.
- Support required interactions: damped OrbitControls with sensible distance/angle limits and no unrestricted panning; 24-hour time slider (`0..24`) affecting sun, brightness, sky, night readability, and window prominence; `Clear` and `Rain` weather controls with 3D rain stopping at the island/pond surface, darker clouds, softened sunlight, and pond ripples; wind slider (`0..100%`) driving windmill blades, tree sway, cloud drift, and rain tilt; synchronized house light toggling via both 3D click (distinguished from orbit drag) and UI button; Reset button restoring camera view, `16:00` time, `Clear` weather, `30%` wind, and house lights `off`.
- Respect `prefers-reduced-motion` and handle missing WebGL support with a readable fallback message.

## Review Focus

1. **Orbit drag over the house accidentally toggling lights:** Dragging starting on the house mesh and releasing after orbiting must NOT toggle the house lights; only pointer gestures with movement `< 6px` and duration `< 500ms` may trigger a house click.
2. **Rain falling through the floating island underside:** 3D raindrops within the island's horizontal footprint must terminate and recycle at the island terrain/pond surface height rather than passing through the rocky underside into empty space below.
3. **Large `requestAnimationFrame` delta after tab backgrounding:** Returning from an inactive tab with a multi-second delta must be clamped (`MAX_FRAME_DELTA = 0.1`) so the windmill, clouds, rain, and damped transitions do not jump or explode.
4. **Rapid weather toggling leaving stale pond ripples or leaked geometries:** Switching between `Rain` and `Clear` repeatedly must reuse pre-allocated pools and smoothly fade out remaining ripples to zero opacity without leaving visible rings on the pond in clear weather.
5. **Nighttime visibility collapse:** At `00:00`–`04:00` and `21:00`–`24:00` (even during `Rain` with house lights off), moonlit hemisphere and ambient fill light must keep the island silhouette, house, windmill, and underside clearly readable rather than pitch black.

---

### Task 1: Project Scaffold, Configuration, and Core State & Lighting Engine

**Files:**
- Create: `docs/superpowers/plans/2026-11-13-pocket-world.md`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/state/worldState.ts`
- Test: `src/state/__tests__/worldState.test.ts`

### Task 2: Procedural Materials, Island Terrain, Pond, Architecture, and Nature Construction

**Files:**
- Create: `src/scene/materials.ts`
- Create: `src/scene/buildIsland.ts`
- Create: `src/scene/buildArchitecture.ts`
- Create: `src/scene/buildNatureAndDetails.ts`

### Task 3: Pooled 3D Weather Effects (Rain Streaks & Pond Ripples) and Scene Controller

**Files:**
- Create: `src/scene/weatherEffects.ts`
- Create: `src/scene/pocketWorldScene.ts`
- Test: `src/scene/__tests__/weatherEffects.test.ts`

### Task 4: Camera & Raycast Interaction Controller, Accessible UI Panel, Entry Point, and README

**Files:**
- Create: `src/interaction/inputController.ts`
- Create: `src/ui/controlPanel.ts`
- Create: `src/style.css`
- Create: `src/main.ts`
- Create: `README.md`

### Task 5: Live Browser Verification and Visual Polish
