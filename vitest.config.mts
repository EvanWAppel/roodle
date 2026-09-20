import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // In-process Postgres (PGlite) boot + migrate takes several seconds and
    // slows further under concurrency; give DB-backed tests headroom.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
});
