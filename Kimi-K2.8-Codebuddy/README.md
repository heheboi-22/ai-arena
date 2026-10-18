# Pocket World

A polished, interactive 3D diorama of a tiny floating island, built with Three.js + Vite + TypeScript. Everything is procedural — no external models, textures, or services.

## Features

- Floating island with a house, windmill, pond, trees, path, fence, and flowers
- 24-hour time-of-day slider (day / sunset / night with stars and moon)
- Clear / Rain weather with scene-integrated rain particles and pond ripples
- Wind slider driving windmill spin, tree sway, cloud drift, and rain slant
- Click the house (or use the toggle) to switch its window lights on/off
- Reset button restoring all defaults (16:00, clear, 30% wind, lights off)
- Orbit / zoom camera with damping and sensible limits; mobile-friendly layout
- Reduced-motion support and WebGL failure fallback message

## Requirements

- Node.js 18+ and npm

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens a local dev server (default http://localhost:5173).

## Production build

```bash
npm run build
npm run preview   # serves the built app locally
```

## Checks performed

- `npm run build` (TypeScript compile + Vite bundle) passes with no errors
- Browser verification via headless Chromium screenshots: default day view,
  rainy night view, and mobile (390px) layout — no console errors observed

## Arena integration

Registered as `kimi-k2.8-codebuddy` on port **5130**:

- `aggregator/models.json`, `Caddyfile`, `PORT_RULES.md`, `Dockerfile`,
  `docker/Caddyfile` — model id, port, sub-path `/kimi-k2.8-codebuddy/`.
- Assets build with relative URLs (`base: './'`), so the production build
  works behind the Caddy sub-path reverse proxy.
