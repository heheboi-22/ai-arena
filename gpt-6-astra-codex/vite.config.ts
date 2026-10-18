import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5122, strictPort: true },
  preview: { port: 5122, strictPort: true },
  build: {
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.endsWith('/three.core.js')) return 'three-core';
          if (id.includes('/node_modules/three/')) return 'three-renderer';
        },
      },
    },
  },
});
