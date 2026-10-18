# Pocket World

A polished, interactive 3D diorama of a tiny floating island, built with
Three.js + Vite + TypeScript. Runs fully in the browser with no backend and
no downloaded assets — everything in the scene is generated in code.

## Develop

```sh
npm install
npm run dev
```

Open the printed local URL (default http://localhost:5173).

## Build

```sh
npm run build
npm run preview   # serves dist/ locally
```

## Type check

```sh
npm run typecheck
```

## Controls

- Drag to orbit, scroll / pinch to zoom. Pan is disabled so the island stays
  framed.
- Sliders: **Time** (00:00–24:00), **Wind** (0–100%).
- **Weather**: Clear / Rain buttons.
- **House lights** switch mirrors clicking or tapping the house (click vs.
  drag is distinguished, so orbiting won't toggle it).
- **Reset world** restores the default camera, 16:00, clear weather, 30%
  wind, lights off.

URL parameters can seed the state for previews, e.g.
`?time=22&weather=rain&lights=1&wind=80&cam=10.5,6.8,13.2,0,0.6,0`.

## Structure

- `src/main.ts` — renderer, camera, controls, main loop, click-vs-drag raycast
- `src/state/AppState.ts` — state model + defaults + query params
- `src/scene/` — `island`, `house`, `windmill`, `vegetation`, `props`,
  `environment` (sun/sky/stars), `effects` (clouds, rain, ripples), `noise`
- `src/ui/Controls.ts` — control panel
- `src/styles/main.css` — styling (desktop + mobile, reduced motion)

Wind is a single shared value feeding the windmill rotor speed, tree sway,
cloud drift, and rain slant. All transitions (rain amount, wind smoothing,
light emissive, camera reset) are damped and interruptible.
