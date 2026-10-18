import { defineConfig } from 'vite';

// base './' keeps asset URLs relative so the build works when served from a
// sub-path (local preview, arena reverse proxy, static file servers...).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
