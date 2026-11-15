# Pocket World (gemini-4-hydrogen-web)

Interactive 3D floating island diorama built procedurally with Three.js, TypeScript, and Vite. Everything in the scene—island geometry, stratified cliffs, cottage, windmill, pond water, trees, clouds, rain, and canvas textures—is generated in code with zero external assets.

## Prerequisites

- Node.js 18+ and npm

## Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Typecheck
npm run typecheck

# Run unit tests
npm test

# Production build
npm run build
```

## Controls

- **Orbit / Zoom**: Drag to rotate around the island; scroll or pinch to zoom.
- **Time of Day**: Scrub across 00:00–24:00 (default 16:00).
- **Weather**: Switch smoothly between Clear and Rain.
- **Wind**: Adjust wind strength from 0% to 100% (default 30%), driving windmill blades, tree sway, cloud drift, chimney smoke, and rain angle.
- **House Lights**: Click or tap the cottage directly, or use the Lights toggle in the control dock.
- **Collapse / Expand Dock**: Use the toggle handle or press `H`.
- **Reset**: Restores camera, 16:00, Clear weather, 30% wind, and Lights off.
