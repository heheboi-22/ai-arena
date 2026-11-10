import { defineConfig } from 'vite';

// Relative asset URLs so the production build works from any sub-path
// (the arena serves each world under /<folder>/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
