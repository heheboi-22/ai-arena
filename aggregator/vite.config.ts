import react from '@vitejs/plugin-react';
import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const here = import.meta.dirname;

// /models.json is the roster this console reads. It stays at aggregator/models.json
// because the Dockerfile generator and arena.sh read it from there, so dev serves
// it through Vite and the build copies it next to index.html.
function modelsJson(): Plugin {
  return {
    name: 'arena-models-json',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== '/models.json') {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(path.join(here, 'models.json')));
      });
    },
    closeBundle() {
      copyFileSync(path.join(here, 'models.json'), path.join(here, 'dist', 'models.json'));
    },
  };
}

// base './' keeps the asset URLs relative, so the console also works when Caddy
// serves it from a subpath.
export default defineConfig({
  base: './',
  plugins: [react(), modelsJson()],
});
