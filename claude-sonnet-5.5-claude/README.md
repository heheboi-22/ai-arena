# Pocket World

A tiny floating island you can orbit, light up, rain on and blow around: a cottage, a windmill, a pond,
a few trees, and a sky that follows the clock. It runs entirely in the browser, with no backend.

Built with Three.js, Vite and TypeScript. Every object is generated in code, and the only textures
are drawn on a canvas at start-up: no model files, image textures, HDRIs or remote assets.

## Run it

You need Node.js 20.19 or newer (or 22.12 and up; developed on Node 24) and npm.

```bash
npm install          # install dependencies
npm run dev          # development server with hot reload, http://localhost:5173
```

```bash
npm run typecheck    # TypeScript only
npm run build        # type-check, then build the static site into dist/
npm run preview      # serve dist/ locally to try the production build
```

`dist/` is a plain static site with relative asset paths, so it can be served from any host or sub-path.

## What you can do

| Control | Effect |
| --- | --- |
| Drag, or one finger | Orbit the island. Motion is damped, and the polar angle and distance are limited. There is no panning. |
| Scroll, or pinch | Zoom, eased, between a near and a far limit. |
| Click or tap the house | Toggle its lights. A drag across the house orbits and does not toggle. |
| Time of day (00:00 to 24:00) | Moves the sun and moon, and changes the light colour, the sky, the stars and how strongly the windows glow. |
| Clear / Rain | Rain falls in the scene, clouds darken, the sun softens, and rings spread over the pond. |
| Wind | One shared wind drives the windmill, the trees and grass, the clouds, the chimney smoke and the slant of the rain. At 0% they all stand still and the rain falls straight down. |
| House lights | The same state as clicking the house. |
| Reset | Camera, 16:00, clear weather, 30% wind, lights off, in the world and in the controls. |

With the scene focused (Tab to it), the arrow keys orbit and `+` / `-` zoom. Every panel control works from
the keyboard and has a visible focus ring. `prefers-reduced-motion` stops the decorative motion (island
bob, drifting debris, fireflies, flicker, house hop, camera easing) and keeps everything the controls drive.

On narrow or portrait screens the panel becomes a bottom sheet that can be folded down; the camera frames
the island in whatever space is left.

## How it is put together

```
src/
  main.ts            start-up, WebGL check, error screen
  app.ts             renderer, frame loop, smoothing of the state, resize, quality governor
  state.ts           the one store: hour, weather, wind, lights
  world/             building the scene
    layout.ts        where everything stands, and the ground height function everything shares
    island.ts        grassy top, turf lip, faceted rock body, hanging spikes, drifting debris
    house.ts         cottage, windows, chimney, lights; trees.ts; windmill.ts; pond.ts (water shader)
    props.ts         stepping stones, fence, flowers, rocks, grass tufts; clouds.ts
    surfaces.ts      a height map of what rain can land on (ground, water, roofs, canopies)
    world.ts         assembles all of it and updates it every frame
  fx/                the environment
    environment.ts   hour + rain -> sun, moon, sky, light colours (a pure function)
    atmosphere.ts    the lights and sky, fed from that function
    wind.ts          the shared wind; rain.ts, smoke.ts, fireflies.ts, sky.ts, particles.ts
  interaction/       cameraRig.ts (orbit, zoom easing, framing, reset) and picking.ts (tap vs drag)
  ui/                panel.ts (controls), fatal.ts (readable error screen)
  util/              maths, noise, geometry baker, canvas textures, quality presets
```

A few decisions worth knowing:

- **One state, smoothed.** The panel and the 3D click both write to the store. The scene never animates
  the store itself; it eases its own copy toward it with frame-rate independent damping, so every
  transition can be interrupted at any moment and nothing queues up. Frame times are clamped to 50 ms.
- **Time of day is a continuous function** of the (smoothed) hour and rain, with no modes to switch between.
- **Rain is recycled, never created.** A fixed pool of drops is aimed at points over the island, falls
  along the wind, and is retired the moment it meets whatever is underneath (grass, a roof, a canopy, the
  pond). Pond hits reuse a fixed pool of ripples. Toggling the weather allocates nothing.
- **Objects are baked.** Houses, trees and fences are assembled from primitives into a few merged meshes
  with shared materials, and flowers and grass are instanced (about 100 draw calls in all).
- **Cost scales with the device.** Phones, small windows and low-core machines get a smaller shadow map,
  fewer raindrops and a lower pixel ratio. If the frame rate stays low the pixel ratio steps down further.
  Add `?quality=low` or `?quality=high` to the URL to pin a preset.

Adding `?debug` to the URL exposes `window.__pocket` (the store and the scene) for scripted checks.

## Limitations

- WebGL 2 is required. Without it the page shows a message instead of the scene.
- The sky is a gradient anchored to the screen, with stars and a sun and moon at their true directions.
  From the opening view you see the light and the stars but not the sun or moon themselves; turn the
  camera toward them to find them.
- Shadows come from one light (the sun by day, the moon at night), and clouds do not cast any.
- Only Chromium has been used to try it (desktop, and phone sizes through emulation). Safari, Firefox and
  real touch devices have not been exercised.
