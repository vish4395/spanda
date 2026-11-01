import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './src/global-setup.ts',
  outputDir: '../../artifacts/test-results',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: '../../artifacts/playwright-report', open: 'never' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
