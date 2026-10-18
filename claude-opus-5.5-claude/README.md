# Pocket World

A tiny floating island you can turn in your hands: a cottage, a windmill, a pond, a few trees,
and a sky that runs through a full day. Built with Three.js, Vite and TypeScript. Everything
is made in code at load time; there are no model files, image textures or network requests.

## Run it

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
```

```bash
npm run dev
```

Opens a dev server (Vite prints the URL, normally http://localhost:5173).

```bash
npm run build
```

Type-checks (`tsc --noEmit`) and writes a static production build to `dist/`. Asset paths are
relative, so `dist/` can be served from any sub-path.

```bash
npm run preview
```

Serves the production build locally.

## What you can do

| Control | Effect |
| --- | --- |
| Drag / one finger | Orbit the island (damped, angle and distance limited, no panning) |
| Scroll / pinch | Zoom |
| Arrow keys, `+` `-` (canvas focused) | Orbit and zoom from the keyboard |
| Time of day slider | Sun or moon direction, light colour and strength, sky, fog, stars, window glow |
| Clear / Rain | Rain streaks, storm clouds, greyer sky, softer shadows, ripples on the pond |
| Wind slider | Windmill speed, tree and grass sway, cloud drift, rain slant, chimney smoke |
| Click or tap the house, or the switch | Window and lantern glow plus a warm light on the path |
| Reset | 16:00, clear, 30 % wind, lights off, and flies the camera back to the start view |

The panel follows the sky: it turns dark after dusk. On narrow screens it becomes a bottom
sheet that starts folded, and the view slides up when you open it.

## How it is put together

```
src/
  main.ts            WebGL 2 check, error screen, start-up
  app.ts             renderer, render loop, eases live values toward the store
  state.ts           the store: time, weather, wind, lights (the only source of truth)
  core/              math helpers, seeded random, value noise, geometry merging, quality tier
  world/             island, house, windmill, trees, pond, props, clouds, layout, terrain
  env/               time-of-day keyframes, sky shader, lights, wind, rain, ripples, smoke, fireflies
  interaction/       camera rig (OrbitControls, framing, reset flight), house picking
  ui/panel.ts        control panel bound to the store
```

- **One state, many effects.** The UI, the 3D click and Reset all write to the same store. Each
  frame the scene eases a "live" copy toward it (time takes the short way round midnight, rain
  fades in about two seconds), so any change can be interrupted by the next one.
- **One wind.** `env/wind.ts` holds the strength, a slow gust and a sway phase. The windmill,
  rain, clouds and smoke read it on the CPU; trees, reeds, flowers and grass read the same values
  through shared shader uniforms. At 0 % everything wind-driven comes to rest; rain still falls.
- **Rain that lands.** About 1,300 drops (650 on small screens) live in one fixed pool and are
  drawn in a single instanced call. Each drop checks a height grid baked from the terrain, pond,
  roof and windmill; on contact it makes a ripple or a small splash and is recycled. Switching
  rain off lets the drops in the air finish their fall instead of vanishing.
- **Light.** One shadow-casting key light is the sun by day and the moon by night. The swap
  happens while its intensity is zero, so it is never visible. Hand-tuned keyframes cover night,
  dawn, morning, noon, afternoon, golden hour, sunset and dusk.
- **Framing.** The start view is computed by fitting key points of the island into the part of
  the screen the panel does not cover, so it holds on wide, tall and short windows.
- **Cost.** Static parts are merged per material (about 150 draw calls in total), the pixel ratio
  is capped (2, or 1.5 on small screens) and lowered further if frames stay slow, and reduced
  motion turns off the island bob, smoke, firefly drift and most of the sway.

`window.__pocketWorld` exposes the store and a `stats()` snapshot (drop count, camera position
and so on). It is only there for automated checks and console poking.

## Known limitations

- Rain passes through tree crowns and lands on the ground below them.
- Rain collision uses a baked grid with cells about a twentieth of the house's width, so drops
  can stop slightly early or late at the roof edge or the shoreline.
- Rendering was checked in headless Chromium on Linux. Safari and Firefox were not tested, and
  touch was tested with emulated touch events rather than on a physical phone.
