import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base wajib: tiap world disajikan di /<model-id>/ oleh Caddy, jadi
  // asset harus ./assets/... bukan /assets/... (kalau absolut, request-nya
  // keluar dari prefix dan jatuh ke route dashboard).
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
