import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5120, strictPort: true },
  preview: { port: 5120, strictPort: true },
});
