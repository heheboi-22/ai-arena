# Pocket World

A procedural Three.js diorama of a floating island, with a cottage, pond, windmill, trees, and drifting clouds. Everything is built in code. There are no downloaded models, textures, fonts, runtime services, or backend.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm. Node.js 24 is used for verification.

```bash
cd gpt-6.1-sol-codex
npm ci
npm run dev
```

Open http://localhost:5120/. The configured port is 5120; if another process is using it, use `npm run dev -- --port 5121`.

## Production

```bash
npm run typecheck
npm run build
npm run preview
```

`npm run build` typechecks first and writes a static application to `dist/`. `npm run preview` serves that build at http://localhost:5120/. Stop the dev server before previewing on the same port. The relative asset base supports deployment inside a subdirectory. npm downloads dependencies during installation; the finished application runs without external requests.

## Container arena

From the repository root:

```bash
docker compose up -d --build
docker compose exec arena supervisorctl status
```

Open http://localhost:8080/gpt-6.1-sol-codex/. The application is registered in the arena dashboard and served on internal port 5119 through Caddy. Only port 8080 is published. `docker compose down` stops the arena container.

## Controls

- Drag with a mouse or one finger to orbit. Use the wheel or pinch with two fingers to zoom. Panning is disabled, and the camera has angle and distance limits.
- Focus the scene with Tab, then use arrow keys to orbit and `+` / `-` to zoom.
- The time slider covers 00:00 to 24:00 in 15 minute steps, changing sunlight, sky, ambient light, moonlight, and window brightness.
- Clear and Rain change cloud color, sunlight, pooled 3D rain, and pond ripples.
- Wind controls the windmill, trees, cloud movement, and rain direction together. Rain still falls at zero wind.
- Click or tap the cottage, or use the Cottage lights switch. Orbit drags and two finger gestures do not toggle the lights.
- Reset restores the camera, 16:00, clear weather, 30% wind, and lights off.
- On narrow screens, controls occupy their own area below the scene. Hide controls expands the scene; Escape also collapses the controls.

Reduced motion lowers decorative windmill, tree, and cloud motion, stops water glint drift, and disables interface transitions. Environmental controls and falling rain remain functional.

## Implementation

`state.ts` owns the shared state. `geometry.ts`, `island.ts`, and `objects.ts` construct the world. `environment.ts` handles lighting, weather, and fixed rain/ripple pools. `world.ts` manages the renderer, bounded camera, animation, picking, and keyboard controls. `ui.ts` and `style.css` handle the interface and responsive layout.

Weather and lighting interpolate toward current state, so new input interrupts a transition without stacking animations. Frame deltas are clamped after interruptions. Rain recycles at a precomputed surface height map, including buildings and trees. Particle and shadow costs are lower on narrow screens or devices reporting four or fewer CPU cores; rendering pixel ratio is capped.

WebGL 2 and a working graphics driver are required. A readable error and reload action appear if initialization fails or the context is lost. Water and rain use stylized approximations. The collision map is sampled at startup, so rain collision follows the initial tree canopy shapes rather than their small animated sway.

See [VERIFICATION.md](VERIFICATION.md) for the build checks, browser scenarios, responsive measurements, and limits of verification.
