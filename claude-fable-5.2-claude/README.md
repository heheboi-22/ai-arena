# Pocket World

An interactive Three.js diorama of a tiny floating island: a cottage, a
windmill, a pond, a small grove, and weather you can change. Everything is
generated in code at runtime. There are no models, image textures, HDRIs or
network requests.

## Run it

Requires Node 20.19+ (or 22.12+).

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

`npm run build` type-checks with `tsc --noEmit` and then writes a static site
to `dist/`. The build uses relative asset URLs, so `dist/` can be served from
any path. `npm run typecheck` runs the type check alone.

## Controls

- Drag to orbit, scroll or pinch to zoom. Panning is disabled and the zoom and
  tilt are limited, so the island cannot be lost.
- **Time of day**: 24 hours in 5-minute steps. Drives sun position and colour,
  sky, exposure, stars, moon and how strongly lit windows read.
- **Weather**: Clear or Rain. Rain brings a storm deck, softer light, streaks
  that land on the island and ripples on the pond.
- **Wind**: one shared wind drives the windmill, tree sway, cloud drift, rain
  slant and chimney smoke. At 0% they stop; rain still falls straight down.
- **House lights**: the switch in the panel, or click/tap the cottage. A drag
  across the cottage orbits and does not toggle.
- **Reset**: camera home, 16:00, clear, wind 30%, lights off.

## Layout of the code

```
src/
  main.ts              bootstrap, renderer, resize, frame loop, WebGL fallback
  state.ts             the single app state store (time, weather, wind, lights)
  core/                math + noise, vertex-colour geometry builder, tri soup
  scene/               terrain functions, island, house, windmill, trees, pond,
                       details, clouds, ambient (smoke, fireflies), world
  env/                 day cycle keyframes, sky dome, environment (lights),
                       wind, rain
  interaction/         camera rig (framing, limits, reset), house picker
  ui/                  control panel binding
```

The UI and the 3D picker only write to the store. Each frame the scene eases
its own copies of those values towards the store and derives every effect from
them, so transitions are interruptible by construction.

## Notes and limits

- Rendering needs WebGL 2; without it a message is shown instead of the scene.
- Phones and machines with four or fewer cores get a lower pixel-ratio cap, a
  1024 px shadow map and half the rain drops.
- With `prefers-reduced-motion`, decorative motion (island bob, twinkle,
  smoke, fireflies, camera glide) is removed and tree sway is reduced. Wind,
  rain and the windmill still respond to the controls.
- Rain lands on a baked height field of the terrain, house, windmill and tree
  crowns. It is an approximation: small props such as the fence are ignored.
- The moon is drawn where it looks good in the opening view, below the true
  horizon line. This is a stylistic choice, not astronomy.
