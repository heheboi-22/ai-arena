import { defineConfig } from 'vite';

// `base: './'` keeps every asset URL relative, so the build works from any
// sub-path (the arena serves it under /<folder>/ behind Caddy).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
