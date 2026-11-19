# Pocket World (`gemini-4-neon-web`)

An interactive Three.js floating-island miniature diorama built entirely with procedural geometry, Canvas PBR textures, and custom GLSL shaders—zero external 3D models, image assets, HDRIs, or runtime network dependencies.

## Features

- **Handcrafted floating island**: Irregular grassy meadow top, beveled mossy rim, sculpted faceted limestone underside, and gently bobbing satellite pebble-islets.
- **Architectural landmarks**: Half-timbered limewash cottage with terracotta shingle roof, dormer, stone chimney with wind-drifting smoke, shutters, flower boxes, porch lantern, and glowing amber windows; working octagonal stone-and-plaster windmill with wooden balcony and pitched canvas sails.
- **Pond & shoreline**: Recessed basin with sandy shoreline, river pebbles, swaying cattails, lily pads, weathered wooden dock, and animated water shader with rain ripples.
- **Dynamic 24-hour atmosphere**: Smooth sky dome gradient, sun/moon arc, twinkling stars, readable night lighting, and drifting clouds.
- **Unified environment controls**: Time of day (00:00–24:00), Clear/Rain weather with pooled 3D rain terminating on the island surface, shared Wind strength affecting windmill/trees/clouds/rain, synchronized House Lights (clickable 3D cottage + UI toggle with drag-vs-click detection), and Reset to defaults (`16:00`, Clear, `30%` wind, lights off).

## Commands

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Type-check
npm run typecheck

# Run unit tests
npm test

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview
```
