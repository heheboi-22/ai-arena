# Pocket World — Interactive 3D Floating Island Diorama

**Pocket World** is a procedural, interactive 3D miniature floating island built with **Three.js**, **TypeScript**, and **Vite**. Every object, texture, shader, and particle system is generated entirely in code with zero external models or runtime asset dependencies.

## Features

- **Handmade Miniature Diorama**: Sculpted grassy plateau with an irregular organic silhouette, multi-tiered craggy rocky underside, hanging stalactite spires, and bobbing satellite islets.
- **Architectural & Environmental Details**:
  - **Cottage**: Stone foundation, cream stucco walls, exposed timber beams, shingled pitched roof, stone chimney with wind-drifting smoke puffs, front door with porch awning and hanging lantern, and paned windows with shutters and flower boxes.
  - **Windmill**: Octagonal stone and cream tower on a raised knoll with 4 rotating lattice canvas blades driven by the shared wind state.
  - **Pond & Shoreline**: Recessed sandy/pebbly shoreline basin, tranquil water surface, wooden pier dock, lily pads with lotus blossoms, shoreline pebbles, cattail reeds, stepping-stone paths, wooden fences, and a garden bench.
- **Interactive Environment & Controls**:
  - **Camera Orbit & Zoom**: Smoothly damped `OrbitControls` with distance and polar angle limits and click-vs-drag disambiguation.
  - **Time of Day (00:00 – 24:00)**: Smoothly transitions sun arc, directional lighting, moon rim light, sky dome gradient shader, twinkling night stars, and window glow prominence across Dawn, Morning, Midday, Afternoon, Sunset, Dusk, and Night.
  - **Weather (Clear / Rain)**: Smoothly introduces 3D wind-slanted rain streaks (which collide and recycle at the island surface rather than passing through the island), darker overcast clouds, softened sunlight, and expanding raindrop ripples on the pond.
  - **Wind Strength (0% – 100%)**: One shared wind state drives windmill blade speed, tree/reed/flower sway, cloud orbit speed, chimney smoke drift, and rain slant angle.
  - **House Lights**: Toggleable by clicking/tapping the 3D cottage or using the synchronized UI button.
  - **Reset**: Smoothly restores the camera and all controls to their default state (`16:00`, `Clear`, `30%` wind, `House Lights: Off`).

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

Open the local URL shown in the terminal (by default `http://localhost:5173`).

### 3. Type-Check and Build for Production

```bash
npm run build
```

### 4. Preview the Production Build

```bash
npm run preview
```

