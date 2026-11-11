import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // Three.js is intentionally cached as a separate ~520 kB vendor chunk.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
