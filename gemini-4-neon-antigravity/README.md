# Pocket World

An interactive 3D miniature floating island diorama built with Three.js, TypeScript, and Vite. All geometry, lighting, procedural textures, weather particles, and atmospheric shaders are generated entirely in code with no external assets or backend services.

## Features

- **Handcrafted floating island diorama**: Irregular grassy plateau with overhanging turf lip, sculpted faceted rocky underside with floating rocklets and roots, recessed shoreline pond with lily pads and reeds, half-timber cottage with chimney smoke, hilltop windmill, varied pines and broadleaf trees, stepping-stone paths, rustic fence, wildflowers, and drifting clouds.
- **24-hour time of day**: Smooth transitions across dawn, morning, midday, golden afternoon (`16:00` default), sunset, dusk, and readable moonlit nighttime with stars and sky-dome shaders.
- **Dynamic weather**: Smooth Clear ↔ Rain transitions with pooled 3D surface-aware rain streaks, darkening clouds, overcast lighting, and pooled pond ripples.
- **Shared wind system**: One unified wind strength (`0%`–`100%`) driving windmill sail rotation, directional tree and reed sway, cloud drift, chimney smoke, and rain slant.
- **Interactive house lighting**: Click or tap the cottage (distinguished cleanly from orbit dragging) or use the synchronized House Lights control for warm amber window glow and local porch illumination.
- **Accessible & responsive**: Smooth damped OrbitControls with sensible limits, desktop floating glass panel, collapsible mobile bottom sheet, keyboard navigation with visible focus states, reduced-motion support, and WebGL fallback.

## Commands

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

### Run type check and unit tests

```bash
npm run typecheck
npm test
```

### Create production build

```bash
npm run build
```

### Preview production build locally

```bash
npm run preview
```
