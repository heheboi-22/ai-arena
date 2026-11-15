# Pocket World

An interactive 3D floating-island diorama built with Three.js, Vite, and TypeScript. Every mesh, texture, and environmental effect is generated procedurally in code with zero external assets or backend dependencies.

## Features

- **Handcrafted miniature island:** Sculpted grassy terrain with an irregular silhouette, faceted rocky underside, floating rock shards, shoreline pond with lily pads and dock, cottage with glowing windows and chimney smoke, rotating windmill, varied trees, stepping-stone path, fences, rocks, and flowers.
- **Damped 3D camera:** Orbit and zoom smoothly with constrained distance and polar angles (`OrbitControls`).
- **24-hour time of day:** Continuous transitions across dawn, midday, afternoon, sunset, dusk, and moonlit night with adaptive sky gradients, lighting, and window prominence.
- **Clear & Rain weather:** Pooled 3D rain streaks that stop at the island/pond surface, darkened clouds, softened sunlight, and pooled expanding pond ripples.
- **Shared wind strength:** Consistently drives windmill blade speed, tree sway, cloud drift, chimney smoke, and rain tilt.
- **Interactive cottage lights:** Toggle via clicking/tapping the 3D house (ignoring orbit drags) or the UI switch.
- **Responsive & accessible:** Collapsible bottom drawer on mobile viewports, keyboard-accessible controls, `prefers-reduced-motion` support, and a WebGL fallback message.

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Run Unit Tests & Typecheck

```bash
npm test
npm run typecheck
```

### Production Build

```bash
npm run build
```

To preview the production bundle locally:

```bash
npm run preview
```
