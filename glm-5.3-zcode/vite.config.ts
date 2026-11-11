import { defineConfig } from 'vite';

// base './' so the production build works from any subpath (this arena serves
// each world behind /<folder>/ via Caddy).
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5132, strictPort: true },
  preview: { host: '127.0.0.1', port: 5132, strictPort: true },
});
