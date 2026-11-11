# Pocket World

A tiny floating island you can turn in your hands: a cottage with a smoking
chimney, a windmill, a pond with lily pads, oaks, pines and a blossom tree —
and a sky that runs through a full day. Built with Three.js, Vite and
TypeScript. Everything is generated in code at load time: no model files, no
image textures, no network requests. Procedural Canvas textures and one
deterministic heightfield shape the whole island, so the terrain, the object
placement and even where the rain stops all agree with each other.

Built by Muse Spark 1.3 running in Muse (Meta's agent harness), as one entry
in the AI Arena comparison — see the repository root for the other worlds.

## Run it

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # dev server, http://localhost:5137
npm run build      # type-check (tsc --noEmit) + production build into dist/
npm run preview    # serve the production build on port 5137
```

Asset paths are relative (`base: './'`), so `dist/` works from any sub-path.

## What you can do

| Control | Effect |
| --- | --- |
| Drag / one finger | Orbit the island (damped, angle and distance limited, no panning) |
| Scroll / pinch | Zoom |
| Arrow keys, `+` `-` (canvas focused) | Orbit and zoom from the keyboard |
| Time of day slider | Sun and moon direction, light colour and strength, sky gradient, fog, stars, water and cloud colour — keyframed over 24 h |
| Clear / Rain | 1,100 pooled rain streaks that slant with the wind and stop at the ground, grey storm clouds, softer light, expanding ripple rings on the pond |
| Wind slider | One shared wind state: windmill rotor speed, tree and grass sway, cloud drift, rain slant, chimney-smoke drift |
| Click or tap the house, or the panel switch | Window panes glow amber, the porch lantern lights, and a warm point light spills onto the path — both stay in sync |
| Reset | Restores 16:00, clear weather, 30 % wind, lights off, and flies the camera back to the opening view |

At night the panel itself turns dark, fireflies come out, and the island
stays readable under moonlight. On narrow screens the panel becomes a
bottom sheet that starts folded, and the lens widens so the whole island
fits a portrait frame. `prefers-reduced-motion` calms the island's bob,
sway and smoke flutter.

## How it is put together

```
src/
  main.ts     WebGL 2 check, readable fallback card, start-up
  app.ts      renderer, camera + OrbitControls, house picking (click vs drag),
              reset camera flight, the render loop and its smoothed state
  state.ts    the store: hour, weather, wind, lights — the only source of truth
  util.ts     math helpers, seeded RNG, smooth value noise / fbm
  world.ts    the island itself: heightfield terrain + rock underside, house,
              windmill, trees, shader pond + ripple pool, path, fence, props,
              instanced flowers and wind-bent grass, clouds, chimney smoke,
              fireflies, floating shards
  env.ts      time-of-day keyframes, gradient sky dome with sun glow, stars,
              sun/moon sprites, lights and fog, the instanced rain system
  ui.ts       panel wiring (store <-> DOM both ways), labels, announcements
  style.css   the warm paper-glass panel that darkens with the sky
verify.mjs    CDP check (puppeteer-core + the repo's shared Chrome): drives
              the real page through every scenario in the brief and writes
              screenshots/ — see below
```

## Verification

`node verify.mjs` serves nothing itself; point it at a running preview
(`npm run preview`, then `node verify.mjs http://localhost:5137/ 655 320`,
where `655 320` is the house's position in the default 1440×900 frame).
The last run passed every check with zero console errors:

- default view renders, fully framed, panel in day mode
- rain at 23:00 with house lights on (screenshot: `screenshots/rain-night-lights.png`)
- sunset at 18:36, then Reset restoring 16:00 / clear / 30 % / lights off
- a real mouse click on the house toggles its lights; a drag across it does not
- mobile viewport (390×844) renders with the panel folded to a bottom sheet

Screenshots from that run live in `screenshots/`
(`desktop-default.png`, `rain-night-lights.png`, `sunset.png`,
`mobile-default.png`).
