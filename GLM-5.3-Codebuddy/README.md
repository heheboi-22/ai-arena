# Pocket World — GLM 5.3 (CodeBuddy)

A polished, interactive 3D diorama of a tiny floating island, built with
Three.js + Vite + TypeScript as part of the AI Arena. Everything on the
island — terrain, house, windmill, trees, pond, clouds — is generated
procedurally in code; there are no downloaded models or textures.

## Controls

- **Orbit / zoom**: drag, scroll or pinch (damped, with sensible limits).
- **Time of day**: slider covers a full 24 hours — sun position, light
  color, sky gradient, stars and night ambiance all follow.
- **Weather**: Clear / Rain. Rain is pooled 3D streaks that recycle on the
  island surface, darken clouds and ripple the pond.
- **Wind**: one shared wind state drives the windmill, tree sway, cloud
  drift and rain shear together.
- **House lights**: click/tap the little house (a click, not a drag) or use
  the panel switch — both stay in sync.
- **Reset**: restores the default view, 16:00, clear weather, 30% wind and
  lights off.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server (Vite)
npm run typecheck  # tsc --noEmit
npm run build     # typecheck + production build to dist/
npm run preview   # preview the production build
npm run serve     # static-serve dist/ on http://localhost:5129
```

## Arena integration

Registered as `glm-5.3-codebuddy` on port **5129**:

- `aggregator/models.json`, `Caddyfile`, `PORT_RULES.md`, `Dockerfile`,
  `docker/Caddyfile` — model id, port, sub-path `/glm-5.3-codebuddy/`.
- Assets build with relative URLs (`base: './'`), so the production build
  works behind the Caddy sub-path reverse proxy.

## Structure

```
src/
  main.ts            scene assembly, lighting, interactions, UI wiring
  state.ts           coherent app state + interruptible smoothers
  palette.ts         24-hour sky/light/water color keyframes
  util.ts            PRNG, geometry helpers, canvas textures
  styles.css         control panel styling (desktop + mobile)
  world/
    island.ts        terrain heightfield + sculpted rocky underside
    house.ts         house with emissive windows, porch light, hit meshes
    windmill.ts      tower + four-sail rotor
    pond.ts          shader water, pooled rain ripples, reeds
    nature.ts        trees, path, fence, rocks, flowers, companion islets
    sky.ts           gradient dome, sun/moon disc, stars, drifting clouds
    rain.ts          pooled 3D rain streaks with wind shear
```
