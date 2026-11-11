import { defineConfig } from 'vite';

// Relative asset URLs so the build also works when served from a sub-path
// (the arena serves every model under /<folder>/).
export default defineConfig({
  base: './',
  server: { port: 5137, strictPort: true },
  preview: { port: 5137, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
