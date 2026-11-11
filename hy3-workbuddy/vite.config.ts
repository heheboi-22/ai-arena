import { defineConfig } from 'vite';

// Relative base so the built app works when served from any sub-path
// (e.g. static hosting or a shareable folder).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
});
