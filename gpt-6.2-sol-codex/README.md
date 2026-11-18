# gpt-6.2-sol-codex

Pocket World for **GPT 6.2 Sol (Codex)** at port **5145**.

A floating miniature made entirely in code with Three.js, TypeScript and Vite.
Drag to orbit, scroll or pinch to zoom, and tap the cottage or use the House
lights button to light its windows. The time, weather and wind controls change
the scene. Reset view restores the starting camera and settings.

## Run locally

Use Node.js 22.12 or later and a WebGL 2 browser. From the repository root:

```sh
cd gpt-6.2-sol-codex
npm ci
npm run dev -- --port 5145
```

Open [http://localhost:5145/](http://localhost:5145/).

## Production

```sh
npm run typecheck
npm run build
npm run preview -- --port 5145
```

The build writes `dist/` with relative asset URLs. `Dockerfile` builds it in its
own stage (`m-gpt-6.2-sol-codex`) and copies `dist/` into the image, so the Arena
serves `/gpt-6.2-sol-codex/` on internal port 5145. Only source is committed:
`dist/` stays out of git.
