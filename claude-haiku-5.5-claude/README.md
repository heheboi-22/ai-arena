# Pocket World

An interactive 3D diorama of a tiny floating island, built with Three.js, Vite and TypeScript. Every mesh, material and texture is generated in code when the page loads. There are no 3D models, image files or remote assets, and no backend.

## Install

```bash
npm install
```

## Develop

```bash
npm run dev
```

Vite prints a local address, usually http://localhost:5173.

## Production build

```bash
npm run build
```

This runs the TypeScript check and then writes the static site to `dist/`. To serve that folder locally:

```bash
npm run preview -- --port 5181 --host 127.0.0.1
```

## Controls

- **Drag** to orbit. **Scroll** or **pinch** to zoom. Panning is off, so the island can't be lost off-screen.
- **Tap or click the house** to switch its lights. The *House lights* switch does the same thing and stays in sync.
- **Time of day** runs across the full 24 hours, and the sky, sun, moon, windows and fireflies follow it.
- **Weather**: Clear or Rain. Rain fades in and out, and the pond ripples while it falls.
- **Wind** speeds the windmill, sways the trees, moves the clouds and slants the rain.
- **Reset view** restores the starting camera, 16:00, clear weather, 30% wind and lights off.

Keyboard: every control is a native input or button, so Tab, the arrow keys and Space work.

## Layout

```
src/
  main.ts            entry point; shows a message if startup fails
  app.ts             renderer, frame loop and wiring
  state.ts           the single store for user-controlled state
  environment.ts     day palette and sun/moon position from the hour
  world.ts           scene assembly, lights and the per-frame update
  quality.ts         rendering budget chosen from the device
  scene/             terrain, island, pond, house, windmill, trees, props, clouds, sky
  effects/           rain, pond ripples, fireflies
  interaction/       orbit camera; tap-versus-drag picking on the house
  ui/                control panel and notices
```

## Notes

- `vite.config.ts` sets `base: './'`, so the build also works when served from a sub-path such as `/<folder>/`.
- With `prefers-reduced-motion: reduce`, decorative motion (tree sway, cloud drift, fireflies) is scaled down. Controls keep their effect.
