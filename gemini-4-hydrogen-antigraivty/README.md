# Pocket World

An interactive 3D miniature floating island diorama built with Three.js, Vite, and TypeScript. Every geometry, shader, and surface texture is generated procedurally in the browser with no external assets or backend dependencies.

## Features

- **Orbit & Zoom Camera**: Damped mouse and touch controls with sensible distance/polar bounds and disabled pan so the island stays framed.
- **24-Hour Time of Day**: Smooth transitions across morning, golden late afternoon (`16:00` default), sunset, and readable starlit night with dynamic sun/moon direction, sky dome shader, and window glow.
- **Dynamic Weather (`Clear` / `Rain`)**: Pooled 3D rain streaks that collide with and recycle at the island surface, darkened storm clouds, softened sunlight, and expanding pond ripples.
- **Shared Wind State**: Controls windmill blade rotation speed, tree and wildflower sway, cloud drift, and rain slant. At `0%`, wind-driven motion stops while rain continues falling vertically.
- **Interactive Cottage Lights**: Click or tap directly on the cottage (without triggering on orbit drags) or use the synchronized UI toggle to illuminate the windows and warm porch light.
- **Responsive & Accessible UI**: Collapsible bottom sheet on narrow viewports, full keyboard focus support, `prefers-reduced-motion` awareness, and graceful WebGL fallback.

## Getting Started

### Prerequisites

- Node.js 20+ and npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Typecheck & Tests

```bash
npm run typecheck
npm test
```

### Production Build

```bash
npm run build
npm run preview
```
