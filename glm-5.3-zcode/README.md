# Pocket World (glm-5.3-zcode)

A polished, interactive 3D diorama of a tiny floating island, built with Three.js
and TypeScript. Everything on screen is generated in code — geometry, materials,
water and sky shaders, even the smoke and mist textures are runtime canvas
drawings. No downloaded models, no image assets, no backend.

## Run it

Requires Node 18+.

```bash
npm install        # three + vite + typescript
npm run dev        # dev server at http://127.0.0.1:5132
npm run build      # typecheck (tsc --noEmit) + production build into dist/
npm run serve      # serve dist/ at http://localhost:5132 (npx serve)
npm run preview    # vite preview of dist/
```

The production build is a static site with relative paths (`base: './'`), so
`dist/` deploys anywhere, including behind a subpath. Port 5132 is this world's
slot in the arena port table (`../PORT_RULES.md`).

## Verify it

With the production build served on port 5132:

```bash
node scripts/verify.mjs
```

The script drives a real Chromium (software GL) through the brief's scenarios:
default framing, tap-on-house vs drag-over-house, UI/light sync, sunset,
rainy night, wind, clear-up cleanup, reset defaults, rapid control changes, and
the mobile layout — capturing screenshots into `shots/` and failing if the
browser console reports any error. `playwright-core` is borrowed from the
sibling `kimi-k3-workbuddy` project so the arena Docker image stays small.

## The world

- A floating island with an irregular grassy silhouette, a drooping grass lip,
  and a strata-banded rocky cone hanging below it, plus companion mini-rocks
  that bob alongside.
- A cream cottage with a terracotta gable roof, chimney with drifting smoke,
  arched door, flower box, and five framed windows that glow amber when the
  lights are on. The street lamp by the path follows the same switch.
- A pond with a sandy shoreline, lily pads, and a custom water shader; it
  spills into a short stream that slides off the island lip and falls into the
  void as a streaked waterfall with droplets and mist.
- A windmill whose four pitched sails spin up and wind down with inertia, a
  flock of low-poly trees that sway, stepping-stone paths, a post-and-rail
  fence, a bench, boulders, mushrooms, and instanced flowers.
- Fireflies drift over the meadow at dusk; stars come out at night; the moon
  takes over the shadows when the sun is gone.

## Controls

- **Orbit / zoom**: drag to orbit, scroll or pinch to zoom (damped, with
  distance and angle limits; panning disabled so the island never leaves).
- **Time of day**: 24h slider with a readable clock. Sun path, light color,
  sky gradient, fog, stars, moon and window glow all follow — and changes
  ease in smoothly rather than snapping.
- **Weather**: Clear / Rain. Rain fades in as pooled line streaks slanted by
  the wind, darker clouds, softened sun, and expanding ripple rings on the
  pond; drops recycle at the surface or below the island, never through it.
- **Wind**: one shared state drives windmill speed, tree sway, cloud drift,
  and rain slant. At 0% everything wind-driven stops; rain still falls.
- **House lights**: tap the house (a real raycast with a generous invisible
  hit box) or flip the panel switch — both write the same state. Dragging
  across the house never toggles it.
- **Reset**: flies the camera home and restores 16:00, clear weather, 30%
  wind, lights off — controls included.

The panel docks to the bottom and collapses on small screens.
`prefers-reduced-motion` calms sway, clouds, smoke and camera flight while
keeping every control functional. If WebGL cannot start, a readable message
replaces the scene.

## Code layout

```
src/
  main.ts            bootstrap, frame loop, wiring
  app-state.ts       one coherent state + smoothed scene values
  palette.ts         time-of-day keyframes, weather blending, world colors
  style.css          the control panel
  lib/math.ts        damping, smoothstep, seeded noise/rng
  world/             island, house, pond, waterfall, vegetation, windmill,
                     clouds, props, sky, smoke, shared materials, layout
  systems/           lighting, rain, orbit controls + reset flight,
                     tap picking, UI panel
```

Smoothed scene values converge on user targets with exponential damping, so
rapid control changes simply retarget one motion instead of racing animations;
frame deltas are clamped so returning from a background tab never lurches.
