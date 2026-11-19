# Pocket World

Pocket World is a browser-based Three.js diorama of Willowmere, a floating meadow with a tiled cottage, a working windmill, and a pond. All geometry is procedural. Fonts and paper textures ship with the application.

## Run locally

Use Node.js 22.12 or newer and npm. From the project directory, install the locked dependencies and start Vite.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Check and build

```sh
npm run typecheck
npm run build
npm run preview
```

The build also runs the TypeScript check. The preview server normally listens at `http://localhost:4173`. Deploy the contents of `dist/` to a static web host. The application requires WebGL 2 and uses no backend or external runtime services.

## Play

- Drag or swipe to orbit. Scroll or pinch to zoom. Focus the island with Tab to use the arrow keys and + or −.
- Scrub the clock through a full day. Switch on rain to see drops and pond ripples.
- Adjust wind to change the sails, tree sway, drifting clouds, and rain angle together.
- Select the cottage or its light switch to illuminate the windows.
- Reset world restores the camera, 16:00, clear weather, 30% wind, and unlit windows.

On phones, tap the Environment heading to open or close the controls. The scene reduces decorative motion when the system requests reduced motion.

## Source

`src/state.ts` defines the shared settings. `src/ui.ts` binds the controls. The `src/world/` modules build the island, buildings, and garden, handle camera interaction, and animate the environment. Static meshes are batched inside each miniature. Rain reuses a line buffer and pond ripples share an instanced mesh.

Baskervville and DM Sans are bundled under the SIL Open Font License. License texts are in `public/fonts/`.
