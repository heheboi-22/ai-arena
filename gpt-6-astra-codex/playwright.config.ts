import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL: 'http://localhost:5122',
    viewport: { width: 1440, height: 1000 },
    channel: 'chromium',
    launchOptions: { args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5122',
    reuseExistingServer: !process.env.CI,
  },
});
