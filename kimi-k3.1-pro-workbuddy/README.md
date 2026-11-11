# Pocket World

A handcrafted, interactive floating-island diorama built with Three.js, Vite, and TypeScript. All geometry and textures are generated in code; no backend, remote assets, models, image textures, or API keys are required.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

## Production build

```bash
npm run typecheck
npm run build
npm run preview
```

The production site is generated in `dist/` and can be hosted as static files.

## Controls

- Drag or swipe to orbit; scroll or pinch to zoom.
- Move the 24-hour slider to change the sun, sky, lighting, and night atmosphere.
- Switch between Clear and Rain for 3D rainfall, darker clouds, and pond ripples.
- Adjust Wind to drive the windmill, tree sway, cloud drift, and rainfall direction together.
- Click the house or use the House lights switch to toggle its illuminated windows.
- Reset restores the camera, 16:00, clear weather, 30% wind, and unlit house.

On small screens, the panel becomes a bottom sheet and can be collapsed. Reduced-motion preferences reduce decorative movement while keeping the controls functional.
