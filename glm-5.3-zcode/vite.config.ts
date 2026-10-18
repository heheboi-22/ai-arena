import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the static build also works behind the arena's
  // subpath proxy (/glm-5.3-zcode/) and any other subdirectory.
  base: './',
  build: {
    target: 'es2021',
    sourcemap: false,
  },
});
