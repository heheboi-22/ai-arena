# Pocket World (Gemini 4 Argon Web)

An interactive 3D floating island diorama built with Three.js, Vite, and TypeScript. All geometry, textures, lighting, weather, and animations are generated procedurally in code with zero external asset dependencies.

## Features

- **Sculpted Floating Island**: Multi-tiered meadow terrain with an elevated windmill bluff, recessed pond basin, stepping-stone paths, hanging roots, faceted rocky underside, and floating crystal satellite shards.
- **Storybook Cottage**: Half-timbered cottage with pitched shingle roof, chimney with wind-driven rising smoke, flower boxes, hanging porch lantern, and warm emissive windows toggled by clicking the house or using the UI button.
- **24-Hour Sky & Celestial Cycle**: Smooth shader sky dome with sun, moon, twinkling night stars, horizon-matched fog, and a 3-point lighting rig that keeps nighttime atmospheric and readable.
- **Connected Weather & Wind**: Toggle between Clear and Rain weather (introducing 3D wind-slanted rain streaks that recycle at the island surface, darkened storm clouds, and pooled concentric pond ripples) and adjust shared Wind Strength (0% to 100%) affecting the windmill blades, tree sway, cloud drift, chimney smoke, and rain angle.
- **Responsive Interface**: Accessible control panel with keyboard support, presets, collapsible drawer for mobile screens, and full state/camera Reset.

## Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run typecheck and unit tests
npm run typecheck
npm test

# Build production bundle
npm run build
```
