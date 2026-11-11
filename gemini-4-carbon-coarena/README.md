# Pocket World

An interactive 3D floating-island miniature diorama built procedurally in the browser with **Three.js**, **Vite**, and **TypeScript**.

Every object, surface texture, cloud, raindrop, ripple, and sky transition is generated through code—with zero external 3D models, image textures, HDR environments, or runtime network dependencies.

## Features

- **Handcrafted Floating Island**: Irregular grassy meadow with overhanging turf lip, soil collar, faceted rocky underside spire, hanging roots, floating satellite shards, stepping-stone paths, rustic fences, mossy rocks, and wildflowers.
- **Architectural Landmarks**:
  - **Cottage**: Cream plaster walls, timber framing, shingled roof, stone chimney with gentle smoke, porch awning, flower boxes, reactive warm hearth windows, and porch lantern.
  - **Windmill**: Octagonal stone & plaster smock tower, timber gallery balcony, conical cap, and 4 lattice canvas sails driven by wind speed.
  - **Pond & Cascade**: Sandy shoreline, wooden jetty, swaying reeds, floating lily pads, pooled rain/ambient ripples, and a cliffside brook waterfall.
- **Interactive Environment Controls**:
  - **Camera**: Smooth damped `OrbitControls` with distance, polar-angle, and pan boundaries plus responsive desktop/mobile framing.
  - **Time of Day (00:00–24:00)**: Continuous 24-hour cycle controlling sun/moon positions, directional shadows, atmospheric sky shader, stars, fog, water tint, and window glow prominence.
  - **Weather (Clear / Rain)**: Smoothly transitions 3D obstacle-aware pooled rain streaks, storm-cloud darkening, softened sunlight, wet surface sheen, and pond ripples.
  - **Shared Wind Strength (0%–100%)**: Consistently drives windmill blade speed, tree/reed/flower sway, cloud drift, chimney smoke, and falling rain slant.
  - **House Lights**: Toggleable both by clicking/tapping the 3D cottage (distinguished from camera drag gestures) and via the synchronized UI control.
  - **Reset**: Smoothly restores initial camera framing, `16:00`, `Clear` weather, `30%` wind, and `House Lights: Off`.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start development server

```bash
npm run dev
```

### 3. Type-check and build for production

```bash
npm run build
```

### 4. Preview production build locally

```bash
npm run preview
```
