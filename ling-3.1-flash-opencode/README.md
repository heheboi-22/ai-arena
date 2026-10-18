# Pocket World

A polished, interactive 3D diorama of a tiny floating island — a handmade-miniature
toy built with Three.js, Vite and TypeScript. Everything in the scene is generated
in code: no downloaded models, textures, or external assets.

## Features

- **Floating island** — grassy top with an irregular silhouette, sculpted rocky
  underside, pond with shoreline, trees, house, windmill, clouds, path, fence,
  flowers and rocks.
- **Time of day** — a 24 h slider drives sun/moon direction, light color and
  intensity, sky gradient, fog, stars and window glow. Day → sunset → night
  transitions are smooth.
- **Weather** — Clear/Rain. Rain adds pooled 3D rain streaks that land on the
  island and fall past its underside, pond ripples, greyer clouds and softened
  sunlight.
- **Wind** — one shared wind state drives the windmill, tree sway, cloud drift,
  chimney smoke and rain direction.
- **House lights** — click/tap the house (click vs. drag is disambiguated) or
  use the panel switch; both write the same state. Windows, lantern and a warm
  point light fade in, glowing more at night.
- **Reset** — restores the initial camera, 16:00, clear weather, 30% wind and
  lights off.
- Responsive layout (panel docks to the bottom on small screens), keyboard
  accessible controls, `prefers-reduced-motion` support, clamped frame deltas,
  and a readable fallback message when WebGL is unavailable.

## Commands

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check (tsc) + production build to dist/
npm run preview  # serve the production build
```

## Structure

```
src/
  main.ts          bootstrap, render loop, resize, WebGL fallback
  state.ts         shared app state (time, weather, wind, lights)
  palette.ts       24-hour environment keyframes (sky, sun, ambient)
  noise.ts         value noise + damping math helpers
  island.ts        island body, pond, rocks (procedural geometry)
  structures.ts    house (windows/chimney/lantern) and windmill
  nature.ts        trees, flowers, fence, path, clouds
  environment.ts   sky dome, stars, sun/moon, lights, rain, ripples, smoke
  world.ts         assembles the diorama and advances all systems
  interaction.ts   OrbitControls config + house click picking
  ui.ts            control panel wiring
```

## Notes

- Rain, ripples and smoke are pooled and reused — nothing is allocated per frame.
- The windmill, trees, clouds, smoke and rain all read the same wind slider, so
  the whole world responds consistently.
- Performance: pixel ratio and shadow-map size are reduced on small screens;
  particle counts are modest and geometry is shared where practical.
