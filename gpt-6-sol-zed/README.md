# Pocket World

A little weather study: a procedural floating-island diorama built with Three.js, Vite and TypeScript. Everything in the scene is made in code. No backend, remote assets, models or runtime API calls are needed.

## Run locally

Requires Node.js 20.19+ (or 22.12+) and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. To run the type check and production build:

```sh
npm run typecheck
npm run build
npm run preview
```

`npm run preview` serves the production bundle locally. The Vite base is relative, so the `dist/` output can also be served under a subpath.

## Explore

Drag to orbit, scroll or pinch to zoom, and click or tap the house to switch its lights. The panel can also toggle the lights. Adjust time, weather and wind; **Reset scene** returns to 16:00, clear weather, 30% wind, lights off and the original camera framing. On small screens, tap **World controls** to open the panel.

If WebGL is unavailable, the page displays an explanatory message instead of an empty scene. Reduced-motion settings soften ambient animation without disabling the functional controls.
