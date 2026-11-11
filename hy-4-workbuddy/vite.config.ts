import { defineConfig } from 'vite';

// Relative base: the built bundle must work from any sub-path, since the arena
// serves each world at /<model-id>/ behind Caddy.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
