import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // W-01: migrate one PGlite template per run; createTestDb() loads it per test.
    globalSetup: ['./src/test/pgliteTemplate.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // W-01: every DB-backed file cold-boots PGlite's WASM in its worker. Capping
    // concurrency keeps that from thrashing a loaded machine, and the hook
    // timeout leaves headroom for the cold boot itself (see DECISIONS D17).
    maxWorkers: 4,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
});
