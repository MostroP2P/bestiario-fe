import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { fileURLToPath } from 'node:url'

// `base` is the one variable that separates a project-page build from a
// custom-domain build (SPEC 10.2). Nothing else about the deployment differs.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [preact()],
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      thresholds: {
        // House rule: 80% overall. SPEC 12 raises the two modules where a
        // bug is silent to 100%.
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        'src/nostr/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/model/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  },
})
