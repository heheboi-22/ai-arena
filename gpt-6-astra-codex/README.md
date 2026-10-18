# Pocket World

A small, interactive floating island built with Three.js, Vite, and TypeScript. All geometry, water, plants, clouds, shadows, and precipitation are generated locally in code. No backend, downloaded models, image textures, remote fonts, or runtime services.

## Run

Requires Node.js 22.12+ (tested with Node.js 24).

```bash
cd gpt-6-astra-codex
npm ci
npm run dev
```

Open **http://localhost:5122/**. The port is strict so an occupied port is reported rather than silently changed. To use another port: `npm run dev -- --port 5200`.

## Production

Stop the development server first, then:

```bash
npm run build
npm run preview
```

The build includes the TypeScript check. Serve `dist/` with any static web server. Asset paths are relative, so the build also supports a subdirectory. This project does not alter the arena's shared deployment or routing configuration.

## Controls

- Drag or one-finger swipe to orbit. Scroll, pinch, or use the +/− buttons to zoom.
- With the canvas focused, arrow keys orbit and +/− zoom. Camera panning is disabled and viewing limits keep the island in reach.
- The time slider covers the full day in 15-minute steps. It changes the sky, sun position, brightness, and night lighting.
- Clear/Rain fades clouds, rain, and pond ripples in and out. One wind value drives the mill, trees, clouds, and rain direction.
- Tap the cottage or use **Cottage lights** to toggle the same light state. Dragging and multi-touch gestures do not count as house clicks.
- **Reset world** restores the camera, 16:00, clear skies, 30% wind, and lights off.
- On phones, tap **Make it your moment** to collapse the controls. Native sliders and buttons support keyboard focus and accessible labels.

## Checks

```bash
npm run typecheck
npx playwright install chromium
npm test
```

On Linux systems where headless Chromium cannot create a WebGL context, use a desktop session with hardware acceleration:

```bash
npm test -- --headed
```

The nine browser tests cover state defaults, camera and keyboard controls, actual day/night lighting, rain recycling, connected wind effects, click-versus-drag behavior, rapid changes and reset, mobile touch orbit/pinch/tap, reduced motion, and the WebGL fallback. Screenshots are written to `.shots/` for visual inspection.

## Implementation

`src/state.ts` owns environment state; `src/ui.ts` binds accessible controls; `src/scene.ts` owns rendering, camera, hit testing, and the animation loop. `src/environment.ts` derives weather and lighting, while `src/world/` builds the terrain, cottage, windmill, and planting.

Static meshes are batched by material. Rain buffers and ripple meshes are reused, frame delta is clamped, and transitions follow current targets without queued animations. Mobile starts with fewer particles and smaller shadow maps; pixel ratio is capped. Reduced-motion mode lowers wind-driven decoration and stops water-line drift while keeping functional weather and controls available.

WebGL 2 is required. A readable fallback handles initialization failure and context loss. Rain is a lightweight approximation: it recycles at the island surface and does not simulate individual roof or leaf collisions. Performance was checked in desktop Chromium; physical phone GPU performance has not been measured.
