import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end, against the built site and a fake relay.
 *
 * The bundle is what ships, so that is what is tested: `preview` serves
 * `dist/`, not the dev server. The relay is intercepted in the browser
 * (`tests/e2e/relay.ts`), so these runs are hermetic — a real relay would
 * make them flaky and would make the assertions about figures that move.
 */
const PORT = 4321

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Absent rather than undefined: `exactOptionalPropertyTypes` refuses the
  // second, and Playwright's own default is what we want off CI.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `--host 127.0.0.1` explicitly: vite binds `localhost`, which resolves
    // to ::1 here, and Playwright waits on 127.0.0.1.
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
