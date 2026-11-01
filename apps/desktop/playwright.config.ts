import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../artifacts/desktop-test-results',
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
